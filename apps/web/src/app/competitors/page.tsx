"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Users, Plus, Trash2, RefreshCw, CheckCircle2, XCircle, Globe } from "lucide-react";
import { useSite } from "@/context/SiteContext";
import { summarizeAnswerBotAccess, type BotAccess, type ReadinessCheck } from "@/lib/geo-readiness";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Notice } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";

/**
 * Rakip karşılaştırması: rakiplerin ana sayfası, sizinkiyle aynı kurallarla canlı denetlenir.
 * Trafik, anahtar kelime ve backlink verisi için üçüncü taraf veri sağlayıcı gerekir; burada gösterilmez.
 */
interface DomainResult {
  domain: string;
  checkedAt: string;
  health: number | null;
  critical: number;
  issues: number;
  hasMeta: boolean | null;
  schema: boolean | null;
  access: ReturnType<typeof summarizeAnswerBotAccess> | null;
  error?: string;
}

const storageKey = (siteId: string) => `calpeo_competitors_${siteId}`;

function readList(siteId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(siteId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeList(siteId: string, list: string[]) {
  try {
    localStorage.setItem(storageKey(siteId), JSON.stringify(list));
  } catch {
    /* depolama kapalı */
  }
}

const cleanDomain = (v: string) => v.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();

async function auditDomain(domain: string): Promise<DomainResult> {
  const url = `https://${domain}`;
  const base: DomainResult = { domain, checkedAt: new Date().toISOString(), health: null, critical: 0, issues: 0, hasMeta: null, schema: null, access: null };
  try {
    const [qa, rd] = await Promise.all([
      fetch("/api/v1/audit/quick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }).then(async (r) => ({ ok: r.ok, data: await r.json() })),
      fetch("/api/v1/geo/readiness", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }).then(async (r) => ({ ok: r.ok, data: await r.json() })),
    ]);
    if (!qa.ok && !rd.ok) return { ...base, error: qa.data?.detail || rd.data?.detail || "Denetlenemedi" };
    const issues = (qa.ok ? qa.data.issues : []) as Array<{ severity: string }>;
    const bots = (rd.ok ? rd.data.bots : []) as BotAccess[];
    const checks = (rd.ok ? rd.data.checks : []) as ReadinessCheck[];
    return {
      ...base,
      health: qa.ok && typeof qa.data.health_score === "number" ? qa.data.health_score : null,
      critical: issues.filter((i) => i.severity === "CRITICAL").length,
      issues: issues.length,
      hasMeta: qa.ok ? Boolean(qa.data.page_info?.meta_description) : null,
      schema: rd.ok ? checks.find((c) => c.id === "structured-data")?.status !== "warn" : null,
      access: rd.ok ? summarizeAnswerBotAccess(bots) : null,
    };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "Denetlenemedi" };
  }
}

function YesNo({ value, yes = "Var", no = "Yok" }: { value: boolean | null; yes?: string; no?: string }) {
  if (value === null) return <span className="text-muted">—</span>;
  return value ? (
    <span className="inline-flex items-center gap-1 text-evidence font-medium">
      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> {yes}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-critical font-medium">
      <XCircle className="w-3.5 h-3.5" aria-hidden /> {no}
    </span>
  );
}

function ResultCells({ r, mine }: { r: DomainResult | undefined; mine: boolean }) {
  if (!r) return <td colSpan={5} className="px-4 py-3 text-xs text-muted">Henüz denetlenmedi</td>;
  if (r.error) return <td colSpan={5} className="px-4 py-3 text-xs text-critical">{r.error}</td>;
  return (
    <>
      <td className="px-4 py-3 text-center font-mono font-semibold tabular-nums">{r.health ?? "—"}</td>
      <td className={cn("px-4 py-3 text-center tabular-nums", r.critical > 0 ? "text-critical font-semibold" : "text-muted")}>{r.critical}</td>
      <td className="px-4 py-3">
        {!r.access || r.access.unknown.length > 0 || r.access.total === 0 ? (
          <span className="text-xs text-muted">{r.access?.summary || "Denetlenemedi"}</span>
        ) : r.access.blocked.length === 0 ? (
          <YesNo value={true} yes="Açık" />
        ) : (
          <span className="text-critical text-xs font-medium" title={r.access.blocked.join(", ")}>
            {r.access.blocked.length} motor engelli
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <YesNo value={r.schema} />
      </td>
      <td className="px-4 py-3">
        <YesNo value={r.hasMeta} />
        {mine && <span className="sr-only">(sizin siteniz)</span>}
      </td>
    </>
  );
}

export default function CompetitorsPage() {
  const { site, setAddSiteOpen, status } = useSite();
  const [list, setList] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, DomainResult>>({});
  const [running, setRunning] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [addErr, setAddErr] = useState<string | null>(null);

  const myDomain = site ? (site.normalized_domain || site.domain).replace(/^www\./, "") : null;

  useEffect(() => {
    if (site) setList(readList(site.id));
  }, [site]);

  const compare = useCallback(
    async (domains: string[]) => {
      setRunning(true);
      // Sırayla: hızlı denetim ucu IP başına dakikada 5 istek kabul eder
      for (const d of domains) {
        const r = await auditDomain(d);
        setResults((prev) => ({ ...prev, [d]: r }));
      }
      setRunning(false);
    },
    []
  );

  const addCompetitor = (e: React.FormEvent) => {
    e.preventDefault();
    const d = cleanDomain(newDomain);
    if (!site || !d) return;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return setAddErr("Geçerli bir alan adı girin (ör. rakip.com).");
    if (d === myDomain || list.includes(d)) return setAddErr("Bu alan adı zaten listede.");
    if (list.length >= 4) return setAddErr("En fazla 4 rakip karşılaştırılabilir.");
    const next = [...list, d];
    setList(next);
    writeList(site.id, next);
    setNewDomain("");
    setAddErr(null);
    setAddOpen(false);
    compare(results[myDomain!] ? [d] : [myDomain!, d]);
  };

  const remove = (d: string) => {
    if (!site) return;
    const next = list.filter((x) => x !== d);
    setList(next);
    writeList(site.id, next);
  };

  const all = myDomain ? [myDomain, ...list] : [];
  const mine = myDomain ? results[myDomain] : undefined;
  const others = list.map((d) => results[d]).filter((r): r is DomainResult => Boolean(r && !r.error));
  const insight =
    mine && !mine.error && others.length > 0
      ? (() => {
          const better = others.filter((o) => (o.health ?? 0) > (mine.health ?? 0)).length;
          const openBots = others.filter((o) => o.access && o.access.total > 0 && o.access.unknown.length === 0 && o.access.blocked.length === 0).length;
          const parts = [
            better === 0 ? "Ana sayfa denetiminde tüm rakiplerinizin önündesiniz." : `${others.length} rakipten ${better} tanesinin ana sayfası sizinkinden daha iyi puan aldı.`,
          ];
          if (mine.access && mine.access.blocked.length > 0 && openBots > 0) parts.push(`Sitenizde ${mine.access.blocked.length} AI yanıt motoru engelli; ${openBots} rakip bu motorlara açık.`);
          if (mine.schema === false && others.some((o) => o.schema)) parts.push("Rakiplerin bir kısmında yapılandırılmış veri var, sizde yok.");
          return parts.join(" ");
        })()
      : null;

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-14">
      <PageHeader
        icon={<Users className="w-5 h-5" />}
        title="Rakipler"
        description="Rakiplerinizin ana sayfasını sizinkiyle aynı kurallarla karşılaştırın: teknik sağlık, AI tarayıcı erişimi, yapılandırılmış veri ve meta açıklama."
        actions={
          site ? (
            <div className="flex gap-2">
              {list.length > 0 && (
                <Button variant="secondary" loading={running} icon={<RefreshCw className="w-4 h-4" aria-hidden />} onClick={() => compare(all)}>
                  Yeniden karşılaştır
                </Button>
              )}
              <Button icon={<Plus className="w-4 h-4" aria-hidden />} onClick={() => setAddOpen(true)} disabled={list.length >= 4}>
                Rakip ekle
              </Button>
            </div>
          ) : undefined
        }
      />

      {status === "ready" && !site ? (
        <Panel>
          <EmptyState
            icon={<Globe className="w-8 h-8" />}
            title="Önce sitenizi ekleyin"
            description="Rakip karşılaştırması sizin sitenizle yapılır. Sitenizi ekledikten sonra en fazla 4 rakip ekleyebilirsiniz."
            action={<Button onClick={() => setAddSiteOpen(true)} icon={<Plus className="w-4 h-4" aria-hidden />}>Site ekle</Button>}
          />
        </Panel>
      ) : list.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title="Rakiplerinizi ekleyerek karşılaştırın"
            description="Bir rakibin alan adını eklediğinizde ana sayfası canlı denetlenir ve sizin sitenizle yan yana gösterilir."
            action={<Button onClick={() => setAddOpen(true)} icon={<Plus className="w-4 h-4" aria-hidden />}>Rakip ekle</Button>}
          />
        </Panel>
      ) : (
        <>
          {insight && <p className="text-sm text-ink">{insight}</p>}
          <Panel flush>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Siteniz ve rakiplerinizin ana sayfa karşılaştırması</caption>
                <thead>
                  <tr className="bg-surface-2 border-b border-line text-2xs font-semibold uppercase tracking-wider text-muted">
                    <th scope="col" className="px-4 py-2.5">Alan adı</th>
                    <th scope="col" className="px-4 py-2.5 text-center" title="Ana sayfanın hızlı denetim puanı; tüm site taramasındaki sağlık puanından farklıdır">Ana sayfa puanı</th>
                    <th scope="col" className="px-4 py-2.5 text-center">Kritik</th>
                    <th scope="col" className="px-4 py-2.5">AI yanıt motorları</th>
                    <th scope="col" className="px-4 py-2.5">Yapılandırılmış veri</th>
                    <th scope="col" className="px-4 py-2.5">Meta açıklama</th>
                    <th scope="col" className="px-2 py-2.5"><span className="sr-only">İşlem</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {all.map((d) => {
                    const isMine = d === myDomain;
                    return (
                      <tr key={d} className={cn(isMine && "bg-accent-soft/40")}>
                        <th scope="row" className="px-4 py-3 font-medium text-ink whitespace-nowrap">
                          {d}
                          {isMine && (
                            <Badge tone="accent" className="ml-2">
                              Siz
                            </Badge>
                          )}
                        </th>
                        <ResultCells r={results[d]} mine={isMine} />
                        <td className="px-2 py-3 text-right">
                          {!isMine && (
                            <button type="button" onClick={() => remove(d)} aria-label={`${d} rakibini kaldır`} className="w-9 h-9 inline-flex items-center justify-center rounded-sm text-muted hover:text-critical hover:bg-critical-soft cursor-pointer">
                              <Trash2 className="w-4 h-4" aria-hidden />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted">
              <span>{mine ? `Son karşılaştırma ${formatRelative(mine.checkedAt)}` : "Karşılaştırma için 'Yeniden karşılaştır'a basın."}</span>
              {!running && Object.keys(results).length === 0 && (
                <Button size="sm" onClick={() => compare(all)} icon={<RefreshCw className="w-3.5 h-3.5" aria-hidden />}>
                  Şimdi karşılaştır
                </Button>
              )}
            </div>
          </Panel>
          <Notice tone="info">Organik trafik, sıralanan kelime ve backlink karşılaştırması için bir SEO veri sağlayıcısı bağlantısı gerekir; bu veri henüz platformda yok.</Notice>
        </>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Rakip ekle" icon={<Users className="w-4 h-4" />}>
        <form onSubmit={addCompetitor} className="space-y-4">
          {addErr && <Notice tone="error">{addErr}</Notice>}
          <div>
            <Label htmlFor="competitor-domain">Rakibin alan adı</Label>
            <Input id="competitor-domain" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="rakip.com" inputMode="url" required />
          </div>
          <p className="text-xs text-muted">Eklediğinizde rakibin ana sayfası hemen denetlenir. Liste bu tarayıcıda saklanır.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" icon={<Plus className="w-4 h-4" aria-hidden />}>
              Ekle ve denetle
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
