import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

class LearningRecord:
    def __init__(
        self,
        site_type: str,
        issue_category: str,
        recommendation_action: str,
        risk_level: str,
        user_feedback: str,
        position_before: float,
        position_after: float,
        clicks_lift_pct: float
    ):
        self.site_type = site_type
        self.issue_category = issue_category
        self.recommendation_action = recommendation_action
        self.risk_level = risk_level
        self.user_feedback = user_feedback  # 'USEFUL', 'INCORRECT', 'TOO_RISKY', 'ALREADY_FIXED'
        self.position_before = position_before
        self.position_after = position_after
        self.clicks_lift_pct = clicks_lift_pct
        self.recorded_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "site_type": self.site_type,
            "issue_category": self.issue_category,
            "recommendation_action": self.recommendation_action,
            "risk_level": self.risk_level,
            "user_feedback": self.user_feedback,
            "position_before": self.position_before,
            "position_after": self.position_after,
            "clicks_lift_pct": self.clicks_lift_pct,
            "recorded_at": self.recorded_at
        }

class LearningDatasetService:
    def __init__(self):
        self.records: List[LearningRecord] = []

    def record_outcome(self, record: LearningRecord):
        self.records.append(record)

    def export_dataset_jsonl(self) -> str:
        """Exports dataset as JSONL formatted for evaluation and task behavior fine-tuning."""
        return "\n".join(json.dumps(r.to_dict()) for r in self.records)
