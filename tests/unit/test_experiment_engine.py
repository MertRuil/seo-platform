import json
import pytest
from services.experiments.experiment_engine import ExperimentEngine
from services.experiments.learning_dataset import LearningRecord, LearningDatasetService

def test_experiment_diff_in_diff_calculation():
    # Scenario:
    # Site-wide seasonal drop of 100 clicks in control: 1000 -> 900 (-10%)
    # Variant page held steady due to SEO fix: 1000 -> 1000 (0%)
    # True net impact of the fix should be POSITIVE (+100 clicks net lift)
    result = ExperimentEngine.calculate_diff_in_diff(
        experiment_id="exp-1",
        variant_before=1000,
        variant_after=1000,
        control_before=1000,
        control_after=900
    )
    assert result.diff_in_diff_net_clicks == 100
    assert result.net_relative_lift == pytest.approx(0.10, abs=0.01)

def test_learning_dataset_logging_and_export():
    service = LearningDatasetService()
    record = LearningRecord(
        site_type="ECOMMERCE",
        issue_category="CANONICALIZATION",
        recommendation_action="SET_CANONICAL_SELF",
        risk_level="CRITICAL",
        user_feedback="USEFUL",
        position_before=12.4,
        position_after=5.2,
        clicks_lift_pct=45.0
    )
    service.record_outcome(record)
    assert len(service.records) == 1

    jsonl_output = service.export_dataset_jsonl()
    assert "ECOMMERCE" in jsonl_output
    assert "SET_CANONICAL_SELF" in jsonl_output
    parsed = json.loads(jsonl_output)
    assert parsed["clicks_lift_pct"] == 45.0
