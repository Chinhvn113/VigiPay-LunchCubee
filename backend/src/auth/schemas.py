"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
import re


class UserBase(BaseModel):
    """Base user schema with common fields"""
    username: str = Field(..., min_length=3, max_length=50, description="Username")
    email: EmailStr = Field(..., description="Email address")
    full_name: Optional[str] = Field(None, max_length=100, description="Full name")


class UserCreate(UserBase):
    """Schema for user registration"""
    password: str = Field(..., min_length=8, max_length=100, description="Password")
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        """Validate username format"""
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username can only contain letters, numbers, and underscores')
        return v.lower()
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one digit')
        return v


class UserLogin(BaseModel):
    """Schema for user login"""
    username: str = Field(..., description="Username or email")
    password: str = Field(..., description="Password")


class UserResponse(UserBase):
    """Schema for user response (without password)"""
    id: int
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    """Schema for JWT token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for token payload data"""
    user_id: Optional[int] = None
    username: Optional[str] = None
    email: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    """Schema for refresh token request"""
    refresh_token: str = Field(..., description="Refresh token")


class LoginResponse(BaseModel):
    """Schema for successful login response"""
    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    """Generic message response"""
    message: str
    success: bool = True
