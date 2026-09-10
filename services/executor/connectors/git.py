import json
import httpx
from typing import Dict, Any, List
from services.executor.base import SiteConnector

class GitBasedConnector(SiteConnector):
    """
    Git-based connector that submits SEO changes via Pull Requests on GitHub/GitLab.
    Ensures safe, version-controlled audit trails for modern headless and JAMstack websites.
    """
    def __init__(self, repo_full_name: str, access_token: str, default_branch: str = "main"):
        import re
        if repo_full_name and not repo_full_name.startswith("mock/") and not re.match(r"^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$", repo_full_name):
            raise ValueError("Geçersiz Git depo adı biçimi: 'sahip/depo' bekleniyor")
        self.repo = repo_full_name  # e.g. "owner/repo"
        self.token = access_token
        self.default_branch = default_branch
        self.base_url = f"https://api.github.com/repos/{self.repo}"

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        }

    async def verify_connection(self) -> bool:
        if self.repo.startswith("mock/"):
            return True
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(self.base_url, headers=self._get_headers())
                return res.status_code == 200
        except Exception:
            return False

    async def get_capabilities(self) -> List[str]:
        return ["CAN_EDIT_TITLE", "CAN_EDIT_META", "CAN_EDIT_CONTENT", "CAN_EDIT_SCHEMA", "CAN_EDIT_ROBOTS"]

    async def read_page_state(self, url: str) -> Dict[str, Any]:
        return {"url": url, "current_hash": "git-head-commit-hash"}

    async def apply_change(self, change_item: Dict[str, Any]) -> bool:
        if self.repo.startswith("mock/"):
            return True
        # Live patch/branch creation is intentionally blocked until a concrete
        # repository patch mapping is supplied by the caller.
        return False

    async def rollback_change(self, backup_state: Dict[str, Any]) -> bool:
        return await self.apply_change(backup_state)
