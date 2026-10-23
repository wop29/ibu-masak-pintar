#!/usr/bin/env python3
"""Validator fixes for the 100 Filipino recipes (23 Oct 2026). Idempotent."""
import json, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "data")
p = f"{D}/recipes.json"; R = json.load(open(p)); by = {r["id"]: r for r in R}
pi = f"{D}/ingredients.json"; I = json.load(open(pi))

def step(rid, n, old, new):
    s = by[rid]["steps"][n - 1]; s[0] = s[0].replace(old, new)
def all_steps(rid, old, new):
    for s in by[rid]["steps"]: s[0] = s[0].replace(old, new)
def line(rid, iid):
    # Idempotent: a line already fixed returns a throwaway copy.
    return next((l for l in by[rid]["ings"] if l[0] == iid), [iid, 0, None, None, None, "x"])

# timers and overnight work
step("chicken_inasal", 2, "diamkan minimal 30 menit (lebih baik semalaman di kulkas)", "diamkan 30 menit")
step("tapang_baka", 1, "Rendam minimal 20 menit (lebih baik semalaman).", "Rendam 20 menit.")
by["tapang_baka"]["persiapan"] = "Untuk hasil terbaik, rendam daging dalam bumbu semalaman di kulkas."
step("sapin_sapin", 3, "kukus tiap lapisan sekitar 10 menit sebelum menuang lapisan berikutnya.", "kukus tiap lapisan sampai set sebelum menuang lapisan berikutnya, total sekitar 30 menit.")
by["sisig_babi"]["spice"] = 2
# steps name what the list holds
line("menudo", "kacang_hijau")[0] = "kapri"
for rid in ("giniling", "pancit_molo", "batchoy", "lomi"): all_steps(rid, "daging cincang", "babi cincang")
all_steps("chopsuey", "kembang kol", "brokoli")
all_steps("lumpiang_shanghai", "daging babi, daging sapi", "babi cincang, daging giling")
t = line("taho", "tahu"); t[0] = "tahu_sutra"
if t[5] is None: t[5] = "potong" if t[1] else None
all_steps("banana_ketchup", "seperti saus tomat", "seperti saus botolan")
all_steps("embutido", "dan acar di tengah", "dan acar timun di tengah")
all_steps("morcon", "wortel, acar, dan sosis", "wortel, acar timun, dan sosis")
all_steps("pancit_canton", "Masukkan mi,", "Masukkan mie telur,")
all_steps("mami", "Tata mi ", "Tata mie telur ")
# amounts written as text
for rid in ("bulalo", "nilagang_baka", "pochero", "pancit_canton", "pancit_bihon_guisado", "lomi"):
    l = line(rid, "kol")
    if l[1] is None: l[1], l[3] = 300, None   # ¼ kol sedang (TAKAR kol sedang = 1200 g)
for rid in ("rellenong_bangus", "lumpiang_shanghai", "empanada_filipina", "atchara"):
    l = line(rid, "bawang_bombay")
    if l[1] is None: l[1], l[3] = 0.5, None
l = line("banana_ketchup", "bawang_putih_bubuk")
if l[1] is None: l[1], l[3] = 0.5, None

# water is a kitchen staple, never bought or counted
for r in R:
    if r["region"] == "filipina":
        for l in r["ings"]:
            if l[0] == "air": l[4] = 1
# crispy pata is pork hock: a separate entry so the bone is not counted as meat
pt = f"{D}/tables.json"; T = json.load(open(pt))
pf = f"{D}/fat-sources.json"; FS = json.load(open(pf))
if not any(i["id"] == "kaki_babi" for i in I):
    I.append({"id": "kaki_babi", "name": "Kaki babi (pata)", "cat": "daging", "halal": "haram", "unit": "gram", "staple": 0, "aliases": ["pata", "pork hock", "kaki babi"], "em": "🍖"})
T["PROT100"]["kaki_babi"] = 18.5; T["CARB100"]["kaki_babi"] = 0; T["FAT100"]["kaki_babi"] = 16; T["EDIBLE"]["kaki_babi"] = 0.6
FS["kaki_babi"] = {"src": "Perkiraan: USDA Pork, fresh, leg (ham), whole, raw; bagian yang dimakan ±60% (sisanya tulang)", "yakin": False}
line("crispy_pata", "daging_babi")[0] = "kaki_babi"
json.dump(T, open(pt, "w"), ensure_ascii=False, indent=1); open(pt, "a").write("\n")
json.dump(FS, open(pf, "w"), ensure_ascii=False, indent=1); open(pf, "a").write("\n")

# deep-frying oil: most of it stays in the pan, so it is a shopping note, not an eaten amount
for r in R:
    if r["region"] != "filipina": continue
    for l in r["ings"]:
        if l[0] == "minyak_goreng" and l[1] and l[5] == "ml" and l[1] >= 150:
            l[3] = f"± {l[1]} ml, untuk menggoreng"; l[1] = None; l[5] = None; l[2] = None

# countables Racik cannot weigh → grams
def regram(rid, iid, unit_was, grams, unit=None):
    l = next((l for l in by[rid]["ings"] if l[0] == iid and l[5] == unit_was), None)
    if l: l[1], l[5] = grams, unit
regram("pesang_isda", "sawi_putih", "buah", 500)      # one small napa cabbage
regram("turon", "nangka", "lembar", 60)              # 6 thin strips
regram("halo_halo", "nangka", "lembar", 40)          # 4 strips
l = next((l for l in by["leche_flan"]["ings"] if l[0] == "susu_evaporasi" and l[5] == "kaleng"), None)
if l: l[1], l[5], l[2] = 370, None, "1 kaleng"
# wrappers, powder and sauce had no macros in the catalogue
for k, (p_, c_, f_, fi_, src) in {
    "kulit_pangsit": (9.8, 57.9, 1.5, 1.8, "USDA FDC SR Legacy: Wonton wrappers (includes egg roll wrappers)"),
    "kulit_lumpia": (9.8, 57.9, 1.5, 1.8, "USDA FDC SR Legacy: Wonton wrappers (includes egg roll wrappers)"),
    "kaldu_bubuk": (16.7, 18.0, 13.9, 0.0, "USDA FDC SR Legacy: Soup, chicken broth or bouillon, dry"),
    "saus_tartar": (1.0, 13.3, 22.2, 0.5, "USDA FDC SR Legacy: Sauce, tartar, ready-to-serve"),
}.items():
    T["PROT100"].setdefault(k, p_); T["CARB100"].setdefault(k, c_); T["FAT100"].setdefault(k, f_); T["FIBER100"].setdefault(k, fi_)
    FS.setdefault(k, {"src": src, "yakin": True})
json.dump(T, open(pt, "w"), ensure_ascii=False, indent=1); open(pt, "a").write("\n")
json.dump(FS, open(pf, "w"), ensure_ascii=False, indent=1); open(pf, "a").write("\n")

# margarine written in grams (the catalogue's own unit is sdm)
for rid in ("empanada_filipina", "pandesal", "ensaymada", "pan_de_coco", "polvoron", "otap", "bibingka", "ube_halaya"):
    for l in by[rid]["ings"]:
        if l[0] == "margarin" and l[5] is None and l[1] and l[1] >= 30: l[5] = "gram"

g = next(i for i in I if i["id"] == "gherkin")
if "acar timun" not in g["aliases"]: g["aliases"].append("acar timun")
json.dump(R, open(p, "w"), ensure_ascii=False, indent=1); open(p, "a").write("\n")
json.dump(I, open(pi, "w"), ensure_ascii=False, indent=1); open(pi, "a").write("\n")
print("fixed")
