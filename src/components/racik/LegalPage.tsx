import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { LEGAL } from "@/lib/racik/legal";

/** Shared by /privasi and /syarat: a plain reading page with a back button. */
export function LegalPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card px-5 pb-16">
      <header className="flex items-center gap-3 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-4">
        <Link
          to="/"
          aria-label="Kembali"
          onClick={(e) => {
            if (window.history.length > 1) {
              e.preventDefault();
              window.history.back();
            }
          }}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-rule bg-card text-ink"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <p className="eyebrow">{eyebrow}</p>
      </header>
      <h1 className="text-title font-extrabold leading-tight tracking-[-0.02em]">{title}</h1>
      <p className="mt-1 text-caption text-ink-3">Berlaku sejak {LEGAL.EFFECTIVE_DATE}</p>
      <div className="mt-4 text-15 leading-relaxed text-ink-2">{intro}</div>
      <div className="mt-2 [overflow-wrap:anywhere]">{children}</div>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-rule pt-5 mt-6">
      <h2 className="text-head font-extrabold leading-snug">{title}</h2>
      <div className="mt-2 space-y-3 text-15 leading-relaxed text-ink-2 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">{children}</div>
    </section>
  );
}

export const Mail = () => (
  <a href={`mailto:${LEGAL.CONTACT_EMAIL}`} className="font-semibold text-primary underline underline-offset-2">
    {LEGAL.CONTACT_EMAIL}
  </a>
);

