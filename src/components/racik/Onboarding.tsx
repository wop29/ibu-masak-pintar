import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRacik } from "@/lib/racik/state";
import { ART } from "@/components/racik/photos";
import { PortionStepper } from "@/components/racik/PortionStepper";

const slides = [
  { image: ART.rendang, label: "SELAMAT DATANG DI", title: "Racik", body: "Naikkan rendang dari 4 ke 12 porsi. Dagingnya memang jadi tiga kali lipat. Tapi cabainya 34, bukan 51 — karena bumbu tidak pernah dikali seperti itu." },
  { image: ART.mendoan, label: "BAHASA DAPUR KITA", title: "Gelas belimbing, bukan mililiter", body: "800 ml santan itu kira-kira 4 gelas belimbing. Racik menulis dua-duanya, jadi tidak perlu timbangan atau gelas ukur." },
  { image: ART.gado, label: "YANG JARANG ADA", title: "Tahu isinya berapa", body: "Perkiraan protein per porsi, supaya tahu masakannya sudah cukup mengenyangkan atau belum. Perkiraan, bukan hasil uji lab." },
  { image: ART.woku, label: "KALAU KETEMU DI HP", title: "Tempel tautannya, selesai", body: "Tempel tautan atau keterangan videonya. Racik merapikan bahan dan langkahnya." },
] as const;

export function Onboarding() {
  const [index, setIndex] = useState(0);
  const { state, update } = useRacik();
  const slide = slides[index] ?? slides[0];

  /**
   * One question, at the end, and it is the only one worth asking.
   *
   * Luma asks for a bio because strangers size each other up before an event.
   * Nobody reads a bio to decide whether to cook someone's rendang. What
   * Racik actually needs is the number of people she cooks for, because every
   * recipe in the app opens at that count and every measurement follows it.
   *
   * It needs no account, it changes the product immediately, and it already
   * has a sensible default — so there is a Lewati on it too.
   */
  if (index === slides.length) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-card px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Kembali" onClick={() => setIndex((v) => v - 1)}><ArrowLeft /></Button>
          <div className="flex flex-1 gap-2">{[...slides, null].map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= index ? "bg-primary" : "bg-rule"}`} />)}</div>
          <Button variant="ghost" className="px-2 text-label text-muted-foreground" onClick={() => update({ intro: true })}>Lewati</Button>
        </div>
        <div className="mt-auto">
          <p className="eyebrow">SATU HAL SAJA</p>
          <h1 className="mt-2 text-display font-extrabold leading-[1.08]">Masak untuk berapa orang?</h1>
          <p className="mt-4 read-line text-ink-2">
            Setiap resep akan langsung terbuka di jumlah ini, dan semua takarannya ikut.
            Bisa diubah kapan saja di setiap resep.
          </p>
          <div className="mt-6 flex justify-center">
            <PortionStepper value={state.household} onChange={(v) => update({ household: v })} />
          </div>
          <Button size="lg" className="mt-8 w-full" onClick={() => update({ intro: true })}>Mulai masak</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-dark text-primary-foreground">
      <img src={slide.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-dark/15 via-dark/25 to-dark" />
      <div className="relative flex min-h-dvh flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          {index > 0 ? <Button variant="ghost" size="icon" aria-label="Kembali" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setIndex((v) => v - 1)}><ArrowLeft /></Button> : <div className="h-12 w-12" />}
          <div className="flex flex-1 gap-2">{[...slides, null].map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= index ? "bg-primary-foreground" : "bg-primary-foreground/35"}`} />)}</div>
          <Button variant="ghost" className="px-2 text-label text-primary-foreground/80 hover:bg-primary-foreground/10" onClick={() => update({ intro: true })}>Lewati</Button>
        </div>
        <div className="mt-auto">
          <p className="inline-flex rounded-full bg-dark/55 px-3 py-1.5 text-label font-semibold">{slide.label}</p>
          <h1 className="mt-4 text-display font-extrabold leading-[1.08]">{slide.title}</h1>
          <p className="mt-4 text-body leading-relaxed text-primary-foreground/80">{slide.body}</p>
          <Button size="lg" className="mt-6 w-full" onClick={() => setIndex((v) => v + 1)}>{index === 0 ? "Mulai" : "Lanjut"}</Button>
        </div>
      </div>
    </main>
  );
}