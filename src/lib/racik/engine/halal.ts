import { ING } from "../data";
import type { Recipe } from "../types";

export type HalalStatus = "halal" | "syubhat" | "haram";

export function analyseHalal(recipe: Recipe): {
  status: HalalStatus;
  label: string;
  certIds: string[];
} {
  const certIds = recipe.ings.map((l) => l[0]).filter((id) => ING[id]?.halal === "cert");
  const status: HalalStatus = certIds.length > 0 ? "syubhat" : "halal";
  return {
    status,
    label: status === "halal" ? "bahan halal" : "perlu dicek",
    certIds,
  };
}

export const HALAL_ROWS = (status: HalalStatus, certNames: string[]): string[] => [
  status === "halal"
    ? "Tidak ada bahan haram di daftar ini."
    : `Ada bahan yang statusnya tergantung merek: ${certNames.join(", ")}.`,
  "Status tergantung merek — cek label kemasannya.",
  "Cara penyembelihan tidak bisa Racik pastikan.",
  "Kebersihan dapur tidak bisa Racik pastikan.",
];

export const HALAL_FOOTNOTE =
  "Racik bukan lembaga sertifikasi halal. Keterangan di sini menilai bahan, bukan merek, penyembelihan, atau dapurnya.";
