import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HandleForm } from "@/components/racik/share/HandleForm";
import { byId } from "@/lib/racik/data";
import { useAccount } from "@/lib/racik/backend/useAccount";
import { myRecipes } from "@/lib/racik/backend/recipes";
import { myHandle, myShareStats, summarise, type StatsSummary } from "@/lib/racik/backend/share";
import type { UserRecipe } from "@/lib/racik/backend/types";

export const Route = createFileRoute("/resepku")({
  head: () => ({ meta: [{ title: "Resepku — Racik" }, { name: "robots", content: "noindex" }] }),
  component: Resepku,
});

const n = (v: number) => v.toLocaleString("id-ID");

/**
 * Her own numbers, visible only to her: how often her links were opened,
 * and how many people saved or finished cooking a recipe because of them.
 */
function Resepku() {
  const { account, ready, available } = useAccount();
  const [profile, setProfile] = useState<
    { handle: string | null; publicName: string | null } | null | undefined
  >(undefined);
  const [stats, setStats] = useState<StatsSummary | null | undefined>(undefined);
  const [mine, setMine] = useState<UserRecipe[]>([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!account) return;
    myHandle().then(setProfile);
    myRecipes().then(setMine);
    myShareStats().then((rows) => {
      if (!rows) return setStats(null);
      // Catalogue titles come from the app; user and imported ones from the server.
      setStats(
        summarise(rows, (kind, ref) => (kind === "catalogue" ? (byId(ref)?.title ?? null) : null)),
      );
    });
  }, [account]);

  const shell = (body: React.ReactNode) => (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card pb-16">
      <header className="flex items-center gap-3 px-5 pb-4 pt-[calc(2rem+env(safe-area-inset-top))]">
        <Link
          to="/tulis"
          aria-label="Kembali"
          className="flex size-11 items-center justify-center rounded-full border border-rule"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-head font-extrabold">Siapa yang memasaknya</h1>
        </div>
      </header>
      <div className="px-5">{body}</div>
    </main>
  );

  if (!available) {
    return shell(
      <p className="rounded-2xl border border-rule bg-notice p-4 read-line">
        Racik belum tersambung ke server, jadi angkanya belum bisa ditampilkan.
      </p>,
    );
  }
  if (!ready) return shell(null);
  if (!account) {
    return shell(
      <div className="grid gap-3">
        <p className="read-line text-ink-2">
          Masuk untuk memilih nama pengguna dan melihat berapa orang membuka, menyimpan, dan memasak
          resep yang kamu bagikan.
        </p>
        <Button asChild size="lg">
          <Link to="/masuk">Masuk</Link>
        </Button>
      </div>,
    );
  }

  return shell(
    <div className="grid gap-8">
      <section className="rounded-2xl border border-rule p-4">
        {profile === undefined ? (
          <p className="text-14 text-ink-3">Memuat…</p>
        ) : profile?.handle && !editing ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-body font-extrabold">@{profile.handle}</p>
              <p className="truncate text-14 text-ink-3">
                {profile.publicName || "Tanpa nama tampilan"}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/u/$handle" params={{ handle: profile.handle }}>
                  Lihat profil
                </Link>
              </Button>
              <Button variant="ghost" className="min-h-11" onClick={() => setEditing(true)}>
                Ubah
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="mb-2 text-body font-extrabold">Nama pengguna</h2>
            <HandleForm
              initialHandle={profile?.handle ?? null}
              initialName={profile?.publicName ?? null}
              onSaved={(handle, publicName) => {
                setProfile({ handle, publicName });
                setEditing(false);
              }}
            />
          </>
        )}
      </section>

      <section>
        <h2 className="heading-sm">Dari tautan yang kamu bagikan</h2>
        {stats === undefined ? (
          <p className="mt-3 text-14 text-ink-3">Memuat angka…</p>
        ) : stats === null ? (
          <p className="mt-3 text-14 text-ink-3">
            Angkanya belum bisa diambil sekarang. Coba lagi nanti.
          </p>
        ) : stats.recipes.length === 0 ? (
          <p className="mt-3 read-line text-ink-2">
            Belum ada. Setelah selesai memasak, ketuk <b>Bagikan</b> untuk membuat kartu hasil
            masakanmu. Angkanya muncul di sini.
          </p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 rounded-2xl bg-primary-soft py-4 text-center">
              {[
                [stats.opens, "dibuka"],
                [stats.saves, "disimpan"],
                [stats.cooks, "dimasak"],
              ].map(([v, l], i) => (
                <div key={String(l)} className={i ? "border-l border-primary-line" : ""}>
                  <p className="text-2xl font-extrabold text-primary-deep tabular-nums">
                    {n(Number(v))}
                  </p>
                  <p className="text-micro text-ink-3">{l}</p>
                </div>
              ))}
            </div>
            {stats.cooks > 0 ? (
              <p className="mt-3 text-body font-bold">
                Dimasak {n(stats.cooks)} orang lewat tautanmu.
              </p>
            ) : null}
            {stats.top ? (
              <p className="mt-2 text-14 text-ink-2">
                Paling banyak: <b>{stats.top.title}</b> ({n(stats.top.opens)} kali dibuka
                {stats.top.cooks ? `, dimasak ${n(stats.top.cooks)} orang` : ""}).
              </p>
            ) : null}
            {stats.byFormat.story + stats.byFormat.feed > 0 ? (
              <p className="mt-2 text-14 text-ink-2">
                Kartu Story/Status dibuka {n(stats.byFormat.story)} kali, kartu feed{" "}
                {n(stats.byFormat.feed)} kali
                {stats.byFormat.story !== stats.byFormat.feed
                  ? ` — ${stats.byFormat.story > stats.byFormat.feed ? "Story/Status" : "feed"} lebih banyak dibuka.`
                  : "."}
              </p>
            ) : null}

            <ul className="mt-5">
              {stats.recipes.map((r) => (
                <li
                  key={r.key}
                  className="flex items-center justify-between gap-3 border-b border-rule py-3"
                >
                  <span className="min-w-0 flex-1 text-body font-bold">{r.title}</span>
                  <span className="shrink-0 text-right text-caption text-ink-3 tabular-nums">
                    {n(r.opens)} dibuka · {n(r.saves)} disimpan · {n(r.cooks)} dimasak
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-caption text-ink-3">
              Satu HP dihitung sekali sehari per tautan. Ketukanmu sendiri tidak dihitung. Hanya
              kamu yang bisa melihat angka ini.
            </p>
          </>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="heading-sm">Resep yang kamu tulis</h2>
          <Link
            to="/tulis/baru"
            className="flex min-h-11 items-center gap-1 text-14 font-bold text-primary"
          >
            <PenLine className="size-4" /> Tulis
          </Link>
        </div>
        {mine.length ? (
          <ul className="mt-2">
            {mine.map((r) => (
              <li key={r.id}>
                <Link
                  to="/tulis/baru"
                  search={{ d: r.id }}
                  className="flex min-h-14 items-center justify-between gap-3 border-b border-rule py-3"
                >
                  <span className="min-w-0 flex-1 text-body font-bold">{r.title}</span>
                  <span className="shrink-0 text-caption text-ink-3">
                    {r.status === "live"
                      ? `Terbit · dimasak ${n(r.cookedCount)}`
                      : r.status === "draft"
                        ? "Draf"
                        : "Disembunyikan"}
                  </span>
                  <ChevronRight aria-hidden className="size-4 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-14 text-ink-3">Belum ada resep yang kamu terbitkan.</p>
        )}
      </section>
    </div>,
  );
}
