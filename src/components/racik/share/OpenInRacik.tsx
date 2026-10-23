import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/**
 * For someone who arrived from a shared link and has never used Racik. On a
 * phone with the app installed, the same link already opens inside it.
 */
export function OpenInRacik() {
  return (
    <aside className="mx-5 mt-10 rounded-3xl border border-primary-line bg-primary-soft p-5">
      <p className="text-head font-extrabold text-primary-deep">Takarannya jelas</p>
      <p className="mt-1 read-line text-ink-2">
        Racik menghitung ulang takaran resep rumahan sesuai jumlah porsimu, lalu menemanimu memasak
        langkah demi langkah. Gratis, tanpa daftar.
      </p>
      <Button asChild size="lg" className="mt-4 w-full">
        <Link to="/">Buka di Racik</Link>
      </Button>
    </aside>
  );
}
