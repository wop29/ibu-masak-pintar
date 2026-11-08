import { useMemo } from "react";
import { encode } from "uqr";
import { t } from "@/lib/racik/i18n";

/** Where the QR points: the same recipe on the public site. */
export const PHONE_ORIGIN = "https://racik.online";

/**
 * "Buka di HP" for tablet and computer: a QR of this recipe's racik.online
 * address, drawn as an SVG on the device (no QR service, no new library: uqr
 * already draws the share-card QR). Hidden on the phone by its parent.
 */
export function OpenOnPhone({
  recipeId,
  savedInAccount,
}: {
  recipeId: string;
  savedInAccount: boolean;
}) {
  const url = `${PHONE_ORIGIN}/resep/${encodeURIComponent(recipeId)}`;
  const path = useMemo(() => {
    const qr = encode(url, { ecc: "M", border: 0 });
    let d = "";
    qr.data.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { d, size: qr.size };
  }, [url]);

  return (
    <div className="flex w-[148px] flex-col items-center gap-2 rounded-2xl border border-rule bg-card p-3 text-center">
      <svg
        viewBox={`-2 -2 ${path.size + 4} ${path.size + 4}`}
        className="size-[104px] rounded-lg bg-white text-ink-strong"
        role="img"
        aria-label={t("qr_buka_di_hp_label")}
        shapeRendering="crispEdges"
      >
        <path d={path.d} fill="currentColor" />
      </svg>
      <p className="text-caption font-extrabold leading-tight text-ink-strong">
        {t("pindai_buka_di_hp")}
      </p>
      <p className="text-micro leading-snug text-ink-3">{t("segera_di_google_play")}</p>
      {savedInAccount ? (
        <p className="text-micro leading-snug text-primary-deep">
          {t("resep_sudah_tersimpan_buka_di_hp")}
        </p>
      ) : null}
    </div>
  );
}
