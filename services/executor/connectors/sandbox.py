import hashlib
import json
from typing import Dict, Any, List, Optional
from services.executor.base import SiteConnector

class SandboxSimulationConnector(SiteConnector):
    """
    In-memory simulation connector for sandbox testing and zero-touch demonstration.
    Allows executing full optimistic concurrency checks, pre-write backups,
    state mutations, and rollbacks without requiring live production CMS credentials.
    """
    def __init__(self, site_domain: str = "example.com"):
        self.site_domain = site_domain
        self.simulated_pages: Dict[str, Dict[str, Any]] = {}
        self.applied_mutations: List[Dict[str, Any]] = []
        self.rolled_back_mutations: List[Dict[str, Any]] = []

    async def verify_connection(self) -> bool:
        """Sandbox simulation is always verified and operational."""
        return True

    async def get_capabilities(self) -> List[str]:
        return [
            "CAN_EDIT_TITLE",
            "CAN_EDIT_META",
            "CAN_EDIT_CANONICAL",
            "CAN_EDIT_SCHEMA",
            "CAN_EDIT_REDIRECT",
            "CAN_EDIT_CONTENT",
        ]

    async def read_page_state(self, url: str) -> Dict[str, Any]:
        """Reads current simulated state or initializes baseline hash."""
        if url in self.simulated_pages:
            return self.simulated_pages[url]

        # Generate deterministic baseline state for this URL
        url_hash = hashlib.sha256(f"baseline:{url}".encode()).hexdigest()[:16]
        state = {
            "url": url,
            "current_hash": url_hash,
            "canonical_seo_hash": url_hash,
            "is_valid": True,
            "title": f"{self.site_domain} - Page",
            "meta_description": "Default meta description",
            "canonical": url,
        }
        self.simulated_pages[url] = state
        return state

    async def apply_change(self, change_item: Dict[str, Any]) -> bool:
        """Applies mutation to the simulated page and computes next state hash."""
        target_url = change_item.get("target_url", "")
        operation = change_item.get("operation", "UPDATE_META")
        state_after = change_item.get("state_after", "")

        # Compute new state hash
        after_hash = hashlib.sha256(f"{target_url}:{operation}:{state_after}".encode()).hexdigest()[:16]

        current = await self.read_page_state(target_url)
        updated_state = dict(current)
        updated_state["current_hash"] = after_hash
        updated_state["canonical_seo_hash"] = after_hash
        updated_state["is_valid"] = True
        updated_state["last_operation"] = operation

        self.simulated_pages[target_url] = updated_state
        self.applied_mutations.append({
            "target_url": target_url,
            "operation": operation,
            "after_hash": after_hash,
            "change_item": change_item
        })
        return True

    async def rollback_change(self, backup_state: Dict[str, Any]) -> bool:
        """Restores the pre-change backup state in the simulation."""
        target_url = backup_state.get("url", "")
        if target_url:
            self.simulated_pages[target_url] = dict(backup_state)
            self.rolled_back_mutations.append(backup_state)
            return True
        return False
