import type { ReactNode } from "react";

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <button
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-ink/55"
      />
      <div className="relative w-full bg-ground">
        <div className="hairline-b flex items-center justify-between px-5 py-4">
          <h2 className="font-display text-head">{title}</h2>
          <button onClick={onClose} className="text-secondary text-ink-3 px-2 py-1">
            Tutup
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
