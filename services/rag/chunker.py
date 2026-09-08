import re
from typing import List, Dict, Any

class KnowledgeChunkDTO:
    def __init__(self, heading_path: List[str], content: str, token_count: int):
        self.heading_path = heading_path
        self.content = content
        self.token_count = token_count

class SemanticChunker:
    TARGET_MIN_WORDS = 60
    TARGET_MAX_WORDS = 250
    OVERLAP_WORDS = 20

    @staticmethod
    def chunk_markdown(content: str, doc_title: str) -> List[KnowledgeChunkDTO]:
        """
        Splits markdown documentation based on semantic headings (#, ##, ###),
        attaching hierarchical heading paths and applying bounded overlap.
        """
        lines = content.splitlines()
        chunks: List[KnowledgeChunkDTO] = []
        current_path = [doc_title]
        current_section_lines: List[str] = []

        for line in lines:
            # Detect markdown headings
            heading_match = re.match(r"^(#{1,6})\s+(.*)$", line.strip())
            if heading_match:
                # Flush existing buffer
                if current_section_lines:
                    text = "\n".join(current_section_lines).strip()
                    words = text.split()
                    if words:
                        chunks.append(KnowledgeChunkDTO(
                            heading_path=list(current_path),
                            content=text,
                            token_count=len(words)
                        ))
                    current_section_lines = []

                level = len(heading_match.group(1))
                heading_text = heading_match.group(2).strip()

                # Adjust heading path hierarchy
                if level == 1:
                    current_path = [doc_title, heading_text]
                elif level == 2:
                    current_path = current_path[:2] + [heading_text]
                else:
                    current_path = current_path[:3] + [heading_text]
            else:
                if line.strip():
                    current_section_lines.append(line)

        # Flush final buffer
        if current_section_lines:
            text = "\n".join(current_section_lines).strip()
            words = text.split()
            if words:
                chunks.append(KnowledgeChunkDTO(
                    heading_path=list(current_path),
                    content=text,
                    token_count=len(words)
                ))

        return chunks
