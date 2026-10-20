"""Ajanların önerdiği yeni başlık, meta açıklaması ve JSON-LD için deterministik kontroller.

Öneri kaydedilirken ve otomatik pilot siteye yazmadan hemen önce aynı kontroller çalışır.
Model sayfada olmayan bir bilgiyi (fiyat, puan, yazar, yıl) uyduramaz: başlık ve meta
yalnızca sayfada geçen sayıları içerebilir, JSON-LD'deki her değer mevcut blokta ya da
sayfanın başlık/H1/meta metninde geçmelidir.
"""
from __future__ import annotations

import json
import re
import unicodedata
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple
from urllib.parse import urlparse

TITLE_MIN, TITLE_MAX = 10, 60
META_MIN, META_MAX = 70, 160
SCHEMA_MAX_BYTES = 8000

TITLE_RULES = {"RULE_TITLE_MISSING", "RULE_TITLE_EMPTY", "RULE_DUPLICATE_TITLE"}
META_RULES = {"RULE_META_DESC_MISSING", "RULE_DUPLICATE_META_DESCRIPTION"}
# Sözdizimi hatasında bozuk metin kanıtta yok; dayanaklı bir düzeltme üretilemez.
SCHEMA_RULES = {"RULE_SCHEMA_MISSING_REQUIRED"}


def _norm(text: str) -> str:
    # casefold("İ") "i̇" (birleşik noktalı) döner; Türkçe i/ı/İ eşit sayılır ki yinelenen başlık kaçmasın.
    text = unicodedata.normalize("NFKC", " ".join(str(text).split()))
    return text.replace("İ", "i").replace("ı", "i").casefold()


def _numbers(text: str) -> Set[str]:
    return set(re.findall(r"\d+(?:[.,]\d+)?", text))


def _host(url: str) -> str:
    return (urlparse(url).hostname or "").lower().removeprefix("www.")


def _page_text(page: Dict[str, Any]) -> str:
    return " ".join(str(page.get(k) or "") for k in ("url", "title", "h1", "meta_description"))


def validate_text(
    value: Any,
    page: Dict[str, Any],
    current_key: str,
    min_len: int,
    max_len: int,
    taken: Iterable[str] = (),
) -> Tuple[Optional[str], str]:
    if not isinstance(value, str) or not value.strip():
        return None, "boş"
    if "\n" in value.strip() or "\r" in value:
        return None, "çok satırlı"
    clean = " ".join(value.split())
    if not min_len <= len(clean) <= max_len:
        return None, f"uzunluk {len(clean)}, beklenen {min_len}-{max_len}"
    if "<" in clean or ">" in clean:
        return None, "HTML içeriyor"
    if page.get(current_key) and _norm(clean) == _norm(page[current_key]):
        return None, "mevcut değerle aynı"
    if _norm(clean) in {_norm(t) for t in taken if t}:
        return None, "sitede başka bir sayfada kullanılıyor"
    invented = _numbers(clean) - _numbers(_page_text(page))
    if invented:
        return None, f"sayfada olmayan sayı: {', '.join(sorted(invented))}"
    return clean, ""


def validate_title(value: Any, page: Dict[str, Any], taken: Iterable[str] = ()) -> Tuple[Optional[str], str]:
    return validate_text(value, page, "title", TITLE_MIN, TITLE_MAX, taken)


def validate_meta_description(value: Any, page: Dict[str, Any], taken: Iterable[str] = ()) -> Tuple[Optional[str], str]:
    return validate_text(value, page, "meta_description", META_MIN, META_MAX, taken)


def _types(node: Any) -> Set[str]:
    found: Set[str] = set()
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "@type":
                found.update(str(t).split("/")[-1] for t in (value if isinstance(value, list) else [value]))
            else:
                found |= _types(value)
    elif isinstance(node, list):
        for item in node:
            found |= _types(item)
    return found


def _leaves(node: Any, key: Optional[str] = None) -> Iterable[Tuple[Optional[str], Any]]:
    if isinstance(node, dict):
        for k, v in node.items():
            yield from _leaves(v, k)
    elif isinstance(node, list):
        for v in node:
            yield from _leaves(v, key)
    else:
        yield key, node


def find_original_schema(page: Dict[str, Any], schema: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    wanted = _types(schema)
    for block in page.get("structured_data") or []:
        if isinstance(block, dict) and _types(block) & wanted:
            return block
    return None


def validate_schema(value: Any, page: Dict[str, Any], target_url: str) -> Tuple[Optional[Dict[str, Any]], str]:
    from services.seo_engine.rules.rules_impl import SchemaMissingRequiredFieldsRule

    if not isinstance(value, dict) or not value:
        return None, "boş"
    if len(json.dumps(value, ensure_ascii=False).encode()) > SCHEMA_MAX_BYTES:
        return None, "çok büyük"
    if "schema.org" not in str(value.get("@context", "")):
        return None, "@context schema.org değil"

    original = find_original_schema(page, value)
    if original is None:
        return None, "sayfada aynı türde mevcut blok yok"
    new_types = _types(value) - _types(original)
    if new_types:
        return None, f"mevcut blokta olmayan tür: {', '.join(sorted(new_types))}"
    if value == original:
        return None, "mevcut blokla aynı"

    original_values = {_norm(v) for k, v in _leaves(original) if isinstance(v, (str, int, float)) and not isinstance(v, bool)}
    facts = [_norm(page.get(k) or "") for k in ("title", "h1", "meta_description")]
    page_host = _host(target_url)
    for key, leaf in _leaves(value):
        if key in ("@context", "@type") or leaf is None or isinstance(leaf, bool):
            continue
        text = _norm(leaf)
        if text in original_values:
            continue
        if isinstance(leaf, str) and leaf.startswith(("http://", "https://")):
            if _host(leaf) == page_host:
                continue
            return None, f"başka alan adına bağlantı: {leaf}"
        if isinstance(leaf, str) and len(text) >= 2 and any(text in fact for fact in facts if fact):
            continue
        return None, f"sayfada geçmeyen değer ({key}): {leaf}"

    if SchemaMissingRequiredFieldsRule().check({"status_code": 200, "structured_data": [value]}) is not None:
        return None, "zorunlu alan hâlâ eksik"
    return value, ""


def build_proposed_change(rule_id: str, output: Any, page: Dict[str, Any], target_url: str) -> Tuple[Dict[str, Any], List[str]]:
    """Kurala uyan ve kontrollerden geçen alanları döner; reddedilenleri gerekçesiyle listeler."""
    proposed: Dict[str, Any] = {}
    rejected: List[str] = []
    candidates = []
    if rule_id in TITLE_RULES:
        candidates.append(("title", output.proposed_title, lambda v: validate_title(v, page)))
    if rule_id in META_RULES:
        candidates.append(("meta_description", output.proposed_meta_description, lambda v: validate_meta_description(v, page)))
    if rule_id in SCHEMA_RULES:
        candidates.append(("schema_json", output.proposed_schema_json, lambda v: validate_schema(v, page, target_url)))
    for field, raw, check in candidates:
        if raw is None:
            continue
        value, reason = check(raw)
        if value is None:
            rejected.append(f"{field}: {reason}")
        else:
            proposed[field] = value
    return proposed, rejected


def plan_auto_change(
    rule_id: str,
    category: str,
    proposed: Dict[str, Any],
    page: Dict[str, Any],
    target_url: str,
    capabilities: Set[str],
    taken_titles: Iterable[str] = (),
    taken_metas: Iterable[str] = (),
) -> Optional[Tuple[str, Dict[str, Any], Dict[str, Any]]]:
    """Otomatik pilotun uygulayacağı (operation, state_before, state_after) üçlüsü; uygulanamıyorsa None."""
    rule_upper = (rule_id or "").upper()
    if ("CANONICAL" in rule_upper or category == "CANONICALIZATION") and "CAN_EDIT_CANONICAL" in capabilities:
        return (
            "UPDATE_CANONICAL",
            {"canonical": page.get("canonical_target") or ""},
            {"canonical": target_url},
        )

    if rule_id in TITLE_RULES | META_RULES:
        state_after: Dict[str, Any] = {}
        if rule_id in TITLE_RULES and "CAN_EDIT_TITLE" in capabilities:
            title, _ = validate_title(proposed.get("title"), page, taken_titles)
            if title:
                state_after["title"] = title
        if rule_id in META_RULES and "CAN_EDIT_META" in capabilities:
            meta, _ = validate_meta_description(proposed.get("meta_description"), page, taken_metas)
            if meta:
                state_after["meta_description"] = meta
        if not state_after:
            return None
        state_before = {k: page.get(k) or "" for k in state_after}
        return "UPDATE_META", state_before, state_after

    if rule_id in SCHEMA_RULES and "CAN_REPLACE_SCHEMA" in capabilities:
        schema, _ = validate_schema(proposed.get("schema_json"), page, target_url)
        if not schema:
            return None
        original = find_original_schema(page, schema)
        return "REPLACE_SCHEMA_JSONLD", {"schema_json": original}, {"schema_json": schema, "replaces": original}

    return None
