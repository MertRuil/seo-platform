import pytest
from services.executor.connectors.wordpress import WordPressConnector
from services.executor.connectors.git import GitBasedConnector
from services.executor.connectors.webhook import GenericWebhookConnector
from services.executor.executor_service import SafeSiteExecutor

@pytest.mark.asyncio
async def test_wordpress_connector():
    wp = WordPressConnector("mock://myblog.com", "admin", "app-pass-123")
    assert await wp.verify_connection() is True
    caps = await wp.get_capabilities()
    assert "CAN_EDIT_TITLE" in caps
    assert "CAN_EDIT_META" in caps

    state = await wp.read_page_state("https://myblog.com/post-1")
    assert "current_hash" in state

    applied = await wp.apply_change({
        "post_id": 10,
        "state_after": {"title": "New Optimized Title"}
    })
    assert applied is True

@pytest.mark.asyncio
async def test_git_connector():
    git = GitBasedConnector("mock/repo", "token123")
    assert await git.verify_connection() is True
    caps = await git.get_capabilities()
    assert "CAN_EDIT_SCHEMA" in caps
    assert "CAN_EDIT_ROBOTS" in caps

    applied = await git.apply_change({"file": "src/pages/index.astro", "diff": "+ canonical"})
    assert applied is True

@pytest.mark.asyncio
async def test_safe_executor_with_wordpress():
    wp = WordPressConnector("mock://myblog.com", "admin", "pass")
    executor = SafeSiteExecutor(wp)

    change_item = {
        "target_url": "https://myblog.com/post-1",
        "expected_hash_before": "wp-mock-hash",
        "risk_level": "LOW",
        "operation": "UPDATE_TITLE",
        "state_after": {"title": "Updated Title"}
    }

    res = await executor.execute_change_item(change_item, require_approval=False)
    assert res.success is True
    assert res.status == "SUCCESS"
