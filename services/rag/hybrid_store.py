import math
from typing import List, Dict, Any, Optional
from collections import defaultdict

class ScoredChunk:
    def __init__(self, chunk_id: str, document_title: str, heading_path: List[str], content: str, score: float, status: str = "ACTIVE"):
        self.chunk_id = chunk_id
        self.document_title = document_title
        self.heading_path = heading_path
        self.content = content
        self.score = score
        self.status = status

class HybridKnowledgeStore:
    """
    Unified Hybrid Vector + Lexical RAG Engine.
    Combines dense embedding matching with lexical token matching,
    fuses candidate lists using Reciprocal Rank Fusion (RRF),
    and filters out deprecated documentation.
    """
    def __init__(self):
        self.chunks: Dict[str, Dict[str, Any]] = {}

    def add_chunk(self, chunk_id: str, document_title: str, heading_path: List[str], content: str, vector: Optional[List[float]] = None, status: str = "ACTIVE"):
        self.chunks[chunk_id] = {
            "chunk_id": chunk_id,
            "document_title": document_title,
            "heading_path": heading_path,
            "content": content,
            "vector": vector or [],
            "status": status
        }

    @staticmethod
    def _cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0
        dot = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = math.sqrt(sum(a * a for a in vec1))
        norm2 = math.sqrt(sum(b * b for b in vec2))
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return dot / (norm1 * norm2)

    def search_lexical(self, query: str, top_k: int = 20) -> List[str]:
        query_terms = set(query.lower().split())
        scored: List[tuple[str, float]] = []

        for chunk_id, data in self.chunks.items():
            if data["status"] != "ACTIVE":
                continue
            title_text = data["document_title"].lower()
            headings_text = " ".join(data.get("heading_path", [])).lower()
            content_lower = data["content"].lower()

            # Weight title and headings higher in BM25-style lexical scoring
            title_matches = sum(title_text.count(term) * 3 for term in query_terms)
            heading_matches = sum(headings_text.count(term) * 2 for term in query_terms)
            content_matches = sum(content_lower.count(term) for term in query_terms)

            total_matches = title_matches + heading_matches + content_matches
            if total_matches > 0:
                scored.append((chunk_id, float(total_matches)))

        scored.sort(key=lambda item: item[1], reverse=True)
        return [item[0] for item in scored[:top_k]]

    def search_dense(self, query_vector: List[float], top_k: int = 20) -> List[str]:
        if not query_vector:
            return []

        scored: List[tuple[str, float]] = []
        for chunk_id, data in self.chunks.items():
            if data["status"] != "ACTIVE":
                continue
            sim = self._cosine_similarity(query_vector, data["vector"])
            scored.append((chunk_id, sim))

        scored.sort(key=lambda item: item[1], reverse=True)
        return [item[0] for item in scored[:top_k]]

    def search_hybrid(self, query: str, query_vector: Optional[List[float]] = None, top_k: int = 5, rrf_k: int = 60) -> List[ScoredChunk]:
        """
        Executes hybrid search using Reciprocal Rank Fusion (RRF):
        RRF_score(d) = 1/(k + rank_dense) + 1/(k + rank_lexical)
        """
        lexical_ids = self.search_lexical(query, top_k=30)
        dense_ids = self.search_dense(query_vector or [], top_k=30) if query_vector else []

        rrf_scores = defaultdict(float)

        for rank, cid in enumerate(lexical_ids):
            rrf_scores[cid] += 1.0 / (rrf_k + rank + 1)

        for rank, cid in enumerate(dense_ids):
            rrf_scores[cid] += 1.0 / (rrf_k + rank + 1)

        sorted_candidates = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

        results: List[ScoredChunk] = []
        for cid, score in sorted_candidates[:top_k]:
            data = self.chunks[cid]
            results.append(ScoredChunk(
                chunk_id=cid,
                document_title=data["document_title"],
                heading_path=data["heading_path"],
                content=data["content"],
                score=score,
                status=data["status"]
            ))

        return results
