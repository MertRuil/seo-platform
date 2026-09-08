import math
import json
import os
from typing import List, Dict, Any, Optional
from collections import defaultdict

class ScoredChunk:
    def __init__(
        self,
        chunk_id: str,
        document_title: str,
        heading_path: List[str],
        content: str,
        score: float,
        status: str = "ACTIVE",
        canonical_url: str = "",
        authority_level: str = "LEVEL_1_OFFICIAL",
        verification_status: str = "VERIFIED",
        verified_claims: Optional[List[str]] = None,
        verification_confidence: float = 1.0,
        verified_at: str = ""
    ):
        self.chunk_id = chunk_id
        self.document_title = document_title
        self.heading_path = heading_path
        self.content = content
        self.score = score
        self.status = status
        self.canonical_url = canonical_url
        self.authority_level = authority_level
        self.verification_status = verification_status
        self.verified_claims = verified_claims or []
        self.verification_confidence = verification_confidence
        self.verified_at = verified_at

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "document_title": self.document_title,
            "heading_path": self.heading_path,
            "content": self.content,
            "score": self.score,
            "status": self.status,
            "canonical_url": self.canonical_url,
            "authority_level": self.authority_level,
            "verification_status": self.verification_status,
            "verified_claims": self.verified_claims,
            "verification_confidence": self.verification_confidence,
            "verified_at": self.verified_at
        }


class HybridKnowledgeStore:
    """
    Production-Grade Hybrid Vector + Okapi BM25 RAG Engine.
    Features:
    - Okapi BM25 Lexical scoring with Term Frequency saturation & Document Length normalization
    - Dense Embedding Cosine Similarity
    - Reciprocal Rank Fusion (RRF) with Authority-Tier Boosting
    - Strict Deprecation & Rejection Filtering
    - Serialization & Persistence (JSON)
    """
    BM25_K1 = 1.5
    BM25_B = 0.75

    def __init__(self):
        self.chunks: Dict[str, Dict[str, Any]] = {}
        # Inverted index for BM25: term -> dict of chunk_id: tf
        self.inverted_index: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self.doc_lengths: Dict[str, int] = {}
        self.avg_doc_length: float = 0.0

    def add_chunk(
        self,
        chunk_id: str,
        document_title: str,
        heading_path: List[str],
        content: str,
        vector: Optional[List[float]] = None,
        status: str = "ACTIVE",
        canonical_url: str = "",
        authority_level: str = "LEVEL_1_OFFICIAL",
        verification_status: str = "VERIFIED",
        verified_claims: Optional[List[str]] = None,
        verification_confidence: float = 1.0,
        verified_at: str = "",
        source_hash: str = ""
    ):
        """Adds a chunk to the store and updates inverted index for BM25 scoring."""
        self.chunks[chunk_id] = {
            "chunk_id": chunk_id,
            "document_title": document_title,
            "heading_path": heading_path,
            "content": content,
            "vector": vector or [],
            "status": status,
            "canonical_url": canonical_url,
            "authority_level": authority_level,
            "verification_status": verification_status,
            "verified_claims": verified_claims or [],
            "verification_confidence": verification_confidence,
            "verified_at": verified_at,
            "source_hash": source_hash
        }

        # Indexing for BM25
        text_tokens = self._tokenize(f"{document_title} {' '.join(heading_path)} {content}")
        self.doc_lengths[chunk_id] = len(text_tokens)

        # Title & heading weighting
        title_tokens = self._tokenize(document_title)
        heading_tokens = self._tokenize(" ".join(heading_path))
        content_tokens = self._tokenize(content)

        token_counts: Dict[str, int] = defaultdict(int)
        for t in content_tokens:
            token_counts[t] += 1
        for t in heading_tokens:
            token_counts[t] += 2  # Higher weight
        for t in title_tokens:
            token_counts[t] += 3  # Highest weight

        for term, count in token_counts.items():
            self.inverted_index[term][chunk_id] = count

        total_length = sum(self.doc_lengths.values())
        self.avg_doc_length = total_length / max(1, len(self.doc_lengths))

    STOP_WORDS = {
        "a", "about", "after", "all", "also", "an", "and", "any", "are", "as", "at", "be", "because",
        "been", "before", "being", "between", "both", "but", "by", "can", "could", "did", "do", "does",
        "for", "from", "had", "has", "have", "having", "he", "her", "here", "him", "his", "how", "i",
        "if", "in", "into", "is", "it", "its", "just", "me", "more", "most", "my", "no", "not", "of",
        "on", "once", "only", "or", "other", "our", "out", "over", "own", "same", "she", "should", "so",
        "some", "such", "than", "that", "the", "their", "them", "then", "there", "these", "they", "this",
        "those", "through", "to", "too", "under", "until", "up", "very", "was", "we", "were", "what",
        "when", "where", "which", "while", "who", "whom", "why", "with", "would", "you", "your"
    }

    @classmethod
    def _tokenize(cls, text: str) -> List[str]:
        tokens = []
        for w in text.split():
            clean = w.lower().strip(".,;:!?\"'()[]{}#-_/")
            if len(clean) > 1 and clean not in cls.STOP_WORDS:
                tokens.append(clean)
        return tokens

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

    def _compute_idf(self, term: str) -> float:
        """Computes BM25 IDF for a query term."""
        n_q = len(self.inverted_index.get(term, {}))
        if n_q == 0:
            return 0.0
        N = len(self.chunks)
        return math.log(1.0 + (N - n_q + 0.5) / (n_q + 0.5))

    def search_lexical(self, query: str, top_k: int = 20) -> List[str]:
        """Performs Okapi BM25 ranking across active, verified chunks."""
        query_terms = self._tokenize(query)
        if not query_terms:
            return []

        scores: Dict[str, float] = defaultdict(float)
        avgdl = max(1.0, self.avg_doc_length)

        for term in query_terms:
            idf = self._compute_idf(term)
            if idf <= 0.0:
                continue

            postings = self.inverted_index.get(term, {})
            for chunk_id, tf in postings.items():
                chunk_data = self.chunks.get(chunk_id)
                if not chunk_data or chunk_data["status"] != "ACTIVE":
                    continue
                if chunk_data.get("verification_status") == "REJECTED":
                    continue

                doc_len = self.doc_lengths.get(chunk_id, avgdl)
                # BM25 formula
                numerator = tf * (self.BM25_K1 + 1.0)
                denominator = tf + self.BM25_K1 * (1.0 - self.BM25_B + self.BM25_B * (doc_len / avgdl))
                bm25_val = idf * (numerator / max(0.0001, denominator))

                scores[chunk_id] += bm25_val

        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [item[0] for item in ranked[:top_k]]

    def search_dense(self, query_vector: List[float], top_k: int = 20) -> List[str]:
        if not query_vector:
            return []

        scored: List[tuple[str, float]] = []
        for chunk_id, data in self.chunks.items():
            if data["status"] != "ACTIVE":
                continue
            if data.get("verification_status") == "REJECTED":
                continue
            sim = self._cosine_similarity(query_vector, data["vector"])
            if sim > 0:
                scored.append((chunk_id, sim))

        scored.sort(key=lambda item: item[1], reverse=True)
        return [item[0] for item in scored[:top_k]]

    def search_hybrid(
        self,
        query: str,
        query_vector: Optional[List[float]] = None,
        top_k: int = 5,
        rrf_k: int = 60
    ) -> List[ScoredChunk]:
        """
        Executes hybrid search using Reciprocal Rank Fusion (RRF)
        with Authority Tier Multipliers:
        RRF_score(d) = [1/(k + rank_dense) + 1/(k + rank_lexical)] * authority_boost
        Strictly filters out DEPRECATED and REJECTED knowledge.
        """
        lexical_ids = self.search_lexical(query, top_k=30)
        dense_ids = self.search_dense(query_vector or [], top_k=30) if query_vector else []

        rrf_scores = defaultdict(float)

        for rank, cid in enumerate(lexical_ids):
            rrf_scores[cid] += 1.0 / (rrf_k + rank + 1)

        for rank, cid in enumerate(dense_ids):
            rrf_scores[cid] += 1.0 / (rrf_k + rank + 1)

        # Apply Authority Tier Boost
        for cid in list(rrf_scores.keys()):
            data = self.chunks.get(cid, {})
            auth = data.get("authority_level", "LEVEL_1_OFFICIAL")
            if auth == "LEVEL_1_OFFICIAL":
                rrf_scores[cid] *= 1.25  # 25% boost for official standards
            elif auth == "LEVEL_2_AUTHORITATIVE":
                rrf_scores[cid] *= 1.10

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
                status=data["status"],
                canonical_url=data.get("canonical_url", ""),
                authority_level=data.get("authority_level", "LEVEL_1_OFFICIAL"),
                verification_status=data.get("verification_status", "VERIFIED"),
                verified_claims=data.get("verified_claims", []),
                verification_confidence=data.get("verification_confidence", 1.0),
                verified_at=data.get("verified_at", "")
            ))

        return results

    def save_to_disk(self, filepath: str):
        """Serializes knowledge chunks and metadata to disk."""
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.chunks, f, indent=2, ensure_ascii=False)

    def load_from_disk(self, filepath: str):
        """Loads knowledge chunks from disk and rebuilds index."""
        if not os.path.exists(filepath):
            return
        with open(filepath, "r", encoding="utf-8") as f:
            chunks_data = json.load(f)
        for cid, d in chunks_data.items():
            self.add_chunk(
                chunk_id=d["chunk_id"],
                document_title=d["document_title"],
                heading_path=d.get("heading_path", []),
                content=d["content"],
                vector=d.get("vector"),
                status=d.get("status", "ACTIVE"),
                canonical_url=d.get("canonical_url", ""),
                authority_level=d.get("authority_level", "LEVEL_1_OFFICIAL"),
                verification_status=d.get("verification_status", "VERIFIED"),
                verified_claims=d.get("verified_claims", []),
                verification_confidence=d.get("verification_confidence", 1.0),
                verified_at=d.get("verified_at", ""),
                source_hash=d.get("source_hash", "")
            )

    def get_stats(self) -> Dict[str, Any]:
        """Provides statistics on stored chunks."""
        total = len(self.chunks)
        active = sum(1 for c in self.chunks.values() if c["status"] == "ACTIVE")
        deprecated = sum(1 for c in self.chunks.values() if c["status"] == "DEPRECATED")
        verified = sum(1 for c in self.chunks.values() if c.get("verification_status") == "VERIFIED")
        level_1 = sum(1 for c in self.chunks.values() if c.get("authority_level") == "LEVEL_1_OFFICIAL")

        return {
            "total_chunks": total,
            "active_chunks": active,
            "deprecated_chunks": deprecated,
            "verified_chunks": verified,
            "level_1_official_chunks": level_1
        }
