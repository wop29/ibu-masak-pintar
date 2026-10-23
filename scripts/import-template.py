#!/usr/bin/env python3
"""Add recipes from a filled 'Racik - Template Resep Baru' workbook.

Usage: python3 scripts/import-template.py <workbook.xlsx> [new_ingredients.json]

Reads the Resep / Bahan / Langkah tabs (CONTOH rows skipped), maps every
ingredient name to the catalogue (name or alias, case-insensitive), and appends
the recipes to src/data/recipes.json in Racik's own shape. New ingredients
(names not in the catalogue) must be defined in the optional JSON file:
  {"ingredients":[{id,name,cat,halal,unit,staple,aliases,em}],
   "tables":{"BERAT":{},"PROT100":{},"CARB100":{},"FAT100":{},"FIBER100":{},"SUBS":{}},
   "fat_sources":{id:{src,yakin}}, "rename":{"Name in sheet":"catalogue id"},
   "regions":[{id,name,desc}], "step_replace":{"recipe title":[["old","new"]]}}
Fails loudly on anything it cannot place. Run scripts/validate-recipes.py after.
"""
import json, os, re, sys
from openpyxl import load_workbook

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data")
wbpath = sys.argv[1]
extra = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else {}

recipes = json.load(open(f"{D}/recipes.json"))
ings = json.load(open(f"{D}/ingredients.json"))
tables = json.load(open(f"{D}/tables.json"))
regions = json.load(open(f"{D}/regions.json"))
fatsrc = json.load(open(f"{D}/fat-sources.json"))

# --- new catalogue entries first, so names resolve
have = {i["id"] for i in ings}
for ing in extra.get("ingredients", []):
    if ing["id"] not in have:
        ings.append(ing); have.add(ing["id"])
for tname, entries in extra.get("tables", {}).items():
    tables.setdefault(tname, {}).update(entries)
fatsrc.update(extra.get("fat_sources", {}))
for g in extra.get("regions", []):
    if g["id"] not in {x["id"] for x in regions}:
        regions.append(g)

ING = {i["id"]: i for i in ings}
by_name = {}
for i in ings:
    for n in [i["name"], *i.get("aliases", [])]:
        by_name.setdefault(n.strip().lower(), i["id"])
rename = {k.strip().lower(): v for k, v in extra.get("rename", {}).items()}
region_by_name = {g["name"].lower(): g["id"] for g in regions} | {g["id"]: g["id"] for g in regions}

def slug(title):
    s = title.lower()
    s = re.sub(r"[’'\",.()]", "", s)
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s

wb = load_workbook(wbpath, data_only=True)
def rows(name):
    return [r for r in wb[name].iter_rows(min_row=3, values_only=True)
            if r[0] and not str(r[0]).startswith("CONTOH")]

R, B, L = rows("Resep"), rows("Bahan"), rows("Langkah")
existing = {r["id"] for r in recipes}
errors, added = [], []
step_fix = extra.get("step_replace", {})

def num(v):
    if v is None or v == "": return None
    if isinstance(v, str): v = float(v.replace(",", "."))
    return int(v) if float(v).is_integer() else round(float(v), 3)

for r in R:
    title = str(r[0]).strip()
    rid = slug(title)
    if rid in existing:
        errors.append(f"{title}: id {rid} already exists"); continue
    region = region_by_name.get(str(r[2]).strip().lower())
    if not region:
        errors.append(f"{title}: unknown region {r[2]}"); continue
    lines = sorted([b for b in B if str(b[0]).strip() == title], key=lambda b: num(b[1]) or 0)
    steps = sorted([s for s in L if str(s[0]).strip() == title], key=lambda s: num(s[1]) or 0)
    if not lines or not steps:
        errors.append(f"{title}: {len(lines)} ingredients, {len(steps)} steps"); continue
    out_ings = []
    for b in lines:
        name = str(b[2]).strip()
        iid = rename.get(name.lower()) or by_name.get(name.lower())
        if not iid:
            errors.append(f"{title}: ingredient not in catalogue: {name}"); continue
        unit = (b[4] or "").strip() or None
        override = unit if unit and unit != ING[iid]["unit"] else None
        pantry = 1 if str(b[7] or "").strip().lower() == "ya" or iid == "air" else None
        out_ings.append([iid, num(b[3]), (b[5] or None), (b[6] or None), pantry, override])
    fixes = step_fix.get(title, [])
    out_steps = []
    for s in steps:
        text = str(s[2]).strip()
        for old, new in fixes: text = text.replace(old, new)
        mins = num(s[3])
        out_steps.append([text, None if mins is None else int(round(mins * 60))])
    slots = [x for x in (r[3], r[4], r[5]) if x]
    alat = [x for x in (r[13], r[14], r[15]) if x]
    rec = {
        "id": rid, "title": title, "region": region, "slots": slots,
        "serv": int(num(r[6])), "time": int(num(r[7])), "diff": r[8], "spice": int(num(r[9]) or 0),
        "glyph": r[10] or "🍽️", "note": str(r[11]).strip(), "ings": out_ings, "steps": out_steps,
        "precise": str(r[16] or "").strip().lower() == "ya", "imported": False,
    }
    if r[12]: rec["persiapan"] = str(r[12]).strip()
    if alat: rec["alat"] = alat
    if r[17]: rec["suhu"] = str(r[17])
    if r[18]: rec["hasil"] = str(r[18])
    if r[19]: rec["satuan"] = str(r[19])
    if r[20]: rec["kategori"] = str(r[20]).strip()
    recipes.append(rec); existing.add(rid); added.append(rid)

if errors:
    print("NOT WRITTEN —", len(errors), "problems:"); [print(" -", e) for e in errors]; sys.exit(1)

def dump(path, obj):
    raw = open(path).read()
    indent = 1 if raw.startswith("[\n {") or raw.startswith("{\n \"") else (2 if raw.startswith("[\n  ") or raw.startswith("{\n  ") else None)
    open(path, "w").write(json.dumps(obj, ensure_ascii=False, indent=indent) + ("\n" if raw.endswith("\n") else ""))

dump(f"{D}/recipes.json", recipes); dump(f"{D}/ingredients.json", ings)
dump(f"{D}/tables.json", tables); dump(f"{D}/regions.json", regions); dump(f"{D}/fat-sources.json", fatsrc)
print(f"added {len(added)} recipes; catalogue now {len(ings)} ingredients")
