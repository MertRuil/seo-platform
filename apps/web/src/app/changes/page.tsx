"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GitCommit, RotateCcw, CheckCircle2, Play, ArrowRight, RefreshCw, Copy, Info, AlertTriangle } from "lucide-react";
import { useSite } from "@/context/SiteContext";
import { api, ApiError, type ChangeSetResponse } from "@/lib/api";
import { DEMO_CHANGESETS, type ChangeSetItem } from "@/lib/demo";
import { readActiveId, readChangeSets, updateChangeSetStatus, writeChangeSets } from "@/lib/changesets";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, Inset } from "@/components/ui/Panel";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge, SeverityBadge } from "@/components/ui/Badge";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { EmptyState, Notice, SkeletonRows, type NoticeTone } from "@/components/ui/States";
import { cn } from "@/lib/cn";

const statusTone = { BEKLİYOR: "accent", UYGULANIYOR: "accent", UYGULANDI: "evidence", GERİ_ALINDI: "warn" } as const;
const statusLabel = { BEKLİYOR: "Onay bekliyor", UYGULANIYOR: "Uygulanıyor", UYGULANDI: "Sitede uygulandı", GERİ_ALINDI: "Geri alındı" } as const;

type SetWithOrigin = ChangeSetItem & { origin: "server" | "draft" | "demo" };

function fromServer(cs: ChangeSetResponse, fallbackUrl: string): SetWithOrigin {
  const item = cs.items?.[0];
  const durum: ChangeSetItem["durum"] =
    cs.status === "SUCCESS" || cs.status === "APPLIED" ? "UYGULANDI" : cs.status === "ROLLED_BACK" ? "GERİ_ALINDI" : cs.status === "EXECUTING" ? "UYGULANIYOR" : "BEKLİYOR";
  return {
    id: cs.id,
    sorunId: cs.recommendation_id ?? undefined,
    baslik: item ? `${item.operation.replace(/_/g, " ").toLowerCase()} · ${item.target_url}` : `Değişiklik seti ${cs.id.slice(0, 8)}`,
    onem: cs.risk_level || undefined,
    etkilenenSayfa: item?.target_url || fallbackUrl,
    kategori: item?.operation,
    durum,
    oncekiKod: item?.state_before ?? "",
    yeniKod: item?.state_after ?? "",
    olusturulmaTarihi: new Date(cs.created_at).toLocaleString("tr-TR"),
    origin: "server",
  };
}

const isSandbox = (connector?: string) => !connector || /sandbox/i.test(connector);

export default function DegisikliklerPage() {
  const { site, org, status } = useSite();
  const hasSite = Boolean(org?.id && site?.id);

  const [sets, setSets] = useState<SetWithOrigin[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasConnector, setHasConnector] = useState<boolean | null>(null);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      if (!hasSite || !org || !site) {
        if (!cancelled) {
          setSets(DEMO_CHANGESETS.map((s) => ({ ...s, origin: "demo" as const })));
          setLoading(false);
        }
        return;
      }
      // Sunucudaki setler + bu tarayıcıda oluşturulmuş, bu siteye ait taslaklar
      const [server, connectors] = await Promise.all([
        api.getChangeSets(org.id, site.id).catch(() => [] as ChangeSetResponse[]),
        api.getConnectors(org.id, site.id).catch(() => null),
      ]);
      const domain = (site.normalized_domain || site.domain).replace(/^www\./, "");
      const drafts = readChangeSets()
        .filter((d) => {
          try { return new URL(d.etkilenenSayfa).hostname.replace(/^www\./, "") === domain; } catch { return false; }
        })
        .map((d) => ({ ...d, origin: "draft" as const }));
      if (cancelled) return;
      const merged = [...drafts, ...server.map((cs) => fromServer(cs, site.primary_url))];
      setSets(merged);
      setHasConnector(connectors === null ? null : connectors.some((c) => c.is_active !== false && !isSandbox(c.connector_type || c.tur)));
      const activeId = readActiveId();
      const idx = activeId ? merged.findIndex((s) => s.id === activeId) : -1;
      setActive(idx >= 0 ? idx : 0);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [status, hasSite, org, site]);

  const current = sets[active];
  const isDemo = current?.origin === "demo";

  const updateCurrent = (durum: ChangeSetItem["durum"]) => {
    const next = sets.map((s, i) => (i === active ? { ...s, durum } : s));
    setSets(next);
    // Yalnızca tarayıcı taslakları yerelde saklanır; sunucu setlerinin durumu sunucudadır.
    if (current?.origin === "draft") updateChangeSetStatus(current.id, durum);
  };

  const errorText = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : "bilinmeyen hata");

  const handleApply = async () => {
    if (!current || !org || !site || isDemo) return;
    setBusy(true);
    setNotice(null);
    try {
      if (current.origin === "server" && current.durum !== "GERİ_ALINDI") {
        const saved = await api.getChangeSet(org.id, site.id, current.id);
        if (saved.status === "WAITING_APPROVAL" || (saved.status === "DRAFT" && ["HIGH", "CRITICAL"].includes(saved.risk_level))) {
          await api.approveChangeSet(org.id, site.id, current.id);
        }
        const result = await api.executeChangeSet(org.id, site.id, current.id);
        if (!result.success) throw new Error(result.error_message || result.status);
        updateCurrent("UYGULANDI");
        setNotice({ tone: "success", text: "Değişiklik uygulandı. Aynı değişiklik setinin yedeğini kullanarak geri alabilirsiniz." });
        return;
      }
      const res = await api.selfHealIssue(org.id, site.id, {
        issue_id: current.sorunId,
        issue_title: current.baslik,
        target_url: current.etkilenenSayfa,
        category: current.kategori,
        risk_level: current.onem || "LOW",
        auto_execute: true,
        state_before: current.oncekiKod,
        state_after: current.yeniKod,
      });
      const executed = res.execution?.success ?? res.success;
      if (!executed) {
        setNotice({ tone: "error", text: `Değişiklik uygulanamadı: ${res.execution?.error_message || res.message || "bilinmeyen hata"}. Sitenizde değişiklik yapılmadı.` });
      } else if (isSandbox(res.connector_type)) {
        setNotice({
          tone: "warn",
          text: "Değişiklik yalnızca deneme ortamında doğrulandı, sitenize yazılmadı: bu site için bağlı bir bağlayıcı yok. Kodu kopyalayıp sitenize elle uygulayabilir veya bağlayıcı kurabilirsiniz.",
        });
      } else {
        // The server created a new set; keep its identity for subsequent rollback.
        const applied = fromServer(res.change_set, site.primary_url);
        setSets((previous) => previous.map((s) => s.id === current.id ? applied : s));
        writeChangeSets(readChangeSets().filter((draft) => draft.id !== current.id));
        setNotice({ tone: "success", text: `Değişiklik ${res.connector_type} bağlayıcısıyla sitenize yazıldı. Yazmadan önce yedek alındı; sorun çıkarsa buradan geri alabilirsiniz.` });
      }
    } catch (e) {
      setNotice({ tone: "error", text: `Değişiklik uygulanamadı: ${errorText(e)}. Sitenizde değişiklik yapılmadı.` });
    } finally {
      setBusy(false);
    }
  };

  const handleRollback = async () => {
    if (!current || !org || !site || current.origin !== "server") return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await api.rollbackChangeSet(org.id, site.id, current.id);
      if (res.success) {
        updateCurrent("GERİ_ALINDI");
        setNotice({ tone: "info", text: "Geri alındı: sayfa, değişiklikten önce alınan yedeğe döndürüldü." });
      } else {
        setNotice({ tone: "error", text: `Geri alınamadı: ${res.error_message || res.status}.` });
      }
    } catch (e) {
      setNotice({ tone: "error", text: `Geri alınamadı: ${errorText(e)}.` });
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.yeniKod);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* pano izni yok */
    }
  };

  const counts = useMemo(() => ({ waiting: sets.filter((s) => s.durum === "BEKLİYOR").length, applied: sets.filter((s) => s.durum === "UYGULANDI").length }), [sets]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {!hasSite && status === "ready" && <DemoBanner source="demo" reason="no-site" />}
      <PageHeader
        icon={<GitCommit className="w-5 h-5" />}
        title="Değişiklikler"
        description="Sitenize uygulanacak düzeltmeleri önce/sonra karşılaştırmasıyla inceleyin. Bağlı bir bağlayıcı varsa onayladığınız değişiklik sitenize yazılır; yoksa kodu kopyalayıp elle uygulayabilirsiniz."
        actions={
          sets.length > 0 ? (
            <Badge tone="neutral" mono>
              {counts.waiting} bekliyor · {counts.applied} uygulandı
            </Badge>
          ) : undefined
        }
      />

      {loading ? (
        <Panel>
          <SkeletonRows rows={6} />
        </Panel>
      ) : !current ? (
        <Panel>
          <EmptyState
            icon={<GitCommit className="w-8 h-8" />}
            title="Henüz değişiklik taslağı yok"
            description="Sorunlar ekranında önerilen koda sahip bir bulgu için taslak oluşturduğunuzda burada inceleyip uygulayabilirsiniz."
            action={<LinkButton href="/issues" variant="primary" icon={<ArrowRight className="w-4 h-4" aria-hidden />}>Sorunlara git</LinkButton>}
          />
        </Panel>
      ) : (
        <>
          {sets.length > 1 && (
            <div role="tablist" aria-label="Değişiklik setleri" className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {sets.map((cs, idx) => (
                <button
                  key={cs.id}
                  role="tab"
                  aria-selected={active === idx}
                  type="button"
                  onClick={() => {
                    setActive(idx);
                    setNotice(null);
                  }}
                  className={cn(
                    "h-9 px-3 rounded-sm text-xs font-semibold whitespace-nowrap inline-flex items-center gap-2 transition-colors cursor-pointer border",
                    active === idx ? "bg-accent-soft text-accent-ink border-accent" : "bg-surface text-muted border-line hover:text-ink hover:bg-surface-2"
                  )}
                >
                  <span className="max-w-[200px] truncate">{cs.baslik}</span>
                  <span className="sr-only">{statusLabel[cs.durum]}</span>
                  <span className={cn("w-2 h-2 rounded-full", cs.durum === "UYGULANDI" ? "bg-evidence" : cs.durum === "GERİ_ALINDI" ? "bg-warn" : "bg-accent")} aria-hidden />
                </button>
              ))}
            </div>
          )}

          {notice && (
            <Notice tone={notice.tone} onClose={() => setNotice(null)}>
              {notice.text}
            </Notice>
          )}

          <Panel>
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-line pb-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {current.onem && <SeverityBadge severity={current.onem} />}
                  <Badge tone={statusTone[current.durum]}>{statusLabel[current.durum]}</Badge>
                  {current.origin === "draft" && <Badge tone="neutral">Bu tarayıcıda oluşturuldu</Badge>}
                </div>
                <h2 className="text-base font-semibold text-ink">{current.baslik}</h2>
                {current.etkilenenSayfa && (
                  <p className="font-mono text-xs text-muted mt-1 break-all">
                    Sayfa:{" "}
                    <a href={current.etkilenenSayfa} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline hover:opacity-80">
                      {current.etkilenenSayfa}
                    </a>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {isDemo ? (
                  <Badge tone="neutral">Örnek set · uygulanamaz</Badge>
                ) : current.durum === "UYGULANDI" ? (
                  current.origin === "server" && (
                    <Button variant="secondary" size="sm" loading={busy} onClick={handleRollback} icon={<RotateCcw className="w-3.5 h-3.5 text-warn" aria-hidden />}>
                      Geri al
                    </Button>
                  )
                ) : current.durum === "GERİ_ALINDI" ? (
                  <Button size="sm" loading={busy} onClick={handleApply} icon={<RefreshCw className="w-3.5 h-3.5" aria-hidden />}>
                    Tekrar uygula
                  </Button>
                ) : (
                  <Button variant="evidence" loading={busy} onClick={handleApply} icon={<Play className="w-3.5 h-3.5" aria-hidden />}>
                    {hasConnector ? "Onayla ve siteye uygula" : "Onayla ve dene"}
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-muted">Önce / sonra</span>
                <Button size="sm" variant="ghost" onClick={copyCode} icon={<Copy className="w-3.5 h-3.5" aria-hidden />}>
                  {copied ? "Kopyalandı" : "Yeni kodu kopyala"}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                <div className="rounded-sm border-l-2 border-critical bg-critical-soft p-3 overflow-x-auto">
                  <div className="text-2xs font-semibold uppercase tracking-wider text-critical mb-2">Şu an</div>
                  <pre className="whitespace-pre-wrap text-critical leading-relaxed">{current.oncekiKod || "—"}</pre>
                </div>
                <div className="rounded-sm border-l-2 border-evidence bg-evidence-soft p-3 overflow-x-auto">
                  <div className="text-2xs font-semibold uppercase tracking-wider text-evidence mb-2">Uygulanacak</div>
                  <pre className="whitespace-pre-wrap text-evidence leading-relaxed">{current.yeniKod || "—"}</pre>
                </div>
              </div>
            </div>

            {!isDemo && hasConnector === false && (
              <Inset className="mt-4 border-warn bg-warn-soft space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-warn">
                  <AlertTriangle className="w-4 h-4" aria-hidden />
                  Bu site için bağlı bağlayıcı yok
                </div>
                <p className="text-xs text-warn">
                  Onayladığınız değişiklikler yalnızca deneme ortamında doğrulanır, sitenize yazılmaz. Kodu kopyalayıp sitenize elle ekleyebilir ya da WordPress, Git veya Cloudflare bağlantısı kurabilirsiniz.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button size="sm" variant="secondary" onClick={copyCode} icon={<Copy className="w-3.5 h-3.5" aria-hidden />}>
                    {copied ? "Kopyalandı" : "Kodu kopyala"}
                  </Button>
                  <Link href="/integrations" className="text-xs font-semibold text-warn hover:underline inline-flex items-center gap-1 min-h-[32px]">
                    Bağlayıcı kur <ArrowRight className="w-3 h-3" aria-hidden />
                  </Link>
                </div>
              </Inset>
            )}

            {!isDemo && hasConnector && (
              <p className="mt-4 pt-3 border-t border-line text-xs text-muted flex items-start gap-2">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
                Uygulamadan önce sayfanın yedeği alınır. Sayfa taramadan bu yana değişmişse yazma yapılmaz; yazma sonrası doğrulama başarısız olursa değişiklik otomatik geri alınır.
              </p>
            )}
            {current.durum === "UYGULANDI" && (
              <p className="mt-3 text-xs text-muted flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-evidence shrink-0 mt-0.5" aria-hidden />
                Sorunun kapandığını görmek için bir sonraki taramayı bekleyin veya Taramalar ekranından yeni tarama başlatın.
              </p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
