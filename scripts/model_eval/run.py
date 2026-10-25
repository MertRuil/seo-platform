"""Copilot, öneri üretimi ve siteye yazılacak değer önerilerini birden fazla modelde çalıştırıp sonuçları kaydeder.

Kullanım:
    .venv/bin/python scripts/model_eval/run.py --dry-run          # API çağrısı yok, akışı doğrular
    .venv/bin/python scripts/model_eval/run.py                    # gerçek çağrılar (ücretli)
    .venv/bin/python scripts/model_eval/run.py --limit 3 --only copilot
    .venv/bin/python scripts/model_eval/run.py --only actions       # yalnızca başlık/meta/JSON-LD önerileri

Anahtarlar ortamdan ya da kök .env'den okunur: ANTHROPIC_API_KEY, GOOGLE_API_KEY (veya GEMINI_API_KEY).
Sonuçlar scripts/model_eval/results/<zaman>/results.jsonl dosyasına yazılır; ardından report.py
kör değerlendirme sayfasını ve özeti üretir.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from fixtures import ACTION_CASES, COPILOT_CASES, REC_CASES, SITES  # noqa: E402
from services.agents.base import LLMProvider  # noqa: E402
from services.agents.technical_agent import SYSTEM_INSTRUCTION as TECHNICAL_SYSTEM_INSTRUCTION  # noqa: E402

# Fiyatlar USD / 1M token; düşünme token'ları çıktı fiyatından faturalanır.
MODELS = {
    "claude-haiku-5-5": {"provider": "anthropic", "in": 0.10, "out": 0.50},
    "gemini-3.5-flash-lite": {"provider": "gemini", "in": 0.30, "out": 2.50},
    "gemini-3.8-flash": {"provider": "gemini", "in": 0.75, "out": 3.75},
}

REC_SYSTEM = TECHNICAL_SYSTEM_INSTRUCTION

CITATION_SCHEMA = {
    "type": "object",
    "properties": {
        "source_id": {"type": "string"},
        "document_title": {"type": "string"},
        "canonical_url": {"type": "string"},
        "excerpt": {"type": "string"},
    },
    "required": ["source_id", "document_title", "canonical_url", "excerpt"],
    "additionalProperties": False,
}

# Pydantic RecommendationOutput ile aynı alanlar; uzunluk/aralık kısıtları sonradan doğrulanır.
REC_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "category": {"type": "string"},
        "problem_diagnosis": {"type": "string"},
        "proposed_solution": {"type": "string"},
        "technical_reason": {"type": "string"},
        "confidence": {"type": "number"},
        "expected_impact": {"type": "string"},
        "effort": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH"]},
        "risk_level": {"type": "string", "enum": ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]},
        "citations": {"type": "array", "items": CITATION_SCHEMA},
    },
    "required": ["title", "category", "problem_diagnosis", "proposed_solution", "technical_reason",
                 "confidence", "expected_impact", "effort", "risk_level", "citations"],
    "additionalProperties": False,
}

_NULLABLE_TEXT = {"anyOf": [{"type": "string"}, {"type": "null"}]}
# Üretimde proposed_schema_json serbest yapılı bir nesne; katı JSON şeması serbest anahtara izin vermediği için
# burada JSON metni olarak istenir ve report.py ayrıştırıp aynı kontrolden geçirir.
ACTION_SCHEMA = dict(
    REC_SCHEMA,
    properties={
        **REC_SCHEMA["properties"],
        "proposed_title": _NULLABLE_TEXT,
        "proposed_meta_description": _NULLABLE_TEXT,
        "proposed_schema_json": {"anyOf": [
            {"type": "string", "description": "Complete corrected JSON-LD object serialized as a JSON string."},
            {"type": "null"},
        ]},
    },
    required=REC_SCHEMA["required"] + ["proposed_title", "proposed_meta_description", "proposed_schema_json"],
)


def load_env() -> None:
    try:
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env", override=False)
    except ImportError:
        pass


def copilot_task(case: dict) -> dict:
    from apps.api.routes.copilot import SYSTEM_INSTRUCTION, build_copilot_prompt
    prompt = build_copilot_prompt(SITES[case["site"]], [tuple(t) for t in case.get("history", [])], case["question"])
    return {"kind": "copilot", "id": case["id"], "system": SYSTEM_INSTRUCTION, "prompt": prompt, "schema": None}


def rec_task(case: dict) -> dict:
    page = case["page"]
    # services/agents/technical_agent.py ile aynı prompt düzeni
    prompt = f"""
TECHNICAL AUDIT FACTS:
Rule ID: {case['rule_id']}
Issue: {case['title']}
Description: {case['description']}
Evidence: {case['evidence']}
Is YMYL Sector: {case.get('ymyl', False)}

OFFICIAL GUIDELINES RETRIEVED:
{[case['guide']]}

<UNTRUSTED_PAGE_CONTENT>
URL: {page.get('url')}
Status: {page.get('status_code')}
Raw Title: {page.get('title')}
</UNTRUSTED_PAGE_CONTENT>
"""
    return {"kind": "rec", "id": case["id"], "system": REC_SYSTEM, "prompt": prompt, "schema": REC_SCHEMA}


class _PromptCaptured(Exception):
    def __init__(self, prompt: str, system: str):
        super().__init__("prompt yakalandı")
        self.prompt, self.system = prompt, system


class _CapturingLLM(LLMProvider):
    async def generate(self, prompt, system_instruction="", temperature=0.2):
        raise _PromptCaptured(prompt, system_instruction)

    async def generate_structured(self, prompt, output_schema, system_instruction="", temperature=0.1):
        raise _PromptCaptured(prompt, system_instruction)


async def action_task(case: dict) -> dict:
    """Prompt ve sistem talimatı üretimdeki ajandan yakalanır; ajan değişince test de onunla değişir."""
    from services.agents.orchestrator import AiOrchestrator
    from services.rag.hybrid_store import HybridKnowledgeStore
    from services.seo_engine.base import IssueSeverity, RuleCategory, RuleCheckResult

    issue = RuleCheckResult(
        passed=False, rule_id=case["rule_id"], category=RuleCategory.CONTENT, severity=IssueSeverity.MEDIUM,
        title=case["title"], description=case["description"], evidence=case["evidence"], recommendation_template="",
    )
    try:
        await AiOrchestrator(_CapturingLLM(), HybridKnowledgeStore())._analyze(issue, case["page"]["url"], case["page"])
    except _PromptCaptured as captured:
        return {"kind": "action", "id": case["id"], "system": captured.system, "prompt": captured.prompt,
                "schema": ACTION_SCHEMA, "case": case}
    raise RuntimeError(f"{case['id']}: ajan modeli çağırmadı")


async def call_anthropic(client, model: str, task: dict, effort: str) -> dict:
    import anthropic

    output_config: dict = {"effort": effort}
    if task["schema"]:
        output_config["format"] = {"type": "json_schema", "schema": task["schema"]}
    try:
        resp = await client.messages.create(
            model=model,
            max_tokens=8000,
            system=task["system"],
            messages=[{"role": "user", "content": task["prompt"]}],
            output_config=output_config,
        )
    except anthropic.APIStatusError as e:
        return {"error": f"HTTP {e.status_code}: {e.message}"}
    except anthropic.APIConnectionError as e:
        return {"error": f"bağlantı hatası: {e}"}
    text = "".join(b.text for b in resp.content if b.type == "text")
    return {
        "text": text,
        "stop_reason": resp.stop_reason,
        "input_tokens": resp.usage.input_tokens,
        "output_tokens": resp.usage.output_tokens,
        "thinking_tokens": None,  # Anthropic düşünme token'larını output_tokens içinde sayar
    }


def _strip_additional_properties(schema):
    if isinstance(schema, dict):
        return {k: _strip_additional_properties(v) for k, v in schema.items() if k != "additionalProperties"}
    if isinstance(schema, list):
        return [_strip_additional_properties(v) for v in schema]
    return schema


async def call_gemini(http, api_key: str, model: str, task: dict, level: str) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    base = {
        "contents": [{"role": "user", "parts": [{"text": task["prompt"]}]}],
        "systemInstruction": {"parts": [{"text": task["system"]}]},
    }
    json_cfg = [{}]
    if task["schema"]:
        json_cfg = [
            {"responseMimeType": "application/json", "responseJsonSchema": task["schema"]},
            {"responseMimeType": "application/json", "responseSchema": _strip_additional_properties(task["schema"])},
        ]
    # API alan adları sürüme göre değişebiliyor; 400 gelirse bir sonraki yapılandırma denenir ve kaydedilir.
    attempts = [(dict(jc, thinkingConfig={"thinkingLevel": level}), f"thinkingLevel={level}") for jc in json_cfg]
    attempts += [(jc, "thinking varsayılan") for jc in json_cfg]
    last_error = ""
    for gen_cfg, note in attempts:
        body = dict(base, generationConfig=gen_cfg) if gen_cfg else base
        for retry in range(3):
            r = await http.post(url, headers={"x-goog-api-key": api_key}, json=body)
            if r.status_code in (429, 500, 503) and retry < 2:
                await asyncio.sleep(2 * (retry + 1))
                continue
            break
        if r.status_code == 400:
            last_error = f"HTTP 400: {r.text[:300]}"
            continue
        if r.status_code != 200:
            return {"error": f"HTTP {r.status_code}: {r.text[:300]}"}
        data = r.json()
        cand = (data.get("candidates") or [{}])[0]
        parts = (cand.get("content") or {}).get("parts") or []
        usage = data.get("usageMetadata") or {}
        return {
            "text": "".join(p.get("text", "") for p in parts if not p.get("thought")),
            "stop_reason": cand.get("finishReason"),
            "input_tokens": usage.get("promptTokenCount", 0),
            "output_tokens": usage.get("candidatesTokenCount", 0) + usage.get("thoughtsTokenCount", 0),
            "thinking_tokens": usage.get("thoughtsTokenCount", 0),
            "config_note": note + ("" if "responseJsonSchema" in gen_cfg or not task["schema"] else ", responseSchema"),
        }
    return {"error": last_error or "bilinmeyen hata"}


def _fake_proposed(case: dict) -> dict:
    # Kuru çalıştırmada sayfa verisinden kaba değerler: bir kısmı kontrolden geçer, bir kısmı (uzunluk) reddedilir.
    page, rule = case["page"], case["rule_id"]
    values = {"proposed_title": None, "proposed_meta_description": None, "proposed_schema_json": None}
    if "TITLE" in rule:
        values["proposed_title"] = page.get("h1")
    elif "META" in rule:
        values["proposed_meta_description"] = page.get("title")
    elif "SCHEMA" in rule and page.get("structured_data"):
        block = dict(page["structured_data"][0])
        block["headline" if block.get("@type") == "Article" else "name"] = page.get("h1")
        values["proposed_schema_json"] = json.dumps(block, ensure_ascii=False)
    return values


def fake_call(model: str, task: dict) -> dict:
    if task["schema"]:
        data = {
            "title": f"Örnek öneri ({model})", "category": "TECHNICAL_SEO",
            "problem_diagnosis": "Kuru çalıştırma.", "proposed_solution": "Kuru çalıştırma.",
            "technical_reason": "Kuru çalıştırma.", "confidence": 0.5, "expected_impact": "Yok.",
            "effort": "LOW", "risk_level": "LOW", "citations": [],
        }
        if task["kind"] == "action":
            data.update(_fake_proposed(task["case"]))
        text = json.dumps(data, ensure_ascii=False)
    else:
        text = f"Kuru çalıştırma yanıtı ({model}). Veride 412 sayfa ve 120 tıklama var; dönüşüm verisi bulunmuyor."
    return {"text": text, "stop_reason": "dry_run", "input_tokens": 1500, "output_tokens": 400, "thinking_tokens": 0}


async def run(args) -> Path:
    load_env()
    models = [m for m in MODELS if not args.models or m in args.models]
    tasks = []
    if args.only in (None, "copilot"):
        tasks += [copilot_task(c) for c in COPILOT_CASES]
    if args.only in (None, "recs"):
        tasks += [rec_task(c) for c in REC_CASES]
    if args.only in (None, "actions"):
        tasks += [await action_task(c) for c in ACTION_CASES]
    if args.limit:
        seen: dict = {}
        limited = []
        for t in tasks:
            seen[t["kind"]] = seen.get(t["kind"], 0) + 1
            if seen[t["kind"]] <= args.limit:
                limited.append(t)
        tasks = limited

    anthropic_client = None
    gemini_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not args.dry_run:
        needs = {MODELS[m]["provider"] for m in models}
        if "anthropic" in needs:
            if not os.environ.get("ANTHROPIC_API_KEY"):
                sys.exit("ANTHROPIC_API_KEY tanımlı değil.")
            import anthropic
            anthropic_client = anthropic.AsyncAnthropic()
        if "gemini" in needs and not gemini_key:
            sys.exit("GOOGLE_API_KEY veya GEMINI_API_KEY tanımlı değil.")

    import httpx

    out_dir = ROOT / "scripts" / "model_eval" / "results" / datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir.mkdir(parents=True, exist_ok=True)
    sem = {"anthropic": asyncio.Semaphore(4), "gemini": asyncio.Semaphore(4)}

    async with httpx.AsyncClient(timeout=120.0) as http:
        async def one(model: str, task: dict) -> dict:
            spec = MODELS[model]
            effort = args.effort_copilot if task["kind"] == "copilot" else args.effort_recs
            async with sem[spec["provider"]]:
                started = time.perf_counter()
                if args.dry_run:
                    res = fake_call(model, task)
                elif spec["provider"] == "anthropic":
                    res = await call_anthropic(anthropic_client, model, task, effort)
                else:
                    res = await call_gemini(http, gemini_key, model, task, effort)
                res["latency_s"] = round(time.perf_counter() - started, 2)
            if "error" not in res:
                res["cost_usd"] = res["input_tokens"] / 1e6 * spec["in"] + res["output_tokens"] / 1e6 * spec["out"]
            res.update({"model": model, "kind": task["kind"], "id": task["id"], "effort": effort})
            print(f"{model:24s} {task['id']}  {'HATA ' + res['error'][:80] if 'error' in res else str(res['latency_s']) + ' sn'}")
            return res

        results = await asyncio.gather(*(one(m, t) for m in models for t in tasks))

    with open(out_dir / "results.jsonl", "w", encoding="utf-8") as f:
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    (out_dir / "run_config.json").write_text(json.dumps({
        "models": {m: MODELS[m] for m in models}, "effort_copilot": args.effort_copilot,
        "effort_recs": args.effort_recs, "dry_run": args.dry_run, "task_count": len(tasks),
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return out_dir


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--dry-run", action="store_true", help="API çağrısı yapmadan akışı doğrula")
    p.add_argument("--models", nargs="*", choices=list(MODELS), help="yalnızca bu modeller")
    p.add_argument("--only", choices=["copilot", "recs", "actions"])
    p.add_argument("--limit", type=int, help="her türden ilk N madde")
    p.add_argument("--effort-copilot", default="low", help="Haiku effort / Gemini thinkingLevel (Copilot)")
    p.add_argument("--effort-recs", default="medium", help="Haiku effort / Gemini thinkingLevel (öneriler ve değer önerileri)")
    args = p.parse_args()
    out_dir = asyncio.run(run(args))

    from report import build_report
    build_report(out_dir)
    print(f"\nSonuçlar: {out_dir}")


if __name__ == "__main__":
    main()
