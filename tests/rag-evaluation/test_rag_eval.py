import pytest
from services.rag.chunker import SemanticChunker
from services.rag.hybrid_store import HybridKnowledgeStore
from services.rag.seeds import SEED_DOCUMENTS

BENCHMARK_QUERIES = [
    {
        "query": "duplicate content rel canonical tags self-referential",
        "expected_doc": "Google Search Central: Consolidate Duplicate URLs"
    },
    {
        "query": "robots.txt googlebot user-agent wildcard crawling",
        "expected_doc": "Google Search Central: Robots.txt Specifications"
    },
    {
        "query": "schema structured data json-ld rich results guidelines",
        "expected_doc": "Google Search Central: Structured Data & Schema.org"
    },
    {
        "query": "meta robots noindex directive x-robots-tag indexing",
        "expected_doc": "Google Search Central: Robots Meta Tags & X-Robots-Tag"
    },
    {
        "query": "core web vitals largest contentful paint lcp inp cls 75th percentile",
        "expected_doc": "W3C & Google: Core Web Vitals (CWV) Standards"
    }
]

@pytest.fixture(scope="module")
def populated_knowledge_store():
    store = HybridKnowledgeStore()
    for doc in SEED_DOCUMENTS:
        chunks = SemanticChunker.chunk_markdown(doc["content"], doc["title"])
        for idx, c in enumerate(chunks):
            chunk_id = f"{doc['id']}-eval-chunk-{idx}"
            mock_vec = [0.05] * 128
            store.add_chunk(
                chunk_id=chunk_id,
                document_title=doc["title"],
                heading_path=c.heading_path,
                content=c.content,
                vector=mock_vec,
                status=doc["status"]
            )
    return store

def test_rag_recall_and_mrr(populated_knowledge_store):
    store = populated_knowledge_store
    reciprocal_ranks = []
    hits_at_5 = 0

    for item in BENCHMARK_QUERIES:
        query = item["query"]
        expected = item["expected_doc"]

        results = store.search_hybrid(query, top_k=10)
        # Unique document ranking
        unique_docs = []
        for r in results:
            if r.document_title not in unique_docs:
                unique_docs.append(r.document_title)

        top_5_docs = unique_docs[:5]

        if expected in top_5_docs:
            hits_at_5 += 1
            rank = top_5_docs.index(expected) + 1
            reciprocal_ranks.append(1.0 / rank)
        else:
            reciprocal_ranks.append(0.0)

    recall_at_5 = hits_at_5 / len(BENCHMARK_QUERIES)
    mrr = sum(reciprocal_ranks) / len(BENCHMARK_QUERIES)

    assert recall_at_5 >= 0.85, f"Recall@5 was {recall_at_5}, expected >= 0.85"
    assert mrr >= 0.85, f"MRR was {mrr}, expected >= 0.85"

def test_zero_citations_of_deprecated_guidance(populated_knowledge_store):
    store = populated_knowledge_store
    results = store.search_hybrid("meta keywords tag Google ranking signal", top_k=5)
    for r in results:
        assert r.status != "DEPRECATED", f"Found deprecated guidance in top results: {r.document_title}"
