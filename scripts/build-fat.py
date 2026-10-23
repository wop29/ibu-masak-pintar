"""Write FAT100 (+ CANNED100[*].L) into src/data/tables.json and the per-entry
sources into src/data/fat-sources.json. Run from the repo root:
    python3 scripts/build-fat.py
Checks that every ingredient with a protein or carb value, and every
ingredient a shipped recipe weighs, has a fat value."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fat_values import CANNED_FAT, FAT  # noqa: E402

TABLES = "src/data/tables.json"
SOURCES = "src/data/fat-sources.json"

raw = open(TABLES, encoding="utf-8").read()
t = json.loads(raw)
recipes = json.load(open("src/data/recipes.json", encoding="utf-8"))
ing = {i["id"] for i in json.load(open("src/data/ingredients.json", encoding="utf-8"))}

unknown = sorted(k for k in FAT if k not in ing)
if unknown:
    sys.exit(f"ids not in ingredients.json: {unknown}")
need = set(t["PROT100"]) | set(t["CARB100"])
need |= {l[0] for r in recipes for l in r["ings"] if l[1] is not None and not l[4]}
missing = sorted(need - set(FAT))
if missing:
    sys.exit(f"no fat value for: {missing}")

t["FAT100"] = {k: FAT[k][0] for k in sorted(FAT)}
for k, v in CANNED_FAT.items():
    t["CANNED100"][k]["L"] = v

indent = 1 if raw.startswith("{\n ") else None
with open(TABLES, "w", encoding="utf-8") as f:
    json.dump(t, f, ensure_ascii=False, indent=indent)
    if raw.endswith("\n"):
        f.write("\n")
with open(SOURCES, "w", encoding="utf-8") as f:
    json.dump({k: {"src": FAT[k][1], "yakin": FAT[k][2]} for k in sorted(FAT)}, f, ensure_ascii=False, indent=1)
    f.write("\n")
print(f"FAT100: {len(FAT)} ids; perlu dicek: {sum(1 for v in FAT.values() if not v[2])}")
