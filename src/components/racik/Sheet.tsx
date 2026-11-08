import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { t } from "@/lib/racik/i18n";

/**
 * Bottom sheet: dimmed backdrop, white panel, grab handle, title and a round close button.
 * From 768 px up the same sheet is a centred dialog (max 560 px), without the grab handle.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  large = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Big Baloo 2 headline in deep green, for full-attention moments (import progress). */
  large?: boolean;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    // Escape closes; focus moves into the sheet and back where it was after.
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center tab:items-center tab:p-6">
      <button
        type="button"
        aria-label={t("tutup")}
        onClick={onClose}
        className="absolute inset-0 bg-scrim backdrop-blur-[2px]"
      />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet-up relative max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl bg-card px-5 pt-3 outline-none pb-[max(32px,env(safe-area-inset-bottom))] shadow-sheet tab:max-h-[85dvh] tab:max-w-[560px] tab:rounded-3xl tab:px-7 tab:pt-7 tab:pb-8"
      >
        <div className="mb-5 flex justify-center tab:hidden">
          <span className="h-1 w-10 rounded-full bg-rule" />
        </div>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              className={
                large
                  ? "font-display text-[calc(32px*var(--teks-h,1))] font-extrabold leading-[1.02] tracking-[-0.01em] text-ink-strong"
                  : "text-[calc(22px*var(--teks-h,1))] font-extrabold leading-tight tracking-[-0.03em]"
              }
            >
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-14 leading-normal text-ink-3">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("tutup")}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint text-primary-deep"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
