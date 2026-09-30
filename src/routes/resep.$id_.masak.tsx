import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { byId, ING } from "@/lib/racik/data";
import { fmtQty, scaledQty, stepIngredients, takaran, unitOf } from "@/lib/racik/engine";
import { useRacik } from "@/lib/racik/state";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/resep/$id_/masak")({
  loader: ({ params }) => {
    const recipe = byId(params.id) ?? null;
    if (!recipe && !params.id.startsWith("import-")) throw notFound();
    return { recipe };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.recipe
      ? `Masak ${loaderData.recipe.title} — Racik`
      : "Mode masak — Racik";
    return {
      meta: [
        { title },
        {
          name: "description",
          content:
            "Satu langkah dalam satu layar, huruf besar, penghitung waktu di tempat. Dibuat untuk dibaca sambil tangan berminyak.",
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: "Satu langkah dalam satu layar, dengan bahan yang perlu disiapkan dulu.",
        },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ModeMasak,
});

function Timer({
  seconds,
  recipeId,
  stepIndex,
}: {
  seconds: number;
  recipeId: string;
  stepIndex: number;
}) {
  const { cookProgress, setCookProgress } = useRacik();
  const progress = cookProgress(recipeId);
  const mine = progress?.timerStep === stepIndex ? progress : null;
  const running = mine?.endsAt != null;

  // A tick only to redraw. The number itself always comes from the clock, so
  // a backgrounded tab — where browsers throttle or suspend timers — cannot
  // make it wrong. A counter that decrements would come back overstating the
  // time left, which on a simmer is the dangerous direction to be wrong in.
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => redraw((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [running]);

  const left = mine?.endsAt != null
    ? Math.max(0, Math.round((mine.endsAt - Date.now()) / 1000))
    : mine?.left ?? seconds;

  const toggle = () => {
    if (running) {
      setCookProgress(recipeId, { timerStep: stepIndex, endsAt: undefined, left });
    } else {
      const from = left > 0 ? left : seconds;
      setCookProgress(recipeId, { timerStep: stepIndex, endsAt: Date.now() + from * 1000, left: undefined });
    }
  };

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="mt-6 flex items-center gap-4 border border-white/25 px-4 py-3">
      <span className="text-34 tabular-nums">
        {mm}:{ss}
      </span>
      <Button variant="outline"
        onClick={toggle}
        className="border-primary-foreground/40 bg-transparent text-label uppercase tracking-[0.1em] text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
      >
        {left === 0 ? "Sudah" : running ? "Jeda" : "Mulai hitung"}
      </Button>
    </div>
  );
}

function ModeMasak() {
  const { recipe: shipped } = Route.useLoaderData();
  const { id } = Route.useParams();
  const { state, ready, logCooked, cookProgress, setCookProgress, clearCookProgress } = useRacik();
  const navigate = useNavigate();
  const recipe = shipped ?? state.imported.find((item) => item.id === id);
  const [i, setI] = useState(0);

  // The store loads from IndexedDB asynchronously, so on a cold start — which
  // is exactly what a phone evicting the page looks like — it is still empty
  // at first render. Restore once, after it has actually loaded, and never
  // again, so a later write cannot move her mid-step.
  const restored = useRef(false);
  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const saved = cookProgress(id)?.step;
    if (saved != null && saved > 0) setI(saved);
  }, [ready, id, cookProgress]);

  const goto = (next: number) => {
    setI(next);
    setCookProgress(id, { step: next });
  };
  const servings = recipe ? state.servings[recipe.id] ?? state.household : state.household;
  const perStep = useMemo(() => (recipe ? stepIngredients(recipe) : []), [recipe]);

  if (!recipe) {
    return (
      <main className="min-h-dvh bg-dark p-6 text-primary-foreground">
        <p className="text-body">Resep ini tidak ada di perangkat ini.</p>
      </main>
    );
  }

  const step = recipe.steps[i];
  const needed = perStep[i] ?? [];
  const last = i === recipe.steps.length - 1;

  if (!step) {
    return (
      <main className="min-h-dvh bg-dark p-6 text-primary-foreground">
        <p className="text-body">Resep ini belum ada langkahnya.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-dark text-primary-foreground">
      <header className="flex items-center justify-between border-b border-primary-foreground/15 px-5 py-4">
        <span className="text-label uppercase tracking-[0.1em] text-primary-foreground/60">
          Langkah {i + 1} dari {recipe.steps.length}
        </span>
        <Link
          to="/resep/$id"
          params={{ id: recipe.id }}
          // Cook mode is used with wet hands. The way out needs a real target.
          className="-mr-2 flex min-h-11 items-center px-2 text-label uppercase tracking-[0.1em] text-primary-foreground/70"
        >
          Keluar
        </Link>
      </header>

      <div className="flex-1 px-5 py-7">
        <p className="font-display text-28 leading-[1.3]">{step[0]}</p>
        {step[1] ? <Timer seconds={step[1]} recipeId={recipe.id} stepIndex={i} /> : null}

        {needed.length > 0 ? (
          <div className="mt-8 rounded-2xl border border-primary-foreground/15 p-4">
            <p className="text-micro uppercase tracking-[0.1em] text-primary-foreground/60">Siapkan dulu</p>
            <ul className="mt-3 space-y-2">
              {needed.map((line) => {
                const ing = ING[line[0]];
                if (!ing) return null;
                const unit = unitOf(line);
                const qty = scaledQty(line, recipe, servings);
                const rumah = qty == null ? null : takaran(line[0], qty, unit, state.satuan);
                return (
                  <li key={line[0]} className="read-line flex gap-3">
                    <span aria-hidden className="w-6 shrink-0">
                      {ing.em}
                    </span>
                    <span>
                      {qty == null ? (
                        <span className="text-primary-foreground/70">secukupnya </span>
                      ) : (
                        <span className="font-semibold tabular-nums">
                          {fmtQty(qty)} {unit}{" "}
                        </span>
                      )}
                      {ing.name}
                      {line[2] ? <span className="text-primary-foreground/70">, {line[2]}</span> : null}
                      {rumah ? <span className="text-primary-foreground/70"> {rumah}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="flex gap-3 border-t border-primary-foreground/15 px-5 py-4">
        <Button variant="outline" size="lg"
          onClick={() => goto(Math.max(0, i - 1))}
          disabled={i === 0}
          className="flex-1 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground disabled:text-primary-foreground/30"
        >
          Sebelumnya
        </Button>
        <Button size="lg"
          onClick={() => {
            if (last) {
              logCooked(recipe.id);
              clearCookProgress(recipe.id);
              navigate({ to: "/resep/$id/selesai", params: { id: recipe.id } });
            } else {
              goto(i + 1);
            }
          }}
          className="flex-1"
        >
          {last ? "Selesai" : "Lanjut"}
        </Button>
      </div>
    </main>
  );
}
