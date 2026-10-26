# Racik: Design alignment plan (for the engineer)

Written 23 Oct 2026 from a read of the working tree in `~/Documents/GitHub/ibu-masak-pintar` (including uncommitted work up to 22 Oct). Source standard: the project doc **"Racik - Design Foundation (UI-UX Standard)"**. This file is self-contained: everything you need to execute is here.

Work the tasks **in order**. Each task has a goal, the files, the exact changes, and checks that must pass before you move on. Commit once per task with a short Indonesian message, like the existing history.

---

## 0. Read this first

### Rules that apply to every task

- **Do not choose colours or fonts.** Octavia is providing the visual direction. Keep today's colour *values* exactly as they are. You are only moving them into named tokens so they can be swapped in one place later.
- **Do not change the cook-mode theme** (it is light today; the design doc once proposed dark). That is part of the visual direction.
- **UI copy is Bahasa Indonesia, sentence case.** No new ALL CAPS labels. One action keeps one name everywhere ("Tambah ke rencana", toast "Ditambahkan ke rencana", tab "Rencana").
- **Honesty rules stay:** nutrition is always "±" and "perkiraan"; never show a number built from guesses; no scores, rings, grades or good/bad colours; halal is a word, never a badge.
- **Red is reserved** for "tidak halal", errors and destructive actions. Nothing else may use it.
- **Touch targets** at least 44×44 px (`size-11` / `min-h-11`). Nothing smaller.
- **No text below 13 px** at the Normal text size, and every size must go through the `--teks` / `--teks-h` multipliers so Pengaturan › Ukuran tulisan works.
- Don't redesign screens that aren't listed. Don't touch import, sync, auth or backend logic.

### How to check your work

```bash
npm install            # 'uqr' is in package.json but not installed yet
npx tsc --noEmit -p .  # must be clean
npm run build          # runs the IngredientList regression test, then vite build
npx vitest run         # all suites
npm run dev            # then check each screen you touched at 360 px and 412 px wide,
                       # at Ukuran tulisan Normal and Paling besar
```

A screen is done only when: no horizontal scroll, no clipped text, every control does something, and the grep checks listed in the task return nothing.

---

## 1. What is already aligned (leave it alone)

| Area | Status in code |
|---|---|
| Tabs Masak · Cari · Rencana · Koleksi | Done (`AppTabs.tsx`, `routes/rencana.tsx`) |
| Plan up to 15 recipes | Done (`PLAN_MAX = 15` in `store.ts`) |
| "Tambah resep" as a button on Masak, Cari, Koleksi + share target | Done (`ImportButton`, `ImportDemo`, `/ambil`) |
| Several cook timers at once, wall-clock, survive step changes | Done (`resep.$id_.masak.tsx`) |
| Wake lock, beep and vibration when a timer ends | Done |
| Cook mode progress bar and "Bahan" sheet | Done |
| Shopping list unit conversion, "Beli:" hints, "Sudah ada di rumah" | Done (`shopping.ts`, `RencanaView.tsx`) |
| Text-size setting drives the size tokens (`--teks`) | Done for token classes; broken wherever a raw px size is used (task 2) |
| Reduced motion | Done (global rule in `styles.css`) |
| "Hapus semua data" and sign-out have confirm sheets | Done (`AccountSection.tsx`) |
| Language switch only in Pengaturan, hidden behind `ENGLISH_ENABLED = false` | Matches the decision for now (task 10 finishes it) |

## 2. What is not aligned yet (measured 23 Oct)

| # | Gap | Evidence | Task |
|---|---|---|---|
| G1 | Colours hard-coded in components instead of tokens | 127 `[#xxxxxx]` classes in `.tsx` (top: `#111` ×18, `#e8e8e4` ×14, `#f0f0ed` ×10, `#9ca3af` ×9) | 1 |
| G2 | Text sizes that ignore the text-size setting | Raw px or `clamp()` text classes in 15 files (titles, cook timer, glyphs, `text-[10px]`) | 2 |
| G3 | Text below 13 px | `text-micro` (11 px) used 47×, `text-label` (12 px) 45×, `section-label` hard-coded at 11 px, `text-[10px]` ×2 | 2 |
| G4 | ALL CAPS tracked labels | `eyebrow` ×23, `eyebrow-ink` ×6, `section-label` ×6, `uppercase` ×12, ~35 caps literals (WAKTU MAKAN, SESUAIKAN SARAN, PORSI, TINGKAT, LANGKAH n, DAFTAR BELANJA, group names…), `.toUpperCase()` on the region chip, caps greetings in `i18n.ts` | 3 |
| G5 | Recipe page: steps hidden behind a Bahan/Langkah tab; portions sit in the stats card far from the ingredient list; no way back to the original portions; nutrition sits above the ingredients | `routes/resep.$id.tsx` lines ~132–185 | 4 |
| G6 | Nutrition shows protein, karbo, serat only; "–" when a value can't be computed; no kalori, no lemak | `ProteinBlock.tsx`; `tables.json` has `PROT100` (289), `CARB100` (286), `FIBER100` (201), no fat table | 5 |
| G7 | Cook mode: ringing timer uses red; caps labels; disabled "Sebelumnya" at 50% opacity (unreadable); running-timer tray at the top of the screen (hardest to reach one-handed) | `resep.$id_.masak.tsx` `StepTimer`, header, bottom bar | 6 |
| G8 | Rencana: no days; removing a recipe has no undo; "Kosongkan rencana" empties everything with no confirm; caps group names; a 10 px button label | `RencanaView.tsx` | 7 |
| G9 | Masak (home): three filter blocks stack before the first recipe; recipes without a photo show a dark green tile with an emoji | `routes/index.tsx`, `RecipePhoto.tsx`, `recommend.ts` | 8 |
| G10 | No shared undo pattern anywhere | no snackbar/toast in Racik components | 9 |
| G11 | English covers only a few screens | `t()` used in 7 of ~40 route/component files | 10 |
| G12 | Small tap targets | `size-10` (40 px) icon buttons in `RencanaView.tsx` and `buku.tsx` | 11 |

---

## Task 0. Housekeeping (15 min)

1. Delete `.gen-tmp.mjs` in the repo root (left over from regenerating the route tree).
2. Run `npm install`, then the four checks above. Fix nothing else yet.
3. **Ask Octavia before committing.** The working tree holds ~58 changed files of earlier, uncommitted work. Suggest she commits that as its own commit first, so the tasks below land as clean commits on top.

## Task 1. Move hard-coded colours into tokens (G1)

**Goal:** every colour in a component comes from a named token, so Octavia's palette can be applied in `styles.css` alone. Visual result must be identical.

**Files:** `src/styles.css`, then every `.tsx` under `src/routes` and `src/components/racik` (not `src/components/ui`).

**Steps**
1. In `styles.css` `:root`, add these tokens **with today's values** and expose each in `@theme inline` as `--color-…`:

   | New token | Value (unchanged) | Replaces |
   |---|---|---|
   | `--ink-strong` | `#111111` | `text-[#111]` |
   | `--rule-soft` | `#f0f0ed` | `border-[#f0f0ed]` |
   | `--rule-strong` | `#e8e8e4` | `border-[#e8e8e4]`, `bg-[#e8e8e4]` |
   | `--ink-faint` | `#9ca3af` | `text-[#9ca3af]` (see note) |
   | `--icon-muted` | `#555555` | `text-[#555]` |
   | `--primary-wash` | `#f7faf6` | `bg-[#f7faf6]` |
   | `--primary-track` | `#e8eee7` | `bg-[#e8eee7]` |
   | `--time` / `--time-soft` / `--time-ink` | `#2e7d32` / `#eef6ee` / `#1c5633` for now | timer colours (task 6) |
   | `--danger-soft` / `--danger-ink` | `#fdecea` / `#b71c1c` | `#fdecea`, `#b71c1c`, `#c62828` |
   | `--notice-ink` | `#66551c` | `text-[#66551c]`, `#765e12` |

   Note: `#9ca3af` on `--ground` is 2.5:1, below WCAG. Where it colours **text** (not icons), use `text-ink-3` instead of `--ink-faint`. Keep `--ink-faint` only for decorative icons and dividers.
2. For any remaining hex (`#c9cec7`, `#e4e5e1`, `#e0e0db`, `#d1d5db`, `#ccc`, `#71736e`, `#adadad`, `#8b8f88`, `#747a72`, `#6b6b6b`, `#b8c8b8`, `#fde68a`), map to the closest existing token (`rule`, `rule-strong`, `ink-3`, `primary-line`, `notice`). Placeholder text `#adadad` → `text-ink-3`.
3. Replace the inline `rgba(...)` shadows with the existing `shadow-card` / `shadow-glow` utilities, or add one `shadow-sheet` utility.

**Done when**
- `grep -rnoE '\[#[0-9a-fA-F]{3,6}\]' src/routes src/components/racik` returns nothing.
- `grep -rnoE 'rgba?\(' src/routes src/components/racik` returns only intentional photo overlays (the gradient over the recipe photo).
- Screens look the same as before (compare screenshots of Masak, a recipe, cook mode, Rencana, Koleksi, Pengaturan).

## Task 2. One type scale, nothing under 13 px (G2, G3)

**Goal:** the text-size setting changes every piece of text, and nothing is smaller than 13 px at Normal.

**Files:** `src/styles.css`; the 15 files with raw sizes (find with the grep below).

**Steps**
1. In `@theme inline`, change the floor:
   - `--text-micro: calc(13px * var(--teks, 1));` (was 11 px)
   - `--text-label: calc(14px * var(--teks, 1));` (was 12 px)
   - `section-label` utility: replace `font-size: 11px` with `var(--text-label)` (it is removed in task 3 anyway).
2. Add the missing scale steps as tokens, all multiplied by `--teks-h`, and use them instead of raw sizes:
   - `--text-hero` = `calc(32px * var(--teks-h, 1))` for screen titles (replaces every `text-[clamp(24px,7vw,30px)]`, `text-[clamp(26px,…)]`, `text-[clamp(28px,8vw,36px)]`).
   - `--text-timer` = `calc(46px * var(--teks-h, 1))` for the running timer (replaces `text-[clamp(36px,11vw,46px)]` and `text-[44px]`).
   - Cook step text: replace `text-[1.625em]` with `text-28`.
   - Photo glyph sizes (`text-[64px]`, `text-[44px]` in `RecipePhoto`) are decorative and may stay until task 8 removes them.
3. Replace each remaining `text-[Npx]` with the nearest token (`text-caption` 13, `text-14`, `text-15`, `text-body` 16, `text-17`, `text-read` 18, `text-head` 20, `text-title` 24, `text-28`). Delete both `text-[10px]`.
4. Exception: the three preview labels in Pengaturan › Ukuran tulisan (`text-[14px]`, `text-[16px]`, `text-[18px]`) are previews of the sizes and must stay fixed.
5. At **Paling besar**, walk every screen. Where something now wraps badly (the tab labels, chips, plan rows), let it wrap to two lines or stack; never truncate a quantity.

**Done when**
- `grep -rnE 'text-\[[0-9.]+(px|em)\]|text-\[clamp' src/routes src/components/racik` returns only the 3 Pengaturan previews and the `RecipePhoto` glyphs.
- At Normal, no rendered text is under 13 px (check in devtools on Masak, recipe, cook mode, Rencana).
- At Paling besar, no horizontal scroll at 360 px.

## Task 3. Sentence-case labels instead of ALL CAPS (G4)

**Goal:** remove tracked capitals; hierarchy comes from size and weight.

**Steps**
1. In `styles.css`, add two utilities and delete `eyebrow`, `eyebrow-ink`, `section-label` once nothing uses them:
   - `heading-sm`: `font-size: var(--text-head); font-weight: 700; line-height: 1.3; color: var(--color-ink-strong);` for section headings.
   - `meta-label`: `font-size: var(--text-caption); font-weight: 600; color: var(--color-ink-3);` for small field labels (Waktu, Tingkat).
2. Rewrite each caps string in sentence case. Full list to change:

   | Where | Now | Change to |
   |---|---|---|
   | `index.tsx` | WAKTU MAKAN / SESUAIKAN SARAN | Waktu makan / Sesuaikan saran (task 8 may remove them) |
   | `i18n.ts` | greeting_* "SELAMAT PAGI," etc. | "Selamat pagi" (no comma, no caps), and the same for siang / sore / malam |
   | `i18n.ts` | suggestions "SARAN UNTUKMU", shuffle "SARAN LAIN" | "Saran untukmu", "Saran lain" |
   | `resep.$id.tsx` | region chip `.toUpperCase()`, SISA BISA DIPAKAI, DARI LUAR, WAKTU, TINGKAT, PORSI | Remove `.toUpperCase()`; "Sisa bisa dipakai", "Dari luar", "Waktu", "Tingkat", "Porsi" |
   | `ProteinBlock.tsx` | PERKIRAAN GIZI PER PORSI, ESTIMASI, PROTEIN | "Perkiraan gizi per porsi"; drop "ESTIMASI" (the ± already says it) |
   | `resep.$id_.masak.tsx` | "LANGKAH n" chip, header counter in `uppercase`, timer labels in `uppercase` | "Langkah 3 dari 8" once, in the header at `text-15`; remove the chip; timer label sentence case |
   | `RencanaView.tsx` | DAFTAR BELANJA, PILIH RESEP, group names in `GROUPS` | "Daftar belanja", "Pilih resep", "Daging, ikan, tahu & telur", "Sayur & buah", "Bumbu segar", "Sembako & lainnya", "Lain-lain" |
   | `buku.tsx` | MILIKMU, RESEP DARI LUAR, RESEP FAVORIT | Remove "MILIKMU"; "Resep dari luar", "Resep favorit" |
   | `cari.tsx` | EKSPLOR RESEP, PILIH PROTEIN UTAMA, HAPUS FILTER, shelf titles (CEPAT & GAMPANG, BAHAN UTAMA, CARA MASAK, PILIHAN MAKAN, MASAKAN BARAT, PROTEIN TINGGI) | Remove the eyebrow; sentence case for the rest. Shelf titles live in the shelf definitions around line 126 of `cari.tsx` (also check `diet.ts`) |
   | `ambil.tsx` | TAMBAH RESEP eyebrow | Remove |
   | `pengaturan.tsx` | RACIK eyebrow; `eyebrow-ink` section heads | Remove the eyebrow; section heads use `heading-sm` |
   | `resepku.tsx`, `tulis*.tsx`, `u.$handle.tsx`, legal pages | RESEPKU, TULIS RESEP, RESEP YANG KAMU TULIS, DIBAGIKAN, DARI TAUTAN…, AKUN RACIK, KEBIJAKAN PRIVASI, SYARAT PENGGUNAAN | Sentence case |
3. Remove `tracking-[0.0Nem]` from anything that is no longer uppercase.

**Done when**
- `grep -rnE '\beyebrow|section-label|\buppercase\b|toUpperCase' src/routes src/components/racik` returns nothing.
- `grep -rnE '>[A-Z][A-Z ,&·-]{5,}<' src/routes src/components/racik` returns nothing.

## Task 4. Recipe page: one scroll, portions next to the ingredients (G5)

**File:** `src/routes/resep.$id.tsx` (and `IngredientList.tsx` only if needed for the header).

**Target order of the page**
1. Photo, back, favourite (unchanged).
2. Region and halal chips, title, "Dari luar" source box, note.
3. Stats row: **Waktu** and **Tingkat** only (value on top, `meta-label` below).
4. "Tambah ke rencana" button (unchanged logic).
5. **Sticky jump bar** (not tabs): two buttons "Bahan (10)" and "Langkah (6)" that scroll to the sections. Sticks under the top safe area while scrolling. Highlight the section in view.
6. **Bahan section**
   - Heading "Bahan" (`heading-sm`).
   - **Portion row** directly under the heading: left "Untuk **4** porsi"; right the existing −/+ buttons (44 px).
   - When the portions differ from `recipe.serv`, show under it: "Resep asli: {recipe.serv} porsi · **Kembalikan**". Tapping "Kembalikan" calls `step(recipe.serv)`.
   - The "Bumbu tidak dikali lurus…" note, only when `!recipe.precise`.
   - `IngredientList` (unchanged), then Alat and timbangan notes.
7. **Gizi section** (the nutrition block, moved here from the top card; task 5 changes its contents).
8. **Langkah section:** heading "Langkah", the numbered steps (the existing `<ol>` markup).
9. Sticky "Mulai masak · N porsi" button (unchanged).

Remove the `tab` state and the Bahan/Langkah tab buttons.

**Done when**
- Both the ingredients and the steps are visible by scrolling, with no tab tap.
- Changing portions then tapping "Kembalikan" restores the recipe's own count, and every amount returns to the authored value.
- The jump bar scrolls to each section and stays visible.
- At 360 px the first ingredient is reachable within 2 screen heights.

## Task 5. Nutrition: all five estimates for everyone (G6)

Decision (22 Oct): show **kalori, protein, karbo, lemak, serat** to every user. Still no scores or colours.

**Data (do this first, with Octavia reviewing the numbers)**
1. Add `FAT100` to `src/data/tables.json`: grams of fat per 100 g, keyed by the same ingredient ids as `PROT100`. Use the same source that `PROT100` / `CARB100` were built from (check the comments in `src/lib/racik/engine/protein.ts` and the data scripts). If it isn't recorded, use **TKPI (Tabel Komposisi Pangan Indonesia)** first and **USDA FoodData Central** for anything TKPI lacks, and record the source per entry in a comment or a sibling `FAT_SRC` map.
2. Cover at least every id in `PROT100` (289). Write the list of ids you could not source into the PR description for review.
3. Add `FAT100` to the `Tables` type and exports in `src/lib/racik/data.ts`.

**Engine** (`src/lib/racik/engine/protein.ts`)
1. Add `"F"` as a nutrient for `nutrientParts`, and export `fatParts` / `fatPerPortion`.
2. Add `kcalPerPortion(recipe)` = `4 × protein + 4 × karbo + 9 × lemak` (Atwater factors; say so in a comment).
3. Kalori is shown **only** when every ingredient line that has weight resolves protein, karbo **and** lemak. Otherwise it is "belum bisa dihitung". Reuse the rule in `proteinUncertain`.
4. Add `coverage(recipe)` that returns `{ counted, total }` for the sheet line "Dihitung dari 9 dari 10 bahan".
5. Tests in `engine.test.ts`: a recipe with all lines known gives kalori within 1 kcal of the hand sum; a recipe with an unknown line gives no kalori; scaling portions does not change per-portion values.

**UI**
1. Rename `ProteinBlock.tsx` to `NutritionBlock.tsx`. On the recipe page it shows one compact row of five, each "±value" over its name: **kkal, protein, karbo, lemak, serat**. Wrap to two rows at large text sizes. Header "Perkiraan gizi per porsi".
2. A value that can't be computed shows "belum bisa dihitung" in `text-ink-3`, never "–" or 0.
3. Tapping the row opens the existing breakdown sheet, extended with a toggle **Per porsi / Seluruh resep** (seluruh resep = per portion × `recipe.serv` × current scale) and the coverage line.
4. **Cards (changed 25 Oct, already built):** `CompactRecipe.tsx` and `RecipeCard.tsx` show only time plus kalori and protein (`nutritionLine(recipe, CARD_KEYS)`). No difficulty, no region, no karbo/lemak/serat on cards. Do not add them back.

**Done when**
- Five values on the recipe page, kalori and protein on cards, all with "±".
- No "–" anywhere in nutrition (`grep -n '"–"' src/components/racik/NutritionBlock.tsx` returns nothing).
- New engine tests pass.

## Task 6. Cook mode fixes (G7)

**File:** `src/routes/resep.$id_.masak.tsx`. Do not change the light/dark theme.

1. **Ringing timer** (`StepTimer` ringing state and the header tray's ringing pill): replace every red (`#c62828`, `#b71c1c`, `#fdecea`, `#e8b4b0`) with the new `--time`, `--time-soft`, `--time-ink` tokens from task 1. Red is reserved for errors and halal. Keep `role="alert"`, the pulse icon, sound and vibration.
2. **Running state** also uses the `--time*` tokens instead of `primary`, so "time" has one colour across the app (the time chip in task 8 uses the same tokens).
3. **Labels:** remove `uppercase` / tracking from "Sedang berjalan", "Dijeda", "Waktu langkah ini", "Waktunya habis" (sentence case, `text-14 font-bold`). Header counter "Langkah 3 dari 8" at `text-15 font-bold text-ink-2`, not caps. Remove the "LANGKAH n" chip above the step text.
4. **Disabled "Sebelumnya"**: replace `disabled:text-ink-3/50` with `disabled:text-ink-3 disabled:border-dashed`. Contrast must stay at least 4.5:1.
5. **Running-timer tray to the bottom:** move the `otherTimers` list out of the sticky header into the sticky bottom bar, directly above the Sebelumnya/Lanjut buttons, so it's in thumb reach. Cap it at 2 rows visible with "+N lainnya" that expands. The header keeps back, title, counter, Bahan, progress bar.
6. **Leaving with a timer running:** when the person taps back and any timer is running, show a confirm sheet (use the existing `Sheet`): "Timer masih berjalan. Keluar dari mode masak?" with "Tetap di sini" (primary) and "Keluar" (timers keep running, since they are wall-clock). No browser `confirm()`.

**Done when**
- `grep -nE 'c62828|b71c1c|fdecea|e8b4b0|uppercase' src/routes/resep.\$id_.masak.tsx` returns nothing.
- With two timers running on steps 1 and 3, while on step 5 both show above the bottom buttons, tapping one jumps to its step, and both ring.
- Back with a timer running shows the sheet.

## Task 7. Rencana: days, undo, confirm (G8)

**Files:** `src/lib/racik/store.ts` (plan entry type + `normaliseState`), `src/lib/racik/backend/sync.ts` (merge keeps `day`), `src/components/racik/RencanaView.tsx`, `src/routes/resep.$id.tsx` ("Tambah ke rencana").

1. **Optional day.** Plan entry becomes `{ id, servings, day?: 0|1|2|3|4|5|6 }` (0 = Senin). `normaliseState` keeps a valid `day` and drops anything else. Sync merges it like `servings`.
2. **Rencana layout:** sections "Belum dijadwalkan", then Senin to Minggu, each only shown when it has recipes, today's day labelled "Hari ini". Each plan row gets a small "Hari" control (a menu or sheet with the 7 days plus "Belum dijadwalkan"). Header shows "{n} dari 15 resep minggu ini".
3. **Add from a recipe:** "Tambah ke rencana" adds with no day (fast path). The toast (task 9) says "Ditambahkan ke rencana" with action "Pilih hari".
4. **Remove** a recipe from the plan → undo snackbar "Dihapus dari rencana · Urungkan" (task 9).
5. **"Kosongkan rencana"** → confirm sheet: "Kosongkan rencana? Semua resep, centang belanja, dan daftar 'ada di rumah' akan dihapus." Buttons "Batal" / "Kosongkan" (destructive style).
6. **Fix small things:** the "ada di rumah" toggle's `text-[10px]` → `text-caption`; group names per task 3; the remove `X` button `size-10` → `size-11`.
7. The shopping list ignores days (it covers the whole plan). Do not change `shopping.ts`.

**Done when**
- A recipe can be given a day, moved to another day, and set back to "Belum dijadwalkan"; days survive reload and sync.
- Removing shows undo, and undo restores the entry with its servings and day.
- Unit tests in `store.test.ts`: `normaliseState` keeps a valid `day`, drops `day: 9`, and still caps the plan at 15.

## Task 8. Masak (home): fewer filters, better empty photos (G9)

**Files:** `src/routes/index.tsx`, `src/components/racik/RecipePhoto.tsx`, `src/lib/racik/recommend.ts`.

1. **One filter row.** Remove the "Waktu makan" tile row. The meal slot comes from `currentSlot()` (already used for the "Masak apa malam ini?" title). Make the title itself the control: tapping "malam ini" opens a small sheet to pick Sarapan / Siang / Malam / Camilan.
2. Keep one horizontal chip row (today's "Sesuaikan saran" chips) directly above "Saran untukmu", with no heading.
3. **Photoless tiles:** in `RecipePhoto`, when there is no photo, render a `bg-tint` tile with the first letters of the dish (e.g. "OA" for Opor Ayam) in `text-head font-bold text-ink-2`. No emoji, no dark green. The ingredient `em` emoji stays in the data but is no longer shown on recipe tiles.
4. **Rank photo recipes first** in `suggest()`: as a tiebreaker only, so personal fit still wins.

**Done when**
- At 360 × 740 the first recipe card is visible without scrolling.
- No emoji renders as a recipe image anywhere (check Masak, Cari shelves, Koleksi, Rencana picker).

## Task 9. Shared undo snackbar (G10)

1. Create `src/components/racik/Snackbar.tsx`: one at a time, bottom of the screen above the tab bar (respect `env(safe-area-inset-bottom)`), message + one action, `role="status"`, 6 s then hides. Not shown in cook mode.
2. Expose `useSnackbar()` from `state.tsx` (or a small context) with `show({ message, actionLabel, onAction })`.
3. Use it for: remove from plan (task 7), add to plan ("Ditambahkan ke rencana · Lihat"), remove from Favorit, delete an imported recipe in Koleksi (keep a copy in memory so Urungkan restores it).

**Done when** each of those four actions can be undone within 6 s, and the restored item is identical (same id, servings, day, position).

## Task 10. Language switch and English coverage (G11)

Decision (22 Oct): the switch lives in **Pengaturan** and the **Profil/Akun** area. English must cover the whole app before `ENGLISH_ENABLED` is turned on.

1. Route every user-facing string through `t()`. Start with the files that have none today: `ProteinBlock`/`NutritionBlock`, `CompactRecipe`, `HalalChip`, `IngredientList`, `PortionStepper`, `RencanaView`, `buku.tsx`, `rencana.tsx`, `resep.$id.tsx`, `resep.$id_.masak.tsx`, `resep.$id_.selesai.tsx`, `Onboarding`, `ImportDemo` (all user messages, including `import-messages.ts`), `Sheet` titles, `ambil.tsx`, `tulis*.tsx`, `resepku.tsx`. Legal pages (`privasi`, `syarat`) stay Indonesian.
2. Keys go in `i18n.ts` `DICT` as `[id, en]`. Indonesian wording does not change.
3. Add a "Bahasa" row to the account area (`AccountSection.tsx`, which is the Profil/Akun part of Pengaturan) and to the top of `resepku.tsx`, both writing `state.lang`. Pengaturan keeps its row.
4. Before turning English on, check the Pengaturan row labels in English at 360 px; the October audit saw "Language" clipped to "Languag" (the label column needs `min-w-0` and wrapping).
5. Turn on `ENGLISH_ENABLED` only when step 6 passes.
6. Add a script `scripts/check-i18n.mjs` that fails if any `.tsx` under `src/routes` or `src/components/racik` (except legal pages) contains a JSX text node with 3+ letters that isn't inside `t(...)`. Wire it into `npm run build`.

**Done when** the check script passes and a walk of every tab in English shows no Indonesian UI text (recipe content itself stays Indonesian).

## Task 11. Accessibility sweep (G12)

1. Every icon-only button is at least `size-11` and has an Indonesian `aria-label` (e.g. `buku.tsx` delete buttons are `size-10`).
2. Visible focus ring on all buttons and links: add a base rule `:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }` in `styles.css`.
3. Status never by colour alone: halal chip, ringing timer, checked shopping items all have an icon or word as well (check each).
4. Run Lighthouse accessibility on Masak, a recipe, Rencana. Target 95+. Paste the scores in the PR.

---

## Order and batching

| Batch | Tasks | When |
|---|---|---|
| A | 0, 1, 2, 3 | Now. Mechanical, low risk, unlocks everything else |
| B | 4, 6, 9, 11 | Before the Play closed test |
| C | 5, 7, 8 | During the closed test (5 needs Octavia to review fat data) |
| D | 10 | Before English is switched on |

**Stop and ask Octavia** if a task would change a colour value, the font, the cook-mode theme, or any copy meaning (not just casing). Everything else in this plan is pre-approved.
