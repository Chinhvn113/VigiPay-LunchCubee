"""
Naver Bank Main API Application
Combines all routers (auth, savings goals, accounts, etc.)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from auth.config import settings
from auth.database import init_db

# Import routers
from auth.router import router as auth_router
from savings_goal_router import router as savings_goals_router

# Create FastAPI app
app = FastAPI(
    title="Naver Bank API",
    description="Complete banking API with authentication and savings goals",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database tables"""
    init_db()
    print("✅ Database initialized")
    print("📚 API Documentation: http://localhost:6011/docs")

# Include routers
app.include_router(auth_router)
app.include_router(savings_goals_router)

# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """API root endpoint"""
    return {
        "message": "Naver Bank API - Running",
        "version": "2.0.0",
        "docs": "/docs",
        "endpoints": {
            "auth": "/auth",
            "savings_goals": "/api/savings-goals"
        }
    }

# Health check
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "naver-bank-api"}
