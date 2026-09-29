# Racik 

# Racik — Complete Build Specification

Everything needed to rebuild the app in Lovable. Written so that nothing from the prototype is lost.

**Status of the source file:** the working prototype `racik-prototype.html` is the single source of truth for the 199 recipes and 167 ingredients. This document specifies *everything else* — schema, engine rules, screens, copy, constraints. Keep your copy of that HTML; section 5.6 explains how to pull the data out of it.

---

# PART A — WHO THIS IS FOR

## 1. The product in one paragraph

Racik is an Indonesian home-cooking app. Mobile only, portrait, Bahasa Indonesia throughout. It holds 199 regional recipes from 22 provinces, rescales them correctly for any household size, translates measurements into things you actually own, estimates protein per portion, and turns a TikTok or Instagram cooking video into a followable recipe when you paste the link. It works with no account, no subscription, and no signal.

**The one-sentence promise:** *Resep yang ditulis untuk dimasak, bukan untuk dibaca.*

## 2. Target audience

**Primary:** Indonesian women, 35–50, running a household. Cook 1–3 meals a day, most days. Mid-range Android, mobile data, limited storage. Save recipe videos constantly and cook almost none of them.

**Secondary:** cooks 22–32, often living away from home for work or study, cooking for one or two, missing home food and unsure of proportions.

**Not the audience:** food enthusiasts, urban foodies, people who own a kitchen scale and read recipe blogs. Every design and copy decision should assume the reader is competent at cooking but impatient with apps.

### The moment the app is used

She is standing in the kitchen. The phone is propped against a jar or a bottle of kecap. She is reading at roughly arm's length. Her hands are wet, oily, or covered in flour. She has already decided to cook and has between five and fifteen minutes before it has to be on the stove. She is not browsing. She is not relaxing on a sofa.

Everything below follows from that sentence.

### Concerns and pain points — ranked by how often they bite

| # | Pain | What it looks like in her life | What Racik does about it |
|---|---|---|---|
| 1 | **Recipes are written for a household that isn't hers** | Recipe says 6 portions, she cooks for 3, or for 12 at Lebaran. She guesses. Doubling the chillies ruins it. | Portion stepper rescales everything, with bumbu on a non-linear curve |
| 2 | **Measurements assume equipment she doesn't own** | "250 ml santan", "500 g tepung" — no scale, no measuring jug in the house | Every quantity shown twice: exact figure + household equivalent ("± 4 gelas belimbing") |
| 3 | **Saved videos never get cooked** | Dozens of saved TikToks. At 4pm she can't face scrubbing a video to find the ingredients. | Paste the link, get a written recipe |
| 4 | **Video recipes can't be followed while cooking** | Pause, rewind, pause again, with wet hands | Step-by-step cook mode with the ingredients for that step shown above it |
| 5 | **Ingredient names differ by region** | Her mother says *brambang*; the recipe says *bawang merah*; Manado says *rica* | 179 regional aliases in the search index |
| 6 | **Not knowing if a dish is filling enough** | Cooks a big meal, family hungry an hour later. Or worries about protein for growing children. | Protein estimate per portion, honestly labelled |
| 7 | **Halal anxiety about unfamiliar recipes** | Especially imported ones — is the kecap ok? was the meat slaughtered properly? | Honest halal labelling that says what it can and cannot verify |
| 8 | **Signal and quota** | Kitchen at the back of the house, no signal. Quota runs out mid-month. | Works fully offline. No login. No paywall. |
| 9 | **Shopping the same thing twice** | Plans three dishes, buys shallots three times | Meal plan merges up to 3 recipes into one aisle-grouped shopping list |
| 10 | **Recipe apps that lie about difficulty** | "Easy 20-minute rendang" | Difficulty is rated by people who actually cooked it |

### What she does *not* care about

Gamification. Streaks. Badges. Social feeds. Macro pie charts. Meal-prep aesthetics. Calorie counting as a lifestyle. A "nutrition score". Do not add these.

## 3. Persona — use this to write copy

> **Bu Sri, 42. Bekasi.**
>
> Two children, 9 and 14. Her husband leaves at six; she cooks before that and again in the afternoon. Shops at the pasar twice a week and at the warung next door when she has forgotten something, which is often.
>
> She has a WhatsApp group with three neighbours where recipe links get forwarded and almost never opened. She has 60-something saved TikToks. She has cooked four of them.
>
> She learned to cook from her mother, by watching. She does not measure. She knows what the bumbu should smell like when it is ready. She is not a beginner — **she is an expert without vocabulary.** She does not know what "emulsify" means and does not need to.
>
> She does not own a kitchen scale. She owns a *gelas belimbing*, a *sendok makan*, and her hand.
>
> Her phone is a 3-year-old Android with 14 GB free and a cracked corner. She turns mobile data off when quota is low.
>
> **What she says:** "Resepnya enak, tapi saya masak buat berempat, ini buat enam. Ya sudah saya kira-kira saja."
>
> **What she will never say:** "I'd like to optimise my protein intake."
>
> **What makes her trust an app:** it tells her something she didn't know but immediately recognises as true. Not a claim — a demonstration.
>
> **What makes her delete an app:** being asked to register before it does anything. Ads over the recipe. Steps that don't match the photo. Being told a recipe is easy when it isn't.

### Copy rules that follow from Bu Sri

1. **Address her as "Ibu."** Warm, not formal. Never "kamu" in system copy.
2. **Demonstrate, don't claim.** Not "penskalaan cerdas" — instead: *"Cabainya 34, bukan 51."* Give her a number she can check against her own experience.
3. **Never use a word she wouldn't use.** No "optimal", "personalisasi", "nutrisi seimbang", "AI", "algoritma". Say *takaran*, *bumbu*, *kira-kira*, *pas*.
4. **Short sentences. Concrete nouns.** "800 ml santan = ± 4 gelas belimbing" beats any adjective.
5. **Admit limits out loud.** *"Ini perkiraan, bukan hasil uji lab."* / *"Racik bukan lembaga sertifikasi halal."* Honesty is the differentiator, not a legal disclaimer — write it like a person, place it where she'll read it.
6. **Never promise something the recipe doesn't deliver.** If the note says the sambal is raw, the steps must not boil it.
7. **No exclamation marks. No emoji in system copy.** Emoji are used only as ingredient glyphs.

### Headline patterns that work for this audience

- **Number that contradicts an expectation** — "Cabainya 34, bukan 51."
- **Her own words as the headline** — "Gelas belimbing, bukan mililiter."
- **The question she is actually asking** — "Masak apa malam ini?"
- **A limitation stated plainly** — "Disebut perkiraan, bukan pasti."

Avoid: "Temukan…", "Nikmati…", "Wujudkan…", "Solusi…", anything ending in "-kan Anda".

## 4. Competitive position — what to lead with

| Competitor | What they have | Their weakness |
|---|---|---|
| **Cookpad Indonesia** | Market leader, millions of UGC recipes, 4.9★ from ~32k ratings, AI features, weekly menu + shopping list | Premium Rp 29–40k/month and users are angry: reviews complain the price rose from 20k to 40k, that **search is paywalled**, and that only ~60 recipes are visible free. Recipes are unvetted UGC. |
| **Yummy App** (IDN Media) | Video-first, trending viral recipes, verified chefs | **The recipe is the video** — which is the exact problem Racik solves |
| **CookifyAI, MealClip, FoodiePrep, CookingGuru** | TikTok/IG → recipe conversion | English, Western ingredients, cups and ounces. None know what *brambang* or *gelas belimbing* is. |

**Therefore:**

- **Video-to-recipe import is a commodity.** Four English products do it and Cookpad advertises it. Do not lead with it in the product.
- **Lead with the cooking engine** — the portion scaling, household measures and regional vocabulary. That cannot be copied without rewriting an entire ingredient ontology.
- **Free, offline, no login is a live wedge** while the market leader is paywalling search.
- Import *is* the right hook for the **app store listing and TikTok ads** — just not for onboarding, which is read by someone who already installed.

---

# PART B — THE APP

## 5. Data model

### 5.1 Recipe

```
id            string, snake_case, stable, used for photo filenames
title         string
region        FK → region
slots         array of: sarapan | makan_siang | makan_malam | lauk | sayur |
                        sambal | camilan | pendamping | jajan | minuman | kue
serv          integer — portions the base quantities are written for
time          integer minutes
diff          "gampang" | "sedang" | "agak ribet"
spice         0–4  (kept for filtering; NEVER rendered as chilli icons — see 8.4)
glyph         emoji, used only as a fallback marker
note          one or two sentences of editorial voice — a promise the photo and
              steps must not contradict
ings          array of ingredient lines (5.2)
steps         array of [text, seconds|null]
precise       boolean — true for cakes/drinks; disables the bumbu curve (6.1)
leftover      optional string
imported      boolean
creator       optional FK → creator
-- only when precise --
alat, suhu, hasil, satuan, timbang
```

### 5.2 Ingredient line — a 6-slot array in the prototype

| Slot | Meaning | Example |
|---|---|---|
| 0 | ingredient id | `daging_sapi` |
| 1 | quantity, or `null` for "secukupnya" | `500` |
| 2 | preparation | `"potong melawan serat"` |
| 3 | fallback text when qty is null | `"secukupnya"` |
| 4 | hidden — used in calculations, not shown | `1` for water |
| 5 | unit override — overrides the ontology unit for this line | `"gram"` |

> **Slot 5 matters more than it looks.** Cake recipes write flour in grams although the ontology unit is `sdm`. Any code that reads a quantity must resolve the unit through `unitOf(line) = line[5] || ING[line[0]].unit`, never through the ontology alone. Two separate bugs in the prototype came from forgetting this — "150 sdm gula merah", and Es Cendol reporting 20 g of protein.

### 5.3 Ingredient (ontology) — 167 entries

```
id, name, cat, halal, unit, staple, aliases[], emoji
cat     : bumbu | sayur | daging | sembako | lain
halal   : halal | cert        (cert = depends on brand/certification)
unit    : gram | ml | sdm | sdt | siung | buah | butir | ruas | batang |
          lembar | ikat | papan | potong | ekor | bungkus | piring | gelas |
          kuntum | kantong
staple  : 0/1 — commonly already in the kitchen
aliases : regional and colloquial names — 179 total across the ontology
```

### 5.4 Region — 22 entries
`id, name, one-line flavour description` e.g. `minang → "Minang", "Santan pekat, cabai, rempah berlapis."`
Counts: Jawa Tengah 41 · Manado 33 · Sunda 23 · Palembang 18 · Betawi 17 · Minang 15 · Jawa Timur 8 · …

### 5.5 Supporting tables

| Table | Size | Purpose |
|---|---|---|
| `TAKAR` | 18 | household equivalents: `{id: [grams_or_ml_per_unit, "unit name"]}` e.g. `santan: [200,"gelas belimbing"]` |
| `SUBS` | 31 | substitutes when an ingredient is unavailable locally |
| `SUBS_LN` | 24 | substitutes for cooking abroad |
| `PROT100` | ~80 | grams of protein per 100 g of ingredient |
| `BERAT` | ~35 | grams per one ontology unit, for non-gram/ml ingredients (telur 55, tempe 200, ayam_utuh 900) |
| `CREATORS` | 3 | handle, name, stats — for imported recipes |
| `ALAT` | — | equipment labels for `precise` recipes |

### 5.6 Getting the data out of the HTML

Open `racik-prototype.html`, find `const RECIPES=[`, `const ING_RAW=[`, `const REG={`, `TAKAR`, `SUBS`, `SUBS_LN`, `PROT100`, `BERAT`. Easiest extraction: open the file in a browser and run in the console —

```js
copy(JSON.stringify({RECIPES, ING, REG, TAKAR, SUBS, SUBS_LN, PROT100, BERAT}, null, 1))
```

— then paste into a `.json` file. That is your seed data. Do not retype it.

---

## 6. The engine — exact rules

This is the part that makes Racik different. Implement it literally.

### 6.1 Portion scaling — the single most important rule

```js
ratio = targetServings / recipe.serv

scaleFactor(ingredientId, ratio, recipe):
  if recipe.precise:            return ratio          // baking is chemistry
  if not isSeasoning(id):       return ratio          // mains scale linearly
  if ratio < 1:                 return ratio ** 0.6   // scaling down
  else:                         return ratio ** 0.75  // scaling up

isSeasoning(id) = ING[id].cat === "bumbu"
                  || id in [garam, gula_pasir, gula_merah, merica, minyak_goreng]
```

**Why.** Aromatics do not scale with volume. Tripling a rendang triples the beef but not the chillies.

Worked example, Rendang (base 8 portions):

| | 1 portion | 4 portions | 12 portions | what linear would say at 12 |
|---|---|---|---|---|
| Daging sapi | 125 g | 500 g | 1500 g | 1500 g ✓ |
| Santan | 190 ml | 800 ml | 2300 ml | 2400 ml |
| Cabai merah | 8 | 17 | **34** | **51** |
| Bawang merah | 5 | 9 | 21 | 27 |

Fifty-one chillies in one pot is inedible, and every other recipe app will tell her to use fifty-one.

> **Do not reintroduce a flat floor.** An earlier version clamped downscaling at 60% of the full batch. That was fine while the smallest household was 2, and broke the moment "1 orang" existed — one portion of a party rendang came out with 15 chillies. The `** 0.6` curve keeps falling; `roundQty` below stops anything vanishing.

### 6.2 Rounding — by unit

```js
COUNTABLE = {siung, buah, butir, ruas, batang, lembar, ikat, papan,
             potong, ekor, bungkus, piring, gelas}

roundQty(v, unit):
  gram:      v >= 100 ? round(v/25)*25 : max(5, round(v/5)*5)
  ml:        v >= 500 ? round(v/100)*100
           : v >= 200 ? round(v/50)*50
           :            max(10, round(v/10)*10)
  countable: max(1, ceil(v - 0.15))        // never 1.5 ekor ayam
  else:      max(0.5, round(v*2)/2)        // spoons go to halves
```

**Display:** halves and quarters as `½ ¼ ¾`, everything else with a **comma** decimal (`1,2`), never a dot. `2.5 sdt` is an English spreadsheet talking; write `2½ sdt`.

### 6.3 Things that cannot be divided

When the household is small, some ingredients hit their floor. Only `ekor` (whole chicken, whole fish, crab) is worth flagging — a knob of ginger rounding up to one is not a problem anyone has.

```js
stuck = ings.filter(l => unitOf(l)==="ekor"
                    && rawQty(l,serv) < 0.7
                    && scaledQty(l,serv) === 1)
```
If non-empty, show under the ingredient list:
> **Tidak bisa dibagi lebih kecil**
> *{names} dijual per ekor, jadi masakannya akan jadi lebih dari {N} porsi. Bumbunya sudah disesuaikan — sisanya bisa disimpan.*

### 6.4 Household measures

If `satuan === "rumah"` and `TAKAR[id]` exists and the unit is gram or ml, show a second line in the accent colour under the quantity:

`takaran(id, qty) → "± " + fmtQty(qty / TAKAR[id][0]) + " " + TAKAR[id][1]`

Examples: `800 ml Santan` → `± 4 gelas belimbing` · `500 gram Daging sapi` → `± 5 ons`
Stay silent for countable units — "± 4 butir telur" under "4 butir telur" is noise.

### 6.5 Halal

```
status(recipe) = haram  if any ingredient is haram
               | syubhat if any ingredient.halal === "cert"
               | halal   otherwise
```
Current counts: 148 halal ingredients / 19 cert → **141 recipes "bahan halal", 58 "perlu dicek"**.

**The label is `bahan halal` or `perlu dicek`, with an ⓘ. Never a green tick.** Tapping opens a sheet with four honest rows:

1. Tidak ada bahan haram di daftar ini ✓ (or: these ingredients depend on brand)
2. Status tergantung merek — cek label kemasannya
3. Cara penyembelihan tidak bisa Racik pastikan
4. Kebersihan dapur tidak bisa Racik pastikan

plus: *"Racik bukan lembaga sertifikasi halal. Keterangan di sini menilai bahan, bukan merek, penyembelihan, atau dapurnya."*

A setting can hide non-halal recipes. The setting screen must say honestly that all 199 built-in recipes already pass, so nothing is currently hidden — the toggle exists for imported recipes.

### 6.6 Protein estimate

**Two tables, not one.** Protein per 100 g, and grams per ontology unit. Resolve every line to grams first, or the unit override in slot 5 will corrupt it.

```js
gramsOfLine(l):
  u = unitOf(l)
  if u === "gram" || u === "ml": return l[1]        // santan ≈ 1 g/ml
  return l[1] * BERAT[l[0]]                          // else, or 0 if unknown

proteinPerPortion(r) = Σ gramsOfLine(l) * PROT100[l[0]] / 100  /  r.serv
```

Computed from the recipe's **base** quantities so the number doesn't wobble when the portion stepper moves. Display `<10 g` to the nearest half, `≥10 g` as a whole number. Show nothing below 1 g.

Sanity anchors: Rendang 36 g · Gado-gado 32 g · Soto Ayam Lamongan 25 g · Tempe Mendoan 20 g · Es Cendol 4 g · Sambal Terasi 0.

Shown on the recipe page as a bar, and on cards when ≥ 5 g. Always with the word **perkiraan**.

### 6.7 Search

The naive version failed on "gado gado" vs "gado-gado" and, worse, matched only the *first* ingredient whose name contained the query — so "bawang" found bawang merah and silently dropped every bawang putih recipe.

```js
normalise(text):
  lowercase
  → "gado2"  becomes "gado gado"        /\b([a-z]+)2\b/ → "$1 $1"
  → old spelling: dj→j, tj→c, oe→u
  → strip all non-alphanumerics to single spaces, trim

index per recipe: title tokens · title squashed (spaces removed)
                  all tokens: title + region + every ingredient name + every
                  alias + slot names

score(recipe, query):
  exact title                 1000
  squashed title equals query  950
  squashed title starts with   800
  squashed title contains      700
  otherwise, every query token must match something:
      title token       +120
      any other token    +45
      fuzzy match        × 0.6, and −15 at the end
  a token that matches nothing at all → score 0, not a result
```

**Fuzzy matching:** bounded Levenshtein. Tolerance 1 from 4 characters, 2 from 8. Four characters matters — it is what makes `sate` find **Satai** and `cabe` find **Cabai**.

Result: `gado gado`, `gado-gado`, `gadogado`, `gado2`, `GADO GADO`, `kambing gulai`, `ayam gor`, `rendhang`, `sotoo ayam`, `nasi gorang`, `boemboe`, `djahe`, `tjabe` all work.

### 6.8 Step → ingredient matching (for cook mode)

Cook mode shows the ingredients each step needs. Derived, not authored, so imported recipes get it free.

- Match ingredient names and aliases against step text, longest first, consuming matched text
- **First mention only** — don't re-list an ingredient already added
- **Head-word rule:** match on the first word of a name ("ayam" in "potongan ayam") only if that word is unambiguous *within this recipe*, longer than 3 characters, and not in the stop set `{bumbu, saus, kecap, tepung, daun}`
- **"bumbu halus"** in a step expands to every line whose prep matches `/haluskan/` — note: `haluskan`, not `halus`, or celery prepped "iris halus" gets swept in

Coverage across 1,134 steps: ~28% correctly have no ingredient; average ~2 per step.

### 6.9 Suggestion ranking (Masak Apa)

```js
W = { recency: 55, time: 28, slot: 17 }     // sums to 100
```
Plus a stable per-recipe hash jitter of up to 14 points, so a fresh install isn't just array order. Accompaniments (`sambal, kue, camilan, pendamping, minuman, jajan`) are excluded from meal suggestions unless the user is explicitly browsing that category — and `precise` recipes never appear as meal suggestions.

> The category filter must run **before** the accompaniment exclusion, or the Sambal category returns nothing. That was a long-standing bug.

### 6.10 Meal plan and shopping list

Max **3 recipes**. Aggregate ingredients across them.

- Group key is **`ingredientId + "|" + unit`**, not ingredient id alone — otherwise two lines of gula merah in different units merge wrongly, and the "from which recipe" attribution is keyed per row, not per ingredient
- Aisle grouping: `sayur` (Sayur & Buah) · `daging` (Daging, Ikan & Telur) · `bumbu` (Bumbu) · `sembako` (Sembako & Kering) · `lain` (Lain-lain)
- Each row: checkbox · quantity in bold · name · underneath in accent colour, which recipes it is for
- Share as WhatsApp text with `☐` checkboxes, grouped, via a `wa.me` link

---

## 7. Screens

Three tabs: **MASAK APA · CARI RESEP · BUKU RESEP**. Bottom bar hidden on recipe detail, cook mode, done, settings and the ingredient picker.

### 7.0 Onboarding — 4 slides

Full-bleed photo, dark scrim, headline over the lower half, segmented progress bar at the top, `Lewati` top-right, one wide button at the bottom. Each slide: eyebrow · headline · lede · two feature rows (line icon, bold label, two-line description).

**Order matters — hardest to copy first:**

| # | Eyebrow | Headline | Lede |
|---|---|---|---|
| 1 | SELAMAT DATANG DI | **Racik** | Naikkan rendang dari 4 ke 12 porsi. Dagingnya memang jadi tiga kali lipat. Tapi cabainya 34, bukan 51 — karena bumbu tidak pernah dikali seperti itu. |
| 2 | BAHASA DAPUR IBU | **Gelas belimbing, bukan mililiter** | Tidak punya timbangan? Tidak masalah. Setiap takaran ditulis dua kali — angka pastinya, dan padanannya di dapur. |
| 3 | YANG JARANG ADA | **Tahu isinya berapa** | Tiap resep punya perkiraan protein per porsi, dalam gram. Jadi kelihatan lauk mana yang benar-benar mengenyangkan. |
| 4 | KALAU KETEMU DI HP | **Tempel tautannya, selesai** | Resep bagus di TikTok atau Instagram sering hilang begitu saja. Tempel tautannya, kami rapikan jadi bahan dan langkah yang tinggal diikuti. |

Feature rows, in order: `Porsi diubah, takaran ikut` / `Dari 1 sampai 8 orang` — `800 ml santan = ± 4 gelas` / `Cari pakai kata sendiri` — `Rendang 36 g, mendoan 20 g` / `Disebut perkiraan, bukan pasti` — `TikTok, Instagram, YouTube` / `Tidak perlu di-pause lagi`.

Buttons: `LANJUT` × 3, then `MULAI MASAK`.

### 7.1 MASAK APA

1. Time-aware greeting — before 10:00 `SELAMAT PAGI,` / **Sarapan apa hari ini?** · 10–15 `SELAMAT SIANG,` / **Masak apa siang ini?** · after 15:00 `SELAMAT SORE,` / **Masak apa malam ini?**
2. `Untuk 4 orang`
3. Search entry (tappable, not a live input) → jumps to CARI RESEP
4. "Continue cooking" card if she quit mid-recipe
5. Category tiles: Siang · Malam · Sarapan · Sayur · Lauk (also Sambal · Jajan · Minuman)
6. Filter chips, multi-select: `< 30 menit` · `Gampang` · `Protein tinggi` · `Anak suka` · `Sekali masak banyak`
7. `SARAN UNTUKMU` + `↻ GANTI`
8. Ranked recipe cards

Empty state: a line plus "Hapus filter".

### 7.2 CARI RESEP

Eyebrow `CARI RESEP`, headline **Masakan Nusantara**, search field (placeholder `Cari resep atau bahan — coba 'brambang'`), two entry rows (kitchen-ingredient search · saved recipes), then horizontal photo shelves:

`CEPAT & GAMPANG` ≤20/≤30/≤45 menit · `BAHAN UTAMA` Ayam · Ikan & Udang · Telur · Tahu & Tempe · Daging · Sayur · Kelapa & Santan · Mi & Bihun · `CARA MASAK` Goreng · Tumis · Kukus · Rebus · Bakar · Ulek · `PROTEIN TINGGI` ≥15/≥20/≥25 g · `JAJAN, MINUMAN & PENDAMPING` · `DAERAH` (22, sorted by count)

Filtered state replaces the shelves with: one accent chip with ✕ · a dark region banner where relevant · `35 RESEP` + `LIHAT SEMUA` · the result list. Protein-filtered results sort by protein descending.

### 7.3 BUKU RESEP

Eyebrow `KOLEKSI`, headline **Buku Resep**, gear button top-right.
Sub-tabs: **Diambil · N** | **Disimpan · N** | **Rencana · N/3**

- **Diambil** — the paste-a-link card at the top (heading *Nemu resep enak di TikTok atau IG?*, input *Tempel tautan videonya di sini…*, button **Ambil**, three example chips `@dapurmamaay` `@koki.harian` `@rasaminang`), then imported recipes. Empty: *"Belum ada resep yang diambil. Tempel tautan TikTok atau IG di kotak di atas."*
- **Disimpan** — saved recipes. Empty: *"…Ketuk tanda ♡ di resep mana pun untuk menyimpannya."*
- **Rencana** — recipe rows with portion steppers and delete · three stat boxes (time, recipes, items) · the aisle-grouped shopping list · **Kirim ke WhatsApp** · **Kosongkan rencana**. Empty: *"Maksimal 3 resep — supaya belanjanya masih muat satu kantong."*

### 7.4 Recipe detail

Hero photo 16:11 with floating back and ♡ · title · tag row (region · halal ⓘ · spice as a word) · note · three-cell row `210 mnt / WAKTU` `agak ribet / TINGKAT` `− 4 + / PORSI` · protein bar with ⓘ · tabs `BAHAN · 14` | `LANGKAH · 5` · conditional yellow notices · action buttons · sticky footer with ♡ and **Mulai Masak**.

Ingredient row: tick circle · **quantity** + name + prep in grey · household equivalent in accent · optional `tidak ada?` pill · ingredient emoji.
Step row: numbered circle · step text **at the same size as ingredient lines** · `⏱ 10 menit` when timed.

### 7.5 Cook mode
Full screen, dark. `← Keluar` + `Langkah 2 dari 5` · thin progress bar · **Siapkan dulu** panel listing that step's ingredients with quantities · the step in the largest type in the app · timer where present · `Sebelumnya` / `Lanjut`, final step `Selesai`.

### 7.6 Selesai
Congratulation · large dashed photo frame *Foto masakan Ibu* (camera) · three difficulty options `😌 Lebih gampang` `👌 Pas` `😅 Lebih susah`, each with *dari yang tertulis* · verdict appears on the recipe once ≥3 ratings · **Selesai**.

### 7.7 Pengaturan
**MASAK** — Porsi di rumah (1/2/3/4/5/6/8 orang) · Satuan takaran (Takaran rumahan / Gram & mililiter saja) · Ukuran huruf (Normal / Besar / Paling besar) · Sembunyikan resep tidak halal (toggle + the honest note).
**BANTUAN** — Tentang Racik · Kirim masukan.
**Footer** — *Tersimpan di HP ini* + explanation + **HAPUS SEMUA DATA**.

### 7.8 Ingredient picker
Heading *Bahan yang ada di dapur* · grid of ~30 common ingredients as chips · live count *"12 resep bisa dimasak dari ini"* · results ranked by how many of her ingredients each recipe uses (threshold: at least 2 matches).

### 7.9 Sheets
Substitution · halal explanation · protein breakdown (per portion, with the biggest contributors) · Tentang Racik.

### 7.10 Import flow
Validation (empty → *"Tempel dulu tautan videonya…"*; non-video → *"Sepertinya itu bukan tautan video…"*) → staged processing screen (reading caption → on-screen text → audio → tidying) → the recipe opens with a creator byline → "already exists" branch.

---

## 8. Design system

### 8.1 Type scale — twelve steps, no half-pixels, floor 11px

`40 display · 34 · 28 · 24 title · 20 head · 18 read · 16 body · 15 · 14 secondary · 13 caption · 12 label · 11 micro`

| Use | Size |
|---|---|
| **Ingredient lines and cooking steps** | **18** |
| Body text | 16 |
| Shopping list items | 16 |
| Secondary / meta | 14 |
| Captions, household measures | 13 |
| Uppercase labels | 12 |
| Tab labels, tile counts | 11 — absolute floor |

The prototype originally carried 34 different sizes including 9.5px tab labels. Floors follow iOS HIG and Material. **Ingredient lines and steps sit at 18, not 16, because she is reading a propped-up phone across a counter** — this is the rule most likely to be quietly undone by a redesign.

### 8.2 Fonts
Display: a Caslon-lineage serif (Libre Caslon Display / Text). Everything read at small size: Inter. The serif never goes below 18px.

### 8.3 Colour
Accent is T-Mobile magenta. Because `#E20074` only reaches 4.5:1 on a near-white ground — too thin for 11–12px uppercase — it is split:

| Token | Value | Use |
|---|---|---|
| `--mag-fill` | `#E20074` | fills: buttons, active tab, selected chips, progress |
| `--mag-text` | `#A6085A` | magenta **text** on light grounds (7.3:1) |
| `--mag-deep` | `#A6085A` → `#7A0042` | solid dark panels |
| ground | `#FCFAF8` | warm near-white |
| ink | `#1C0A14` / `#3D2A34` / `#6D5A64` | |
| onboarding ground | `#2E0018` | |

Squared corners (2–3px). Hairline rules, not shadows. Uppercase letterspaced section heads. White tab bar with thin line icons, never emoji.

### 8.4 Non-negotiables

1. Ingredient lines and steps at 18px; nothing below 11px anywhere
2. Three tabs, no more
3. The portion stepper lives on the recipe page and updates quantities live
4. Halal says "bahan halal" / "perlu dicek" with an explanation — **never a green tick**
5. Protein always labelled *perkiraan*
6. **No chilli icons.** Spice level is a word: *pedas / agak pedas / tidak pedas*
7. Works offline; no login, no account, no paywall
8. Bahasa Indonesia, addressing "Ibu"
9. Photographs are the primary visual material — dark, warm, single-source side light, real kitchens

---

## 9. Persistence

Everything local. No server, no account.

```
household · halalMode · saved · disliked · log · imported · community ·
servings · intro · plan · planChecked · ratings · photos · satuan · teks
```

- localStorage is ~5 MB and iOS can evict it. **Use IndexedDB** for anything that must survive, especially user photos.
- Quota handling: on failure, drop `photos` first, set a `photoFull` flag, keep saved recipes, and tell her plainly: *"Penyimpanan HP sudah penuh, jadi foto lama terpaksa dihapus. Resep dan rencana Ibu tetap aman."*
- Loading a stale payload must be tolerant: normalise removed tab names, drop plan entries whose recipes no longer exist, guard every array.
- User photos: downscale to 640px on a canvas and store as JPEG q0.6 before saving.

---

## 10. What is faked and must be built for real

| Feature | Prototype | Real version needs |
|---|---|---|
| **TikTok/IG import** | Validates the URL, then plays a scripted animation against 3 hardcoded demo recipes. **There is no server.** | A backend that fetches the video, transcribes audio, OCRs on-screen text, and maps the result onto the ingredient ontology. This is the only part of Racik that needs a server, and it is weeks of work. |
| Community recipes | 3 hardcoded entries with fake stats | Real storage + moderation |
| Creator stats | Hardcoded | Real |
| Recipe photos | 44 of 199 exist | 155 more (see the asset spreadsheet) |

**Ship without import.** The 199 recipes, search, scaling, meal plan, shopping list, protein and halal are a complete, useful app that needs no backend at all. Import is the growth hook — and the only expensive part.

---

# PART C — THE FIGMA OUTPUT

## 11. Review of the Figma Make prototype

*Reviewed at the link provided. Note: only the first onboarding slide is reachable — `Mulai`, `Lewati` and the pagination dots are not wired, so no other screen could be inspected. The review below is of that one screen.*

### What works

- The photograph is genuinely good — a hand holding a phone over a table of food, warm, believable, and it communicates "video → recipe" in one image
- The stacked eyebrow → headline → lede → button structure is right
- The floating `Tempel link di sini` chip over the phone is a nice touch; it shows the mechanic instead of describing it
- The progress bar and `Lewati` are in the right places
- The copy is Indonesian, plain, and short

### What must change

**1. The brand colour is green (`#2E7D4F`-ish), not magenta.** The whole system — buttons, logo dot, the chip — is green. Magenta was specified and it matters: it is the only thing distinguishing Racik from every other recipe app, all of which are green. Replace with `#E20074` for fills and `#A6085A` for magenta text.

**2. It leads with the wrong feature.** The headline is *"Tempel link video, langsung jadi resep."* Video-to-recipe is a commodity — four English products and Cookpad already do it. Slide 1 must be the portion-scaling demonstration (see 7.0). Import moves to slide 4.

**3. Only one of four slides exists.** The remaining three carry the features that actually differentiate the product.

**4. The frame is landscape/desktop.** Racik is portrait-only. Everything must be rebuilt at phone width with a 16px side gutter.

**5. Type is far too small.** At this frame the lede reads at roughly 9–10px equivalent. Body 16, ingredient lines and steps 18, nothing below 11.

**6. The hero photo is not an Indonesian home kitchen.** There is a latte and a café table. The brief specifies a real home kitchen: cast-iron wok, wooden spatula, glass jars, dark aged wood, single warm side light. No marble, no coffee, no Western cutlery.

**7. The photo contains a fabricated creator handle** (`@chefanto_id`) in a fake TikTok overlay. Use the three handles the app actually ships with, or no handle at all.

**8. The logo is a green dot + "Racik" in a geometric sans.** No relationship to the editorial Caslon direction. Either design a real wordmark or set "Racik" in the display serif.

**9. The skip control reads `Lewati` in ~8px grey on a photo.** It must be a legible chip with its own background, 11px uppercase minimum.

### What to tell Figma next

> Rebuild at portrait phone width, 390×844. Brand colour magenta #E20074 for fills and #A6085A for magenta text on light backgrounds — not green. Four onboarding slides, all wired, in this order: (1) portion scaling with the rendang numbers, (2) household measurements, (3) protein estimate, (4) TikTok import. Body text 16px minimum, ingredient lines and cooking steps 18px, nothing below 11px. Photography is an Indonesian home kitchen — dark aged wood, single warm light from the upper left, cast-iron wok, no café, no marble, no coffee. Then design the three main tabs and the recipe page from the screen spec.

---

## 12. Build order in Lovable

1. **Seed the data** — export the JSON from the HTML (5.6). Ship with it bundled; no API.
2. **The engine as pure functions, with tests** — `scaleFactor`, `roundQty`, `fmtQty`, `takaran`, `proteinPerPortion`, `analyseHalal`, `searchScore`, `stepIngredients`, `planList`. Test these before drawing anything. Every one of them had a bug found by testing.
3. **Recipe detail** first — it is the screen that proves the product. Portion stepper, ingredient list, steps, protein, halal.
4. **Cook mode** second — the screen with the highest stakes in real use.
5. Then CARI RESEP, MASAK APA, BUKU RESEP + meal plan.
6. Onboarding last — it is the easiest to change and the least load-bearing.
7. PWA shell: manifest, service worker, bundled fonts, IndexedDB.

### Starting prompt for Lovable

> Build a mobile-only Progressive Web App in Indonesian called Racik — a home-cooking app for Indonesian women aged 35–50. Portrait phone layout only. No login, no account, no backend: all data is bundled JSON and all user state is stored locally in IndexedDB so it works offline.
>
> I will provide recipes.json with 199 recipes, 167 ingredients and 22 regions. Read the attached specification for the data schema, the scaling engine, and all screens.
>
> The single most important behaviour: changing the portion count on a recipe rescales every quantity live, with main ingredients scaling linearly and seasonings on a curve — `ratio ** 0.75` when scaling up, `ratio ** 0.6` when scaling down, linear for baking recipes.
>
> Typography: ingredient lines and cooking steps are 18px, body text 16px, nothing below 11px. Accent colour #E20074 for fills, #A6085A for magenta text on light backgrounds. Near-white ground #FCFAF8, squared 2–3px corners, hairline rules instead of shadows.
>
> Start with the recipe detail screen.

---

## Appendix — verification checklist

Before calling it done, check each of these. All ten were real bugs in the prototype.

- [ ] Rendang at 12 portions shows **34** chillies, not 51
- [ ] Rendang at 1 portion shows ~8 chillies, not 15
- [ ] No fractional countables anywhere — never "1,5 ekor ayam"
- [ ] No quantity displays with a dot decimal
- [ ] Es Cendol reports ~4 g protein, not 20 (unit override leak)
- [ ] Every `daging`-category ingredient has a protein value
- [ ] Searching `gado gado`, `gado2` and `sate` all return results
- [ ] Searching `bawang` returns bawang putih recipes too
- [ ] The Sambal category returns results
- [ ] Ingredient lines and step text are the same size
- [ ] The halal label never renders as a tick
- [ ] No chilli icons anywhere
- [ ] A recipe's note never contradicts its steps



Racik — Audiens, Persona, dan Aturan Copywriting

Dokumen pendamping. Bagian ini juga ada di dalam spesifikasi lengkap, dipisah di sini supaya bisa dipakai sendiri — untuk brief desainer, untuk menulis halaman toko aplikasi, atau untuk mengarahkan Lovable dan Figma.

1. Siapa yang dilayani

Utama: perempuan Indonesia, 35–50 tahun, mengurus rumah tangga. Masak satu sampai tiga kali sehari, hampir tiap hari. HP Android kelas menengah, pakai kuota, penyimpanan terbatas. Menyimpan video resep terus-menerus dan hampir tidak pernah memasaknya.

Kedua: perempuan dan laki-laki 22–32 tahun, merantau untuk kerja atau kuliah, masak untuk satu atau dua orang, kangen masakan rumah tapi tidak yakin takarannya.

Bukan audiensnya: penggemar kuliner, warga kota yang mengikuti tren makanan, orang yang punya timbangan dapur dan membaca blog resep.

2. Situasi yang jadi dasar semua keputusan

Ibu berdiri di dapur. HP disandarkan ke toples atau botol kecap. Dia membaca dari jarak kira-kira satu lengan. Tangannya basah, berminyak, atau kena tepung. Dia sudah memutuskan untuk masak, dan punya lima sampai lima belas menit sebelum masakan harus naik ke kompor.

Dia tidak sedang menjelajah. Dia tidak sedang rebahan di sofa.

Setiap aturan huruf, warna, dan kalimat di Racik berasal dari satu kalimat itu.

3. Keluhan dan masalahnya — diurut dari yang paling sering menggigit

# Masalah Wujudnya sehari-hari Jawaban Racik 1 Resep ditulis untuk rumah tangga orang lain Resep 6 porsi, dia masak untuk 3. Atau untuk 12 waktu Lebaran. Akhirnya dikira-kira. Cabainya dikali dua, rasanya hancur. Pengubah porsi, dengan bumbu di kurva tidak lurus 2 Takarannya mengandaikan alat yang tidak dia punya "250 ml santan", "500 g tepung" — tidak ada timbangan, tidak ada gelas ukur di rumah Tiap takaran ditulis dua kali: angka pastinya dan padanan dapurnya 3 Video yang disimpan tidak pernah dimasak Puluhan TikTok tersimpan. Jam 4 sore dia tidak sanggup menggulir video untuk mencari bahannya. Tempel tautannya, jadi resep tertulis 4 Resep video tidak bisa diikuti sambil masak Pause, mundur, pause lagi, dengan tangan basah Mode masak langkah demi langkah, bahan tiap langkah ditampilkan di atasnya 5 Nama bahan beda-beda per daerah Ibunya bilang brambang, resepnya menulis bawang merah, orang Manado bilang rica 179 sebutan daerah masuk indeks pencarian 6 Tidak tahu masakannya cukup mengenyangkan atau tidak Masak banyak, sejam kemudian anaknya lapar lagi. Atau khawatir protein untuk anak yang sedang tumbuh. Perkiraan protein per porsi, disebut perkiraan 7 Was-was soal halal pada resep yang tidak dikenal Terutama resep impor — kecapnya bagaimana? dagingnya disembelih benar? Keterangan halal yang jujur soal apa yang bisa dan tidak bisa dipastikan 8 Sinyal dan kuota Dapur di belakang rumah, tidak ada sinyal. Kuota habis di pertengahan bulan. Jalan penuh tanpa sinyal. Tanpa login. Tanpa langganan. 9 Beli bahan yang sama dua kali Merencanakan tiga masakan, beli bawang tiga kali Rencana masak menggabungkan sampai 3 resep jadi satu daftar belanja per lorong pasar 10 Aplikasi resep yang berbohong soal tingkat kesulitan "Rendang mudah 20 menit" Tingkat kesulitan dinilai orang yang benar-benar memasaknya

Yang tidak dia pedulikan

Gamifikasi. Runtutan hari. Lencana. Lini masa sosial. Diagram makro. Estetika meal prep. Menghitung kalori sebagai gaya hidup. "Skor gizi". Jangan ditambahkan.

4. Persona — dipakai untuk menulis copy

Bu Sri, 42. Bekasi.

Dua anak, 9 dan 14 tahun. Suaminya berangkat jam enam; dia masak sebelum itu dan sekali lagi sore hari. Belanja ke pasar dua kali seminggu, dan ke warung sebelah kalau ada yang terlupa — yang sering terjadi.

Dia punya grup WhatsApp berisi tiga tetangga, tempat tautan resep diteruskan dan hampir tidak pernah dibuka. Dia punya enam puluh sekian TikTok tersimpan. Yang benar-benar dia masak: empat.

Dia belajar masak dari ibunya, dengan melihat. Dia tidak menakar. Dia tahu bumbu sudah matang dari baunya. Dia bukan pemula — dia ahli yang tidak punya istilah. Dia tidak tahu arti "emulsifikasi" dan memang tidak perlu tahu.

Dia tidak punya timbangan dapur. Dia punya gelas belimbing, sendok makan, dan tangannya sendiri.

HP-nya Android tiga tahun, sisa 14 GB, sudutnya retak. Data seluler dimatikan kalau kuota menipis.

Yang dia katakan: "Resepnya enak, tapi saya masak buat berempat, ini buat enam. Ya sudah saya kira-kira saja."

Yang tidak akan pernah dia katakan: "Saya ingin mengoptimalkan asupan protein harian."

Yang membuatnya percaya: aplikasi memberitahu sesuatu yang belum dia tahu, tapi langsung dia akui benar. Bukan klaim — pembuktian.

Yang membuatnya menghapus aplikasi: disuruh daftar sebelum aplikasinya melakukan apa pun. Iklan menutupi resep. Langkah yang tidak cocok dengan fotonya. Dibilang gampang padahal tidak.

5. Tujuh aturan menulis untuk Bu Sri

1 · Panggil dia "Ibu." Hangat, bukan formal. Jangan "kamu" di teks sistem.

2 · Buktikan, jangan mengklaim. Bukan "penskalaan cerdas" — tapi "Cabainya 34, bukan 51." Beri angka yang bisa dia cocokkan dengan pengalamannya sendiri.

3 · Jangan pakai kata yang tidak dia pakai. Tidak ada "optimal", "personalisasi", "nutrisi seimbang", "AI", "algoritma". Katakan takaran, bumbu, kira-kira, pas.

4 · Kalimat pendek. Kata benda yang konkret. "800 ml santan = ± 4 gelas belimbing" mengalahkan kata sifat apa pun.

5 · Akui batasnya dengan lantang. "Ini perkiraan, bukan hasil uji lab." / "Racik bukan lembaga sertifikasi halal." Kejujuran itu pembedanya, bukan sekadar sanggahan hukum — tulis seperti manusia bicara, dan taruh di tempat yang benar-benar dia baca.

6 · Jangan menjanjikan yang tidak ada di resepnya. Kalau catatannya bilang sambalnya mentah, langkahnya tidak boleh merebus.

7 · Tanpa tanda seru. Tanpa emoji di teks sistem. Emoji hanya dipakai sebagai penanda bahan.

6. Pola judul yang bekerja untuk audiens ini

Pola Contoh Angka yang melawan dugaan "Cabainya 34, bukan 51." Kata-katanya sendiri jadi judul "Gelas belimbing, bukan mililiter." Pertanyaan yang memang sedang dia pikirkan "Masak apa malam ini?" Keterbatasan yang diakui terang-terangan "Disebut perkiraan, bukan pasti."

Hindari: "Temukan…", "Nikmati…", "Wujudkan…", "Solusi…", dan apa pun yang berakhiran "-kan Anda".

7. Posisi melawan pesaing — apa yang boleh dipimpinkan

Pesaing Kekuatannya Titik lemahnya Cookpad Indonesia Pemimpin pasar, jutaan resep, 4,9★ dari ±32.000 penilaian, sudah punya AI dan rencana menu Premium Rp 29–40 ribu/bulan dan penggunanya marah: ulasan mengeluhkan harga naik dari 20 ke 40 ribu, pencarian dikunci, dan ada yang mengaku cuma bisa lihat ±60 resep gratis. Resepnya UGC tanpa penjaga mutu. Yummy App Video-first, resep viral, koki terverifikasi Resepnya adalah videonya — persis masalah yang Racik selesaikan CookifyAI · MealClip · FoodiePrep · CookingGuru Mengubah video TikTok/IG jadi resep Bahasa Inggris, bahan Barat, satuan cup dan ons. Tidak ada yang tahu apa itu brambang atau gelas belimbing.

Kesimpulannya:

Impor video bukan keunggulan. Empat produk berbahasa Inggris sudah melakukannya dan Cookpad mengiklankannya. Jangan memimpin dengan itu di dalam produk.

Pimpin dengan mesin masaknya — penskalaan porsi, takaran rumahan, kosakata daerah. Itu tidak bisa ditiru tanpa menulis ulang seluruh ontologi bahan.

Gratis, offline, tanpa login adalah celah yang sedang terbuka selagi pemimpin pasar mengunci pencarian di balik langganan.

Impor tetap hook yang benar untuk halaman toko aplikasi dan iklan TikTok — cuma bukan untuk onboarding, yang dibaca orang yang sudah terlanjur mengunduh.

8. Urutan onboarding, dan kenapa begitu

Diurut dari yang paling sulit ditiru ke yang paling mudah.

# Eyebrow Judul Kenapa di posisi ini 1 SELAMAT DATANG DI Racik — "Cabainya 34, bukan 51." Satu-satunya hal yang tidak bisa disalin pesaing dalam satu rilis 2 BAHASA DAPUR IBU Gelas belimbing, bukan mililiter Masalah nomor dua paling sering, dan langsung terasa berguna 3 YANG JARANG ADA Tahu isinya berapa Pembeda dari Cookpad, tapi bukan hal yang unik di dunia 4 KALAU KETEMU DI HP Tempel tautannya, selesai Komoditas. Penting, tapi bukan alasan dia bertahan.

Onboarding bukan alat akuisisi — dia sudah mengunduh. Tugasnya membuat dia tidak menghapus aplikasinya besok.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ibu-masak-pintar.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/404aa9e3-8685-40d9-ad45-482865bd6804).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
