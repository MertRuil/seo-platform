from pydantic import BaseModel, Field
from typing import List, Optional

class IndexNowSubmitRequest(BaseModel):
    host: str = Field(..., description="Web sitesinin ana alan adı (örn: example.com)", json_schema_extra={"example": "example.com"})
    url_list: List[str] = Field(..., min_length=1, max_length=10000, description="Dizine eklenmesi/güncellenmesi istenen URL listesi")
    key: Optional[str] = Field(None, description="Opsiyonel IndexNow API anahtarı (belirtilmezse otomatik atanır)")
    key_location: Optional[str] = Field(None, description="IndexNow anahtar doğrulama dosyasının URL'si")

class IndexNowSubmitResponse(BaseModel):
    success: bool
    status_code: int
    submitted_urls_count: int
    host: str
    message: str
    key_used: str

class GoogleIndexingSubmitRequest(BaseModel):
    url: str = Field(..., description="Google Indexing API'ye bildirilecek web sayfası adresi")
    action_type: str = Field("URL_UPDATED", pattern=r"^(URL_UPDATED|URL_DELETED)$", description="İşlem türü: URL_UPDATED veya URL_DELETED")

class GoogleIndexingSubmitResponse(BaseModel):
    success: bool
    status_code: int
    url: str
    action_type: str
    message: str
    notify_time: Optional[str] = None
