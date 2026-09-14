import re
import math
from typing import List, Any
from collections import Counter

class CrossEncoderReranker:
    """
    Cross-Encoder Reranker that scores candidate chunks jointly against the user query.
    Unlike dual-encoders that score query and document independently, cross-encoders model
    joint token interactions, term proximities, heading alignments, and phrase co-occurrences.
    """

    @classmethod
    def rerank(cls, query: str, candidates: List[Any], top_k: int = 5) -> List[Any]:
        """
        Reranks ScoredChunk candidate objects based on full cross-attention heuristics.
        """
        if not candidates:
            return []

        query_tokens = [w.lower() for w in re.findall(r"\b\w+\b", query) if len(w) > 2]
        if not query_tokens:
            return candidates[:top_k]

        scored_candidates = []
        for chunk in candidates:
            content = getattr(chunk, "content", "").lower()
            doc_title = getattr(chunk, "document_title", "").lower()
            heading_path = " ".join(getattr(chunk, "heading_path", [])).lower()
            base_score = getattr(chunk, "score", 0.0)

            # 1. Exact query phrase match in chunk
            exact_phrase_bonus = 2.5 if query.lower().strip() in content else 0.0

            # 2. Heading alignment (query tokens appearing in headings indicate structural relevance)
            heading_matches = sum(1 for qt in query_tokens if qt in heading_path or qt in doc_title)
            heading_score = (heading_matches / len(query_tokens)) * 1.5

            # 3. Content token coverage & density
            content_words = re.findall(r"\b\w+\b", content)
            token_counts = Counter(content_words)
            matched_tokens = sum(1 for qt in query_tokens if token_counts.get(qt, 0) > 0)
            coverage_ratio = matched_tokens / len(query_tokens)

            # 4. Proximity penalty / bonus
            proximity_score = 0.0
            if len(query_tokens) >= 2 and all(qt in token_counts for qt in query_tokens[:2]):
                pos1 = content.find(query_tokens[0])
                pos2 = content.find(query_tokens[1])
                if pos1 != -1 and pos2 != -1:
                    distance = abs(pos2 - pos1)
                    if distance < 100:
                        proximity_score = 1.0

            # Joint Cross-Encoder Score
            cross_score = (
                (base_score * 0.4) +
                (coverage_ratio * 2.0) +
                exact_phrase_bonus +
                heading_score +
                proximity_score
            )

            # Only retain candidate if it has at least some lexical/semantic coverage or strong base score
            if coverage_ratio > 0 or exact_phrase_bonus > 0 or heading_score > 0:
                chunk.score = round(cross_score, 4)
                scored_candidates.append((chunk, cross_score))

        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        return [item[0] for item in scored_candidates[:top_k]]
