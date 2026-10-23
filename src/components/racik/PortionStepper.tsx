import { Minus, Plus } from "lucide-react";
import { t } from "@/lib/racik/i18n";
import { Button } from "@/components/ui/button";

export function PortionStepper({
  value,
  onChange,
  min = 1,
  max = 20,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-rule bg-card">
      <Button variant="ghost" size="icon"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={t("kurangi_porsi")}
      >
        <Minus />
      </Button>
      <div className="w-16 text-center">
        <span className="text-head font-semibold tabular-nums">{value}</span>
        <span className="text-label text-ink-3"> {t("portions")}</span>
      </div>
      <Button variant="ghost" size="icon"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={t("tambah_porsi")}
      >
        <Plus />
      </Button>
    </div>
  );
}
