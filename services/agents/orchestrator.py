import json
from typing import List, Dict, Any, Optional
from services.agents.base import LLMProvider, RecommendationOutput
from services.agents.technical_agent import TechnicalSEOAgent
from services.agents.content_agent import ContentSEOAgent
from services.agents.link_agent import InternalLinkingAgent
from services.agents.schema_agent import StructuredDataAgent
from services.agents.strategy_agent import SEOStrategyAgent
from services.rag.hybrid_store import HybridKnowledgeStore
from services.seo_engine.base import RuleCheckResult

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
        pages_by_url: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Processes deterministic issues through relevant specialist agents, outputting prioritized recommendations."""
        recommendations: List[Dict[str, Any]] = []

        for issue in issues:
            target_url = issue.evidence.get("url") or issue.evidence.get("page_url", "")
            page_data = pages_by_url.get(target_url, {})

            # Smart specialist agent dispatching
            rule_upper = issue.rule_id.upper()
            if "SCHEMA" in rule_upper:
                rec_output = await self.schema_agent.analyze_schema(
                    target_url=target_url,
                    current_schema_json=str(issue.evidence),
                    detected_page_type=page_data.get("page_type", "WebPage")
                )
            elif any(k in rule_upper for k in ["CONTENT", "THIN", "TITLE", "META", "HEADING", "KEYWORD"]):
                rec_output = await self.content_agent.analyze_content(
                    target_url=target_url,
                    page_data=page_data
                )
            elif any(k in rule_upper for k in ["LINK", "ORPHAN", "ANCHOR"]):
                source_url = issue.evidence.get("source_url") or target_url
                target_dest = issue.evidence.get("target_url") or target_url
                topic = issue.evidence.get("target_topic") or issue.title
                snippet = issue.evidence.get("snippet") or page_data.get("body_snippet") or page_data.get("title", "")
                rec_output = await self.link_agent.analyze_link_opportunity(
                    source_url=source_url,
                    target_url=target_dest,
                    target_topic=topic,
                    source_snippet=snippet
                )
            else:
                rec_output = await self.technical_agent.analyze_issue(
                    issue_data={
                        "rule_id": issue.rule_id,
                        "title": issue.title,
                        "description": issue.description,
                        "evidence": issue.evidence
                    },
                    page_data=page_data
                )

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
                "status": "PENDING"
            })

        # Sort recommendations by priority score descending
        recommendations.sort(key=lambda r: r["priority_score"], reverse=True)
        return recommendations

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
