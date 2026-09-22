import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRacik } from "@/lib/racik/state";
import { ART } from "@/components/racik/photos";

const slides = [
  { image: ART.rendang, label: "SELAMAT DATANG DI", title: "Racik", body: "Daging mengikuti jumlah porsi. Bumbu naik lebih pelan, supaya rasa tidak berlebihan." },
  { image: ART.mendoan, label: "BAHASA DAPUR KITA", title: "Gelas belimbing, bukan mililiter", body: "800 ml santan itu kira-kira 4 gelas belimbing. Racik menulis dua-duanya, jadi tidak perlu timbangan atau gelas ukur." },
  { image: ART.gado, label: "YANG JARANG ADA", title: "Tahu isinya berapa", body: "Perkiraan protein per porsi, supaya tahu masakannya sudah cukup mengenyangkan atau belum. Perkiraan, bukan hasil uji lab." },
  { image: ART.woku, label: "KALAU KETEMU DI HP", title: "Tempel tautannya, selesai", body: "Tempel tautan atau keterangan videonya. Racik merapikan bahan dan langkahnya." },
] as const;

export function Onboarding() {
  const [index, setIndex] = useState(0);
  const { update } = useRacik();
  const slide = slides[index] ?? slides[0];
  return (
    <main className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-dark text-primary-foreground">
      <img src={slide.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-dark/15 via-dark/25 to-dark" />
      <div className="relative flex min-h-dvh flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          {index > 0 ? <Button variant="ghost" size="icon" aria-label="Kembali" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setIndex((v) => v - 1)}><ArrowLeft /></Button> : <div className="h-12 w-12" />}
          <div className="flex flex-1 gap-2">{slides.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= index ? "bg-primary-foreground" : "bg-primary-foreground/35"}`} />)}</div>
          <Button variant="ghost" className="px-2 text-label text-primary-foreground/80 hover:bg-primary-foreground/10" onClick={() => update({ intro: true })}>Lewati</Button>
        </div>
        <div className="mt-auto">
          <p className="inline-flex rounded-full bg-dark/55 px-3 py-1.5 text-label font-semibold">{slide.label}</p>
          <h1 className="mt-4 text-display font-extrabold leading-[1.08]">{slide.title}</h1>
          <p className="mt-4 text-body leading-relaxed text-primary-foreground/80">{slide.body}</p>
          <Button size="lg" className="mt-6 w-full" onClick={() => index === slides.length - 1 ? update({ intro: true }) : setIndex((v) => v + 1)}>{index === 0 ? "Mulai" : index === slides.length - 1 ? "Mulai masak" : "Lanjut"}</Button>
        </div>
      </div>
    </main>
  );
}