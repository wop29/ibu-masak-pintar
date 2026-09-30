import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortionStepper } from "@/components/racik/PortionStepper";
import { clearAll, defaultState } from "@/lib/racik/store";
import { useRacik } from "@/lib/racik/state";
import { useT } from "@/lib/racik/i18n";
import { useAccount } from "@/lib/racik/backend/useAccount";
import { signOut } from "@/lib/racik/backend/auth";

export const Route = createFileRoute("/pengaturan")({ head: () => ({ meta: [{ title: "Pengaturan — Racik" }, { name: "description", content: "Atur jumlah porsi, satuan, ukuran tulisan, dan pilihan resep di Racik." }, { property: "og:title", content: "Pengaturan — Racik" }, { property: "og:description", content: "Pengaturan memasak dan penyimpanan di perangkat." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Pengaturan });

function Row({ title, detail, children }: { title: string; detail?: string | undefined; children: React.ReactNode }) { return <div className="border-b border-border py-5"><div className="flex items-center justify-between gap-4"><div className="min-w-0 flex-1"><h2 className="text-body font-bold">{title}</h2>{detail ? <p className="mt-1 text-14 text-muted-foreground">{detail}</p> : null}</div>{children}</div></div>; }
function Pengaturan() {
  const { state, update } = useRacik(); const navigate = useNavigate(); const t = useT(); const { account, available, refresh } = useAccount();
  return <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card px-5 pb-12"><header className="flex items-center gap-3 py-5"><Button asChild variant="ghost" size="icon"><Link to="/buku" aria-label={t("back")}><ArrowLeft /></Link></Button><div><p className="eyebrow">RACIK</p><h1 className="text-title font-bold">{t("settings")}</h1></div></header>
    <Row title={t("usual_portions")} detail={t("usual_portions_detail")}><PortionStepper value={state.household} onChange={(v)=>update({household:v})} /></Row>
    <Row title={t("measures")}><div className="flex gap-1 rounded-xl bg-secondary p-1">{(["rumah","gram"] as const).map((x)=><Button key={x} size="sm" variant={state.satuan===x?"default":"ghost"} onClick={()=>update({satuan:x})}>{x==="rumah"?t("measures_home"):t("measures_gram")}</Button>)}</div></Row>
    <Row title={t("text_size")}><select value={state.teks} onChange={(e)=>update({teks:e.target.value as typeof state.teks})} className="h-11 rounded-xl border border-border bg-card px-3 text-body"><option value="normal">{t("text_normal")}</option><option value="besar">{t("text_large")}</option><option value="paling_besar">{t("text_largest")}</option></select></Row>
    <Row title={t("hide_check")} detail={t("hide_check_detail")}><input aria-label={t("hide_check")} type="checkbox" checked={state.halalMode} onChange={(e)=>update({halalMode:e.target.checked})} className="h-6 w-6 accent-primary" /></Row>
    <Row title={t("language")}><div className="flex gap-1 rounded-xl bg-secondary p-1">{([["id","Bahasa Indonesia"],["en","English"]] as const).map(([code,label])=><Button key={code} size="sm" variant={state.lang===code?"default":"ghost"} onClick={()=>update({lang:code})}>{label}</Button>)}</div></Row>
    {available ? <Row title={t("sign_in")} detail={account?.name ? t("signed_in_as",{name:account.name}) : undefined}>{account ? <Button size="sm" variant="ghost" onClick={async()=>{await signOut();refresh();}}>{t("sign_out")}</Button> : <Button asChild size="sm" variant="ghost"><Link to="/masuk">{t("sign_in")}</Link></Button>}</Row> : null}
    <section className="py-6"><h2 className="eyebrow-ink">{t("about")}</h2><p className="mt-3 text-body text-muted-foreground">{t("about_body")}</p></section>
    <Button variant="outline" className="w-full text-destructive" onClick={async()=>{await clearAll();update(defaultState);navigate({to:"/"})}}>{t("erase_all")}</Button>
  </main>;
}