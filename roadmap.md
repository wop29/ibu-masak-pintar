# Racik — roadmap

## Milestone 1 (in progress)
- [x] Sample seed data: 15 recipes, ~60 ingredients, 7 regions, supporting tables
- [ ] Engine as pure functions + tests (unitOf, scaleFactor, roundQty, fmtQty, takaran, protein, halal, undividable, stepIngredients, search)
- [ ] Design tokens + type scale in src/styles.css, fonts via root head
- [ ] Recipe list stub at /
- [ ] Recipe detail /resep/$id (portion stepper, ingredients, steps, protein, halal sheet, substitutes)
- [ ] Cook mode /resep/$id/masak
- [ ] Done screen /resep/$id/selesai (photo frame, difficulty rating)
- [ ] Import demo at /buku
- [ ] Local state in IndexedDB with localStorage fallback
- [ ] Verification checklist (34 chillies at 12, ~8 at 1, no dot decimals, Es Cendol ~4 g, etc.)

## Copy rules (updated by user request)
- [ ] Inclusive language: never address the reader as "Ibu"; no gendered wording.
      Avoid pronouns where possible; neutral phrasing for all genders.

## Later milestones
- Masak Apa, Cari Resep, Buku Resep tabs, meal plan + shopping list
- Onboarding (4 slides), settings, PWA shell
- Real video import (needs a backend)
