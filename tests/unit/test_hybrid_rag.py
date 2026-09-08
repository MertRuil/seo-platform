import pytest
from services.rag.chunker import SemanticChunker
from services.rag.hybrid_store import HybridKnowledgeStore
from services.rag.seeds import SEED_DOCUMENTS

def test_semantic_chunker_hierarchical_paths():
    doc = SEED_DOCUMENTS[0]
    chunks = SemanticChunker.chunk_markdown(doc["content"], doc["title"])
    assert len(chunks) >= 3
    # First chunk has root title in path
    assert doc["title"] in chunks[0].heading_path
    # Specific subheadings exist
    assert any("Why Canonicalization Matters" in c.heading_path for c in chunks)
    assert any("Canonicalization Best Practices" in c.heading_path for c in chunks)

def test_hybrid_rag_retrieval_and_deprecation_filtering():
    store = HybridKnowledgeStore()

    # Ingest all seeds into store
    for doc in SEED_DOCUMENTS:
        chunks = SemanticChunker.chunk_markdown(doc["content"], doc["title"])
        for idx, c in enumerate(chunks):
            chunk_id = f"{doc['id']}-chunk-{idx}"
            # Synthetic mock vector for test
            mock_vector = [0.1] * 128
            store.add_chunk(
                chunk_id=chunk_id,
                document_title=doc["title"],
                heading_path=c.heading_path,
                content=c.content,
                vector=mock_vector,
                status=doc["status"]
            )

    # 1. Query for canonicalization
    results = store.search_hybrid("canonical absolute url self-referential", query_vector=[0.1]*128, top_k=3)
    assert len(results) > 0
    top = results[0]
    assert "Duplicate URLs" in top.document_title or "Canonical" in top.document_title
    assert "canonical" in top.content.lower()

    # 2. Query for robots noindex conflict
    robots_results = store.search_hybrid("noindex blocked robots crawling", top_k=2)
    assert len(robots_results) > 0
    assert any("Robots.txt" in r.document_title for r in robots_results)

    # 3. Test Deprecation filter: querying for "preferred domain setting" must NOT return the deprecated document
    deprec_results = store.search_hybrid("preferred domain setting in search console")
    assert all(r.document_title != "Google Search Console: Preferred Domain Setting (Legacy)" for r in deprec_results)
