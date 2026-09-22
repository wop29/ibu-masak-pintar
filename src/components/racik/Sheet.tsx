import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      <Button
        variant="ghost"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 h-auto w-auto rounded-none bg-ink/55 hover:bg-ink/55"
      />
      <div className="relative w-full rounded-t-3xl bg-ground">
        <div className="hairline-b flex items-center justify-between px-5 py-4">
          <h2 className="font-display text-head font-bold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Tutup"><X /></Button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
