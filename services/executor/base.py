from abc import ABC, abstractmethod
from typing import Dict, Any, List

class SiteConnector(ABC):
    @abstractmethod
    async def verify_connection(self) -> bool:
        """Verifies API credentials, reachable endpoint, and permissions."""
        pass

    @abstractmethod
    async def get_capabilities(self) -> List[str]:
        """Returns supported features: e.g. CAN_EDIT_TITLE, CAN_EDIT_META, CAN_EDIT_SCHEMA."""
        pass

    @abstractmethod
    async def read_page_state(self, url: str) -> Dict[str, Any]:
        """Reads current live state for concurrency check."""
        pass

    @abstractmethod
    async def apply_change(self, change_item: Dict[str, Any]) -> bool:
        """Applies mutation to target CMS or repository."""
        pass

    @abstractmethod
    async def rollback_change(self, backup_state: Dict[str, Any]) -> bool:
        """Restores the pre-change backup state."""
        pass
