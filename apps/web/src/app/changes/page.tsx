"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { GitCommit, RotateCcw, CheckCircle2, ShieldCheck, Play, ArrowRight, RefreshCw, Copy, Info, Lock, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import { useSiteData } from "@/hooks/useSiteData";
import { api, type ChangeSetResponse } from "@/lib/api";
import { DEMO_CHANGESETS, type ChangeSetItem } from "@/lib/demo";
import { readActiveId, readChangeSets, writeChangeSets } from "@/lib/changesets";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, Inset } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge, SeverityBadge } from "@/components/ui/Badge";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Notice, type NoticeTone } from "@/components/ui/States";
import { cn } from "@/lib/cn";

const statusTone = { BEKLİYOR: "accent", UYGULANIYOR: "accent", UYGULANDI: "evidence", GERİ_ALINDI: "warn" } as const;
const statusLabel = { BEKLİYOR: "Bekliyor", UYGULANIYOR: "Uygulanıyor", UYGULANDI: "Uygulandı", GERİ_ALINDI: "Geri alındı" } as const;

export default function DegisikliklerPage() {
  const { user } = useAuth();
  const { site, org } = useSite();
  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);

  const demo = useSiteData<ChangeSetItem[]>("changesets", async () => DEMO_CHANGESETS, DEMO_CHANGESETS, { requires: "none" });

  const [sets, setSets] = useState<ChangeSetItem[]>([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      // 1. Try to load live change-sets from the backend API if org & site exist
      if (org?.id && site?.id) {
        try {
          const apiSets = await api.getChangeSets(org.id, site.id);
          if (!isCancelled && apiSets && apiSets.length > 0) {
            const mapped: ChangeSetItem[] = apiSets.map((cs) => {
              const item = cs.items && cs.items[0];
              const durumMapped: ChangeSetItem["durum"] =
                cs.status === "SUCCESS"
                  ? "UYGULANDI"
                  : cs.status === "ROLLED_BACK"
                  ? "GERİ_ALINDI"
                  : cs.status === "EXECUTING"
                  ? "UYGULANIYOR"
                  : "BEKLİYOR";

              return {
                id: cs.id,
                sorunId: cs.recommendation_id || `ISSUE-${cs.id.slice(0, 4)}`,
                baslik: item ? `${item.operation.replace(/_/g, " ")} (${item.target_url})` : `Değişiklik Seti #${cs.id.slice(0, 6)}`,
                onem: (cs.risk_level as any) || "MEDIUM",
                etkilenenSayfa: item?.target_url || site.primary_url || "https://" + site.domain,
                kategori: item?.operation || "CANONICAL",
                durum: durumMapped,
                oncekiKod: item?.state_before || "<!-- Önceki Sayfa Durumu -->",
                yeniKod: item?.state_after || "<!-- Yeni Optimize Durum -->",
                olusturulmaTarihi: new Date(cs.created_at).toLocaleTimeString("tr-TR"),
              };
            });

            setSets(mapped);
            return;
          }
        } catch {
          // Gracefully fallback to localStorage/demo
        }
      }

      // 2. LocalStorage & Demo Fallback
      const saved = readChangeSets();
      if (saved.length > 0) {
        setSets(saved);
        const id = readActiveId();
        const idx = id ? saved.findIndex((s) => s.id === id) : -1;
        if (idx >= 0) setActive(idx);
      } else {
        const lastUrl = typeof window !== "undefined" ? localStorage.getItem("calpeo_last_audited_url") : null;
        const domain = lastUrl ? lastUrl.replace(/^https?:\/\//, "").split("/")[0] : site?.domain || null;
        const target = lastUrl || site?.primary_url || null;

        if (domain && target) {
          const dynamicSet: ChangeSetItem = {
            id: "CS-LIVE-1",
            sorunId: "ISSUE-01",
            baslik: `${domain} Sayfası Başlık ve Canonical İyileştirmesi`,
            onem: "CRITICAL",
            etkilenenSayfa: target,
            kategori: "CANONICAL",
            durum: "BEKLİYOR",
            oncekiKod: `<title>${domain}</title>\n<!-- Eksik rel=canonical veya hatalı yönlendirme -->`,
            yeniKod: `<title>${domain} | Resmi Web Sitesi</title>\n<link rel="canonical" href="${target}" />`,
            olusturulmaTarihi: "Bugün",
          };
          setSets([dynamicSet]);
        } else {
          setSets(DEMO_CHANGESETS);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [org?.id, site?.id, site?.domain, site?.primary_url]);

  const current = sets[active] ?? DEMO_CHANGESETS[0];

  const update = (patch: Partial<ChangeSetItem>) => {
    const next = [...sets];
    next[active] = { ...next[active], ...patch };
    setSets(next);
    writeChangeSets(next);
  };

  // Yerel ve örnek setlerin kimliği "CS-" ile başlar; sunucunun oluşturduğu setler UUID taşır.
  const isServerSet = !current.id.startsWith("CS-");

  const handleApply = async () => {
    if (!isAdmin) {
      setNotice({ tone: "error", text: "Değişiklikleri canlıya yalnızca platform yöneticileri uygulayabilir." });
      return;
    }
    if (!org?.id || !site?.id) {
      setNotice({ tone: "info", text: "Bu bir örnek değişiklik seti. Site seçili olmadığı için hiçbir şey uygulanmadı." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
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
      if (res.execution && !res.execution.success) {
        setNotice({
          tone: "error",
          text: `Değişiklik uygulanamadı: ${res.execution.error_message || "yürütücü hata döndürdü"}.${res.execution.rolled_back ? " Sayfa yedekten geri yüklendi." : ""}`,
        });
      } else if (res.change_set.status === "SUCCESS") {
        // Geri alma sunucudaki seti hedeflesin diye yerel kimlik sunucu kimliğiyle değiştirilir.
        update({ id: res.change_set.id, durum: "UYGULANDI" });
        setNotice(
          res.connector_type === "SANDBOX"
            ? { tone: "info", text: "Değişiklik sandbox bağlayıcısında denendi; canlı siteye yazılmadı." }
            : { tone: "success", text: `Değişiklik ${res.connector_type} bağlayıcısıyla uygulandı. Yazmadan önce yedek alındı ve sonuç doğrulandı.` }
        );
      } else {
        update({ id: res.change_set.id });
        setNotice({ tone: "info", text: `${res.message} Yüksek riskli değişiklikler uygulanmadan önce onay bekler.` });
      }
    } catch (err) {
      setNotice({ tone: "error", text: `Değişiklik uygulanamadı: ${err instanceof Error && err.message ? err.message : "sunucuya ulaşılamadı"}` });
    } finally {
      setBusy(false);
    }
  };

  const handleRollback = async () => {
    if (!isAdmin) {
      setNotice({ tone: "error", text: "Geri almayı yalnızca platform yöneticileri yapabilir." });
      return;
    }
    if (!org?.id || !site?.id || !isServerSet) {
      setNotice({ tone: "info", text: "Bu set sunucuda uygulanmadığı için geri alınacak bir değişiklik yok." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await api.rollbackChangeSet(org.id, site.id, current.id);
      if (res.success) {
        update({ durum: "GERİ_ALINDI" });
        setNotice({ tone: "info", text: "Geri alma tamamlandı; yedek geri yüklendi, sayfa önceki durumuna döndü." });
      } else {
        setNotice({ tone: "error", text: `Geri alma tamamlanamadı: ${res.error_message || "bağlayıcı yedeği geri yükleyemedi"}` });
      }
    } catch (err) {
      setNotice({ tone: "error", text: `Geri alma tamamlanamadı: ${err instanceof Error && err.message ? err.message : "sunucuya ulaşılamadı"}` });
    } finally {
      setBusy(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(current.yeniKod);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <DemoBanner source={demo.source} reason={demo.reason} />
      <PageHeader
        icon={<GitCommit className="w-5 h-5" />}
        title="Değişiklikler"
        description="Her değişikliği eski ve yeni hâliyle yan yana inceleyin. Uygulamadan önce dosyanın değişmediği doğrulanır ve yedek alınır; doğrulama başarısız olursa değişiklik otomatik geri alınır."
        actions={
          <Badge tone="neutral" mono>
            {sets.length} set
          </Badge>
        }
      />

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
              <span className="font-mono">#{cs.id}</span>
              <span className="max-w-[160px] truncate">{cs.baslik}</span>
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
              <span className="font-mono text-xs font-semibold text-accent-ink">DEĞİŞİKLİK SETİ #{current.id}</span>
              {current.onem && <SeverityBadge severity={current.onem} />}
              <Badge tone={statusTone[current.durum]}>{statusLabel[current.durum]}</Badge>
            </div>
            <h2 className="text-base font-semibold text-ink">{current.baslik}</h2>
            <p className="font-mono text-xs text-muted mt-1 truncate">
              Etkilenen sayfa:{" "}
              <a href={current.etkilenenSayfa} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline hover:opacity-80">
                {current.etkilenenSayfa}
              </a>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isAdmin ? (
              <Badge tone="neutral">
                <Lock className="w-3 h-3" aria-hidden /> Yalnızca yönetici uygulayabilir
              </Badge>
            ) : current.durum === "UYGULANDI" ? (
              <>
                <Badge tone="evidence">
                  <CheckCircle2 className="w-3 h-3" aria-hidden /> Uygulandı
                </Badge>
                <Button variant="secondary" size="sm" loading={busy} onClick={handleRollback} icon={<RotateCcw className="w-3.5 h-3.5 text-warn" />}>
                  Geri al
                </Button>
              </>
            ) : current.durum === "GERİ_ALINDI" ? (
              <>
                <Badge tone="warn">Önceki duruma döndürüldü</Badge>
                <Button size="sm" loading={busy} onClick={handleApply} icon={<RefreshCw className="w-3.5 h-3.5" />}>
                  Tekrar uygula
                </Button>
              </>
            ) : (
              <Button variant="evidence" loading={busy} onClick={handleApply} icon={<Play className="w-3.5 h-3.5" />}>
                Değişikliği uygula
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-muted">Eski ve yeni hâl yan yana</span>
            <Button size="sm" variant="ghost" onClick={copyCode} icon={<Copy className="w-3.5 h-3.5" />}>
              {copied ? "Kopyalandı" : "Yeni kodu kopyala"}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
            <div className="rounded-sm border-l-2 border-critical bg-critical-soft p-3 overflow-x-auto">
              <div className="text-xs font-semibold uppercase tracking-wider text-critical mb-2">− Önceki durum</div>
              <pre className="whitespace-pre-wrap text-critical leading-relaxed">{current.oncekiKod}</pre>
            </div>
            <div className="rounded-sm border-l-2 border-evidence bg-evidence-soft p-3 overflow-x-auto">
              <div className="text-xs font-semibold uppercase tracking-wider text-evidence mb-2">+ Uygulanacak durum</div>
              <pre className="whitespace-pre-wrap text-evidence leading-relaxed">{current.yeniKod}</pre>
            </div>
          </div>
        </div>

        <Inset className="mt-4 border-accent bg-accent-soft space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-accent-ink">
            <Info className="w-4 h-4" aria-hidden />
            Sandbox modu
          </div>
          <p className="text-xs text-accent-ink">
            Siteye ait bağlayıcı anahtarı henüz girilmediği için değişiklik yalnızca platformun yerel koruma motorunda uygulanır; gerçek sunucu dosyalarına dokunulmaz. Kodu kopyalayabilir veya bağlayıcı tanımlayarak otomatik yazmayı açabilirsiniz.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button size="sm" onClick={copyCode} icon={<Copy className="w-3.5 h-3.5" />}>
              {copied ? "Kopyalandı" : "Düzeltilmiş kodu kopyala"}
            </Button>
            <Link href="/integrations" className="text-xs font-medium text-accent-ink hover:underline inline-flex items-center gap-1">
              Bağlayıcı tanımla <ArrowRight className="w-3 h-3" aria-hidden />
            </Link>
          </div>
        </Inset>

        <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-evidence-soft text-evidence font-medium text-xs border border-evidence/20">
              <ShieldCheck className="w-3.5 h-3.5" /> Güvenli yazma
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface text-ink font-mono text-2xs border border-line">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent" /> Yazmadan önce dosya özeti kontrolü
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface text-ink font-medium text-xs border border-line">
              <RotateCcw className="w-3.5 h-3.5 text-muted" /> Hata olursa otomatik geri alma
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-soft text-accent-ink font-medium text-xs border border-accent/20">
              <Zap className="w-3.5 h-3.5" /> IndexNow ile hızlı bildirim
            </span>
          </div>
          <span className="text-muted text-xs">
            Sunucu hatası veya içerik sapmasında otomatik geri alınır.
          </span>
        </div>
      </Panel>
    </div>
  );
}
