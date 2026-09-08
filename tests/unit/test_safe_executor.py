import pytest
from typing import Dict, Any, List
from services.executor.base import SiteConnector
from services.executor.executor_service import SafeSiteExecutor

class DummyConnector(SiteConnector):
    def __init__(self, initial_hash: str = "hash-v1"):
        self.current_hash = initial_hash
        self.applied_changes: List[Dict[str, Any]] = []
        self.rolled_back_states: List[Dict[str, Any]] = []
        self.should_fail_post_validation = False

    async def verify_connection(self) -> bool:
        return True

    async def get_capabilities(self) -> List[str]:
        return ["CAN_EDIT_TITLE"]

    async def read_page_state(self, url: str) -> Dict[str, Any]:
        return {
            "url": url,
            "current_hash": self.current_hash,
            "is_valid": not self.should_fail_post_validation
        }

    async def apply_change(self, change_item: Dict[str, Any]) -> bool:
        self.applied_changes.append(change_item)
        self.current_hash = "hash-v2"
        return True

    async def rollback_change(self, backup_state: Dict[str, Any]) -> bool:
        self.rolled_back_states.append(backup_state)
        self.current_hash = backup_state.get("current_hash", "")
        return True

@pytest.mark.asyncio
async def test_high_risk_requires_approval():
    connector = DummyConnector()
    executor = SafeSiteExecutor(connector)

    change = {
        "target_url": "https://example.com/page",
        "operation": "SET_CANONICAL",
        "expected_hash_before": "hash-v1",
        "risk_level": "CRITICAL"
    }

    # Attempt execution without approval -> BLOCKED
    res = await executor.execute_change_item(change, require_approval=True, is_approved=False)
    assert res.success is False
    assert res.status == "BLOCKED_APPROVAL_REQUIRED"
    assert len(connector.applied_changes) == 0

@pytest.mark.asyncio
async def test_optimistic_concurrency_aborts_stale_mutation():
    connector = DummyConnector(initial_hash="hash-MODIFIED-EXTERNALLY")
    executor = SafeSiteExecutor(connector)

    change = {
        "target_url": "https://example.com/page",
        "operation": "UPDATE_TITLE",
        "expected_hash_before": "hash-v1",
        "risk_level": "LOW"
    }

    res = await executor.execute_change_item(change, require_approval=False, is_approved=True)
    assert res.success is False
    assert res.status == "STALE_CONCURRENCY_ABORT"
    assert len(connector.applied_changes) == 0

@pytest.mark.asyncio
async def test_successful_execution_lifecycle():
    connector = DummyConnector(initial_hash="hash-v1")
    executor = SafeSiteExecutor(connector)

    change = {
        "target_url": "https://example.com/page",
        "operation": "UPDATE_TITLE",
        "expected_hash_before": "hash-v1",
        "risk_level": "LOW"
    }

    res = await executor.execute_change_item(change, require_approval=False, is_approved=True)
    assert res.success is True
    assert res.status == "SUCCESS"
    assert len(connector.applied_changes) == 1
    assert connector.current_hash == "hash-v2"

@pytest.mark.asyncio
async def test_post_validation_failure_triggers_atomic_rollback():
    connector = DummyConnector(initial_hash="hash-v1")
    connector.should_fail_post_validation = True  # Simulating 500 error or regression
    executor = SafeSiteExecutor(connector)

    change = {
        "target_url": "https://example.com/page",
        "operation": "UPDATE_TITLE",
        "expected_hash_before": "hash-v1",
        "risk_level": "LOW"
    }

    res = await executor.execute_change_item(change, require_approval=False, is_approved=True)
    assert res.success is False
    assert res.status == "ROLLED_BACK_ON_VALIDATION_FAILURE"
    assert res.rolled_back is True
    # Verify rollback was called and state restored to hash-v1
    assert len(connector.rolled_back_states) == 1
    assert connector.current_hash == "hash-v1"
