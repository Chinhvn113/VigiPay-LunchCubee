"""
Start Naver Bank API Server
Run with: python start_auth.py
"""
import uvicorn
from auth.config import settings

if __name__ == "__main__":
    print("🚀 Starting Naver Bank API Server...")
    print(f"📡 Server: http://{settings.HOST}:{settings.PORT}")
    print(f"📚 API Docs: http://localhost:{settings.PORT}/docs")
    print(f"🔒 Database: {settings.DATABASE_URL}")
    print(f"🌐 CORS Origins: {settings.CORS_ORIGINS}")
    print("\n🔧 Available Endpoints:")
    print("   - Authentication: /auth")
    print("   - Savings Goals: /api/savings-goals")
    print("\nPress Ctrl+C to stop\n")
    
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        log_level="info"
    )
