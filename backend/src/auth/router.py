"""
Authentication API Router
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

from .database import get_db
from .models import User, RefreshToken, TokenBlacklist
from .schemas import (
    UserCreate, UserLogin, UserResponse, LoginResponse, 
    MessageResponse, RefreshTokenRequest, Token
)
from .utils import (
    get_password_hash, verify_password, 
    create_access_token, create_refresh_token, verify_token
)
from .dependencies import get_current_user, get_current_active_user
from .config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user account
    
    - **username**: Unique username (3-50 chars, alphanumeric + underscore)
    - **email**: Valid email address
    - **password**: Strong password (min 8 chars, uppercase, lowercase, digit)
    - **full_name**: Optional full name
    
    Returns user info and JWT tokens
    """
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user_data.username.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email already exists
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username.lower(),
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Generate tokens
    token_data = {
        "sub": new_user.id,
        "username": new_user.username,
        "email": new_user.email
    }
    access_token = create_access_token(token_data)
    refresh_token_str = create_refresh_token({"sub": new_user.id})
    
    # Store refresh token in database
    refresh_token_obj = RefreshToken(
        user_id=new_user.id,
        token=refresh_token_str,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(refresh_token_obj)
    db.commit()
    
    return LoginResponse(
        user=UserResponse.model_validate(new_user),
        access_token=access_token,
        refresh_token=refresh_token_str,
        token_type="bearer"
    )


@router.post("/login", response_model=LoginResponse)
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """
    Login with username/email and password
    
    - **username**: Username or email address
    - **password**: User password
    
    Returns user info and JWT tokens
    """
    # Find user by username or email
    user = db.query(User).filter(
        (User.username == login_data.username.lower()) | 
        (User.email == login_data.username)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    if not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Generate tokens
    token_data = {
        "sub": user.id,
        "username": user.username,
        "email": user.email
    }
    access_token = create_access_token(token_data)
    refresh_token_str = create_refresh_token({"sub": user.id})
    
    # Store refresh token in database
    refresh_token_obj = RefreshToken(
        user_id=user.id,
        token=refresh_token_str,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(refresh_token_obj)
    db.commit()
    
    return LoginResponse(
        user=UserResponse.model_validate(user),
        access_token=access_token,
        refresh_token=refresh_token_str,
        token_type="bearer"
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Logout current user (invalidate tokens)
    
    Requires authentication via Bearer token
    """
    # Note: In a real implementation, you'd get the actual token from the request
    # and add it to the blacklist. For now, we'll just delete refresh tokens.
    
    # Delete all refresh tokens for this user
    db.query(RefreshToken).filter(RefreshToken.user_id == current_user.id).delete()
    db.commit()
    
    return MessageResponse(
        message="Successfully logged out",
        success=True
    )


@router.post("/refresh", response_model=Token)
async def refresh_access_token(
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token
    
    - **refresh_token**: Valid refresh token
    
    Returns new access token
    """
    # Verify refresh token
    token_data = verify_token(refresh_data.refresh_token, token_type="refresh")
    
    if token_data is None or token_data.user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if refresh token exists in database
    refresh_token_obj = db.query(RefreshToken).filter(
        RefreshToken.token == refresh_data.refresh_token,
        RefreshToken.user_id == token_data.user_id
    ).first()
    
    if not refresh_token_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found or revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if refresh token is expired
    if refresh_token_obj.expires_at < datetime.utcnow():
        db.delete(refresh_token_obj)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user
    user = db.query(User).filter(User.id == token_data.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Generate new access token
    new_token_data = {
        "sub": user.id,
        "username": user.username,
        "email": user.email
    }
    new_access_token = create_access_token(new_token_data)
    
    return Token(
        access_token=new_access_token,
        refresh_token=refresh_data.refresh_token,
        token_type="bearer"
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """
    Get current authenticated user information
    
    Requires authentication via Bearer token
    """
    return UserResponse.model_validate(current_user)


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "auth-service"}
