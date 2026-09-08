from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class KnowledgeSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500, description="Search query string")
    top_k: int = Field(default=5, ge=1, le=50, description="Maximum number of chunks to return")
    query_vector: Optional[List[float]] = Field(default=None, description="Optional dense embedding vector")

class KnowledgeChunkDTO(BaseModel):
    chunk_id: str
    document_title: str
    heading_path: List[str]
    content: str
    score: float
    canonical_url: str
    authority_level: str
    verification_status: str

class KnowledgeSearchResponse(BaseModel):
    query: str
    results_count: int
    results: List[KnowledgeChunkDTO]

class KnowledgeStatsResponse(BaseModel):
    total_chunks: int
    active_chunks: int
    deprecated_chunks: int
    verified_chunks: int
    level_1_official_chunks: int
    rate_limit_metrics: Dict[str, Any]

class KnowledgeSourceDTO(BaseModel):
    id: str
    title: str
    canonical_url: str
    authority_level: str
    status: str

class KnowledgeSourcesResponse(BaseModel):
    total_sources: int
    sources: List[KnowledgeSourceDTO]

class DocumentIngestRequest(BaseModel):
    id: Optional[str] = None
    title: str = Field(..., min_length=3, max_length=200)
    content: str = Field(..., min_length=10)
    canonical_url: str = Field(..., min_length=10)
    status: str = Field(default="ACTIVE", pattern=r"^(ACTIVE|DEPRECATED)$")

class DocumentIngestResponse(BaseModel):
    doc_id: str
    title: str
    canonical_url: str
    verification_status: str
    confidence: float
    authority_level: str
    chunks_ingested: int
    reasons: List[str]
    verified_at: str
