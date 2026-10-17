"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Sparkles, Bot, CheckCircle2, XCircle, AlertTriangle, Info, Copy, Check, RefreshCw, Search, CircleDashed } from "lucide-react";
import { useSite } from "@/context/SiteContext";
import { summarizeAnswerBotAccess, type BotAccess, type ReadinessCheck } from "@/lib/geo-readiness";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState, Notice, SkeletonRows } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";

interface ReadinessReport {
  url: string;
  checked_at: string;
  robots: { status: number | null; found: boolean };
  bots: BotAccess[];
  checks: ReadinessCheck[];
}

const ACCESS = {
  allowed: { label: "Erişebiliyor", Icon: CheckCircle2, cls: "text-evidence" },
  partial: { label: "Kısmen kısıtlı", Icon: AlertTriangle, cls: "text-warn" },
  blocked: { label: "Engelli", Icon: XCircle, cls: "text-critical" },
  unknown: { label: "Bilinmiyor", Icon: CircleDashed, cls: "text-muted" },
} as const;

const CHECK = {
  pass: { label: "Uygun", Icon: CheckCircle2, cls: "text-evidence", box: "border-line" },
  warn: { label: "İyileştirilebilir", Icon: AlertTriangle, cls: "text-warn", box: "border-warn/40" },
  fail: { label: "Engel", Icon: XCircle, cls: "text-critical", box: "border-critical/40" },
  info: { label: "Bilgi", Icon: Info, cls: "text-accent-ink", box: "border-line" },
} as const;

function CopySnippet({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2">
      <pre className="whitespace-pre-wrap break-all bg-surface-2 border border-line rounded-sm p-3 font-mono text-xs text-ink">{text}</pre>
      <Button
        size="sm"
        variant="ghost"
        className="mt-1"
        icon={copied ? <Check className="w-3.5 h-3.5" aria-hidden /> : <Copy className="w-3.5 h-3.5" aria-hidden />}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* pano izni yok */
          }
        }}
      >
        {copied ? "Kopyalandı" : "Kopyala"}
      </Button>
    </div>
  );
}

function BotRow({ b }: { b: BotAccess }) {
  const a = ACCESS[b.status];
  return (
    <li className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">
          {b.token} <span className="font-normal text-muted">· {b.company}</span>
        </div>
        <div className="text-xs text-muted">{b.role}</div>
      </div>
      <div className="sm:text-right shrink-0">
        <span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold", a.cls)}>
          <a.Icon className="w-4 h-4" aria-hidden />
          {a.label}
        </span>
        <div className="text-2xs text-muted font-mono">
          {b.status === "unknown" ? "robots.txt okunamadı" : b.rule ? b.rule : b.source === "none" ? "robots.txt kuralı yok" : b.source === "wildcard" ? "genel kural (*)" : "bota özel kural"}
        </div>
      </div>
    </li>
  );
}

export default function GeoPage() {
  const { site, status } = useSite();
  const [url, setUrl] = useState("");
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (target: string) => {
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/geo/readiness", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: target }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Denetim yapılamadı.");
      setReport(data as ReadinessReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Denetim yapılamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    const target = site?.primary_url || (site ? `https://${site.domain}` : "");
    setUrl(target);
    if (target) run(target);
  }, [status, site, run]);

  const searchBots = report?.bots.filter((b) => b.purpose !== "training") ?? [];
  const trainingBots = report?.bots.filter((b) => b.purpose === "training") ?? [];
  const blockedSearch = searchBots.filter((b) => b.status === "blocked");
  const access = summarizeAnswerBotAccess(searchBots);
  const fails = report?.checks.filter((c) => c.status === "fail") ?? [];
  const warns = report?.checks.filter((c) => c.status === "warn") ?? [];
  const ordered = report ? [...fails, ...warns, ...report.checks.filter((c) => c.status === "info"), ...report.checks.filter((c) => c.status === "pass")] : [];

  const headline = !report
    ? null
    : blockedSearch.length > 0
      ? `${blockedSearch.length} yanıt motoru sitenizi okuyamıyor. İçeriğiniz bu motorların yanıtlarında kaynak olarak kullanılamaz.`
      : access.unknown.length > 0 || access.total === 0
        ? access.summary
        : fails.length > 0
        ? "Yanıt motorları sitenize erişebiliyor, ancak içeriğin alıntılanmasını engelleyen bir sorun var."
        : warns.length > 0
          ? `Yanıt motorları sitenize erişebiliyor. ${warns.length} iyileştirme, içeriğinizin daha doğru anlaşılmasını sağlar.`
          : "Yanıt motorları sitenize erişebiliyor ve temel hazırlık sinyalleri yerinde.";

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-14">
      <PageHeader
        icon={<Sparkles className="w-5 h-5" />}
        title="AI görünürlüğü"
        description="ChatGPT, Perplexity, Claude, Copilot ve Google AI Overviews'un sitenizi okuyup kaynak olarak kullanabilmesi için gerekenleri kontrol eder."
      />

      <Panel>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(url);
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <label htmlFor="geo-url" className="sr-only">
            Denetlenecek site
          </label>
          <Input id="geo-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="siteniz.com" inputMode="url" icon={<Search className="w-4 h-4" />} />
          <Button type="submit" loading={loading} icon={<RefreshCw className="w-4 h-4" aria-hidden />} className="shrink-0">
            {report ? "Yeniden denetle" : "Denetle"}
          </Button>
        </form>
        {report && (
          <p className="text-2xs text-muted mt-2">
            {report.url} · {formatRelative(report.checked_at)} denetlendi · robots.txt {report.robots.found ? "bulundu" : report.robots.status === 404 ? "yok (tüm tarayıcılara açık)" : "okunamadı"}
          </p>
        )}
      </Panel>

      {error && <Notice tone="error">{error}</Notice>}

      {loading && !report ? (
        <Panel>
          <SkeletonRows rows={6} />
        </Panel>
      ) : !report ? (
        <Panel>
          <EmptyState icon={<Bot className="w-8 h-8" />} title="Sitenizi denetleyin" description="Adresi girin; robots.txt, site haritası, llms.txt ve ana sayfa sinyalleri birkaç saniyede kontrol edilir." />
        </Panel>
      ) : (
        <>
          <div className={cn("p-4 rounded-md border-l-4 bg-surface border border-line", blockedSearch.length > 0 || fails.length > 0 ? "border-l-critical" : warns.length > 0 ? "border-l-warn" : "border-l-evidence")}>
            <p className="text-base font-semibold text-ink">{headline}</p>
            <p className="text-xs text-muted mt-1">
              {access.accessible}/{access.total} arama ve yanıt tarayıcısı erişebiliyor{access.unknown.length > 0 ? ` · ${access.unknown.length} tarayıcının erişimi bilinmiyor` : ""} · {fails.length} engel · {warns.length} iyileştirme
            </p>
          </div>

          <Panel title="Neden ve ne yapmalı" sub="Önce engeller, sonra iyileştirmeler. Her maddede bulgu, neden önemli olduğu ve yapılacak iş var.">
            <ul className="space-y-3">
              {ordered.map((c) => {
                const st = CHECK[c.status];
                return (
                  <li key={c.id} className={cn("p-4 rounded-sm border bg-surface", st.box)}>
                    <div className="flex items-start gap-2.5">
                      <st.Icon className={cn("w-4 h-4 shrink-0 mt-0.5", st.cls)} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="text-sm font-semibold text-ink">{c.label}</span>
                          <span className={cn("text-2xs font-semibold uppercase tracking-wider", st.cls)}>{st.label}</span>
                        </div>
                        <p className="text-sm text-ink mt-1">{c.finding}</p>
                        <p className="text-xs text-muted mt-1">{c.why}</p>
                        {c.action && (
                          <p className="text-xs text-ink mt-2">
                            <span className="font-semibold">Yapılacak: </span>
                            {c.action}
                          </p>
                        )}
                        {c.snippet && <CopySnippet text={c.snippet} />}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Hangi AI tarayıcıları sitenize erişebiliyor?" sub="robots.txt kurallarına göre. Arama ve yanıt tarayıcıları görünürlüğü doğrudan etkiler; eğitim tarayıcılarını engellemek bir tercih meselesidir.">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mt-1">Arama ve yanıt</h3>
            <ul className="divide-y divide-line">
              {searchBots.map((b) => (
                <BotRow key={b.token} b={b} />
              ))}
            </ul>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mt-5">Model eğitimi</h3>
            <ul className="divide-y divide-line">
              {trainingBots.map((b) => (
                <BotRow key={b.token} b={b} />
              ))}
            </ul>
          </Panel>
        </>
      )}

      <Panel title="Yanıtlarda görünürlük ölçümü">
        <div className="flex items-start gap-3">
          <CircleDashed className="w-5 h-5 text-muted shrink-0 mt-0.5" aria-hidden />
          <div className="text-sm text-muted space-y-1">
            <p className="text-ink font-medium">Henüz ölçülmüyor.</p>
            <p>
              Markanızın ChatGPT, Perplexity veya Gemini yanıtlarında geçip geçmediğini, hangi kaynakların alıntılandığını ve rakiplere göre payınızı görmek için bu motorlara düzenli sorgu göndermek gerekir. Bu ölçüm henüz
              platformda yok; bu sayfadaki denetim yalnızca erişim ve hazırlık durumunu gösterir.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
