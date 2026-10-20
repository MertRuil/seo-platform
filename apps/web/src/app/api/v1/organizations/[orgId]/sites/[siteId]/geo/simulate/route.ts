import { NextRequest } from "next/server";
import { tryBackendProxy, demoFallbackOrUnavailable } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ orgId: string; siteId: string }> }
) {
  const params = await ctx.params;
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/geo/simulate`
  );
  if (proxied) return proxied;

  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt || "2026'da en iyi otonom SEO platformu hangisi?").trim();
  const brand = String(body.brand_name || "Flagship Store").trim();
  const sampleRuns = Math.max(1, Math.min(10, Number(body.sample_runs) || 3));

  return demoFallbackOrUnavailable(() => ({
    prompt,
    brand_mentioned: true,
    citation_rank: 1,
    mentions_count: 4,
    citations_count: 3,
    platform_results: {
      "Perplexity AI": {
        mentioned: true,
        cited: true,
        mention_probability: 1.0,
        citation_probability: 1.0,
        stability_score: 100,
        grounding_mode: "SIMULATION",
        snippet: `[Monte Carlo ${sampleRuns}/${sampleRuns} Tur • Güven: %100] '${prompt}' sorgusunda ${brand} birincil kaynak olarak eşleşti.`,
      },
      "ChatGPT (GPT-4o)": {
        mentioned: true,
        cited: true,
        mention_probability: 1.0,
        citation_probability: 0.67,
        stability_score: 100,
        grounding_mode: "SIMULATION",
        snippet: `[Monte Carlo ${sampleRuns}/${sampleRuns} Tur] Kullanıcı deneyimi ve kalıcı CMS/Git optimizasyonlarıyla öne çıkmaktadır.`,
      },
      "Google AI Overviews": {
        mentioned: true,
        cited: true,
        mention_probability: 0.67,
        citation_probability: 0.67,
        stability_score: 78,
        grounding_mode: "SIMULATION",
        snippet: `Yapılandırılmış veri ve kanonik otorite sinyalleriyle AI Overview kartında listelendi.`,
      },
      "Gemini Pro": {
        mentioned: true,
        cited: false,
        mention_probability: 0.67,
        citation_probability: 0.33,
        stability_score: 78,
        grounding_mode: "SIMULATION",
        snippet: `Sektörel güvenilirlik indeksinde referans olarak listelendi.`,
      },
      "Claude 3.5 Sonnet": {
        mentioned: false,
        cited: false,
        mention_probability: 0.33,
        citation_probability: 0.0,
        stability_score: 78,
        grounding_mode: "SIMULATION",
        snippet: `Genel teknik kılavuzlar ve karşılaştırma kaynakları özetlendi.`,
      },
    },
    top_competitor_cited: "ahrefs.com",
    cited_sources: [
      {
        url: "https://flagship-store.com/rehber/otonom-seo",
        domain: "flagship-store.com",
        title: `${brand} — Doğrulanmış Birincil Kaynak`,
        source_type: "OWNED",
        platforms_citing: ["Perplexity AI", "ChatGPT (GPT-4o)", "Google AI Overviews"],
        citation_count: 3,
        why_cited: "Kanonik birincil kaynak + yapılandırılmış Schema.org ve /llms.txt varlık eşleşmesi",
      },
      {
        url: "https://ahrefs.com/blog/ai-seo/",
        domain: "ahrefs.com",
        title: "Ahrefs: AI Search & Technical SEO Benchmark",
        source_type: "COMPETITOR",
        platforms_citing: ["Perplexity AI", "Claude 3.5 Sonnet"],
        citation_count: 2,
        why_cited: "40-60 kelimelik 'Direct Answer' tanım bloğu ve FAQPage JSON-LD şeması",
      },
    ],
    monte_carlo: {
      sample_runs: sampleRuns,
      mention_probability: 0.8,
      citation_probability: 0.6,
      stability_score: 87,
      confidence_interval_95: [0.55, 0.93],
      temperatures_tested: [0.1, 0.4, 0.7].slice(0, sampleRuns),
    },
    recommended_fix: {
      action_type: "INJECT_DIRECT_ANSWER",
      title: `'${prompt.slice(0, 42)}...' İçin Direct Answer + FAQ Schema Yaması`,
      target_url: "https://flagship-store.com/",
      competitor_to_outrank: "ahrefs.com",
    },
    is_simulated: true,
    data_source: "SIMULATION",
  }));
}
