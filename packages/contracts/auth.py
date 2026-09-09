from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128, description="Minimum 8, maksimum 128 karakter")
    full_name: Optional[str] = None

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128, description="Maksimum 128 karakter")

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    is_active: bool
    is_platform_admin: bool

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ForgotPasswordResponse(BaseModel):
    success: bool
    message: str
    reset_token: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128, description="Minimum 8, maksimum 128 karakter")

class OAuthLoginRequest(BaseModel):
    provider: str  # "google", "github", "microsoft"
    token: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
