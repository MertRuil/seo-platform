from typing import List, Dict, Any, Optional

class ExperimentMetricComparison:
    def __init__(
        self,
        experiment_id: str,
        variant_clicks_before: int,
        variant_clicks_after: int,
        control_clicks_before: int,
        control_clicks_after: int
    ):
        self.experiment_id = experiment_id
        self.variant_clicks_before = variant_clicks_before
        self.variant_clicks_after = variant_clicks_after
        self.control_clicks_before = control_clicks_before
        self.control_clicks_after = control_clicks_after

        # Calculate Growth rates
        self.variant_growth = (
            (variant_clicks_after - variant_clicks_before) / variant_clicks_before
            if variant_clicks_before > 0 else 0.0
        )
        self.control_growth = (
            (control_clicks_after - control_clicks_before) / control_clicks_before
            if control_clicks_before > 0 else 0.0
        )

        # Difference-in-Differences (Diff-in-Diff) Net Effect:
        # Net impact = (Variant_After - Variant_Before) - (Control_After - Control_Before)
        self.diff_in_diff_net_clicks = (
            (variant_clicks_after - variant_clicks_before) -
            (control_clicks_after - control_clicks_before)
        )
        self.net_relative_lift = self.variant_growth - self.control_growth

class ExperimentEngine:
    """
    Measures empirical SEO outcomes and isolates causality by comparing
    variant pages against control cohorts over 28, 56, and 90-day windows.
    """
    @staticmethod
    def calculate_diff_in_diff(
        experiment_id: str,
        variant_before: int,
        variant_after: int,
        control_before: int,
        control_after: int
    ) -> ExperimentMetricComparison:
        return ExperimentMetricComparison(
            experiment_id=experiment_id,
            variant_clicks_before=variant_before,
            variant_clicks_after=variant_after,
            control_clicks_before=control_before,
            control_clicks_after=control_after
        )
