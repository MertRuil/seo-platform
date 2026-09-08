import os
import shutil
import pytest
from services.rag.hybrid_store import HybridKnowledgeStore
from services.rag.curator_agent import KnowledgeCuratorAgent, AutonomousRAGCurator

TEST_DATA_DIR = "tests/scratch_curator_data"

@pytest.fixture(autouse=True)
def cleanup_scratch_dir():
    if os.path.exists(TEST_DATA_DIR):
        shutil.rmtree(TEST_DATA_DIR, ignore_errors=True)
    os.makedirs(TEST_DATA_DIR, exist_ok=True)
    yield
    if os.path.exists(TEST_DATA_DIR):
        shutil.rmtree(TEST_DATA_DIR, ignore_errors=True)

@pytest.mark.anyio
async def test_curator_agent_ingestion_and_rejection():
    store = HybridKnowledgeStore()
    audit_file = os.path.join(TEST_DATA_DIR, "audit_log.json")
    agent = KnowledgeCuratorAgent(
        knowledge_store=store,
        audit_log_path=audit_file
    )

    # 1. Official valid document
    valid_doc = {
        "id": "doc-test-canonical",
        "title": "Google Search Central: Canonical URLs",
        "canonical_url": "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
        "content": "# Canonicalization\nSpecify canonical links to consolidate ranking signals on duplicate pages."
    }
    res_valid = await agent.curate_document(valid_doc)
    assert res_valid["verification_status"] == "VERIFIED"
    assert res_valid["chunks_ingested"] >= 1
    assert store.get_stats()["verified_chunks"] >= 1

    # 2. Myth document (must be rejected, 0 chunks ingested)
    myth_doc = {
        "id": "doc-test-myth",
        "title": "Spam Secrets",
        "canonical_url": "https://developers.google.com/search/docs/fake",
        "content": "You must use meta keywords to rank in Google search."
    }
    res_myth = await agent.curate_document(myth_doc)
    assert res_myth["verification_status"] == "REJECTED"
    assert res_myth["chunks_ingested"] == 0

    # Ensure search does not return rejected content
    search_res = store.search_hybrid("meta keywords to rank")
    assert len(search_res) == 0

@pytest.mark.anyio
async def test_autonomous_rag_curator_3_day_simulation():
    store_file = os.path.join(TEST_DATA_DIR, "store.json")
    state_file = os.path.join(TEST_DATA_DIR, "state.json")

    curator = AutonomousRAGCurator(
        state_file=state_file,
        store_file=store_file
    )

    result = await curator.simulate_multi_day_run(days=3)
    assert result["status"] == "COMPLETED"
    assert result["days_run"] == 3
    assert len(result["daily_summaries"]) == 3
    assert result["total_verified"] > 0
    assert result["total_rejected"] > 0

    # Verify disk persistence
    assert os.path.exists(store_file)
    assert os.path.exists(state_file)

    # Re-instantiate from disk and verify state recovery
    reloaded_store = HybridKnowledgeStore()
    reloaded_store.load_from_disk(store_file)
    stats = reloaded_store.get_stats()
    assert stats["verified_chunks"] > 0
