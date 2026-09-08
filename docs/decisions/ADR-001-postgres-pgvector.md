# ADR-001: Selection of PostgreSQL with pgvector as Unified Store

## Status
Accepted

## Context
The Autonomous AI SEO Platform requires a relational database capable of handling complex multi-tenant relationships (organizations, users, sites, crawls, issues, recommendations), full-text search across crawled web documents, and vector similarity search for the SEO Knowledge Brain. We needed to choose between running a standalone vector database (e.g., Pinecone, Qdrant, Weaviate) alongside a relational database, or utilizing PostgreSQL with the `pgvector` extension.

## Decision
We chose **PostgreSQL 16+ with the `pgvector` extension** as our unified primary data and vector store for Phase 1. An abstract `VectorStore` interface is established in `services/rag` so that high-volume external vector engines (such as Qdrant or Pinecone) can be attached in the future without altering application code.

## Consequences
### Positive
- Single database transaction boundary: transactional consistency between metadata, documents, chunks, and embeddings.
- Reduced operational and infrastructure complexity in local development and production.
- Direct joins between vector search results and relational tenant ownership / document authority filters.
- Native `tsvector` enables fast hybrid lexical + dense search within the exact same database engine.

### Negative
- High-scale vector workloads (> 10M embeddings) require dedicated tuning of HNSW index maintenance memory (`maintenance_work_mem`).
