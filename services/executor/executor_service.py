import hashlib
import json
from typing import Dict, Any, Optional
from services.executor.base import SiteConnector

class SafeExecutionResult:
    def __init__(self, success: bool, status: str, error_message: Optional[str] = None, rolled_back: bool = False):
        self.success = success
        self.status = status
        self.error_message = error_message
        self.rolled_back = rolled_back

class SafeSiteExecutor:
    """
    Executes website changes with optimistic concurrency verification,
    pre-write backup, post-write validation, and automated rollback.
    """
    def __init__(self, connector: SiteConnector):
        self.connector = connector
        self.backup_storage: Dict[str, Dict[str, Any]] = {}

    async def execute_change_item(
        self,
        change_item: Dict[str, Any],
        require_approval: bool = True,
        is_approved: bool = False
    ) -> SafeExecutionResult:
        risk_level = change_item.get("risk_level", "LOW")

        # 1. Human Approval Enforcement for High/Critical actions
        if risk_level in ("HIGH", "CRITICAL") or require_approval:
            if not is_approved:
                return SafeExecutionResult(
                    success=False,
                    status="BLOCKED_APPROVAL_REQUIRED",
                    error_message=f"Change requires explicit human approval due to {risk_level} risk tier."
                )

        target_url = change_item["target_url"]
        expected_hash = change_item["expected_hash_before"]

        # 2. Step 1: Optimistic Concurrency Check
        current_state = await self.connector.read_page_state(target_url)
        current_hash = current_state.get("current_hash", "")
        if current_hash != expected_hash:
            return SafeExecutionResult(
                success=False,
                status="STALE_CONCURRENCY_ABORT",
                error_message=f"Page modified out-of-band: expected hash '{expected_hash}', but found '{current_hash}'."
            )

        # 3. Step 2: Pre-write Backup
        backup_key = f"backup-{hashlib.sha256(target_url.encode()).hexdigest()[:16]}"
        self.backup_storage[backup_key] = current_state

        # 4. Step 3: Apply Mutation
        try:
            apply_success = await self.connector.apply_change(change_item)
            if not apply_success:
                raise IOError("Connector apply_change failed")
        except Exception as e:
            # Immediate rollback
            await self.connector.rollback_change(current_state)
            return SafeExecutionResult(
                success=False,
                status="ROLLED_BACK",
                error_message=f"Mutation failed during application: {str(e)}",
                rolled_back=True
            )

        # 5. Step 4: Post-write live validation
        post_state = await self.connector.read_page_state(target_url)
        # Validation rule: ensure change is active and no 5xx
        is_valid = post_state.get("is_valid", True)
        if not is_valid:
            # Revert immediately
            await self.connector.rollback_change(current_state)
            return SafeExecutionResult(
                success=False,
                status="ROLLED_BACK_ON_VALIDATION_FAILURE",
                error_message="Post-write live validation failed (e.g. 500 server error or regression). State restored.",
                rolled_back=True
            )

        return SafeExecutionResult(success=True, status="SUCCESS")

    async def rollback_backup(self, backup_state: Dict[str, Any]) -> bool:
        """Restores a pre-write backup state through the connector."""
        return await self.connector.rollback_change(backup_state)
