"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSite } from "@/context/SiteContext";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";
import { Badge } from "@/components/ui/Badge";

type Method = "DNS_TXT" | "HTML_FILE" | "META_TAG";
interface Verification {
  site_id: string;
  token: string;
  instructions: { methods: Record<Method, {description:string;snippet?:string;host?:string;path?:string}> };
}

export function SiteVerification() {
  const { org, site, refresh } = useSite();
  const [details, setDetails] = useState<Verification | null>(null);
  const [method, setMethod] = useState<Method>("DNS_TXT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!org || !site) return;
    let cancelled = false;
    setError(null);
    api.getSiteVerification(org.id, site.id).then((value) => {
      if (!cancelled) setDetails(value);
    }).catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Doğrulama bilgileri alınamadı"); });
    return () => { cancelled = true; };
  }, [org?.id, site?.id]);
  if (!org || !site) return null;
  const current = details?.site_id === site.id ? details : null;
  const instruction = current?.instructions.methods[method];
  const verify = async () => {
    setBusy(true); setError(null);
    try {
      await api.verifySite(org.id, site.id, method);
      await refresh({ siteId: site.id });
    } catch (e) { setError(e instanceof Error ? e.message : "Sahiplik doğrulanamadı"); }
    finally { setBusy(false); }
  };
  return <Panel title="Alan adı sahipliği" sub="Sitenize otomatik değişiklik uygulamadan önce sahipliğini doğrulayın." actions={<Badge tone={site.verification_status === "VERIFIED" ? "evidence" : "warn"}>{site.verification_status === "VERIFIED" ? "Doğrulandı" : "Doğrulama bekliyor"}</Badge>}>
    {error && <Notice tone="error">{error}</Notice>}
    {site.verification_status !== "VERIFIED" && <div className="space-y-3">
      <label className="block text-sm text-muted">Doğrulama yöntemi
        <select value={method} onChange={(e) => setMethod(e.target.value as Method)} className="block mt-1 w-full rounded border border-line bg-surface p-2 text-ink">
          <option value="DNS_TXT">DNS TXT kaydı</option><option value="HTML_FILE">Doğrulama dosyası</option><option value="META_TAG">HTML meta etiketi</option>
        </select>
      </label>
      {instruction ? <><p className="text-sm text-muted">{instruction.description}</p><pre className="whitespace-pre-wrap break-all rounded bg-surface-2 p-3 text-xs text-ink">{instruction.snippet || [instruction.host || instruction.path, current?.token].filter(Boolean).join("\n")}</pre></> : <p className="text-sm text-muted">Doğrulama bilgileri yükleniyor…</p>}
      <Button onClick={verify} loading={busy} disabled={!current}>Kaydı ekledim, doğrula</Button>
    </div>}
  </Panel>;
}
