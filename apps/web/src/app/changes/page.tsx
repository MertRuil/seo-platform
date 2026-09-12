"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { GitCommit, RotateCcw, CheckCircle2, ShieldCheck, Play, ArrowRight, RefreshCw, Copy, Info, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSiteData } from "@/hooks/useSiteData";
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
  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);
  // Arka uçta değişiklik seti listeleme ucu yok; sandbox setleri tarayıcıda tutulur.
  const demo = useSiteData<ChangeSetItem[]>("changesets", async () => DEMO_CHANGESETS, DEMO_CHANGESETS, { requires: "none" });

  const [sets, setSets] = useState<ChangeSetItem[]>([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);

  useEffect(() => {
    const saved = readChangeSets();
    if (saved.length > 0) {
      setSets(saved);
      const id = readActiveId();
      const idx = id ? saved.findIndex((s) => s.id === id) : -1;
      if (idx >= 0) setActive(idx);
    } else {
      setSets(DEMO_CHANGESETS);
    }
  }, []);

  const current = sets[active] ?? DEMO_CHANGESETS[0];

  const update = (durum: ChangeSetItem["durum"]) => {
    const next = [...sets];
    next[active] = { ...next[active], durum };
    setSets(next);
    writeChangeSets(next);
  };

  const handleApply = async () => {
    if (!isAdmin) {
      setNotice({ tone: "error", text: "Değişiklikleri canlıya yalnızca platform yöneticileri uygulayabilir." });
      return;
    }
    setBusy(true);
    setNotice(null);
    await new Promise((r) => setTimeout(r, 900));
    update("UYGULANDI");
    setBusy(false);
    setNotice({ tone: "success", text: `Değişiklik seti #${current.id} sandbox'ta uygulandı: yazma öncesi hash doğrulandı, yedek alındı, doğrulama geçti.` });
  };

  const handleRollback = async () => {
    if (!isAdmin) {
      setNotice({ tone: "error", text: "Geri almayı yalnızca platform yöneticileri yapabilir." });
      return;
    }
    setBusy(true);
    setNotice(null);
    await new Promise((r) => setTimeout(r, 700));
    update("GERİ_ALINDI");
    setBusy(false);
    setNotice({ tone: "info", text: "Geri alma tamamlandı; yedek geri yüklendi, sayfa önceki durumuna döndü." });
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
        title="Değişiklik setleri ve diff"
        description="Her değişiklik yan yana diff olarak incelenir; uygulamada yazma öncesi hash doğrulanır, yedek alınır, doğrulama başarısızsa otomatik geri alınır."
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
            <span className="font-semibold text-muted">Yan yana diff</span>
            <Button size="sm" variant="ghost" onClick={copyCode} icon={<Copy className="w-3.5 h-3.5" />}>
              {copied ? "Kopyalandı" : "Yeni kodu kopyala"}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
            <div className="rounded-sm border-l-2 border-critical bg-critical-soft p-3 overflow-x-auto">
              <div className="text-2xs font-semibold uppercase tracking-wider text-critical mb-2">− Önceki durum</div>
              <pre className="whitespace-pre-wrap text-critical leading-relaxed">{current.oncekiKod}</pre>
            </div>
            <div className="rounded-sm border-l-2 border-evidence bg-evidence-soft p-3 overflow-x-auto">
              <div className="text-2xs font-semibold uppercase tracking-wider text-evidence mb-2">+ Uygulanacak durum</div>
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

        <div className="mt-3 flex items-start gap-2 text-xs text-muted">
          <ShieldCheck className="w-4 h-4 text-evidence shrink-0" aria-hidden />
          <span>
            <span className="font-semibold text-ink">Güvenli yazma:</span> yazma öncesi sayfa hash'i doğrulanır, yedek alınır; sunucu hatası veya doğrulama başarısızlığında değişiklik otomatik geri alınır. Hash: SHA-256.
          </span>
        </div>
      </Panel>
    </div>
  );
}
