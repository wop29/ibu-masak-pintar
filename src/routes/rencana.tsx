import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { AppTabs } from "@/components/racik/AppTabs";
import { RencanaView } from "@/components/racik/RencanaView";

export const Route = createFileRoute("/rencana")({
  head: () => ({ meta: [{ title: "Rencana Masak — Racik" }, { name: "description", content: "Rencana masak seminggu dan daftar belanja yang bahannya sudah digabung." }] }),
  component: Rencana,
});

function Rencana() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-ground pb-24">
      <header className="border-b border-[#f0f0ed] bg-card px-5 pb-5 pt-[calc(3.5rem+env(safe-area-inset-top))]">
        <div className="flex items-start justify-between">
          <h1 className="text-[clamp(24px,7vw,30px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#111]">Rencana</h1>
          <Link to="/pengaturan" aria-label="Pengaturan" className="mt-1 flex size-11 items-center justify-center rounded-full border border-[#e8e8e4] bg-tint text-[#555]"><Settings className="size-4" /></Link>
        </div>
      </header>
      <div className="flex-1"><RencanaView /></div>
      <AppTabs />
    </main>
  );
}
