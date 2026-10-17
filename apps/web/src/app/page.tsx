"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  OctagonAlert,
  Loader2,
  Globe,
  Search,
  Sparkles,
  KeyRound,
  ShieldCheck,
  History,
  RefreshCw,
  Users,
} from "lucide-react";
import { useDensity } from "@/context/DensityContext";
import { useSite } from "@/context/SiteContext";
import { useSiteData } from "@/hooks/useSiteData";
import { useIssues } from "@/hooks/useIssues";
import { useAiReadiness } from "@/hooks/useAiReadiness";
import { api, type CrawlRunResponse } from "@/lib/api";
import { DEMO_DASHBOARD, type IssueItem } from "@/lib/demo";
import { gscToPerformance, gscToWeeklySeries } from "@/lib/mappers";
import { issueGuide } from "@/lib/issueGuide";
import { formatCompact, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { Panel } from "@/components/ui/Panel";
import { Button, LinkButton } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { SeverityBadge } from "@/components/ui/Badge";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { TrendChart } from "@/components/ui/TrendChart";
import { EmptyState, Notice, SkeletonRows } from "@/components/ui/States";
import { cn } from "@/lib/cn";

interface Overview {
  score: number;
  pages: number;
  finishedAt: string | null;
  prev: { score: number; rules: string[]; titles: Record<string, string> } | null;
  rules: string[];
  gsc: { connected: boolean; clicks: number; impressions: number; ctr: number; position: number; labels: string[]; values: number[] };
}

const DEMO_OVERVIEW: Overview = {
  score: DEMO_DASHBOARD.health.score,
  pages: DEMO_DASHBOARD.health.pages,
  finishedAt: null,
  prev: { score: DEMO_DASHBOARD.health.score - 6, rules: ["ISSUE-01", "ISSUE-02", "ISSUE-05"], titles: { "ISSUE-05": "Eksik hreflang dönüş bağlantısı" } },
  rules: ["ISSUE-01", "ISSUE-02", "ISSUE-03", "ISSUE-04"],
  gsc: { connected: true, clicks: DEMO_DASHBOARD.search.clicks, impressions: 0, ctr: DEMO_DASHBOARD.search.ctr, position: DEMO_DASHBOARD.search.position, labels: DEMO_DASHBOARD.series.labels, values: DEMO_DASHBOARD.series.google },
};

const isCompleted = (c: CrawlRunResponse) => c.status === "COMPLETED" || c.status === "COMPLETED_WITH_ERRORS";

function healthLabel(score: number) {
  if (score >= 80) return { text: "İyi", Icon: CheckCircle2, cls: "text-evidence" };
  if (score >= 50) return { text: "Orta", Icon: AlertTriangle, cls: "text-warn" };
  return { text: "Zayıf", Icon: OctagonAlert, cls: "text-critical" };
}

/* ---------- İlk kurulum: site yokken ---------- */
function FirstRun() {
  const { addSite, siteImport, dismissSiteImport } = useSite();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addSite(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Site eklenemedi.");
    } finally {
      setBusy(false);
    }
  };

  if (siteImport?.state === "running") {
    return (
      <Panel>
        <div className="flex items-start gap-3 p-1">
          <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0 mt-0.5" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold text-ink">{siteImport.url.replace(/^https?:\/\//, "")} ekleniyor ve taranıyor</h1>
            <p className="text-sm text-muted mt-1">Sayfalar, başlıklar, meta açıklamalar, canonical ve robots ayarları kontrol ediliyor. Bu genellikle bir iki dakika sürer; bu sayfada kalabilirsiniz.</p>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="max-w-2xl space-y-4 p-1">
        <div>
          <h1 className="text-xl font-semibold text-ink">Sitenizi ekleyin, ilk analiz birkaç dakikada hazır olsun</h1>
          <p className="text-sm text-muted mt-1">Yalnızca site adresi gerekiyor. Anahtar kelime, rakip veya entegrasyon eklemeniz gerekmez; bunları sonra ekleyebilirsiniz.</p>
        </div>
        {siteImport?.state === "error" && (
          <Notice tone="error" onClose={dismissSiteImport}>
            {siteImport.url} eklenemedi: {siteImport.message}
          </Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
          <Label htmlFor="first-site-url">
            <span className="sr-only">Site adresi</span>
          </Label>
          <Input id="first-site-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="siteniz.com" inputMode="url" autoComplete="url" icon={<Globe className="w-4 h-4" />} />
          <Button type="submit" loading={busy} icon={<ArrowRight className="w-4 h-4" aria-hidden />} className="shrink-0">
            {busy ? "Taranıyor…" : "Ekle ve tara"}
          </Button>
        </form>
        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted">
          <li className="p-3 rounded-sm border border-line">
            <span className="block font-semibold text-ink">1. Tarama</span>Sitenizin sayfaları taranır ve teknik sorunlar bulunur.
          </li>
          <li className="p-3 rounded-sm border border-line">
            <span className="block font-semibold text-ink">2. Öncelikler</span>Sorunlar önem ve etkilediği sayfa sayısına göre sıralanır.
          </li>
          <li className="p-3 rounded-sm border border-line">
            <span className="block font-semibold text-ink">3. Düzeltme</span>Her sorun için nerede olduğu ve nasıl düzeltileceği gösterilir.
          </li>
        </ol>
      </div>
    </Panel>
  );
}

/* ---------- İlk tarama bekleniyor ---------- */
function CrawlPending() {
  const { org, site, crawls, refresh } = useSite();
  const latest = [...crawls].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const [retrying, setRetrying] = useState(false);

  // Arka uçta tarama kuyrukta çalışır: tamamlanınca pano kendiliğinden canlı veriye geçer.
  useEffect(() => {
    if (!org || !site || latest?.status === "FAILED") return;
    let cancelled = false;
    const t = setInterval(async () => {
      const list = await api.listCrawls(org.id, site.id).catch(() => [] as CrawlRunResponse[]);
      if (cancelled) return;
      const newest = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (list.some(isCompleted) || newest?.status === "FAILED") {
        clearInterval(t);
        refresh({ siteId: site.id });
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [org, site, refresh, latest?.status]);

  const failed = latest?.status === "FAILED";
  const retry = async () => {
    if (!org || !site) return;
    setRetrying(true);
    try {
      await api.triggerCrawl(org.id, site.id);
      await refresh({ siteId: site.id });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Panel>
      <div className="flex items-start gap-3 p-1">
        {failed ? <OctagonAlert className="w-5 h-5 text-critical shrink-0 mt-0.5" aria-hidden /> : <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0 mt-0.5" aria-hidden />}
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-ink">{failed ? "İlk tarama tamamlanamadı" : latest ? "İlk tarama sürüyor" : "Henüz tarama başlatılmadı"}</h1>
          <p className="text-sm text-muted">
            {failed
              ? "Siteye ulaşılamamış olabilir. Adresin doğru ve herkese açık olduğunu kontrol edip yeniden deneyin."
              : latest
                ? `${site?.domain} taranıyor${latest.total_urls_crawled ? ` (${latest.total_urls_crawled} sayfa)` : ""}. Tamamlandığında bu sayfa kendiliğinden güncellenir.`
                : "Sonuçları görmek için ilk taramayı başlatın."}
          </p>
          <div className="flex flex-wrap gap-2">
            {(failed || !latest) && (
              <Button size="sm" loading={retrying} onClick={retry} icon={<RefreshCw className="w-3.5 h-3.5" aria-hidden />}>
                {failed ? "Yeniden dene" : "Taramayı başlat"}
              </Button>
            )}
            <LinkButton href="/crawls" size="sm">
              Tarama ayrıntıları
            </LinkButton>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ---------- Pano gövdesi ---------- */
interface Priority {
  key: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  issue?: IssueItem;
}

function Kpi({ label, value, sub, source, href, children }: { label: string; value: React.ReactNode; sub?: React.ReactNode; source: string; href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="block bg-surface border border-line rounded-md px-4 py-4 hover:bg-surface-2 hover:border-line-strong transition-colors min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-semibold text-ink mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
      {children}
      <div className="text-2xs text-faint mt-2">Kaynak: {source}</div>
    </Link>
  );
}

function DashboardBody({ o, issues, isDemo }: { o: Overview; issues: ReturnType<typeof useIssues>; isDemo: boolean }) {
  const { density } = useDensity();
  const { site, crawl, period } = useSite();
  const ai = useAiReadiness(isDemo ? null : site?.primary_url);
  const hl = healthLabel(o.score);
  const top = issues.data[0];

  // Öncelikler: acil sorunlar → AI erişim engeli → Search Console kurulumu (en fazla 3)
  const priorities: Priority[] = [];
  issues.data
    .filter((i) => i.severity === "CRITICAL")
    .slice(0, 2)
    .forEach((i) => priorities.push({ key: i.id, title: i.title, detail: `${i.affected ?? 0} sayfada. ${issueGuide(i.category, i.ruleId).why}`, href: "/issues", cta: "Sayfaları gör", issue: i }));
  if (ai.blocked.length > 0)
    priorities.push({ key: "ai", title: `${ai.blocked.length} AI yanıt motoru sitenizi okuyamıyor`, detail: `${ai.blocked.map((b) => b.token).join(", ")} robots.txt ile engelli. İçeriğiniz bu motorların yanıtlarında kaynak olamaz.`, href: "/geo", cta: "Nasıl açılır" });
  issues.data
    .filter((i) => i.severity === "HIGH")
    .forEach((i) => priorities.push({ key: i.id, title: i.title, detail: `${i.affected ?? 0} sayfada. ${issueGuide(i.category, i.ruleId).why}`, href: "/issues", cta: "Sayfaları gör", issue: i }));
  if (!o.gsc.connected) priorities.push({ key: "gsc", title: "Search Console'u bağlayın", detail: "Hangi aramalardan tıklama aldığınızı ve sıralamanızı görmek için gerekir. Bağlamak birkaç dakika sürer.", href: "/integrations", cta: "Bağla" });
  const shown = priorities.slice(0, 3);

  const headline =
    issues.urgent > 0 && top
      ? `${issues.urgent} acil sorun var. En önemlisi: ${top.title.toLocaleLowerCase("tr-TR")} (${top.affected ?? 0} sayfa).`
      : ai.blocked.length > 0
        ? `Acil teknik sorun yok, ancak ${ai.blocked.length} AI yanıt motoru sitenizi okuyamıyor.`
        : issues.data.length > 0
          ? `Acil sorun yok. Kalan ${issues.data.length} bulgu iyileştirme fırsatı.`
          : "Son taramada sorun bulunmadı.";

  const resolved = o.prev ? o.prev.rules.filter((r) => !o.rules.includes(r)) : [];
  const added = o.prev ? o.rules.filter((r) => !o.prev!.rules.includes(r)) : [];
  const titleFor = (rule: string) => issues.data.find((i) => i.ruleId === rule || i.id === rule)?.title ?? o.prev?.titles[rule] ?? rule;

  return (
    <div className="space-y-5">
      {/* 1. Durum */}
      <section className="bg-surface border border-line rounded-md p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="min-w-0 space-y-2">
          <div className="text-xs text-muted">
            {site ? site.domain : "Örnek site"} · {crawl ? `son tarama ${formatRelative(crawl.finished_at ?? crawl.created_at)}` : "örnek veri"}
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-ink text-balance">{headline}</h1>
          <div className="flex flex-wrap gap-2 pt-1">
            <LinkButton href="/issues" variant="primary" icon={<ArrowRight className="w-4 h-4" aria-hidden />}>
              {issues.urgent > 0 ? "Acil sorunlara bak" : "Tüm bulgular"}
            </LinkButton>
            <LinkButton href="/crawls" icon={<RefreshCw className="w-4 h-4" aria-hidden />}>
              Yeniden tara
            </LinkButton>
          </div>
        </div>
        <div className="shrink-0 text-center px-6 py-4 rounded-md border border-line bg-surface-2">
          <div className="text-2xs uppercase tracking-wider text-muted font-semibold">Teknik sağlık</div>
          <div className="text-4xl font-semibold text-ink tabular-nums mt-1">
            {o.score}
            <span className="text-sm text-muted font-normal">/100</span>
          </div>
          <div className={cn("inline-flex items-center gap-1 text-sm font-semibold mt-1", hl.cls)}>
            <hl.Icon className="w-4 h-4" aria-hidden />
            {hl.text}
          </div>
        </div>
      </section>

      {/* 2. Göstergeler: her birinin kaynağı yazılı */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3" aria-label="Özet göstergeler">
        <Kpi label="Acil sorunlar" value={issues.urgent} sub={`${issues.critical} kritik · ${issues.high} yüksek`} source="son tarama" href="/issues" />
        <Kpi label="Taranan sayfa" value={formatNumber(o.pages)} sub={o.finishedAt ? formatRelative(o.finishedAt) : "son tarama"} source="son tarama" href="/pages" />
        {o.gsc.connected ? (
          <Kpi label="Google tıklamaları" value={formatCompact(o.gsc.clicks)} sub={`ort. sıra ${formatNumber(o.gsc.position, 1)} · TO ${formatPercent(o.gsc.ctr, 1)}`} source={`Search Console · ${period} gün`} href="/performance" />
        ) : (
          <Kpi label="Google tıklamaları" value={<span className="text-base text-muted font-medium">Bağlı değil</span>} sub="Search Console'u bağlayın" source="Search Console" href="/integrations" />
        )}
        {isDemo ? (
          <Kpi label="AI yanıt motorları" value="6/7" sub="erişebiliyor" source="robots.txt denetimi" href="/geo" />
        ) : ai.isLoading ? (
          <Kpi label="AI yanıt motorları" value={<Loader2 className="w-5 h-5 animate-spin text-muted" aria-label="Denetleniyor" />} source="robots.txt denetimi" href="/geo" />
        ) : ai.isError ? (
          <Kpi label="AI yanıt motorları" value={<span className="text-base text-muted font-medium">Denetlenemedi</span>} source="robots.txt denetimi" href="/geo" />
        ) : (
          <Kpi
            label="AI yanıt motorları"
            value={ai.access.unknown.length === ai.access.total ? "Bilinmiyor" : `${ai.access.accessible}/${ai.access.total}`}
            sub={ai.access.summary}
            source="robots.txt denetimi"
            href="/geo"
          />
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 3. Öncelikler */}
        <Panel className="lg:col-span-7" title="Önce bunları yapın" sub="Önem ve etkilenen sayfa sayısına göre, en fazla üç iş.">
          {issues.loading ? (
            <SkeletonRows rows={4} />
          ) : shown.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="w-8 h-8 text-evidence" />} title="Acil iş yok" description="Kalan bulgular Sorunlar ekranında önem sırasıyla listelenir." />
          ) : (
            <ol className="space-y-2">
              {shown.map((p, idx) => (
                <li key={p.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-sm border border-line">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-surface-2 border border-line text-xs font-semibold text-ink flex items-center justify-center shrink-0" aria-hidden>
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {p.issue && <SeverityBadge severity={p.issue.severity} />}
                        <span className="text-sm font-semibold text-ink">{p.title}</span>
                      </div>
                      <p className="text-xs text-muted mt-0.5">{p.detail}</p>
                    </div>
                  </div>
                  <LinkButton href={p.href} size="sm" className="shrink-0 self-start sm:self-center">
                    {p.cta}
                  </LinkButton>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {/* 4. Ne değişti */}
        <Panel className="lg:col-span-5" title="Ne değişti?" sub="Son iki taramanın karşılaştırması">
          {o.prev ? (
            <div className="space-y-3 text-sm">
              <p className="text-ink">
                Sağlık puanı {o.prev.score} → <strong>{o.score}</strong>
                <span className={cn("ml-1 font-semibold", o.score - o.prev.score > 0 ? "text-evidence" : o.score - o.prev.score < 0 ? "text-critical" : "text-muted")}>
                  ({o.score - o.prev.score > 0 ? "+" : ""}
                  {o.score - o.prev.score})
                </span>
              </p>
              <div>
                <div className="text-xs font-semibold text-evidence flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> {resolved.length} sorun türü çözüldü
                </div>
                <ul className="text-xs text-muted list-disc pl-5 mt-1">
                  {resolved.slice(0, 3).map((r) => (
                    <li key={r}>{titleFor(r)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className={cn("text-xs font-semibold flex items-center gap-1", added.length ? "text-critical" : "text-muted")}>
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden /> {added.length} yeni sorun türü
                </div>
                <ul className="text-xs text-muted list-disc pl-5 mt-1">
                  {added.slice(0, 3).map((r) => (
                    <li key={r}>{titleFor(r)}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <EmptyState icon={<History className="w-7 h-7" />} title="Bu ilk tarama" description="Bir sonraki taramadan sonra neyin düzeldiğini ve neyin yeni çıktığını burada görürsünüz." className="py-6" />
          )}
        </Panel>
      </section>

      {/* 5. Diğer alanlar */}
      <nav aria-label="Diğer alanlar" className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { href: "/keywords", label: "Anahtar kelimeler", Icon: KeyRound },
          { href: "/geo", label: "AI görünürlüğü", Icon: Sparkles },
          { href: "/competitors", label: "Rakiplerle karşılaştır", Icon: Users },
          { href: "/changes", label: "Değişiklik taslakları", Icon: ShieldCheck },
        ].map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-2 px-3 py-3 rounded-sm border border-line bg-surface text-sm font-medium text-ink hover:bg-surface-2 min-h-[44px]">
            <Icon className="w-4 h-4 text-muted shrink-0" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      {density === "expert" && <ExpertDetails o={o} />}
    </div>
  );
}

function ExpertDetails({ o }: { o: Overview }) {
  const { period } = useSite();
  const [auditUrl, setAuditUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; score: number | null; issues: Array<{ title: string; severity: string }> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const url = /^https?:\/\//.test(auditUrl) ? auditUrl : `https://${auditUrl}`;
      const res = await fetch("/api/v1/audit/quick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Denetim yapılamadı.");
      setResult({ url, score: typeof data.health_score === "number" ? data.health_score : null, issues: data.issues ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Denetim yapılamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      <Panel className="xl:col-span-8" title="Google tıklamaları" sub={`Search Console · haftalık · son ${period} gün`}>
        {o.gsc.connected && o.gsc.values.length > 1 ? (
          <TrendChart labels={o.gsc.labels} series={[{ name: "Tıklama", values: o.gsc.values, tone: "accent" }]} height={220} ariaLabel="Haftalık Google tıklamaları" format={(n) => formatCompact(n)} />
        ) : (
          <EmptyState
            title="Henüz eğri yok"
            description="Search Console bağlandığında ve en az iki haftalık veri biriktiğinde eğri burada oluşur."
            action={<LinkButton href="/integrations" size="sm">Search Console'u bağla</LinkButton>}
          />
        )}
      </Panel>
      <Panel className="xl:col-span-4" title="Tek sayfa denetimi" sub="Herhangi bir adresi hızlıca kontrol edin">
        <form onSubmit={audit} className="flex gap-2">
          <label htmlFor="expert-audit" className="sr-only">
            Denetlenecek adres
          </label>
          <Input id="expert-audit" value={auditUrl} onChange={(e) => setAuditUrl(e.target.value)} placeholder="ornek.com/sayfa" icon={<Search className="w-4 h-4" />} />
          <Button type="submit" loading={busy} className="shrink-0">
            Denetle
          </Button>
        </form>
        {error && (
          <Notice tone="error" className="mt-2">
            {error}
          </Notice>
        )}
        {result && (
          <div className="mt-3 text-xs space-y-2" aria-live="polite">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-ink truncate">{result.url.replace(/^https?:\/\//, "")}</span>
              {result.score !== null && <span className="font-mono font-semibold">{result.score}/100</span>}
            </div>
            <ul className="space-y-1">
              {result.issues.slice(0, 5).map((i, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <SeverityBadge severity={i.severity} />
                  <span className="text-ink">{i.title}</span>
                </li>
              ))}
              {result.issues.length === 0 && <li className="text-muted">Sorun bulunmadı.</li>}
            </ul>
          </div>
        )}
      </Panel>
    </section>
  );
}

export default function GenelGorunumPage() {
  const { status, source, reason, site, crawl, crawls, siteImport } = useSite();
  const issues = useIssues();

  const overview = useSiteData<Overview>(
    "overview",
    async ({ org, site: s, crawl: c, period }) => {
      const done = crawls.filter(isCompleted).sort((a, b) => (b.finished_at ?? b.created_at).localeCompare(a.finished_at ?? a.created_at));
      const prevCrawl = done.find((x) => x.id !== c!.id);
      const [health, gsc, prev] = await Promise.all([
        api.getCrawlHealth(org.id, s.id, c!.id),
        api.getGscMetrics(org.id, s.id, period).catch(() => []),
        prevCrawl ? api.getCrawlHealth(org.id, s.id, prevCrawl.id).catch(() => null) : Promise.resolve(null),
      ]);
      const perf = gscToPerformance(gsc);
      const weekly = gscToWeeklySeries(gsc);
      return {
        score: health.health_score,
        pages: health.total_pages_evaluated,
        finishedAt: c!.finished_at ?? null,
        rules: health.issues.map((i) => i.rule_id),
        prev: prev ? { score: prev.health_score, rules: prev.issues.map((i) => i.rule_id), titles: Object.fromEntries(prev.issues.map((i) => [i.rule_id, i.title])) } : null,
        gsc: { connected: gsc.length > 0, clicks: perf.clicks, impressions: perf.impressions, ctr: perf.ctr, position: perf.position, labels: weekly.labels, values: weekly.values },
      };
    },
    DEMO_OVERVIEW
  );

  if (status === "loading") {
    return (
      <div className="max-w-7xl mx-auto">
        <Panel>
          <SkeletonRows rows={6} />
        </Panel>
      </div>
    );
  }

  const noSite = !site && (reason === "no-site" || reason === "no-org" || reason === "unauthorized");
  const pendingCrawl = Boolean(site) && !crawl && reason === "no-crawl";

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {noSite || siteImport?.state === "running" ? (
        <>
          <FirstRun />
          <div className="pt-2 space-y-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Örnek pano</h2>
            <DemoBanner source="demo" reason="no-site" />
            <DashboardBody o={DEMO_OVERVIEW} issues={issues} isDemo />
          </div>
        </>
      ) : pendingCrawl ? (
        <CrawlPending />
      ) : (
        <>
          <DemoBanner source={overview.source} reason={overview.reason} error={overview.error} />
          {overview.loading ? (
            <Panel>
              <SkeletonRows rows={6} />
            </Panel>
          ) : (
            <DashboardBody o={overview.data} issues={issues} isDemo={source === "demo" || overview.source === "demo"} />
          )}
        </>
      )}
    </div>
  );
}
