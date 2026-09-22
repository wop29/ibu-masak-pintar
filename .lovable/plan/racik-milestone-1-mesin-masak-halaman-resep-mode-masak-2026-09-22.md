# Racik — Milestone 1: mesin masak + halaman resep + mode masak

Mobile-only, portrait, Bahasa Indonesia, no login, no backend. This milestone builds the cooking engine and the two screens that prove the product, using a sample of ~15 recipes so the full 199 can be dropped in later without touching any code.

## What you'll be able to do

- Open a recipe page: photo, note, region, halal label, spice as a word, protein estimate.
- Change the portion count from 1 to 8 and watch every quantity rewrite itself live — beef triples, chillies don't.
- Read each quantity twice: the exact figure, and the household equivalent underneath ("± 4 gelas belimbing").
- Tap a substitute pill on ingredients that are hard to find.
- Tap the halal label and read four honest rows about what Racik can and cannot check.
- Start cook mode: dark full screen, one step at a time in the largest type in the app, with that step's ingredients listed above it and a timer where the step has one.
- Finish and rate the difficulty (Lebih gampang / Pas / Lebih susah).
- Paste a TikTok or Instagram link in Buku Resep and watch the staged import demo resolve to one of three demo recipes — clearly marked as a demo, since the real version needs a server.

## Sample data

15 recipes chosen to exercise every engine rule: Rendang (base 8, the scaling showcase), Gado-gado, Soto Ayam Lamongan, Tempe Mendoan, Sambal Terasi (0 g protein), Es Cendol (the unit-override trap), Ayam Goreng Lengkuas (whole-chicken "ekor" floor), Bolu Kukus (`precise`, linear scaling), plus Sunda/Manado/Palembang/Betawi/Jawa Timur dishes for region coverage. Around 45 ingredients with regional aliases, and the supporting tables (TAKAR, SUBS, SUBS_LN, PROT100, BERAT, REG) filled only for those ingredients.

Data lives in bundled JSON files shaped exactly like the prototype export, so replacing them with the full export is a file swap.

## Technical section

**Data files** under `src/data/`: `recipes.json`, `ingredients.json`, `regions.json`, `takar.json`, `subs.json`, `prot100.json`, `berat.json`, `creators.json`. Ingredient lines keep the 6-slot array shape from the prototype; a typed loader in `src/lib/racik/data.ts` indexes them by id.

**Engine as pure functions** in `src/lib/racik/engine/`, each with Vitest tests written against the spec's worked numbers before any UI:

- `unitOf(line)` = `line[5] || ING[line[0]].unit` — the single accessor everything else uses; nothing reads the ontology unit directly.
- `scaleFactor` — `ratio` for `precise` or non-seasoning, `ratio ** 0.75` up, `ratio ** 0.6` down. No floor, no clamp.
- `roundQty` / `fmtQty` — per-unit rounding rules; `½ ¼ ¾` glyphs, comma decimals, never a dot.
- `takaran` — household equivalent for gram/ml only, silent for countables, gated on the `satuan` setting.
- `proteinPerPortion` — resolves each line to grams via `BERAT` before applying `PROT100`, computed from base quantities.
- `analyseHalal` — haram / syubhat / halal, surfaced as `bahan halal` or `perlu dicek`.
- `undividable` — `ekor` lines at their floor, feeding the "Tidak bisa dibagi lebih kecil" note.
- `stepIngredients` — name/alias matching longest-first, first mention only, head-word rule with the stop set, `bumbu halus` expanding on `/haluskan/`.

Search, suggestion ranking, and the plan/shopping-list aggregator are out of this milestone; their function files are stubbed in the same folder so the next milestone slots in.

**Routes** (TanStack Start, file-based): `/` redirects to a recipe list stub that links into detail; `/resep/$id` detail; `/resep/$id/masak` cook mode; `/resep/$id/selesai` done; `/buku` for the import demo card. Bottom tab bar is not built yet — this milestone's screens all hide it anyway.

**Design tokens** in `src/styles.css`: `--mag-fill #E20074`, `--mag-text #A6085A`, `--mag-deep`, ground `#FCFAF8`, three ink levels, onboarding ground. Twelve-step type scale as named tokens, with ingredient lines and step text bound to the 18px token so a later restyle can't silently drop them to 16. Libre Caslon Display + Inter loaded via `<link>` in the root route. Squared 2–3px corners, hairline rules, no shadows.

**State** in IndexedDB via a small wrapper with a localStorage fallback: `servings`, `household`, `satuan`, `teks`, `ratings`, `photos`, `log`, `saved`. Photos downscaled to 640px JPEG q0.6; on a quota failure, photos are dropped first and the honest message is shown.

**Import demo**: URL validation, staged processing screen, resolves to one of three hardcoded demo recipes with a creator byline, plus the "already exists" branch. Labelled as a demo in the UI.

**Verification** before completion: Rendang at 12 shows 34 chillies and at 1 shows ~8; no fractional countables; no dot decimals; Es Cendol ~4 g protein; every `daging` ingredient has a protein value; ingredient lines and step text render at the same size; halal never renders as a tick; no chilli icons anywhere.
