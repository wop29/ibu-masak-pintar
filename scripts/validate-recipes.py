#!/usr/bin/env python3
"""Racik recipe validator.

Checks the shipped catalogue for the defects that make a recipe unfollowable
for someone who has never cooked the dish. It cannot judge flavour. It can
judge coherence, and incoherence is most of what makes a recipe fail.

Every rule here is self-referential: it compares the recipe against its own
ingredient list, its own steps and the project's own tables. No outside
culinary knowledge is assumed, so a failure is always a real contradiction
in the data rather than a matter of taste.
"""
import json
import os
import re
import sys
from collections import defaultdict

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data")
rec = json.load(open(f"{D}/recipes.json"))
ings = json.load(open(f"{D}/ingredients.json"))
tab = json.load(open(f"{D}/tables.json"))

ING = {i["id"]: i for i in ings}
BERAT, TAKAR, PROT100 = tab["BERAT"], tab["TAKAR"], tab["PROT100"]
REGIONS = {g["id"] for g in json.load(open(f"{D}/regions.json"))}

# Ingredients a step may legitimately leave unnamed, because Indonesian recipe
# language implies them: you do not write "tambahkan minyak" before "tumis",
# and seasonings are referred to collectively as "bumbu".
IMPLICIT = {
    "minyak_goreng", "air", "garam", "gula_pasir", "gula_merah", "merica",
    "pala", "kaldu_bubuk", "penyedap", "margarin", "mentega",
}

# Categories whose quantity may honestly be "secukupnya". Everything else
# needs a number: this is the secukupnya rule.
SEASONING_IDS = {
    "garam", "gula_pasir", "gula_merah", "merica", "pala", "kaldu_bubuk",
    "penyedap", "air", "minyak_goreng", "lada_hitam", "ketumbar", "kayu_manis", "cengkeh",
    "jinten", "kunyit_bubuk", "vanili", "baking_powder", "soda_kue",
}


def words(ing_id):
    """Every string that could refer to this ingredient in a step.

    Deliberately NOT including the first word on its own: matching "bawang"
    would let bawang_bombay claim every mention of bawang merah, which made
    an earlier version of this script report 1,096 phantom findings.
    """
    i = ING.get(ing_id)
    if not i:
        return [ing_id.replace("_", " ")]
    out = [i["name"].lower()] + [a.lower() for a in i.get("aliases", [])]
    out.append(ing_id.replace("_", " "))
    return sorted(set(out), key=len, reverse=True)


# "Campur semua bumbu halus", "Tumis bumbu halus" — the standard Indonesian
# way of writing a spice paste. When a recipe says this, the individual
# bumbu are accounted for and must not be reported as unused.
PASTE = re.compile(r"bumbu(\s+\w+)?\s*(halus|dasar)|semua bumbu|bumbu yang dihaluskan")

# "Masukkan semua sayuran mentah" — the same blanket, for produce.
VEG_BLANKET = re.compile(r"sayuran|semua sayur|semua buah")

# "Buat bumbu kacang seperti siomay", "Buat adonan pempek lenjer" — the step
# sends the cook to a different recipe. The ingredients for that sub-recipe
# sit in the list with no instructions attached, which is why this rule
# exists: found while checking the unused-ingredient findings by hand.
# Matching "seperti" alone catches similes — "kental seperti lem", "lipat
# seperti amplop". The reference only counts when what follows names another
# recipe in the catalogue, so DISH_WORDS is built from the titles themselves.
DISH_WORDS = set()
for _r in rec:
    for _w in re.split(r"\W+", _r["title"].lower()):
        if len(_w) > 4:
            DISH_WORDS.add(_w)
# "adonan X" names a dough by its next word only; "seperti" may take two.
DEFER_CUE = re.compile(r"(?:seperti\s+((?:\w+\s+)?\w+)|adonan\s+(\w+))")


def defers_to(text, before=""):
    """The other recipe this step sends the cook to without saying how.

    A step containing a colon is writing the sub-recipe out inline — "Buat
    sambal: rebus cabai, bawang merah, dan tomat" needs no cross-reference
    and must not be flagged. Tuned for precision: it would rather miss a
    deferral than cry wolf, because a validator people stop trusting is
    worse than no validator.
    """
    if ":" in text:
        return None
    for m in DEFER_CUE.finditer(text):
        for w in (m.group(1) or m.group(2)).split():
            # Made in an earlier step of this recipe ("Buat kulit: …", "Parut
            # singkong …"): the cook has already been told how.
            if w in DISH_WORDS and w not in before:
                return w
    return None
# "Tata semua bahan di piring" covers everything, whatever its category.
ALL_BLANKET = re.compile(r"semua bahan")


def heads(ing_id):
    """The short forms a step may use: cabai_merah -> cabai, beras_ketan ->
    ketan, mie_telur -> mie. A step reading "Masukkan cabai" covers both
    cabai_merah and cabai_rawit. Safe when asking "was this ever referred
    to?", unsafe in the other direction — see words().
    """
    parts = [p for p in ing_id.split("_") if len(p) >= 3]
    return [parts[0]] + ([parts[-1]] if len(parts) > 1 else [])


# Ids that the same words legitimately cover: "jeruk nipis" in a step when the
# list has air_jeruk_nipis, "potongan ayam" for a whole chicken cut up.
EQUIV = {
    "air_jeruk_nipis": ("jeruk_nipis",), "jeruk_nipis": ("air_jeruk_nipis",),
    "ayam_utuh": ("ayam",), "ayam": ("ayam_utuh",),
}
# Generic phrasings that name a kind, not a specific listed ingredient.
GENERIC = {"fillet ikan": "ikan_", "daging ikan": "ikan_"}

# A mention inside these clauses is a serving idea or a swap, not a step the
# cook must buy for: "Sajikan dengan plecing kangkung", "atau couscous",
# "bisa diganti keju feta", "Sebagai variasi, saus BBQ …".
SERVE = re.compile(r"\b(sajikan|hidangkan|santap|nikmati)\b")
ALT = re.compile(r"\b(atau|diganti|pengganti|menggantikan|variasi|bila suka|kalau suka|kalau ada|opsional)\b")


def optional_mention(text, pos):
    """True when the word at pos sits in a serving or alternative clause."""
    start = max(text.rfind(".", 0, pos), text.rfind(";", 0, pos), text.rfind("(", 0, pos)) + 1
    clause = text[start:pos]
    return bool(SERVE.search(clause) or ALT.search(clause))


findings = defaultdict(list)


def flag(rule, rid, detail):
    findings[rule].append((rid, detail))


# --- durations written in a step: "dua jam", "10–15 menit", "setengah jam", "semalaman"
WORDNUM = {
    "satu": 1, "dua": 2, "tiga": 3, "empat": 4, "lima": 5, "enam": 6, "tujuh": 7,
    "delapan": 8, "sembilan": 9, "sepuluh": 10, "sebelas": 11, "dua belas": 12,
    "lima belas": 15, "dua puluh": 20, "dua puluh lima": 25, "tiga puluh": 30,
    "empat puluh": 40, "empat puluh lima": 45, "lima puluh": 50, "enam puluh": 60,
    "setengah": 0.5, "seperempat": 0.25, "satu setengah": 1.5, "dua setengah": 2.5,
    "tiga perempat": 0.75,
}
_NUM = r"(\d+(?:[.,]\d+)?½?|½|" + "|".join(sorted(WORDNUM, key=len, reverse=True)) + r")"
_UNIT = {"detik": 1, "menit": 60, "mnt": 60, "jam": 3600}
_U = r"(detik|menit|mnt|jam)\b"
_RANGE = re.compile(r"\b" + _NUM + r"\s*(?:[–-]|sampai|hingga|atau)\s*" + _NUM + r"\s+" + _U)
_SINGLE = re.compile(r"\b" + _NUM + r"\s*" + _U)
_OVERNIGHT = re.compile(r"\b(semalam(?:an)?|satu malam)\b")
_PER_SIDE = re.compile(r"\b(per|tiap|setiap|masing-masing)\s+sisi\b")


def _num(tok):
    if tok in WORDNUM:
        return WORDNUM[tok]
    half = tok.endswith("½")
    tok = tok.rstrip("½")
    return (float(tok.replace(",", ".")) if tok else 0) + (0.5 if half else 0)


def durations(text):
    """([(lo_s, hi_s), …], overnight?) for the durations a step names."""
    text = text.lower()
    out, taken = [], []
    for m in _RANGE.finditer(text):
        u = _UNIT[m.group(3)]
        lo, hi = _num(m.group(1)) * u, _num(m.group(2)) * u
        out.append((lo, hi))
        if _PER_SIDE.match(text, m.end() + 1):
            out.append((lo * 2, hi * 2))  # one timer per side, or one for both
        taken.append(m.span())
    for m in _SINGLE.finditer(text):
        if any(a <= m.start() < b for a, b in taken):
            continue
        v = _num(m.group(1)) * _UNIT[m.group(2)]
        out.append((v, v))
        if _PER_SIDE.match(text, m.end() + 1):
            out.append((v * 2, v * 2))
    return out, bool(_OVERNIGHT.search(text))


def timer_ok(timer, spans):
    """The timer matches one named duration, or all of them added up (±10%)."""
    def within(lo, hi):
        return lo * 0.9 - 30 <= timer <= hi * 1.1 + 30
    return any(within(lo, hi) for lo, hi in spans) or within(
        sum(x[0] for x in spans), sum(x[1] for x in spans))


# --- heat: chillies per portion in cabai-rawit equivalents (mirrors fix data)
HEAT = {"cabai_rawit": 1, "cabai_merah": 0.35, "cabai_hijau": 0.25, "cabai_kering": 0.5,
        "cabai_bubuk": 0.5, "cabai_habanero": 3, "cabai_jalapeno": 0.5, "cabai_chipotle": 0.7,
        "gochujang": 0.8, "gochugaru": 1.5, "saus_sambal": 0.5, "andaliman": 1}


def heat(r):
    s = 0
    for x in r["ings"]:
        if x[0] in HEAT and x[1]:
            q = x[1]
            if x[5] == "gram" and ING.get(x[0], {}).get("unit") != "gram":
                q = q / BERAT.get(x[0], 1)
            s += HEAT[x[0]] * q
    return s / r["serv"]


# --- BERAT: grams per household unit must be believable for that unit.
# Ranges are wide on purpose; they catch a copied default (a chilli at 120 g,
# a clove at 15 g), not a disagreement about the size of a potato.
BERAT_RANGE = {
    "siung": (2, 15), "butir": (0.05, 600), "ruas": (3, 40), "batang": (1, 150),
    "lembar": (0.1, 300), "ikat": (25, 400), "papan": (40, 400), "potong": (10, 200),
    "ekor": (15, 4000), "bungkus": (5, 500), "piring": (100, 300), "gelas": (100, 250),
    "kaleng": (100, 600), "kotak": (100, 1000), "sachet": (5, 50), "kuntum": (5, 400),
    "kantong": (1, 5), "sdm": (4, 25), "sdt": (0.1, 7), "buah": (0.2, 3000),
}
# Small by nature: a buah of these weighs a few grams at most.
BERAT_SMALL = {"cabai_rawit": 5, "cabai_merah": 15, "cabai_hijau": 25, "cabai_kering": 5,
               "bunga_lawang": 5, "cengkeh": 1, "kapulaga": 1, "kayu_manis": 10,
               "jeruk_limau": 50, "belimbing_wuluh": 25, "daun_salam": 2, "daun_jeruk": 2,
               "daun_kari": 1, "kemiri": 6, "kerupuk_udang": 15}
for _id, _g in BERAT.items():
    _u = ING.get(_id, {}).get("unit")
    _lo, _hi = BERAT_RANGE.get(_u, (0, 1e9))
    if not (_lo <= _g <= _hi) or _g > BERAT_SMALL.get(_id, 1e9):
        flag("implausible gram weight (BERAT)", _id, f"{_g} g per {_u}")


for r in rec:
    rid = r["id"]
    steptext = " ".join((s[0] or "") for s in r["steps"]).lower()
    ids = [x[0] for x in r["ings"]]

    # --- structural ---
    if len(ids) != len(set(ids)):
        dupes = {i for i in ids if ids.count(i) > 1}
        flag("duplicate ingredient line", rid, ", ".join(sorted(dupes)))
    if not r.get("serv"):
        flag("no serving count", rid, "")
    if len(r["steps"]) < 3:
        flag("fewer than three steps", rid, f"{len(r['steps'])} steps")
    if not (r.get("note") or "").strip():
        flag("no note", rid, "")

    # --- unresolved ids: the engine goes dark on these ---
    for x in r["ings"]:
        if x[0] not in ING:
            flag("ingredient id not in ontology", rid, x[0])

    # --- bought and never used ---
    has_paste = bool(PASTE.search(steptext))
    has_veg = bool(VEG_BLANKET.search(steptext))
    # "semua bahan" accounts for the whole list. Guard only this rule — an
    # earlier draft used `continue` here and silently skipped every later
    # check for those recipes.
    has_all = bool(ALL_BLANKET.search(steptext))
    for x in ([] if has_all else r["ings"]):
        iid, prep = x[0], (x[2] or "")
        cat = ING.get(iid, {}).get("cat")
        if iid in IMPLICIT:
            continue
        if any(w in steptext for w in words(iid)):
            continue
        if any(re.search(r"\b" + h, steptext) for h in heads(iid)):
            continue  # referred to by a short form or collective noun
        if has_paste and (cat == "bumbu" or "halus" in prep):
            continue  # covered by a spice-paste instruction
        if has_veg and cat == "sayur":
            continue  # covered by "semua sayuran"
        flag("in list, never used in any step", rid, iid)

    # --- used but never listed (the water-bug class, generalised) ---
    listed = set(ids)
    listed |= {e for i in ids for e in EQUIV.get(i, ())}
    listed_text = " ".join(w for i in listed for w in words(i))
    for cand in ING:
        if cand in listed or cand in IMPLICIT:
            continue
        for w in words(cand):
            if len(w) < 6 or " " not in w and len(w) < 8:
                continue  # single short words are too ambiguous to trust
            if w in listed_text:
                continue  # a listed ingredient already accounts for this text
            generic = GENERIC.get(w)
            if generic and any(i.startswith(generic) for i in ids):
                continue  # "fillet ikan" when an ikan_* is listed
            hit = None
            for st in r["steps"]:
                m = re.search(r"\b" + re.escape(w) + r"\b", st[0].lower())
                if m and not optional_mention(st[0].lower(), m.start()):
                    hit = m
                    break
            if hit:
                flag("used in a step, not in the list", rid, f'{cand} ("{w}")')
                break

    # --- the secukupnya rule ---
    for x in r["ings"]:
        iid, qty, note = x[0], x[1], (x[3] or "")
        if qty is None and iid not in SEASONING_IDS:
            flag("no quantity on a load-bearing ingredient", rid,
                 f"{iid}" + (f" (\"{note}\")" if note else " (no note either)"))

    # --- a step that defers to another recipe ---
    own = {w for w in re.split(r"\W+", r["title"].lower()) if len(w) > 4}
    own |= {w for x in ids for w in words(x)}
    for n, s in enumerate(r["steps"], 1):
        if not s[0]:
            continue
        before = " ".join(t[0].lower() for t in r["steps"][: n - 1])
        ref = defers_to(s[0].lower(), before)
        if ref and ref not in own:
            flag("step defers to another recipe", rid,
                 f'step {n} → "{ref}": {s[0][:60]}')
            break

    # --- internal time contradiction ---
    timers = [s[1] for s in r["steps"] if s[1]]
    # A 5-minute overrun is rounding. A 20%+ overrun means someone planning
    # dinner around the stated time will be caught out.
    if timers and r.get("time"):
        total_min = sum(timers) / 60
        over = total_min - r["time"]
        if over > 5 and total_min > r["time"] * 1.2:
            flag("timers exceed the stated total time", rid,
                 f"steps total {total_min:.0f} min, recipe says {r['time']} "
                 f"min (+{over / r['time'] * 100:.0f}%)")
    if not timers:
        flag("no step timers at all", rid, "cook mode shows no countdown")

    # --- a timer that says something different from its own step ---
    for n, st in enumerate(r["steps"], 1):
        spans, overnight = durations(st[0])
        conditional = re.search(r"\b(kalau|jika|bila|boleh|sudah)\b[^.]*semalam", st[0].lower())
        if overnight and not conditional:
            if st[1]:
                flag("timer contradicts its step text", rid,
                     f"step {n}: overnight in the text, {st[1]}s timer")
            if not r.get("persiapan"):
                flag("overnight work without persiapan", rid, f"step {n}: {st[0][:60]}")
            continue
        if st[1] and spans and not timer_ok(st[1], spans):
            flag("timer contradicts its step text", rid,
                 f"step {n}: timer {st[1] // 60} min, text says "
                 + " / ".join(f"{lo / 60:g}–{hi / 60:g} min" if lo != hi else f"{lo / 60:g} min" for lo, hi in spans))

    # --- an amount the list cannot draw (¼ ½ ¾ only) ---
    for x in r["ings"]:
        if x[1] is not None and round((x[1] - int(x[1])) * 100) not in (0, 25, 50, 75):
            flag("authored amount the list cannot draw", rid, f"{x[0]} = {x[1]}")

    # --- chillies in the pot, spice level 0 or 1 ---
    h = heat(r)
    need = 2 if h >= 1.5 else 1 if h >= 0.3 else 0
    if r["spice"] < need:
        flag("spice level below its chillies", rid,
             f"spice {r['spice']}, {h:.1f} cabai-rawit equivalents per portion")

    if r.get("region") not in REGIONS:
        flag("region not in regions.json", rid, str(r.get("region")))

    # --- can a protein figure be produced? ---
    missing = [x[0] for x in r["ings"]
               if x[1] is not None and x[0] in ING
               and x[0] not in PROT100 and x[0] not in BERAT]
    prot_ids = [x[0] for x in r["ings"] if x[0] in PROT100]
    if not prot_ids:
        flag("no protein data for any ingredient", rid, "")


BLOCKING = [
    "ingredient id not in ontology",
    "used in a step, not in the list",
    "timer contradicts its step text",
    "overnight work without persiapan",
    "implausible gram weight (BERAT)",
    "spice level below its chillies",
    "authored amount the list cannot draw",
    "duplicate ingredient line",
    "region not in regions.json",
]
order = [
    "ingredient id not in ontology",
    "implausible gram weight (BERAT)",
    "timer contradicts its step text",
    "overnight work without persiapan",
    "spice level below its chillies",
    "authored amount the list cannot draw",
    "region not in regions.json",
    "no quantity on a load-bearing ingredient",
    "step defers to another recipe",
    "used in a step, not in the list",
    "in list, never used in any step",
    "timers exceed the stated total time",
    "duplicate ingredient line",
    "fewer than three steps",
    "no serving count",
    "no note",
    "no protein data for any ingredient",
    "no step timers at all",
]

print(f"{len(rec)} recipes, {len(ING)} ingredients\n")
print("=" * 62)
for rule in order:
    hits = findings.get(rule, [])
    affected = len({h[0] for h in hits})
    print(f"\n## {rule}")
    print(f"   {len(hits)} occurrences across {affected} recipes")
    if not hits:
        print("   — clean")
        continue
    for rid, detail in hits[: int(sys.argv[1]) if len(sys.argv) > 1 else 12]:
        print(f"   {rid:34s} {detail}")
    lim = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    if len(hits) > lim:
        print(f"   … and {len(hits) - lim} more")

blocking = sum(len(findings.get(rule, [])) for rule in BLOCKING)
print(f"\n{blocking} blocking finding(s)." if blocking else "\nNo blocking findings.")
sys.exit(1 if blocking else 0)
