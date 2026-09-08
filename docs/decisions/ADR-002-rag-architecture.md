# ADR-002: Hybrid Lexical-Dense RAG with Cross-Encoder Reranking

## Status
Accepted

## Context
Technical SEO inquiries often center around exact tokens and numeric directives (e.g., HTTP `404`, `301`, `noindex`, `disallow: /admin`, `INP`, `LCP`, `Hreflang`). Standard dense vector semantic retrieval frequently experiences embedding drift, returning conceptually related text that misses the exact technical directive. Conversely, pure keyword search fails to capture complex conceptual questions.

## Decision
We mandate a **Hybrid Retrieval Pipeline**:
1. Lexical retrieval using PostgreSQL `tsvector` with BM25-style ranking.
2. Dense semantic retrieval using `pgvector` HNSW cosine distance embeddings.
3. Merging candidate sets via Reciprocal Rank Fusion (RRF, $k=60$).
4. Cross-encoder reranker scoring the top 20 candidates down to the final 5-8 context chunks.
5. Strict exclusion of deprecated documentation via `status = 'ACTIVE'` filters.

## Consequences
### Positive
- Substantially higher retrieval precision on exact error codes and protocol terms.
- Zero reliance on outdated SEO practices due to automated deprecation filtering.
- Fully grounded claims with explicit citation verification.

### Negative
- Higher latency during the retrieval phase (mitigated by cross-encoder batched inferences and caching).
