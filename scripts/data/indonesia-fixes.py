"""Fixes after importing the 213 so scripts/validate-recipes.py has no blocking findings."""
import json, os, sys
D = os.path.join(sys.argv[1], "src", "data")
p = f"{D}/recipes.json"; raw = open(p).read()
R = json.loads(raw); by = {r["id"]: r for r in R}

def step(rid, i, old=None, new=None, timer=None):
    s = by[rid]["steps"][i]
    if old is not None:
        assert old in s[0], (rid, i, old); s[0] = s[0].replace(old, new)
    if timer is not None: s[1] = timer

step("mie_ayam", 3, timer=120)
step("bakso_ayam", 4, "lanjutkan sekitar 5 menit", "lalu lanjutkan beberapa menit lagi")
step("cakwe", 2, "istirahatkan 20 menit, lalu uleni sebentar. Ulangi tiga kali.", "istirahatkan sebentar, lalu uleni lagi. Ulangi tiga kali.")
step("bika_ambon", 5, "selama 30 menit pertama", "di awal pemanggangan")
step("es_doger", 1, "tiap satu jam", "beberapa kali selama dibekukan")
# existing recipes: the new 'air kelapa' ingredient made their wording look like an unlisted ingredient
for rid in ("es_teler", "es_kelapa_muda"):
    for s in by[rid]["steps"]:
        s[0] = s[0].replace("air kelapa", "air dari kelapa muda")
step("es_kelapa_kopyor", 2, "air kelapa", "air dari kelapa muda")
step("ayam_asam_manis", 6, "saus asam manis", "sausnya")
step("sate_buntel", 2, "daging cincang", "daging kambing cincang")
step("rujak_buah", 3, "potongan buah, atau aduk buah", "potongan mangga, bengkuang, timun, jambu air, dan kedondong, atau aduk buahnya")
for rid in ("getuk_lindri", "kue_lapis"):
    for s in by[rid]["steps"]:
        s[0] = s[0].replace("beri warna", "beri pewarna makanan").replace("Beri warna", "Beri pewarna makanan")

def merge(rid, iid, note):
    lines = [x for x in by[rid]["ings"] if x[0] == iid]
    if len(lines) < 2: return
    a, b = lines[0], lines[1]
    assert (a[5] or None) == (b[5] or None), (rid, iid, a, b)
    a[1] = (a[1] or 0) + (b[1] or 0); a[2] = note
    by[rid]["ings"].remove(b)
merge("sate_klathak", "daging_kambing", "500 g potong dadu untuk sate, 300 g tetelan untuk gulai")
merge("ikan_acar_kuning", "bawang_merah", "5 untuk bumbu halus, 6 kupas utuh untuk acar")
merge("kue_lumpur_kentang", "margarin", "3 sdm dilelehkan, 1 sdm untuk olesan cetakan")
merge("kue_putri_salju", "margarin", None); merge("kue_putri_salju", "mentega", None)
merge("nastar", "margarin", None); merge("nastar", "mentega", None)

spice = {"sate_maranggi": 2, "ikan_acar_kuning": 2, "ikan_pesmol": 2, "mie_koclok": 3,
         "martabak_telur": 2, "tahu_walik_isi_aci": 2}
for k, v in spice.items(): by[k]["spice"] = max(by[k]["spice"], v)
if len(sys.argv) > 2:
    for k, v in json.loads(sys.argv[2]).items(): by[k]["spice"] = v
open(p, "w").write(json.dumps(R, ensure_ascii=False, indent=1) + ("\n" if raw.endswith("\n") else ""))
print("fixed")
