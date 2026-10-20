import json
import logging
from typing import List, Dict, Any, Optional
from services.agents.base import LLMProvider, RecommendationOutput
from services.agents.technical_agent import TechnicalSEOAgent
from services.agents.content_agent import ContentSEOAgent
from services.agents.link_agent import InternalLinkingAgent
from services.agents.schema_agent import StructuredDataAgent
from services.agents.strategy_agent import SEOStrategyAgent
from services.agents.proposed_change import build_proposed_change
from services.rag.hybrid_store import HybridKnowledgeStore
from services.seo_engine.base import RuleCheckResult

logger = logging.getLogger(__name__)

# Her sorun bir model çağrısı demek. Aynı kural yüzlerce sayfada tekrarlandığında
# listeyi tek kural doldurmasın diye kural başına da sınır var.
MAX_ISSUES_PER_RUN = 40
MAX_ISSUES_PER_RULE = 3
MAX_CONSECUTIVE_FAILURES = 3
SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}


def issue_key(rule_id: str, evidence: Dict[str, Any]) -> tuple:
    return rule_id, evidence.get("url") or evidence.get("page_url", "")


def select_issues_for_ai(
    issues: List[RuleCheckResult],
    max_issues: int = MAX_ISSUES_PER_RUN,
    max_per_rule: int = MAX_ISSUES_PER_RULE,
) -> List[RuleCheckResult]:
    per_rule: Dict[str, int] = {}
    selected: List[RuleCheckResult] = []
    for issue in sorted(issues, key=lambda i: SEVERITY_ORDER.get(i.severity.value, len(SEVERITY_ORDER))):
        if len(selected) >= max_issues:
            break
        if per_rule.get(issue.rule_id, 0) >= max_per_rule:
            continue
        per_rule[issue.rule_id] = per_rule.get(issue.rule_id, 0) + 1
        selected.append(issue)
    return selected


class PriorityEngine:
    RISK_MODIFIERS = {
        "CRITICAL": 0.5,  # High risk requires careful review, dampen auto priority
        "HIGH": 0.8,
        "MEDIUM": 1.0,
        "LOW": 1.1,
        "INFO": 1.0
    }

    EFFORT_VALUES = {
        "LOW": 1.0,
        "MEDIUM": 2.0,
        "HIGH": 3.5
    }

    @staticmethod
    def calculate_priority_score(
        impact: float,        # 1.0 - 5.0
        confidence: float,    # 0.0 - 1.0
        reach: float,         # 1.0 - 5.0 (URL count or impression volume)
        business_value: float = 1.0,  # 1.0 default, 2.5 for money pages
        effort: str = "LOW",
        risk_level: str = "LOW"
    ) -> float:
        risk_mod = PriorityEngine.RISK_MODIFIERS.get(risk_level, 1.0)
        effort_val = PriorityEngine.EFFORT_VALUES.get(effort, 1.0)

        raw = (impact * confidence * reach * business_value * risk_mod * 15.0) / effort_val
        return round(min(100.0, max(0.0, raw)), 2)

class AiOrchestrator:
    def __init__(self, llm_provider: LLMProvider, knowledge_store: HybridKnowledgeStore):
        self.llm = llm_provider
        self.rag = knowledge_store
        self.technical_agent = TechnicalSEOAgent(llm_provider, knowledge_store)
        self.content_agent = ContentSEOAgent(llm_provider, knowledge_store)
        self.link_agent = InternalLinkingAgent(llm_provider, knowledge_store)
        self.schema_agent = StructuredDataAgent(llm_provider, knowledge_store)
        self.strategy_agent = SEOStrategyAgent(llm_provider, knowledge_store)

    async def process_crawl_issues(
        self,
        site_id: str,
        issues: List[RuleCheckResult],
        pages_by_url: Dict[str, Any],
        max_issues: int = MAX_ISSUES_PER_RUN
    ) -> List[Dict[str, Any]]:
        """Processes deterministic issues through relevant specialist agents, outputting prioritized recommendations."""
        recommendations: List[Dict[str, Any]] = []
        selected = select_issues_for_ai(issues, max_issues=max_issues)
        if len(selected) < len(issues):
            logger.info("AI önerisi için %d/%d sorun seçildi (site %s)", len(selected), len(issues), site_id)

        consecutive_failures = 0
        for issue in selected:
            _, target_url = issue_key(issue.rule_id, issue.evidence)
            page_data = pages_by_url.get(target_url, {})

            try:
                rec_output = await self._analyze(issue, target_url, page_data)
            except Exception as e:
                # Tek sorunun hatası diğer önerileri düşürmesin; art arda hata model/anahtar sorunudur, boşuna çağrı yapma.
                consecutive_failures += 1
                logger.warning("AI önerisi üretilemedi (%s, %s): %s", issue.rule_id, target_url, e)
                if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                    logger.error("Art arda %d model hatası, öneri üretimi durduruldu (site %s)", consecutive_failures, site_id)
                    break
                continue
            consecutive_failures = 0

            # Impact scale based on severity
            impact_map = {"CRITICAL": 5.0, "HIGH": 4.0, "MEDIUM": 2.5, "LOW": 1.5, "INFO": 1.0}
            impact = impact_map.get(issue.severity.value, 2.0)

            score = PriorityEngine.calculate_priority_score(
                impact=impact,
                confidence=rec_output.confidence,
                reach=2.0,
                business_value=1.0,
                effort=rec_output.effort,
                risk_level=rec_output.risk_level
            )

            citations_json = json.dumps([c.model_dump() for c in rec_output.citations])
            proposed, rejected = build_proposed_change(issue.rule_id, rec_output, page_data, target_url)
            if rejected:
                logger.info("Önerilen değer reddedildi (%s, %s): %s", issue.rule_id, target_url, "; ".join(rejected))

            recommendations.append({
                "site_id": site_id,
                "issue_id": issue.rule_id,
                "category": rec_output.category,
                "title": rec_output.title,
                "description": rec_output.problem_diagnosis,
                "reason": rec_output.technical_reason,
                "expected_impact": rec_output.expected_impact,
                "confidence": rec_output.confidence,
                "priority_score": score,
                "risk_level": rec_output.risk_level,
                "effort": rec_output.effort,
                "evidence_json": json.dumps(issue.evidence),
                "rag_sources_json": citations_json,
                "proposed_change_json": json.dumps(proposed, ensure_ascii=False) if proposed else None,
                "status": "PENDING"
            })

        # Sort recommendations by priority score descending
        recommendations.sort(key=lambda r: r["priority_score"], reverse=True)
        return recommendations

    async def _analyze(self, issue: RuleCheckResult, target_url: str, page_data: Dict[str, Any]) -> RecommendationOutput:
        rule_upper = issue.rule_id.upper()
        if "SCHEMA" in rule_upper:
            return await self.schema_agent.analyze_schema(
                target_url=target_url,
                current_schema_json=str(issue.evidence),
                detected_page_type=page_data.get("page_type", "WebPage"),
                page_data=page_data
            )
        if any(k in rule_upper for k in ["CONTENT", "THIN", "TITLE", "META", "HEADING", "KEYWORD"]):
            return await self.content_agent.analyze_content(
                target_url=target_url,
                page_data=page_data,
                issue={"rule_id": issue.rule_id, "title": issue.title, "description": issue.description}
            )
        if any(k in rule_upper for k in ["LINK", "ORPHAN", "ANCHOR"]):
            source_url = issue.evidence.get("source_url") or target_url
            target_dest = issue.evidence.get("target_url") or target_url
            topic = issue.evidence.get("target_topic") or issue.title
            snippet = issue.evidence.get("snippet") or page_data.get("body_snippet") or page_data.get("title", "")
            return await self.link_agent.analyze_link_opportunity(
                source_url=source_url,
                target_url=target_dest,
                target_topic=topic,
                source_snippet=snippet
            )
        return await self.technical_agent.analyze_issue(
            issue_data={
                "rule_id": issue.rule_id,
                "title": issue.title,
                "description": issue.description,
                "evidence": issue.evidence
            },
            page_data=page_data
        )

    async def generate_strategic_roadmap(
        self,
        site_id: str,
        domain: str,
        health_score: int,
        critical_issues_count: int,
        opportunities_count: int
    ) -> Dict[str, Any]:
        rec = await self.strategy_agent.generate_roadmap(
            domain=domain,
            health_score=health_score,
            critical_issues_count=critical_issues_count,
            opportunities_count=opportunities_count
        )
        return {
            "site_id": site_id,
            "category": rec.category,
            "title": rec.title,
            "diagnosis": rec.problem_diagnosis,
            "roadmap": rec.proposed_solution,
            "priority_score": 85.0,
            "risk_level": rec.risk_level,
            "citations": [c.model_dump() for c in rec.citations]
        }
