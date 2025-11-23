import asyncio
import os
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, status, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional
from openai import OpenAI
from dotenv import load_dotenv
from rag_db import MilvusRAGDB
from datetime import datetime, timedelta, timezone
from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Float, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.sql import func
import bcrypt
from jose import JWTError, jwt
import uuid      
import time      
import json      
import httpx     
import re
import secrets
import base64

import joblib
import pandas as pd
import sys
sys.path.append(os.path.join(os.path.dirname(__file__)))
try:
    from randomforrest import load_model_pt, load_feature_columns, predict
except ImportError as e:
    print(f"[WARN] Could not import randomforrest model helpers: {e}")
    load_model_pt = None
    load_feature_columns = None
    predict = None

load_dotenv()



def load_ml_model(path: str):
    if not os.path.exists(path):
        print(f"⚠️ WARNING: ML model file not found at {path}. Safety check endpoint will be disabled.")
        return None
    try:
        model = joblib.load(path)
        print(f"✅ ML Model '{path}' loaded successfully.")
        return model
    except Exception as e:
        print(f"❌ ERROR: Failed to load ML model from {path}: {e}")
        return None

fraud_detection_model = None
feature_columns_cache = None

def get_fraud_detection_model():
    global fraud_detection_model
    if fraud_detection_model is None:
        fraud_detection_model = load_ml_model('checkpoints/random_forest.pkl')
    return fraud_detection_model

def get_feature_columns():
    global feature_columns_cache
    if feature_columns_cache is None and load_feature_columns is not None:
        feature_columns_cache = load_feature_columns()
    return feature_columns_cache


def predict_transaction_fraud(model, feature_list: list):
    """
    Makes a prediction using a loaded model on a single list of features.
    Automatically maps string 'type' values to their integer encoding.

    Args:
        model: A trained and loaded scikit-learn model object.
        feature_list (list): A list containing feature values in the correct order.
                             The 'type' can be an integer or a string like 'TRANSFER'.

    Returns:
        int: The prediction result (0 for not fraud, 1 for fraud).
    """
    feature_columns = [
        'step', 'type', 'amount', 'oldbalanceOrg', 'newbalanceOrig',
        'oldbalanceDest', 'newbalanceDest'
    ]

    if len(feature_list) != len(feature_columns):
        raise ValueError(f"Expected {len(feature_columns)} features, but got {len(feature_list)}")

    processed_features = feature_list.copy()

    if isinstance(processed_features[1], str):
        type_mapping = {
            'CASH_IN': 0, 'CASH_OUT': 1, 'DEBIT': 2, 'PAYMENT': 3, 'TRANSFER': 4
        }
        str_type = processed_features[1].upper()
        processed_features[1] = type_mapping.get(str_type, 4) # Default to 4 ('TRANSFER')

    input_df = pd.DataFrame([processed_features], columns=feature_columns)
    prediction = model.predict(input_df)
    return prediction[0]

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    print("⚠️ WARNING: SECRET_KEY not found in .env, using random key (tokens will be invalid after restart!)")
    SECRET_KEY = secrets.token_urlsafe(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./naver_bank.db")

security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)  #

engine_kwargs = {
    "pool_pre_ping": True,  # Verify connections before using
    "pool_size": 10,  # Connection pool size
    "max_overflow": 20,  # Max connections beyond pool_size
    "echo": False  # Set True for SQL query logging
}

if "sqlite" in DATABASE_URL:
    engine_kwargs = {"connect_args": {"check_same_thread": False}}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(
    title="Naver Bank API",
    description="Unified API for Authentication, Chat, RAG, and Scam Detection",
    version="1.0.0"
)

milvus_host = os.getenv("MILVUS_HOST", "10.0.1.8")
milvus_port = os.getenv("MILVUS_PORT", "6030")
milvus_collection_name = os.getenv("MILVUS_COLLECTION_NAME", "scam_check_db")

try:
    rag_db = MilvusRAGDB(
        host=milvus_host,
        port=milvus_port,
        collection_name=milvus_collection_name
    )
    print("✅ Milvus RAG Database initialized successfully")
except Exception as e:
    print(f"⚠️ Warning: Could not initialize Milvus RAG Database: {e}")
    rag_db = None

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)


client = OpenAI(
    api_key="nv-a851d08d11b84ff18525aa7cd38d138dxBoj",
    base_url="https://clovastudio.stream.ntruss.com/v1/openai",
)

CLOVA_OCR_API_URL = os.getenv("CLOVA_OCR_API_URL")
CLOVA_OCR_SECRET_KEY = os.getenv("CLOVA_OCR_SECRET_KEY")
CLOVA_SPEECH_INVOKE_URL = os.getenv("CLOVA_SPEECH_INVOKE_URL")
CLOVA_SPEECH_SECRET_KEY = os.getenv("CLOVA_SPEECH_SECRET_KEY")

class User(Base):
    """User model for authentication"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    fraud_checking = Column(Boolean, default=False, nullable=False)  # Flag for fraud demo account
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    bank_accounts = relationship("BankAccount", back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    """Refresh token model"""
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(500), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="refresh_tokens")


class TokenBlacklist(Base):
    """Token blacklist for logout"""
    __tablename__ = "token_blacklist"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(500), unique=True, nullable=False, index=True)
    blacklisted_at = Column(DateTime(timezone=True), server_default=func.now())

class Transaction(Base):
    """Transaction model for financial management (income/expense tracking)"""
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True)  # Link to specific account
    transfer_id = Column(Integer, ForeignKey("transfer_transactions.id", ondelete="SET NULL"), nullable=True)  # Link to transfer if applicable
    type = Column(String(20), nullable=False) # "income" or "expense"
    amount = Column(Integer, nullable=False)
    description = Column(String(255), nullable=False)
    transaction_date = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    owner = relationship("User")
    account = relationship("BankAccount", back_populates="transactions")
    transfer = relationship("TransferTransaction", back_populates="transactions")

class BankAccount(Base):
    """Bank account model - User can have multiple accounts"""
    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_number = Column(String(10), unique=True, nullable=False, index=True)  # 10-digit account number
    account_type = Column(String(20), nullable=False, default="main")  # "main", "savings", "investment"
    balance = Column(Integer, nullable=False, default=0)  # Balance in VND (integer to avoid float issues)
    
    currency = Column(String(3), nullable=False, default="VND")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="bank_accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")
    outgoing_transfers = relationship(
        "TransferTransaction", 
        foreign_keys="TransferTransaction.sender_account_id",
        back_populates="sender_account",
        cascade="all, delete-orphan"
    )


class TransferTransaction(Base):
    """Transfer transaction model - Records money transfers between accounts"""
    __tablename__ = "transfer_transactions"

    id = Column(Integer, primary_key=True, index=True)
    sender_account_id = Column(Integer, ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False)
    receiver_account_number = Column(String(50), nullable=False)  
    receiver_bank = Column(String(50), nullable=False)  
    receiver_name = Column(String(100), nullable=True)  
    amount = Column(Integer, nullable=False)  
    fee = Column(Integer, nullable=False, default=0)  
    fee_payer = Column(String(10), nullable=False, default="sender")  
    description = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="completed")  
    transaction_date = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    sender_account = relationship("BankAccount", foreign_keys=[sender_account_id], back_populates="outgoing_transfers")
    transactions = relationship("Transaction", back_populates="transfer")


class SavingsGoal(Base):
    """Savings Goal model for tracking user financial goals per account"""
    __tablename__ = "savings_goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    
    name = Column(String(100), nullable=False)
    target_amount = Column(Float, nullable=False)
    allocated_amount = Column(Float, nullable=False, default=0)
    color = Column(String(20), nullable=False, default="bg-blue-500")
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<SavingsGoal(id={self.id}, name='{self.name}', user_id={self.user_id}, account_id={self.account_id})>"


 
def generate_account_number(db: Session) -> str:
    """Generate unique 10-digit account number"""
    import random
    max_attempts = 100
    
    for _ in range(max_attempts):
        # Generate random 10-digit number
        account_number = ''.join([str(random.randint(0, 9)) for _ in range(10)])
        
        # Check if already exists
        existing = db.query(BankAccount).filter(BankAccount.account_number == account_number).first()
        if not existing:
            return account_number
    
    raise Exception("Failed to generate unique account number after 100 attempts")


def calculate_transfer_fee(amount: int) -> int:
    """Calculate transfer fee based on amount"""
    if amount < 500000:  # Less than 500K VND
        return 0
    else:  # 500K and above
        return 0


# Initialize database
def init_db():
    Base.metadata.create_all(bind=engine)
    print("✅ Database initialized")

# Create tables on startup
init_db()


 
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


 
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hashed password using bcrypt"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str, token_type: str = "access"):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != token_type:
            print(f"⚠️ Token type mismatch: expected '{token_type}', got '{payload.get('type')}'")
            return None
        return payload
    except JWTError as e:
        print(f"⚠️ JWT decode error: {e}")
        return None
    except Exception as e:
        print(f"⚠️ Unexpected error in verify_token: {e}")
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    
    # Check blacklist
    blacklisted = db.query(TokenBlacklist).filter(TokenBlacklist.token == token).first()
    if blacklisted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked"
        )
    
    # Verify token
    payload = verify_token(token, "access")
    if payload is None:
        raise credentials_exception
    
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception
    
    user_id = int(user_id_str)
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    
    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Optional authentication - returns user if valid token provided, None otherwise"""
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        
        # Check blacklist
        blacklisted = db.query(TokenBlacklist).filter(TokenBlacklist.token == token).first()
        if blacklisted:
            return None
        
        # Verify token
        payload = verify_token(token, "access")
        if payload is None:
            return None
        
        user_id_str = payload.get("sub")
        if user_id_str is None:
            return None
        
        user_id = int(user_id_str)
        user = db.query(User).filter(User.id == user_id).first()
        if user is None or not user.is_active:
            return None
        
        return user
    except Exception as e:
        print(f"⚠️ Error in get_current_user_optional: {e}")
        return None


 
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: Optional[str] = Field(None, max_length=100)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100)
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username can only contain letters, numbers, and underscores')
        return v.lower()
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain digit')
        return v


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    message: str
    success: bool = True


class RefreshTokenRequest(BaseModel):
    refresh_token: str


 
class ImageContent(BaseModel):
    """Image content with base64 encoded data"""
    type: str = "image_url"
    image_url: Optional[dict] = None  # For URL-based images
    data_uri: Optional[dict] = None  # For base64 encoded images: {"data": "data:image/png;base64,..."}

class TextContent(BaseModel):
    """Text content"""
    type: str = "text"
    text: str

class Message(BaseModel):
    """Chat message that can contain text and/or image content"""
    role: str
    content: Optional[str] = None  # For backward compatibility with plain text
    # Extended fields for structured content
    text: Optional[str] = None
    image_url: Optional[str] = None  # Base64 encoded image or URL
    image_data: Optional[str] = None  # Base64 encoded image data

class ChatRequest(BaseModel):
    messages: List[Message]

class EmbeddingRequest(BaseModel):
    text: str = Field(..., description="Text to generate embeddings for")
    model: str = Field(default="bge-m3", description="Model to use for embeddings")

class EmbeddingResponse(BaseModel):
    success: bool
    embedding: List[float] = None
    error: str = None

class SearchRequest(BaseModel):
    query: str = Field(..., description="The search query")
    top_k: int = Field(default=5, description="Number of top results to return")

class SearchResultItem(BaseModel):
    id: int
    distance: float
    source: str
    text: str

class SearchResponse(BaseModel):
    success: bool
    results: List[SearchResultItem] = None
    error: str = None

class ScamCheckRequest(BaseModel):
    input: str = Field(..., description="The input to check for scams")

class ScamCheckResponse(BaseModel):
    success: bool
    verdict: str = None  # "This is a scam" or "This is not a scam"
    error: str = None

class SafetyCheckRequest(BaseModel):
    sender_account_id: int
    amount: float
    receiver_account_number: Optional[str] = None  # Optional: receiver account number to check destination user's fraud status

class SafetyCheckResponse(BaseModel):
    is_safe: bool
    message: str

class SafetyPredictRequest(BaseModel):
    features: dict

class SafetyPredictResponse(BaseModel):
    isFraud: int
    probability: Optional[float] = None
    
class OcrResultItem(BaseModel):
    text: str
    bounding_poly: Optional[List[List[int]]] = None # Example: [[x1, y1], [x2, y2], ...]

class OcrResponse(BaseModel):
    success: bool
    full_text: Optional[str] = None
    regions: Optional[List[OcrResultItem]] = None # List of OcrResultItem if you parse detailed regions
    error: Optional[str] = None

class OcrScamCheckResponse(BaseModel):
    success: bool
    ocr_full_text: Optional[str] = None
    scam_verdict: Optional[str] = None
    error: Optional[str] = None
    
class TransactionResponse(BaseModel):
    id: int
    type: str
    amount: int
    description: str
    transaction_date: datetime

    class Config:
        from_attributes = True


# --- Bank Account Pydantic Models ---
class BankAccountResponse(BaseModel):
    id: int
    user_id: int
    account_number: str
    account_type: str
    balance: int
    currency: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class BankAccountCreate(BaseModel):
    account_type: str = Field(default="main", description="Account type: main, savings, or investment")
    
    @field_validator('account_type')
    @classmethod
    def validate_account_type(cls, v: str) -> str:
        if v not in ['main', 'savings', 'investment']:
            raise ValueError('account_type must be main, savings, or investment')
        return v


# --- Transfer Transaction Pydantic Models ---
class TransferRequest(BaseModel):
    sender_account_id: int = Field(..., description="ID of sender's bank account")
    receiver_account_number: str = Field(..., min_length=10, max_length=10, description="Receiver's account number (10 digits)")
    receiver_bank: str = Field(..., description="Receiver's bank code (vcb, bidv, etc.)")
    receiver_name: str = Field(..., min_length=1, max_length=100, description="Receiver's name (required)")
    amount: int = Field(..., gt=0, description="Transfer amount in VND (must be positive)")
    description: Optional[str] = Field(None, max_length=255, description="Transfer description (optional)")
    fee_payer: str = Field(default="sender", description="Who pays the fee: sender or receiver")
    
    @field_validator('fee_payer')
    @classmethod
    def validate_fee_payer(cls, v: str) -> str:
        if v not in ['sender', 'receiver']:
            raise ValueError('fee_payer must be either "sender" or "receiver"')
        return v


class InternalTransferRequest(BaseModel):
    """Request model for internal VigiPay transfers"""
    sender_account_id: int = Field(..., description="ID of sender's bank account")
    receiver_account_number: str = Field(..., min_length=10, max_length=10, description="Receiver's account number (10 digits)")
    amount: int = Field(..., gt=0, description="Transfer amount in VND (must be positive)")
    description: Optional[str] = Field(default="Internal transfer", max_length=255, description="Transfer description")
    fee_payer: str = Field(default="sender", description="Who pays the fee: sender or receiver")
    
    @field_validator('fee_payer')
    @classmethod
    def validate_fee_payer(cls, v: str) -> str:
        if v not in ['sender', 'receiver']:
            raise ValueError('fee_payer must be either "sender" or "receiver"')
        return v


class TransferResponse(BaseModel):
    id: int
    sender_account_id: int
    receiver_account_number: str
    receiver_bank: str
    receiver_name: Optional[str]
    amount: int
    fee: int
    fee_payer: str
    description: str
    status: str
    transaction_date: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True

class TransferDetailsResponse(BaseModel):
    account_number: Optional[str] = None
    amount: Optional[int] = None
    description: Optional[str] = None


# --- Savings Goals Pydantic Models ---
class SavingsGoalCreate(BaseModel):
    account_id: int = Field(..., description="Bank account ID")
    name: str = Field(..., min_length=1, max_length=100)
    target_amount: float = Field(..., gt=0)
    allocated_amount: float = Field(..., ge=0)
    color: str = Field(default="bg-blue-500")


class SavingsGoalUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    target_amount: Optional[float] = Field(None, gt=0)
    allocated_amount: Optional[float] = Field(None, ge=0)
    color: Optional[str] = None


class SavingsGoalResponse(BaseModel):
    id: int
    account_id: int
    user_id: int
    name: str
    target_amount: float
    allocated_amount: float
    color: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SavingsGoalSummary(BaseModel):
    account_id: int
    total_balance: float
    total_allocated: float
    available_balance: float
    goals_count: int
    is_over_allocated: bool
    goals: List[SavingsGoalResponse]


def format_messages_with_images(messages_list: list) -> list:
    """
    Format messages for HyperClovaX API, supporting text and images.
    Converts messages from ChatRequest format to HyperClovaX API format.
    
    HyperClovaX API expects messages like:
    {
        "role": "user",
        "content": [
            {"type": "text", "text": "..."},
            {"type": "image_url", "dataUri": {"data": "data:image/png;base64,..."}}
        ]
    }
    """
    formatted_messages = []
    
    for msg in messages_list:
        formatted_msg = {"role": msg.get("role", "user")}
        content_list = []
        
        # Add text content
        text_content = msg.get("content") or msg.get("text")
        if text_content:
            content_list.append({
                "type": "text",
                "text": text_content
            })
        
        # Add image content if present
        image_data = msg.get("image_data") or msg.get("image_url")
        if image_data:
            # Ensure the image data is in the correct format
            if not image_data.startswith("data:"):
                image_data = f"data:image/png;base64,{image_data}"
            
            content_list.append({
                "type": "image_url",
                "image_url": {
                    "url": image_data
                }
            })
        
        # Set content as list if we have content, otherwise use empty list
        formatted_msg["content"] = content_list if content_list else [{"type": "text", "text": ""}]
        formatted_messages.append(formatted_msg)
    
    return formatted_messages

# --- Streaming Generator Function ---
async def stream_generator(messages_list: list):
    """
    This is a generator function that yields data chunks from the AI service.
    Supports both text and image content in messages.
    """
    try:
        # Format messages to include images if present
        formatted_messages = format_messages_with_images(messages_list)
        
        print(f"📨 Sending {len(formatted_messages)} formatted messages to HyperClovaX")
        
        # Request a streaming response from the OpenAI-compatible API
        stream = client.chat.completions.create(
            model="HCX-005",
            messages=formatted_messages,
            top_p=0.7,
            temperature=0.5,
            max_tokens=500,  # Limit response tokens
            stream=True,  # <-- THIS IS THE KEY CHANGE
        )

        # Iterate through the chunks in the stream
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content is not None:
                # Yield the content in Server-Sent Event (SSE) format
                yield f"data: {content}\n\n"
                await asyncio.sleep(0.01) # Small delay to ensure chunks are sent timely

    except Exception as e:
        print(f"An error occurred during streaming: {e}")
        # Yield an error message in SSE format
        yield f"data: [ERROR] Sorry, an internal error occurred.\n\n"


async def stream_scam_check(user_input: str):
    """
    Stream scam check verdict and explanation using RAG context.
    """
    try:
        print(f"🔍 Scam Check with RAG: {user_input[:100]}")
        
        # Load the scam check prompt
        prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "scamcheck.txt")
        if not os.path.exists(prompt_path):
            yield f"data: Error: Scam check prompt file not found\n\n"
            return
        
        with open(prompt_path, 'r', encoding='utf-8') as f:
            system_prompt = f.read()
        
        # Retrieve relevant knowledge base context using RAG
        rag_context = ""
        if rag_db:
            try:
                print(f"📚 Retrieving knowledge base context...")
                search_results = await rag_db.search(user_input, top_k=3)
                
                if search_results:
                    rag_context = "\n\nKNOWLEDGE BASE CONTEXT:\n"
                    for i, result in enumerate(search_results, 1):
                        rag_context += f"\n{i}. Source: {result['metadata']['source']}\n"
                        rag_context += f"   Information: {result['metadata']['text'][:400]}\n"
                    
                    print(f"✅ Retrieved {len(search_results)} knowledge base documents")
            except Exception as e:
                print(f"⚠️ Warning: Could not retrieve RAG context: {e}")
        
        # Prepare messages with RAG context
        user_message = user_input + rag_context if rag_context else user_input
        
        messages = [
            {"role": "system", "content": [{"type": "text", "text": system_prompt}]},
            {"role": "user", "content": [{"type": "text", "text": user_message}]}
        ]
        
        # Stream the response
        stream = client.chat.completions.create(
            model="HCX-005",
            messages=messages,
            top_p=0.1,
            temperature=0.1,
            max_tokens=300,  # Limit scam check response tokens for faster processing
            stream=True
        )
        
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content is not None:
                yield f"data: {content}\n\n"
                await asyncio.sleep(0.01)
    
    except Exception as e:
        print(f"❌ Error during scam check stream: {e}")
        yield f"data: [ERROR] {str(e)}\n\n"


# --- Transfer Details Extraction Function ---
async def extract_transfer_details(user_message: str, message_obj: dict = None) -> dict:
    """
    Extract transfer details (account_number, amount, description) from user message and/or images.
    
    Args:
        user_message: The user's input message
        message_obj: Optional full message object that may contain images
    
    Returns:
        dict with keys: account_number, amount, description (or None if not found)
    """
    try:
        print(f"💳 Extracting transfer details from: {user_message[:50]}...")
        
        # Load the transfer extractor prompt
        transfer_prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "transfer_extractor.txt")
        if not os.path.exists(transfer_prompt_path):
            print("⚠️ Transfer extractor prompt not found")
            return {"account_number": None, "amount": None, "description": None}
        
        with open(transfer_prompt_path, 'r', encoding='utf-8') as f:
            transfer_prompt = f.read()
        
        # Prepare user message content with image if present
        user_msg_content = [{"type": "text", "text": user_message}]
        
        if message_obj and (message_obj.get("image_data") or message_obj.get("image_url")):
            image_data = message_obj.get("image_data") or message_obj.get("image_url")
            if not image_data.startswith("data:"):
                image_data = f"data:image/png;base64,{image_data}"
            
            user_msg_content.append({
                "type": "image_url",
                "image_url": {
                    "url": image_data
                }
            })
        
        # Call the API for transfer details extraction
        response = client.chat.completions.create(
            model="HCX-005",
            messages=[
                {"role": "system", "content": [{"type": "text", "text": transfer_prompt}]},
                {"role": "user", "content": user_msg_content}
            ],
            top_p=0.1,
            temperature=0.1,
            max_tokens=200,  # Limit tokens for structured extraction
            stream=False
        )
        
        response_text = response.choices[0].message.content.strip()
        
        # Try to parse JSON response
        try:
            import json
            # Extract JSON from response using regex
            clean_json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if clean_json_match:
                clean_json = clean_json_match.group()
                transfer_data = json.loads(clean_json)
                print(f"✅ Transfer details extracted: {transfer_data}")
                return transfer_data
            else:
                print(f"⚠️ No JSON found in response: {response_text}")
                return {"account_number": None, "amount": None, "description": None}
        except json.JSONDecodeError as e:
            print(f"⚠️ Could not parse transfer details JSON: {response_text} - Error: {e}")
            return {"account_number": None, "amount": None, "description": None}
    
    except Exception as e:
        print(f"⚠️ Error extracting transfer details: {e}")
        return {"account_number": None, "amount": None, "description": None}


async def stream_transfer_notification(user_message: str, transfer_details: dict):
    """
    Stream a response notifying the user that the chatbot will switch to the transaction page
    and include transfer details for auto-filling.
    
    Args:
        user_message: The original user message
        transfer_details: Extracted transfer details (account_number, amount, description)
    
    Yields:
        SSE formatted response with transfer data
    """
    try:
        # Extract transfer details (keep None if not found, don't convert to 'N/A')
        account_number = transfer_details.get('account_number')
        amount = transfer_details.get('amount')
        description = transfer_details.get('description')
        
        # Format display message
        display_account = account_number or 'Not specified'
        display_amount = amount or 'Not specified'
        display_description = description or 'Not specified'
        
        notification = (
            f"I'll help you with that transfer! 🏦\n\n"
            f"Transfer Details:\n"
            f"• Account: {display_account}\n"
            f"• Amount: {display_amount}\n"
            f"• Description: {display_description}\n\n"
            f"Switching you to the transaction page now..."
        )
        
        # Stream the notification with transfer data embedded
        yield f"data: {notification}\n\n"
        
        # Send a special message with transfer data that the frontend can parse
        # Convert amount to int if it's a string
        if isinstance(amount, str):
            try:
                amount = int(amount)
            except (ValueError, TypeError):
                amount = None
        
        transfer_data = json.dumps({
            "type": "TRANSFER_INTENT",
            "account_number": account_number,
            "amount": amount,
            "description": description
        })
        print(f"📤 Sending transfer data: {transfer_data}")
        yield f"data: <<<TRANSFER_DATA>>>{transfer_data}<<<END_TRANSFER_DATA>>>\n\n"
        
    except Exception as e:
        print(f"❌ Error in stream_transfer_notification: {e}")
        yield f"data: [ERROR] Failed to process transfer: {str(e)}\n\n"


# --- Intent Detection Function ---
async def detect_intent(user_message: str, message_obj: dict = None) -> str:
    """
    Detect the user's intent: "Scam Check", "Transfer", or "Normal"
    
    Args:
        user_message: The user's input message
        message_obj: Optional full message object that may contain images
    
    Returns:
        "Scam Check", "Transfer", or "Normal"
    """
    try:
        print(f"🧠 Detecting intent for: {user_message[:50]}...")
        
        # Load the intent detection prompt
        intent_prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "intent.txt")
        if not os.path.exists(intent_prompt_path):
            print("⚠️ Intent prompt not found, defaulting to Normal")
            return "Normal"
        
        with open(intent_prompt_path, 'r', encoding='utf-8') as f:
            intent_prompt = f.read()
        
        # Prepare user message with image if present
        user_msg_content = [{"type": "text", "text": user_message}]
        
        if message_obj and (message_obj.get("image_data") or message_obj.get("image_url")):
            image_data = message_obj.get("image_data") or message_obj.get("image_url")
            if not image_data.startswith("data:"):
                image_data = f"data:image/png;base64,{image_data}"
            
            user_msg_content.append({
                "type": "image_url",
                "image_url": {
                    "url": image_data
                }
            })
        
        # Call the API for intent detection
        response = client.chat.completions.create(
            model="HCX-005",
            messages=[
                {"role": "system", "content": [{"type": "text", "text": intent_prompt}]},
                {"role": "user", "content": user_msg_content}
            ],
            top_p=0.1,
            temperature=0.1,
            max_tokens=100,  # Limit tokens for intent classification
            stream=False
        )
        
        intent = response.choices[0].message.content.strip()
        
        # Normalize the intent response
        if "Scam Check" in intent or "SCAM_CHECKING" in intent:
            print(f"✅ Intent detected: Scam Check")
            return "Scam Check"
        elif "Transfer" in intent or "TRANSFER" in intent:
            print(f"✅ Intent detected: Transfer")
            return "Transfer"
        else:
            print(f"✅ Intent detected: Normal")
            return "Normal"
    
    except Exception as e:
        print(f"⚠️ Error detecting intent: {e}, defaulting to Normal")
        return "Normal"
    
async def call_clova_ocr_api(image_data: bytes, filename: str) -> dict:
    """
    Calls the Clova OCR API to extract text from an image.
    """
    if not CLOVA_OCR_API_URL or not CLOVA_OCR_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Clova OCR API URL or Secret Key not configured. Please check your .env file."
        )

    request_uuid = str(uuid.uuid4())
    timestamp = int(round(time.time() * 1000))

    headers = {
        "X-OCR-SECRET": CLOVA_OCR_SECRET_KEY,
        "Content-Type": "application/json"
    }

    image_base64 = base64.b64encode(image_data).decode('utf-8')

    # Try to infer image format from filename
    file_extension = filename.split('.')[-1].lower() if '.' in filename else 'jpg'
    # Clova OCR typically supports jpg, png, pdf, tiff
    supported_formats = ['jpg', 'jpeg', 'png', 'pdf', 'tiff', 'tif']
    if file_extension not in supported_formats:
        # Default to jpg if unknown or unsupported
        file_extension = 'jpg'

    payload = {
        "images": [
            {
                "format": file_extension,
                "name": filename,
                "data": image_base64
            }
        ],
        "requestId": request_uuid,
        "version": "V2",
        "timestamp": timestamp
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client: # Increased timeout for OCR
            response = await client.post(CLOVA_OCR_API_URL, headers=headers, json=payload)
            response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
            return response.json()
    except httpx.HTTPStatusError as e:
        print(f"Clova OCR API HTTP error: {e.response.status_code} - {e.response.text}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Clova OCR API error: {e.response.text}"
        )
    except httpx.RequestError as e:
        print(f"Clova OCR API request error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not connect to Clova OCR API: {e}"
        )
    except Exception as e:
        print(f"Error calling Clova OCR API: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error during OCR: {e}"
        )

async def call_clova_speech_api(audio_data: bytes) -> dict:
    if not CLOVA_SPEECH_INVOKE_URL or not CLOVA_SPEECH_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Chưa cấu hình CLOVA_SPEECH_INVOKE_URL hoặc CLOVA_SPEECH_SECRET_KEY trong file .env"
        )

    headers = {
        "Content-Type": "application/octet-stream",
        "X-CLOVASPEECH-API-KEY": CLOVA_SPEECH_SECRET_KEY
    }
    params = {"lang": "Eng"} 

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(CLOVA_SPEECH_INVOKE_URL, headers=headers, params=params, data=audio_data)
            response.raise_for_status() 
            return response.json()
    except httpx.HTTPStatusError as e:
        print(f"Lỗi HTTP từ Clova Speech API: {e.response.status_code} - {e.response.text}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Lỗi từ Clova Speech API: {e.response.text}"
        )
    except Exception as e:
        print(f"Lỗi khi gọi Clova Speech API: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi server nội bộ khi nhận dạng giọng nói: {e}"
        )

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Main chat endpoint with intelligent routing:
    1. Detects user intent (Scam Check vs Transfer vs Normal)
    2. If Scam Check: Uses RAG-augmented scam detection with streaming
    3. If Transfer: Extracts transfer details and notifies user
    4. If Normal: Routes to regular chat
    
    Supports both text and image content in messages.
    Images should be base64 encoded or URLs.
    """
    message_dicts = [msg.model_dump() for msg in request.messages]
    
    last_user_message = None
    last_user_message_obj = None
    for msg in reversed(message_dicts):
        if msg['role'] == 'user':
            last_user_message = msg.get('content') or msg.get('text', '')
            last_user_message_obj = msg
            break
    
    if not last_user_message:
        message_dicts.insert(0, {"role": "system", "content": "You're a skilled and helpful AI assistant named Sentinel."})
        return StreamingResponse(stream_generator(message_dicts), media_type="text/event-stream")
    
    # Detect intent (pass both text and message object for image support)
    intent = await detect_intent(last_user_message, last_user_message_obj)
    
    # Route based on intent
    if intent == "Scam Check":
        print("🔍 Routing to Scam Check with RAG...")
        return StreamingResponse(stream_scam_check(last_user_message), media_type="text/event-stream")
    elif intent == "Transfer":
        print("💳 Routing to Transfer Flow...")
        # Extract transfer details (pass image if present)
        transfer_details = await extract_transfer_details(last_user_message, last_user_message_obj)
        return StreamingResponse(stream_transfer_notification(last_user_message, transfer_details), media_type="text/event-stream")
    elif intent == "TopUp":
        print("💰 Routing to Phone TopUp Flow (Defaulting to Normal Chat for now)...")
        pass 
    else:
        print("💬 Routing to Normal Chat...")
        # Regular chat
        if not any(m['role'] == 'system' for m in message_dicts):
            message_dicts.insert(0, {"role": "system", "content": "You're a skilled and helpful AI assistant named Sentinel."})
        
        return StreamingResponse(stream_generator(message_dicts), media_type="text/event-stream")


@app.post("/api/embeddings", response_model=EmbeddingResponse)
async def embeddings_endpoint(request: EmbeddingRequest):
    """
    Generate embeddings for the provided text using HyperClovaX API.
    
    Args:
        text: The text to generate embeddings for
        model: The model to use (default: bge-m3)
    
    Returns:
        EmbeddingResponse with the embedding vector
    """
    try:
        print(f"Generating embeddings for text: {request.text[:50]}...")
        
        response = client.embeddings.create(
            model=request.model,
            input=request.text,
            encoding_format="float"  
        )
        
        embedding = response.data[0].embedding
        
        print(f"✅ Embeddings generated successfully. Dimension: {len(embedding)}")
        
        return EmbeddingResponse(
            success=True,
            embedding=embedding
        )
    
    except Exception as e:
        print(f"❌ Error generating embeddings: {e}")
        return EmbeddingResponse(
            success=False,
            error=str(e)
        )


@app.post("/api/scam-check", response_model=ScamCheckResponse)
async def scam_check_endpoint(request: ScamCheckRequest):
    """
    Analyze input to determine if it describes a scam using RAG.
    
    Args:
        input: The text/scenario to check for scam indicators
    
    Returns:
        ScamCheckResponse with verdict: "This is a scam" or "This is not a scam"
    """
    try:
        print(f"🔍 Scam Check: {request.input[:100]}")
        
        # Load the scam check prompt
        prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "scamcheck.txt")
        if not os.path.exists(prompt_path):
            return ScamCheckResponse(
                success=False,
                error="Scam check prompt file not found"
            )
        
        with open(prompt_path, 'r', encoding='utf-8') as f:
            system_prompt = f.read()
        
        rag_context = ""
        if rag_db:
            try:
                print(f"📚 Retrieving knowledge base context...")
                search_results = await rag_db.search(request.input, top_k=3)
                
                if search_results:
                    rag_context = "\n\nKNOWLEDGE BASE CONTEXT:\n"
                    for i, result in enumerate(search_results, 1):
                        rag_context += f"\n{i}. Source: {result['metadata']['source']}\n"
                        rag_context += f"   Information: {result['metadata']['text'][:400]}\n"
                    
                    print(f"✅ Retrieved {len(search_results)} knowledge base documents")
            except Exception as e:
                print(f"⚠️ Warning: Could not retrieve RAG context: {e}")
        
        user_message = request.input + rag_context if rag_context else request.input
        
        messages = [
            {"role": "system", "content": [{"type": "text", "text": system_prompt}]},
            {"role": "user", "content": [{"type": "text", "text": user_message}]}
        ]
        
        response = client.chat.completions.create(
            model="HCX-005",
            messages=messages,
            top_p=0.1,  # Lower temperature for more deterministic results
            temperature=0.1,
            stream=False  # Non-streaming for faster response
        )
        
        # Extract the verdict
        verdict = response.choices[0].message.content.strip()
        
        # Validate the verdict
        if "This is a scam" in verdict or "This is not a scam" in verdict:
            
            return ScamCheckResponse(
                success=True,
                verdict=verdict
            )
        else:
            print(f"⚠️ Unexpected verdict format: {verdict}")
            return ScamCheckResponse(
                success=True,
                verdict=verdict  
            )
    
    except Exception as e:
        print(f"❌ Error during scam check: {e}")
        return ScamCheckResponse(
            success=False,
            error=str(e)
        )
@app.post("/api/safety-check", response_model=SafetyCheckResponse)
async def safety_check_endpoint(
    request: SafetyCheckRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Safety check for a transaction using Random Forest ML model.
    Returns: { "is_safe": bool, "message": str }
    """
    if load_model_pt is None:
        raise HTTPException(status_code=503, detail="ML fraud detection service is unavailable. Model loading failed.")
    
    try:
        # Validate sender account
        sender_account = db.query(BankAccount).filter(
            BankAccount.id == request.sender_account_id,
            BankAccount.user_id == current_user.id
        ).first()
        
        if not sender_account:
            raise HTTPException(status_code=403, detail="Invalid sender account")
        
        # Get cached model and feature columns
        model = get_fraud_detection_model()
        if model is None:
            raise HTTPException(status_code=503, detail="ML model failed to load")
        
        feature_columns_list = get_feature_columns()
        if feature_columns_list is None:
            raise HTTPException(status_code=503, detail="Feature columns loading failed")
        
        # Check if destination account's user is flagged for fraud checking
        is_fraud_flagged = False
        if request.receiver_account_number:
            print(f"Checking fraud status for receiver account: {request.receiver_account_number}")
            receiver_account = db.query(BankAccount).filter(
                BankAccount.account_number == request.receiver_account_number
            ).first()
            
            if receiver_account:
                receiver_user = db.query(User).filter(User.id == receiver_account.user_id).first()
                if receiver_user:
                    is_fraud_flagged = receiver_user.fraud_checking
        
        # Prepare features for ML model prediction
        features = {
            "step": 1,
            "type": 0,  # Transfer type
            "amount": float(request.amount),
            "oldbalanceOrg": float(sender_account.balance),
            "newbalanceOrig": max(0.0, float(sender_account.balance) - float(request.amount)),
            "oldbalanceDest": 0.0,
            "newbalanceDest": float(request.amount),
            "isfraud": 1 if is_fraud_flagged else 0  # Pass isfraud flag: 1 if destination user is fraud flagged
        }
        
        result = predict(model, features, feature_columns=feature_columns_list)
        
        # isFraud: 0 = safe, 1 = fraud
        is_safe = result['isFraud'] == 0
        probability = result['probability'] or 0.0
        
        # Add note if destination account is fraud flagged
        fraud_flag_note = " (⚠️ Destination account flagged for fraud checking)" if is_fraud_flagged else ""
        message = f"Transaction {'is safe' if is_safe else 'may be fraudulent'} (confidence: {probability:.2%}){fraud_flag_note}"
        
        print(f"✅ Safety check for account {request.sender_account_id} → {request.receiver_account_number}: is_safe={is_safe}, probability={probability:.4f}, dest_isfraud={1 if is_fraud_flagged else 0}")
        
        return SafetyCheckResponse(
            is_safe=is_safe,
            message=message
        )
    except HTTPException:
        raise
    except ValueError as e:
        print(f"❌ ValueError in safety check: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Error in safety check: {e}")
        raise HTTPException(status_code=500, detail=f"Safety check failed: {str(e)}")


@app.post("/api/safety/predict", response_model=SafetyPredictResponse)
async def safety_predict_endpoint(request: SafetyPredictRequest):
    """
    Predict safety/fraud using the trained random forest model.
    Request: { "features": { ... } }
    Response: { "isFraud": 0|1, "probability": float }
    """
    if load_model_pt is None:
        raise HTTPException(status_code=503, detail="ML fraud detection service is unavailable.")
    
    try:
        model = get_fraud_detection_model()
        if model is None:
            raise HTTPException(status_code=503, detail="ML model failed to load")
        
        feature_columns_list = get_feature_columns()
        result = predict(model, request.features, feature_columns=feature_columns_list)
        return SafetyPredictResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")

        
@app.post("/api/search", response_model=SearchResponse)
async def search_endpoint(request: SearchRequest):
    """
    Search for similar documents in the Milvus RAG database.
    
    Args:
        query: The search query
        top_k: Number of top results to return (default: 5)
    
    Returns:
        SearchResponse with matching documents
    """
    if rag_db is None:
        return SearchResponse(
            success=False,
            error="Milvus RAG Database is not initialized"
        )
    
    try:
        print(f"🔍 Searching for: {request.query[:100]}")
        
        # Search in Milvus database
        search_results = await rag_db.search(request.query, top_k=request.top_k)
        
        # Format results for the response
        formatted_results = []
        for result in search_results:
            formatted_results.append(
                SearchResultItem(
                    id=result["id"],
                    distance=result["distance"],
                    source=result["metadata"]["source"],
                    text=result["metadata"]["text"]
                )
            )
        
        print(f"✅ Search completed. Found {len(formatted_results)} results")
        
        return SearchResponse(
            success=True,
            results=formatted_results
        )
    
    except Exception as e:
        print(f"❌ Error during search: {e}")
        return SearchResponse(
            success=False,
            error=str(e)
        )

@app.post("/api/ocr-and-scam-check", response_model=OcrScamCheckResponse)
async def ocr_and_scam_check_endpoint(
    image: UploadFile = File(...),
    db: Session = Depends(get_db) # You might need `db` for logging or other operations later
):
    """
    Upload an image, perform OCR to extract text, and then run a scam check on the extracted text.
    """
    print(f"🔄 Received image for OCR and scam check: {image.filename}")

    if not image.filename:
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No image file provided or filename missing."
        )

    try:
        image_data = await image.read()
        
        # 1. Perform OCR
        ocr_raw_response = await call_clova_ocr_api(image_data, image.filename)
        
        full_text = []
        for image_result in ocr_raw_response.get("images", []):
            # Check if the inference was successful for the image
            if image_result.get("inferResult") == "SUCCESS":
                for field in image_result.get("fields", []):
                    full_text.append(field.get("inferText", ""))
            else:
                print(f"⚠️ OCR inference failed for an image in the batch: {image_result.get('message', 'No message')}")
        
        extracted_text = " ".join(full_text).strip()
        print(f"✅ OCR extracted text (first 200 chars): {extracted_text[:200]}...")

        if not extracted_text:
            return OcrScamCheckResponse(
                success=False,
                error="No discernible text found in the image by OCR."
            )

        # 2. Perform Scam Check on extracted text
        # Reuse the existing scam check logic/function by calling it
        scam_check_request = ScamCheckRequest(input=extracted_text)
        scam_check_response = await scam_check_endpoint(scam_check_request) # Call the existing endpoint logic

        if scam_check_response.success:
            print(f"✅ Scam check verdict on OCR text: {scam_check_response.verdict}")
            return OcrScamCheckResponse(
                success=True,
                ocr_full_text=extracted_text,
                scam_verdict=scam_check_response.verdict
            )
        else:
            return OcrScamCheckResponse(
                success=False,
                ocr_full_text=extracted_text,
                error=f"Scam check failed after OCR: {scam_check_response.error}"
            )

    except HTTPException as e:
        print(f"❌ OCR/Scam Check HTTP Error: {e.detail}")
        return OcrScamCheckResponse(
            success=False,
            error=e.detail
        )
    except Exception as e:
        print(f"❌ Unexpected error during OCR/Scam Check: {e}")
        return OcrScamCheckResponse(
            success=False,
            error=f"Internal server error: {e}"
        )

@app.post("/api/process-receipt", response_model=TransactionResponse)
async def process_receipt_endpoint(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a receipt image, perform OCR, use AI to extract financial data,
    and save it as a transaction for the current user.
    """
    print(f"🔄 Received receipt for processing from user {current_user.id}: {image.filename}")

    try:
        image_data = await image.read()
        
        # 1. Perform OCR
        ocr_raw_response = await call_clova_ocr_api(image_data, image.filename)
        
        full_text_list = [
            field.get("inferText", "")
            for image_result in ocr_raw_response.get("images", [])
            if image_result.get("inferResult") == "SUCCESS"
            for field in image_result.get("fields", [])
        ]
        extracted_text = " ".join(full_text_list).strip()
        print(f"✅ OCR extracted text: {extracted_text[:200]}...")

        if not extracted_text:
            raise HTTPException(status_code=400, detail="No text could be extracted from the image.")

        # 2. Use CLOVA Studio to extract information
        prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "receipt_extractor.txt")
        with open(prompt_path, 'r', encoding='utf-8') as f:
            system_prompt = f.read()

        messages = [
            {"role": "system", "content": [{"type": "text", "text": system_prompt}]},
            {"role": "user", "content": [{"type": "text", "text": extracted_text}]}
        ]

        response = client.chat.completions.create(
            model="HCX-005",
            messages=messages,
            temperature=0.1,
            top_p=0.1,
            stream=False,
        )

        ai_response_content = response.choices[0].message.content.strip()
        
        print(f"🤖 AI Extraction Response: {ai_response_content}")

        # 3. Parse JSON and save to database
        try:
            # The model might sometimes add markdown backticks around the JSON
            cleaned_json_str = ai_response_content.strip('` \n').replace("json", "").strip()
            transaction_data = json.loads(cleaned_json_str)
            
            # Validate required fields
            if not all(k in transaction_data for k in ["transaction_type", "amount", "description"]):
                raise ValueError("Missing required fields in AI response.")

            new_transaction = Transaction(
                user_id=current_user.id,
                type=transaction_data["transaction_type"],
                amount=int(transaction_data["amount"]),
                description=transaction_data["description"],
                # Use date from receipt if available, otherwise default to now
                transaction_date=datetime.fromisoformat(transaction_data["transaction_date"]) if transaction_data.get("transaction_date") else datetime.utcnow()
            )
            db.add(new_transaction)
            db.commit()
            db.refresh(new_transaction)

            print(f"✅ Transaction saved successfully with ID: {new_transaction.id}")
            return new_transaction

        except (json.JSONDecodeError, ValueError) as e:
            print(f"❌ Failed to parse AI response or save transaction: {e}")
            raise HTTPException(status_code=500, detail=f"AI returned invalid data: {ai_response_content}")

    except HTTPException as e:
        # Re-raise HTTPExceptions to send proper client errors
        raise e
    except Exception as e:
        print(f"❌ Unexpected error during receipt processing: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# Also, create an endpoint to fetch transactions for the financial management page
@app.get("/api/transactions", response_model=List[TransactionResponse])
async def get_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).order_by(Transaction.transaction_date.desc()).all()
    return transactions


@app.get("/api/recent-recipients")
async def get_recent_recipients(
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get recent transfer recipients for the current user
    Returns unique recipients ordered by most recent transfer
    """
    # Get user's bank accounts
    user_accounts = db.query(BankAccount).filter(
        BankAccount.user_id == current_user.id
    ).all()
    
    if not user_accounts:
        return []
    
    account_ids = [acc.id for acc in user_accounts]
    
    # Get recent transfers from user's accounts
    # Use subquery to get unique recipients with their most recent transfer
    subquery = db.query(
        TransferTransaction.receiver_account_number,
        TransferTransaction.receiver_name,
        TransferTransaction.receiver_bank,
        func.max(TransferTransaction.created_at).label('last_transfer_date')
    ).filter(
        TransferTransaction.sender_account_id.in_(account_ids),
        TransferTransaction.status == 'completed'
    ).group_by(
        TransferTransaction.receiver_account_number,
        TransferTransaction.receiver_name,
        TransferTransaction.receiver_bank
    ).order_by(
        func.max(TransferTransaction.created_at).desc()
    ).limit(limit).subquery()
    
    # Get full transfer details
    recent_recipients = db.query(
        subquery.c.receiver_account_number,
        subquery.c.receiver_name,
        subquery.c.receiver_bank,
        subquery.c.last_transfer_date
    ).all()
    
    return [
        {
            "account_number": r.receiver_account_number,
            "account_name": r.receiver_name,
            "bank": r.receiver_bank,
            "last_transfer": r.last_transfer_date.isoformat() if r.last_transfer_date else None
        }
        for r in recent_recipients
    ]


@app.post("/api/transfer/internal", status_code=status.HTTP_201_CREATED)
async def internal_transfer(
    transfer_data: InternalTransferRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Process internal transfer between VigiPay accounts (REAL MONEY TRANSFER)
    
    This endpoint performs actual money transfer:
    1. Validates sender has sufficient balance
    2. Looks up receiver account in database
    3. Deducts money from sender (including fee if sender pays)
    4. Adds money to receiver (minus fee if receiver pays)
    5. Creates transfer record and transaction history for both parties
    6. Uses database transaction for atomicity (all or nothing)
    
    Args:
        transfer_data: Transfer request with sender_account_id, receiver_account_number, amount, etc.
        
    Returns:
        Transfer confirmation with transaction IDs
        
    Raises:
        403: Sender account doesn't belong to current user
        404: Receiver account not found
        400: Insufficient balance or invalid data
    """
    try:
        # 1. Validate sender account belongs to current user
        sender_account = db.query(BankAccount).filter(
            BankAccount.id == transfer_data.sender_account_id,
            BankAccount.user_id == current_user.id,
            BankAccount.is_active == True
        ).first()
        
        if not sender_account:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sender account not found or unauthorized"
            )
        
        # 2. Look up receiver account by account number
        receiver_account = db.query(BankAccount).filter(
            BankAccount.account_number == transfer_data.receiver_account_number,
            BankAccount.is_active == True
        ).first()
        
        if not receiver_account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Receiver account not found. Please check the account number."
            )
        
        # 3. Prevent self-transfer
        if sender_account.id == receiver_account.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot transfer to the same account"
            )
        
        # 4. Calculate fee
        fee = calculate_transfer_fee(transfer_data.amount)
        
        # 5. Check sufficient balance
        total_deduction = transfer_data.amount + fee if transfer_data.fee_payer == "sender" else transfer_data.amount
        if sender_account.balance < total_deduction:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient balance. Required: {total_deduction:,} VND, Available: {sender_account.balance:,} VND"
            )
        
        # 6. Get receiver user info
        receiver_user = db.query(User).filter(User.id == receiver_account.user_id).first()
        receiver_name = receiver_user.full_name if receiver_user.full_name else receiver_user.username
        
        # 7. BEGIN ATOMIC TRANSACTION
        # Update balances
        sender_account.balance -= total_deduction
        
        amount_to_receiver = transfer_data.amount - fee if transfer_data.fee_payer == "receiver" else transfer_data.amount
        receiver_account.balance += amount_to_receiver
        
        # 8. Create TransferTransaction record
        transfer_transaction = TransferTransaction(
            sender_account_id=sender_account.id,
            receiver_account_number=receiver_account.account_number,
            receiver_bank="vigipay",  # Internal transfer
            receiver_name=receiver_name,
            amount=transfer_data.amount,
            fee=fee,
            fee_payer=transfer_data.fee_payer,
            description=transfer_data.description or "Internal transfer",
            status="completed",
            transaction_date=datetime.now(timezone.utc)
        )
        db.add(transfer_transaction)
        db.flush()  # Get transfer_transaction.id
        
        # 9. Create Transaction records for both sender and receiver
        # Sender transaction (outgoing)
        sender_transaction = Transaction(
            user_id=current_user.id,
            account_id=sender_account.id,
            transfer_id=transfer_transaction.id,
            type="transfer_out",
            amount=-total_deduction,  # Negative for outgoing
            description=f"Transfer to {receiver_name} - {transfer_data.description}",
            transaction_date=datetime.now(timezone.utc)
        )
        db.add(sender_transaction)
        
        # Receiver transaction (incoming)
        receiver_transaction = Transaction(
            user_id=receiver_account.user_id,
            account_id=receiver_account.id,
            transfer_id=transfer_transaction.id,
            type="transfer_in",
            amount=amount_to_receiver,  # Positive for incoming
            description=f"Received from {current_user.full_name or current_user.username} - {transfer_data.description}",
            transaction_date=datetime.now(timezone.utc)
        )
        db.add(receiver_transaction)
        
        # 10. COMMIT all changes atomically
        db.commit()
        db.refresh(transfer_transaction)
        db.refresh(sender_account)
        db.refresh(receiver_account)
        
        return {
            "success": True,
            "message": "Transfer completed successfully",
            "transfer_id": transfer_transaction.id,
            "sender_transaction_id": sender_transaction.id,
            "receiver_transaction_id": receiver_transaction.id,
            "amount_sent": total_deduction,
            "amount_received": amount_to_receiver,
            "fee": fee,
            "sender_new_balance": sender_account.balance,
            "receiver_new_balance": receiver_account.balance,
            "receiver_name": receiver_name
        }
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Internal transfer error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transfer failed: {str(e)}"
        )


# ... imports ...

@app.post("/api/voice-command")
async def voice_command_endpoint(
    # Make audio optional, allow text as Form data
    audio: UploadFile = File(None),
    text: str = Form(None), 
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    username = current_user.username if current_user else "anonymous"
    print(f"🎤 Voice command received from: {username}")
    
    transcribed_text = ""

    # 1. Input Processing
    if text:
        transcribed_text = text
    elif audio:
        # print("🔈 Processing audio file via Clova Speech...")
        audio_data = await audio.read()
        try:
            speech_result = await call_clova_speech_api(audio_data)
            transcribed_text = speech_result.get("text")
        except Exception as e:
            raise HTTPException(status_code=500, detail="Error processing speech.")
    else:
        raise HTTPException(status_code=400, detail="No voice or text data received.")

    if not transcribed_text:
         raise HTTPException(status_code=400, detail="Could not recognize voice.")

    # 2. Load Prompt from File (Original Method)
    try:
        prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "voice_nlu.txt")
        if not os.path.exists(prompt_path):
            # Fallback only if file is missing
            nlu_system_prompt = "You are a banking assistant. Return JSON with intent (transfer_money, phone_topup, check_scam) and entities."
        else:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                nlu_system_prompt = f.read()
        
        messages = [
            {"role": "system", "content": [{"type": "text", "text": nlu_system_prompt}]},
            {"role": "user", "content": [{"type": "text", "text": transcribed_text}]}
        ]

        # Call AI
        response = client.chat.completions.create(
            model="HCX-005",
            messages=messages,
            temperature=0.1,
            top_p=0.1,
            stream=False,
        )
        ai_response_content = response.choices[0].message.content.strip()
        
        # Parse JSON
        cleaned_json_str = ai_response_content
        if "```json" in ai_response_content:
            cleaned_json_str = ai_response_content.split("```json")[1].split("```")[0]
        elif "```" in ai_response_content:
            cleaned_json_str = ai_response_content.split("```")[1].split("```")[0]
            
        cleaned_json_str = cleaned_json_str.strip()
        
        parsed_json = {}
        try:
            parsed_json = json.loads(cleaned_json_str)
        except:
            parsed_json = {"intent": "general_chat"}

        # Inject transcript
        parsed_json["transcript"] = transcribed_text

        # 3. Handle Intents
        intent = parsed_json.get("intent")
        
        # --- NEW LOGIC FOR SCAM CHECK ---
        if intent == "check_scam":
            print(f"🕵️ Voice Scam Check detected. Content: {parsed_json.get('content', '')}")
            
            # Determine input for scam check (use extracted content or full transcript)
            scam_input = parsed_json.get("content") or transcribed_text
            
            # Call the existing logic directly
            scam_request = ScamCheckRequest(input=scam_input)
            scam_result = await scam_check_endpoint(scam_request)
            
            # Add result to response
            parsed_json["scam_check_result"] = {
                "success": scam_result.success,
                "verdict": scam_result.verdict,
                "error": scam_result.error
            }
            return parsed_json
        # --------------------------------
        
        elif intent in ['transfer_money', 'phone_topup']:
            return parsed_json
            
        else:
            # General Chat Fallback
            print("💬 General Chat fallback...")
            chat_messages = [
                {"role": "system", "content": [{"type": "text", "text": "You are Sentinel, a helpful AI banking assistant."}]},
                {"role": "user", "content": [{"type": "text", "text": transcribed_text}]}
            ]
            
            chat_response = client.chat.completions.create(
                model="HCX-005",
                messages=chat_messages,
                temperature=0.5,
                max_tokens=300
            )
            
            reply_text = chat_response.choices[0].message.content.strip()
            
            return {
                "intent": "general_chat",
                "transcript": transcribed_text,
                "reply": reply_text
            }

    except Exception as e:
        print(f"❌ Voice API Error: {e}")
        return {
            "intent": "general_chat",
            "transcript": transcribed_text,
            "reply": "I heard you, but I encountered an error processing the request."
        }

# --- RAG-Augmented Chat Endpoint ---
@app.post("/api/chat-with-rag")
async def chat_with_rag_endpoint(request: ChatRequest):
    """
    Chat endpoint that augments responses with context from Milvus RAG database.
    Searches for relevant documents and includes them in the system context.
    Supports image inputs - performs OCR on images and uses extracted text as prompt.
    
    Args:
        messages: List of chat messages (can include text and/or base64 images)
    
    Returns:
        StreamingResponse with AI response augmented by RAG
    """
    message_dicts = [msg.model_dump() for msg in request.messages]
    
    # Extract the last user message for RAG search
    last_user_message = None
    last_user_message_obj = None
    for msg in reversed(message_dicts):
        if msg["role"] == "user":
            last_user_message = msg.get("content")
            last_user_message_obj = msg
            break
    
    # If image is present, perform OCR and use extracted text as prompt
    if last_user_message_obj and (last_user_message_obj.get("image_data") or last_user_message_obj.get("image_url")):
        print(f"🖼️ Image detected in /api/chat-with-rag, performing OCR...")
        try:
            # Extract image data
            image_data = last_user_message_obj.get("image_data") or last_user_message_obj.get("image_url")
            
            # If it's a data URI format, extract the base64 part
            if isinstance(image_data, str) and image_data.startswith("data:"):
                # Format: "data:image/png;base64,<base64_data>"
                base64_part = image_data.split(",", 1)[1]
                image_bytes = base64.b64decode(base64_part)
            else:
                # Assume it's already base64 encoded
                image_bytes = base64.b64decode(image_data)
            
            # Call Clova OCR API
            ocr_result = await call_clova_ocr_api(image_bytes, "image.png")
            
            if ocr_result and ocr_result.get("success"):
                # Extract full text from OCR result
                ocr_text = ocr_result.get("full_text", "")
                
                if ocr_text:
                    print(f"✅ OCR extracted text: {ocr_text[:100]}...")
                    # Use OCR text as the prompt, combine with any existing text
                    last_user_message = (last_user_message + " " + ocr_text).strip() if last_user_message else ocr_text
                    # Update the message content to only text (remove image)
                    last_user_message_obj["content"] = last_user_message
                    last_user_message_obj.pop("image_data", None)
                    last_user_message_obj.pop("image_url", None)
                else:
                    print(f"⚠️ OCR returned empty text")
            else:
                print(f"⚠️ OCR failed: {ocr_result.get('error') if ocr_result else 'No response'}")
        
        except Exception as e:
            print(f"⚠️ Error during OCR: {e}")
            # Continue with original message if OCR fails
    
    # Build augmented system message with RAG context
    system_content = (
        "You are Sentinel, a banking security assistant specializing in scam/fraud detection and prevention.\n"
        "Use the user's message (and any OCR/image-derived text) together with the knowledge base context provided below to assess scam risk.\n"
        "Be conservative and prioritize user safety."
    )
    
    if rag_db and last_user_message:
        try:
            # Search for relevant documents using the text prompt (or OCR-extracted text)
            search_results = await rag_db.search(last_user_message, top_k=3)
            
            if search_results:
                # Build context from search results
                context = "Relevant information from knowledge base:\n\n"
                for i, result in enumerate(search_results, 1):
                    context += f"{i}. Source: {result['metadata']['source']}\n"
                    context += f"   Content: {result['metadata']['text'][:300]}...\n\n"
                
                system_content += "\n\n" + context
                print(f"✅ RAG Context added: {len(search_results)} documents retrieved")
        except Exception as e:
            print(f"⚠️ Warning: Could not retrieve RAG context: {e}")
    
    # Update system message
    if not any(m['role'] == 'system' for m in message_dicts):
        message_dicts.insert(0, {"role": "system", "content": system_content})
    else:
        # Update existing system message
        for msg in message_dicts:
            if msg['role'] == 'system':
                msg['content'] = system_content
                break
    
    # Return a StreamingResponse that uses our generator (text-only messages)
    return StreamingResponse(stream_generator(message_dicts), media_type="text/event-stream")



@app.get("/")
def read_root():
    return {
        "status": "Naver Bank API is running",
        "version": "1.0.0",
        "services": ["authentication", "chat", "rag", "scam-detection", "ocr"]
    }


# ==================== AUTHENTICATION ENDPOINTS ====================

@app.post("/api/auth/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user account
    """
    existing_user = db.query(User).filter(User.username == user_data.username.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
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
    
    try:
        account_number = generate_account_number(db)
        default_account = BankAccount(
            user_id=new_user.id,
            account_number=account_number,
            account_type="main",
            balance=20000000,  
            currency="VND",
            is_active=True
        )
        db.add(default_account)
        db.commit()
        db.refresh(default_account)
        print(f"✅ Created default bank account {account_number} for user {new_user.username} with 500,000 VND")
    except Exception as e:
        print(f"⚠️ Warning: Failed to create default bank account: {e}")
        db.rollback()
    
    token_data = {
        "sub": str(new_user.id),
        "username": new_user.username,
        "email": new_user.email
    }
    access_token = create_access_token(token_data)
    refresh_token_str = create_refresh_token({"sub": str(new_user.id)})
    
    refresh_token_obj = RefreshToken(
        user_id=new_user.id,
        token=refresh_token_str,
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(refresh_token_obj)
    db.commit()
    
    return LoginResponse(
        user=UserResponse.model_validate(new_user),
        access_token=access_token,
        refresh_token=refresh_token_str,
        token_type="bearer"
    )


@app.post("/api/auth/login", response_model=LoginResponse)
async def login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Login with username/email and password (OAuth2 compatible form)
    """
    user = db.query(User).filter(
        (User.username == username.lower()) | 
        (User.email == username)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    if not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    token_data = {
        "sub": str(user.id),
        "username": user.username,
        "email": user.email
    }
    access_token = create_access_token(token_data)
    refresh_token_str = create_refresh_token({"sub": str(user.id)})
    
    refresh_token_obj = RefreshToken(
        user_id=user.id,
        token=refresh_token_str,
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(refresh_token_obj)
    db.commit()
    
    return LoginResponse(
        user=UserResponse.model_validate(user),
        access_token=access_token,
        refresh_token=refresh_token_str,
        token_type="bearer"
    )


@app.post("/api/auth/logout", response_model=MessageResponse)
async def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Logout current user (invalidate tokens)
    """
    # Delete all refresh tokens for this user
    db.query(RefreshToken).filter(RefreshToken.user_id == current_user.id).delete()
    db.commit()
    
    return MessageResponse(
        message="Successfully logged out",
        success=True
    )


@app.post("/api/auth/refresh", response_model=Token)
async def refresh_access_token(
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token
    """
    # Verify refresh token
    payload = verify_token(refresh_data.refresh_token, "refresh")
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload"
        )
    
    user_id = int(user_id_str)
    
    refresh_token_obj = db.query(RefreshToken).filter(
        RefreshToken.token == refresh_data.refresh_token,
        RefreshToken.user_id == user_id
    ).first()
    
    if not refresh_token_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found or revoked"
        )
    
    now = datetime.now(timezone.utc) if refresh_token_obj.expires_at.tzinfo else datetime.utcnow()
    if refresh_token_obj.expires_at < now:
        db.delete(refresh_token_obj)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    new_token_data = {
        "sub": str(user.id),
        "username": user.username,
        "email": user.email
    }
    new_access_token = create_access_token(new_token_data)
    
    return Token(
        access_token=new_access_token,
        refresh_token=refresh_data.refresh_token,
        token_type="bearer"
    )


@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information
    """
    return UserResponse.model_validate(current_user)


@app.get("/api/auth/health")
async def auth_health_check():
    """Auth service health check"""
    return {
        "status": "healthy",
        "service": "authentication",
        "secret_key_loaded": SECRET_KEY is not None and len(SECRET_KEY) > 20,
        "secret_key_preview": SECRET_KEY[:10] + "..." if SECRET_KEY else "NOT SET"
    }


@app.post("/api/auth/debug-token")
async def debug_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Debug endpoint to test token parsing"""
    token = credentials.credentials
    print(f"🔍 Debug: SECRET_KEY = '{SECRET_KEY[:20]}...'")
    print(f"🔍 Debug: Token = '{token[:50]}...'")
    try:
        payload = verify_token(token, "access")
        if payload:
            return {"status": "valid", "payload": payload}
        else:
            import base64
            import json
            payload_part = token.split('.')[1]
            padding = 4 - len(payload_part) % 4
            if padding != 4:
                payload_part += '=' * padding
            decoded_payload = json.loads(base64.b64decode(payload_part))
            
            try:
                manual_decode = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                return {"status": "manual_decode_success", "payload": manual_decode}
            except Exception as e2:
                return {"status": "invalid", "error": "verify_token returned None", "decode_error": str(e2), "payload_preview": decoded_payload}
    except Exception as e:
        return {"status": "error", "error": str(e)}



@app.get("/api/accounts", response_model=List[BankAccountResponse])
async def get_user_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all bank accounts for the authenticated user
    
    Returns:
        List of user's bank accounts ordered by creation date
    """
    accounts = db.query(BankAccount).filter(
        BankAccount.user_id == current_user.id,
        BankAccount.is_active == True
    ).order_by(BankAccount.created_at.asc()).all()
    
    return accounts


@app.get("/api/accounts/{account_id}", response_model=BankAccountResponse)
async def get_account_by_id(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get specific bank account by ID
    
    Args:
        account_id: Bank account ID
        
    Returns:
        Bank account details
        
    Raises:
        404: Account not found
        403: Unauthorized access to account
    """
    account = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    # Verify account belongs to current user
    if account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized access to this account"
        )
    
    return account


@app.get("/api/bank-accounts/lookup/{account_number}")
async def lookup_account_by_number(
    account_number: str,
    db: Session = Depends(get_db)
):
    """
    Lookup bank account by account number and return owner information
    
    This endpoint is public (no authentication required) to allow users
    to verify recipient account before making a transfer.
    
    Args:
        account_number: The bank account number to lookup
        
    Returns:
        Account owner information if found
        
    Raises:
        404: Account not found
    """
    account = db.query(BankAccount).filter(
        BankAccount.account_number == account_number,
        BankAccount.is_active == True
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found. Please check the account number."
        )
    
    # Get user information
    user = db.query(User).filter(User.id == account.user_id).first()
    
    return {
        "exists": True,
        "account_number": account.account_number,
        "account_holder_name": user.full_name if user.full_name else user.username,
        "account_type": account.account_type
    }


@app.post("/api/accounts", response_model=BankAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_bank_account(
    account_data: BankAccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new bank account for the authenticated user
    
    Args:
        account_data: Account creation request with account_type
        
    Returns:
        Created bank account
        
    Raises:
        400: Invalid account type or generation failed
    """
    try:
        # Generate unique account number
        account_number = generate_account_number(db)
        
        # Create new account with initial balance of 500,000 VND
        new_account = BankAccount(
            user_id=current_user.id,
            account_number=account_number,
            account_type=account_data.account_type,
            balance=20000000,  # All new accounts start with 20,000,000 VND
            currency="VND",
            is_active=True
        )
        
        db.add(new_account)
        db.commit()
        db.refresh(new_account)
        
        print(f"✅ Created new {account_data.account_type} account {account_number} for user {current_user.username} with 500,000 VND initial balance")
        
        return new_account
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating bank account: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create bank account: {str(e)}"
        )

@app.post("/api/unified-analyze")
async def unified_analyze_endpoint(
    image: UploadFile = File(None),
    text: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Intelligent routing endpoint:
    1. If Image: OCR -> Classify (Bill vs Scam) -> Process.
    2. If Text: Classify (Scam Check vs Chat) -> Process.
    """
    
    extracted_text = ""
    source_type = "text" # or "image"

    if image:
        print(f"📷 Analyzing image upload: {image.filename}")
        source_type = "image"
        try:
            image_data = await image.read()
            ocr_raw_response = await call_clova_ocr_api(image_data, image.filename)
            
            full_text_list = [
                field.get("inferText", "")
                for image_result in ocr_raw_response.get("images", [])
                if image_result.get("inferResult") == "SUCCESS"
                for field in image_result.get("fields", [])
            ]
            extracted_text = " ".join(full_text_list).strip()
            
            if not extracted_text:
                raise HTTPException(status_code=400, detail="OCR failed to extract text from image.")
                
            print(f"📝 OCR Result: {extracted_text[:100]}...")
            
        except Exception as e:
            print(f"❌ OCR Error: {e}")
            raise HTTPException(status_code=500, detail=f"Image processing failed: {str(e)}")
    
    elif text:
        print(f"💬 Analyzing text input: {text[:50]}...")
        extracted_text = text.strip()
        source_type = "text"
    
    else:
        raise HTTPException(status_code=400, detail="No text or image provided.")

    
    classification_prompt = (
        "You are a routing assistant. Analyze the user input below.\n"
        "1. If it looks like a financial receipt, bill, or invoice (contains items, prices, total, date), respond with JSON: {\"intent\": \"BILL\"}.\n"
        "2. If it looks like a suspicious message, email, offer, or the user is asking if something is a scam, respond with JSON: {\"intent\": \"SCAM_CHECK\"}.\n"
        "3. If it is just casual conversation or a general question, respond with JSON: {\"intent\": \"CHAT\"}.\n\n"
        f"USER INPUT: {extracted_text}"
    )

    try:
        class_response = client.chat.completions.create(
            model="HCX-005",
            messages=[{"role": "system", "content": [{"type": "text", "text": "Output only JSON."}]}, 
                      {"role": "user", "content": [{"type": "text", "text": classification_prompt}]}],
            temperature=0.1,
            max_tokens=50
        )
        
        intent_raw = class_response.choices[0].message.content.strip()
        # Clean potential markdown
        if "```" in intent_raw:
            intent_raw = intent_raw.split("```json")[-1].split("```")[0].strip()
        
        intent_data = json.loads(intent_raw)
        intent = intent_data.get("intent", "CHAT")
        print(f"🧠 Detected Intent: {intent}")

    except Exception as e:
        print(f"⚠️ Classification failed, defaulting to SCAM_CHECK: {e}")
        intent = "SCAM_CHECK"


    if intent == "BILL":
        try:
            # Reuse receipt extraction logic prompt
            prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "receipt_extractor.txt")
            if os.path.exists(prompt_path):
                with open(prompt_path, 'r', encoding='utf-8') as f:
                    extractor_system_prompt = f.read()
            else:
                extractor_system_prompt = "Extract JSON: {transaction_type: 'expense'|'income', amount: int, description: str, transaction_date: 'YYYY-MM-DD'}"

            extract_response = client.chat.completions.create(
                model="HCX-005",
                messages=[
                    {"role": "system", "content": [{"type": "text", "text": extractor_system_prompt}]},
                    {"role": "user", "content": [{"type": "text", "text": extracted_text}]}
                ],
                temperature=0.1
            )
            
            ai_content = extract_response.choices[0].message.content.strip()
            clean_json = ai_content.strip('` \n').replace("json", "").strip()
            tx_data = json.loads(clean_json)

            # Save to DB
            new_transaction = Transaction(
                user_id=current_user.id,
                type=tx_data.get("transaction_type", "expense"),
                amount=int(tx_data.get("amount", 0)),
                description=tx_data.get("description", "Uploaded Receipt"),
                transaction_date=datetime.utcnow() 
            )
            db.add(new_transaction)
            db.commit()
            db.refresh(new_transaction)
            
            return {
                "category": "BILL",
                "success": True,
                "message": f"Saved {new_transaction.type}: {new_transaction.amount:,} VND",
                "details": f"{new_transaction.description}"
            }

        except Exception as e:
            print(f"❌ Bill processing error: {e}")
            return {"category": "ERROR", "message": "Identified as bill, but failed to extract data."}

    elif intent == "SCAM_CHECK":
        prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "scamcheck.txt")
        system_prompt = "Analyze if this is a scam."
        if os.path.exists(prompt_path):
            with open(prompt_path, 'r', encoding='utf-8') as f:
                system_prompt = f.read()

        rag_context = ""
        if rag_db:
             results = await rag_db.search(extracted_text, top_k=2)
             if results:
                 rag_context = "\nReference Info:\n" + "\n".join([r['metadata']['text'][:200] for r in results])

        scam_response = client.chat.completions.create(
            model="HCX-005",
            messages=[
                {"role": "system", "content": [{"type": "text", "text": system_prompt}]},
                {"role": "user", "content": [{"type": "text", "text": extracted_text + rag_context}]}
            ],
            temperature=0.2
        )
        
        verdict = scam_response.choices[0].message.content.strip()
        
        return {
            "category": "SCAM_CHECK",
            "success": True,
            "verdict": verdict,
            "ocr_text": extracted_text if source_type == "image" else None
        }

    else:
        chat_response = client.chat.completions.create(
            model="HCX-005",
            messages=[
                {"role": "system", "content": [{"type": "text", "text": "You are Sentinel, a helpful banking assistant."}]},
                {"role": "user", "content": [{"type": "text", "text": extracted_text}]}
            ],
            temperature=0.7
        )
        reply = chat_response.choices[0].message.content.strip()
        
        return {
            "category": "CHAT",
            "success": True,
            "reply": reply
        }


@app.post("/api/transfers", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
async def create_transfer(
    transfer_data: TransferRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Execute a money transfer from user's account
    
    This endpoint handles the complete transfer flow:
    1. Validates sender account belongs to user
    2. Checks sufficient balance
    3. Calculates transfer fee
    4. Deducts amount + fee from sender account
    5. Creates transfer transaction record
    6. Creates expense transaction records
    
    Args:
        transfer_data: Transfer request with all required details
        
    Returns:
        Created transfer transaction
        
    Raises:
        404: Sender account not found
        403: Unauthorized account access
        400: Insufficient balance or invalid amount
    """
    # 1. Validate sender account exists and belongs to user
    sender_account = db.query(BankAccount).filter(
        BankAccount.id == transfer_data.sender_account_id
    ).first()
    
    if not sender_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sender account not found"
        )
    
    if sender_account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized access to sender account"
        )
    
    if not sender_account.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sender account is not active"
        )
    
    fee = calculate_transfer_fee(transfer_data.amount)
    
    total_deduction = transfer_data.amount + fee if transfer_data.fee_payer == "sender" else transfer_data.amount
    
    if sender_account.balance < total_deduction:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient balance. Available: {sender_account.balance:,} VND, Required: {total_deduction:,} VND"
        )
    
    try:
        sender_account.balance -= total_deduction
        
        new_transfer = TransferTransaction(
            sender_account_id=sender_account.id,
            receiver_account_number=transfer_data.receiver_account_number,
            receiver_bank=transfer_data.receiver_bank,
            receiver_name=transfer_data.receiver_name,
            amount=transfer_data.amount,
            fee=fee,
            fee_payer=transfer_data.fee_payer,
            description=transfer_data.description,
            status="completed",
            transaction_date=datetime.utcnow()
        )
        
        db.add(new_transfer)
        db.flush()  
        
        transfer_transaction = Transaction(
            user_id=current_user.id,
            account_id=sender_account.id,
            transfer_id=new_transfer.id,
            type="expense",
            amount=transfer_data.amount,
            description=f"Transfer to {transfer_data.receiver_account_number} ({transfer_data.receiver_bank}): {transfer_data.description}",
            transaction_date=datetime.utcnow()
        )
        db.add(transfer_transaction)
        
        if transfer_data.fee_payer == "sender" and fee > 0:
            fee_transaction = Transaction(
                user_id=current_user.id,
                account_id=sender_account.id,
                transfer_id=new_transfer.id,
                type="expense",
                amount=fee,
                description=f"Transfer fee for transaction to {transfer_data.receiver_account_number}",
                transaction_date=datetime.utcnow()
            )
            db.add(fee_transaction)
        
        db.commit()
        db.refresh(new_transfer)
        
        print(f"✅ Transfer completed: {transfer_data.amount:,} VND from account {sender_account.account_number} to {transfer_data.receiver_account_number}")
        print(f"   Fee: {fee:,} VND (paid by {transfer_data.fee_payer})")
        print(f"   New balance: {sender_account.balance:,} VND")
        
        return new_transfer
        
    except Exception as e:
        db.rollback()
        print(f"❌ Transfer failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transfer failed: {str(e)}"
        )


@app.get("/api/transfers", response_model=List[TransferResponse])
async def get_user_transfers(
    account_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get transfer history for authenticated user
    
    Args:
        account_id: Optional filter by specific account ID
        limit: Maximum number of records to return (default: 50)
        offset: Number of records to skip (default: 0)
        
    Returns:
        List of transfer transactions ordered by date (newest first)
    """
    # Get user's account IDs
    user_account_ids = [acc.id for acc in db.query(BankAccount).filter(
        BankAccount.user_id == current_user.id
    ).all()]
    
    # Build query
    query = db.query(TransferTransaction).filter(
        TransferTransaction.sender_account_id.in_(user_account_ids)
    )
    
    # Filter by specific account if provided
    if account_id:
        # Verify account belongs to user
        if account_id not in user_account_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized access to account"
            )
        query = query.filter(TransferTransaction.sender_account_id == account_id)
    
    # Order and paginate
    transfers = query.order_by(
        TransferTransaction.transaction_date.desc()
    ).limit(limit).offset(offset).all()
    
    return transfers

@app.post("/api/extract-transfer-details", response_model=TransferDetailsResponse)
async def extract_transfer_details_from_image(
    file: UploadFile = File(...), 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db) 
):
    """
    Handles file uploads (Image or Audio) to extract structured transfer details.
    """
    print(f"🔄 Received file for transfer detail extraction from user {current_user.id}: {file.filename}")

    if not file.filename:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided.")

    try:
        file_data = await file.read()
        extracted_text = ""
        
        file_content_type = file.content_type.lower()
        
        if file_content_type.startswith('image/'):
            print("🖼️ Processing as Image via OCR.")
            ocr_raw_response = await call_clova_ocr_api(file_data, file.filename)
            
            full_text_list = [
                field.get("inferText", "")
                for image_result in ocr_raw_response.get("images", [])
                if image_result.get("inferResult") == "SUCCESS"
                for field in image_result.get("fields", [])
            ]
            extracted_text = " ".join(full_text_list).strip()

        elif file_content_type.startswith('audio/'):
            print("🎙️ Processing as Audio via Clova Speech.")
            speech_result = await call_clova_speech_api(file_data)
            extracted_text = speech_result.get("text", "").strip()
        
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Only image/* and audio/* are supported.")

        print(f"✅ Extracted text (first 200 chars): {extracted_text[:200]}...")

        if not extracted_text:
            raise HTTPException(status_code=400, detail="No discernible text found in the file.")

        prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "transfer_extractor.txt")
        if not os.path.exists(prompt_path):
             raise HTTPException(status_code=500, detail="Transfer extractor prompt not found on server.")

        with open(prompt_path, 'r', encoding='utf-8') as f:
            system_prompt = f.read()

        messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": extracted_text}]

        response = client.chat.completions.create(
            model="HCX-005", messages=messages, temperature=0.1, top_p=0.1, stream=False,
        )
        ai_response_content = response.choices[0].message.content.strip()
        print(f"🤖 AI Transfer Extraction Response: {ai_response_content}")

        try:
            cleaned_json_str = ai_response_content.strip('` \n').replace("json", "").strip()
            data = json.loads(cleaned_json_str)
            return TransferDetailsResponse(**data)
        except (json.JSONDecodeError, ValueError) as e:
            print(f"❌ Failed to parse AI response for transfer details: {e}")
            raise HTTPException(status_code=500, detail=f"AI returned invalid data: {ai_response_content}")

    except Exception as e:
        print(f"❌ Unexpected error during file-based transfer detail extraction: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")



@app.get("/api/savings-goals/", response_model=List[SavingsGoalResponse])
async def get_all_savings_goals(
    account_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all savings goals for current user, optionally filtered by account_id"""
    query = db.query(SavingsGoal).filter(
        SavingsGoal.user_id == current_user.id,
        SavingsGoal.is_active == True
    )
    if account_id:
        query = query.filter(SavingsGoal.account_id == account_id)
    
    goals = query.order_by(SavingsGoal.created_at.desc()).all()
    return goals


@app.get("/api/savings-goals/summary/{account_id}", response_model=SavingsGoalSummary)
async def get_account_summary(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get summary of savings goals for a specific account"""
    # Verify account belongs to user
    account = db.query(BankAccount).filter(
        BankAccount.id == account_id,
        BankAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    # Get all goals for this account
    goals = db.query(SavingsGoal).filter(
        SavingsGoal.account_id == account_id,
        SavingsGoal.user_id == current_user.id,
        SavingsGoal.is_active == True
    ).all()
    
    # Calculate summary
    total_allocated = sum(goal.allocated_amount for goal in goals)
    available_balance = account.balance - total_allocated
    
    return SavingsGoalSummary(
        account_id=account_id,
        total_balance=float(account.balance),
        total_allocated=total_allocated,
        available_balance=available_balance,
        goals_count=len(goals),
        is_over_allocated=available_balance < 0,
        goals=[SavingsGoalResponse.model_validate(goal) for goal in goals]
    )


@app.get("/api/savings-goals/{goal_id}", response_model=SavingsGoalResponse)
async def get_savings_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific savings goal by ID"""
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id,
        SavingsGoal.user_id == current_user.id
    ).first()
    
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    
    return goal


@app.post("/api/savings-goals/", response_model=SavingsGoalResponse, status_code=201)
async def create_savings_goal(
    goal_data: SavingsGoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new savings goal with validation"""
    # Verify account belongs to user
    account = db.query(BankAccount).filter(
        BankAccount.id == goal_data.account_id,
        BankAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    # Calculate current total allocated
    existing_goals = db.query(SavingsGoal).filter(
        SavingsGoal.account_id == goal_data.account_id,
        SavingsGoal.user_id == current_user.id,
        SavingsGoal.is_active == True
    ).all()
    
    total_allocated = sum(goal.allocated_amount for goal in existing_goals)
    available_balance = account.balance - total_allocated
    
    # Validate allocation
    if goal_data.allocated_amount > available_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot allocate {goal_data.allocated_amount:,.0f}đ. Available: {available_balance:,.0f}đ"
        )
    
    # Create new goal
    new_goal = SavingsGoal(
        user_id=current_user.id,
        account_id=goal_data.account_id,
        name=goal_data.name,
        target_amount=goal_data.target_amount,
        allocated_amount=goal_data.allocated_amount,
        color=goal_data.color
    )
    
    db.add(new_goal)
    db.commit()
    db.refresh(new_goal)
    
    return new_goal


@app.put("/api/savings-goals/{goal_id}", response_model=SavingsGoalResponse)
async def update_savings_goal(
    goal_id: int,
    goal_data: SavingsGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing savings goal"""
    # Get existing goal
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id,
        SavingsGoal.user_id == current_user.id
    ).first()
    
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    
    # Get account
    account = db.query(BankAccount).filter(BankAccount.id == goal.account_id).first()
    
    # If updating allocated amount, validate
    if goal_data.allocated_amount is not None:
        other_goals = db.query(SavingsGoal).filter(
            SavingsGoal.account_id == goal.account_id,
            SavingsGoal.user_id == current_user.id,
            SavingsGoal.is_active == True,
            SavingsGoal.id != goal_id
        ).all()
        
        other_total = sum(g.allocated_amount for g in other_goals)
        available = account.balance - other_total
        
        if goal_data.allocated_amount > available:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot allocate {goal_data.allocated_amount:,.0f}đ. Available: {available:,.0f}đ"
            )
    
    # Update fields
    update_data = goal_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(goal, field, value)
    
    db.commit()
    db.refresh(goal)
    
    return goal


@app.delete("/api/savings-goals/{goal_id}", response_model=MessageResponse)
async def delete_savings_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete a savings goal"""
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id,
        SavingsGoal.user_id == current_user.id
    ).first()
    
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    
    # Soft delete
    goal.is_active = False
    db.commit()
    
    return MessageResponse(message="Savings goal deleted successfully", success=True)


@app.get("/api/transfers/{transfer_id}", response_model=TransferResponse)
async def get_transfer_by_id(
    transfer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get specific transfer transaction by ID
    
    Args:
        transfer_id: Transfer transaction ID
        
    Returns:
        Transfer transaction details
        
    Raises:
        404: Transfer not found
        403: Unauthorized access
    """
    transfer = db.query(TransferTransaction).filter(
        TransferTransaction.id == transfer_id
    ).first()
    
    if not transfer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transfer not found"
        )
    
    # Verify transfer belongs to user's account
    sender_account = db.query(BankAccount).filter(
        BankAccount.id == transfer.sender_account_id
    ).first()
    
    if not sender_account or sender_account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized access to this transfer"
        )
    
    return transfer