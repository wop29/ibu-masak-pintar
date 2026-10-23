"""Review sheet for the fat table: python3 scripts/fat-review-xlsx.py <out.xlsx>"""
import json
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

out = sys.argv[1]
t = json.load(open("src/data/tables.json", encoding="utf-8"))
src = json.load(open("src/data/fat-sources.json", encoding="utf-8"))
ing = {i["id"]: i for i in json.load(open("src/data/ingredients.json", encoding="utf-8"))}

F = "Arial"
wb = Workbook()
ws = wb.active
ws.title = "Tabel Lemak"
ws["A1"] = "Racik — Tabel lemak per 100 g (untuk dicek)"
ws["A1"].font = Font(name=F, bold=True, size=14)
ws["A2"] = ("Gram lemak per 100 g bagian yang dimakan, sama dengan dasar protein dan karbo. "
            "Baris kuning = 'Perlu dicek'. Ganti angka di kolom C kalau salah, lalu kirim balik; "
            "Claude memasukkannya lewat scripts/fat_values.py. Protein dan karbo hanya untuk konteks.")
ws["A2"].font = Font(name=F, italic=True, color="555555")
ws.merge_cells("A2:G2")
ws["A2"].alignment = Alignment(wrap_text=True)
ws.row_dimensions[2].height = 45
hdr = ["ID", "Nama bahan", "Lemak per 100 g", "Protein per 100 g (sudah ada)", "Karbo per 100 g (sudah ada)", "Sumber", "Yakin?"]
for j, h in enumerate(hdr, 1):
    c = ws.cell(row=4, column=j, value=h)
    c.font = Font(name=F, bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="2E7D32")
    c.alignment = Alignment(wrap_text=True, vertical="center")
yellow = PatternFill("solid", fgColor="FFF59D")
rows = sorted(t["FAT100"], key=lambda k: (src[k]["yakin"], ing[k]["name"].lower()))
for i, k in enumerate(rows, 5):
    vals = [k, ing[k]["name"], t["FAT100"][k], t["PROT100"].get(k), t["CARB100"].get(k), src[k]["src"],
            "Ya" if src[k]["yakin"] else "Perlu dicek"]
    for j, v in enumerate(vals, 1):
        c = ws.cell(row=i, column=j, value=v)
        c.font = Font(name=F, color="0000FF") if j == 3 else Font(name=F)
        if j in (3, 4, 5):
            c.number_format = "0.0"
        if not src[k]["yakin"]:
            c.fill = yellow
last = 4 + len(rows)
dv = DataValidation(type="list", formula1='"Ya,Perlu dicek"', allow_blank=False)
ws.add_data_validation(dv)
dv.add(f"G5:G{last}")
for col, w in zip("ABCDEFG", (24, 30, 12, 14, 14, 70, 12)):
    ws.column_dimensions[col].width = w
ws.freeze_panes = "C5"
ws.auto_filter.ref = f"A4:G{last}"
wb.save(out)
print(len(rows), "rows;", sum(1 for k in rows if not src[k]["yakin"]), "perlu dicek")
