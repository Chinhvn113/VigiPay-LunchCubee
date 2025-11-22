#!/usr/bin/env python3
"""
Quick connection test for PostgreSQL database
Usage: python test_postgres_connection.py
"""
import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment
load_dotenv()

def main():
    print("=" * 70)
    print("🔍 PostgreSQL Connection Test")
    print("=" * 70)
    
    DATABASE_URL = os.getenv("DATABASE_URL")
    
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found in .env file!")
        sys.exit(1)
    
    # Hide password in display
    display_url = DATABASE_URL
    if "@" in DATABASE_URL and ":" in DATABASE_URL:
        parts = DATABASE_URL.split("@")
        creds = parts[0].split("//")[1]
        if ":" in creds:
            username = creds.split(":")[0]
            display_url = DATABASE_URL.replace(creds, f"{username}:****")
    
    print(f"\n📋 Connection String: {display_url}")
    
    # Check if PostgreSQL
    if "postgresql" not in DATABASE_URL:
        print(f"⚠️  Warning: DATABASE_URL doesn't contain 'postgresql'")
        print(f"   Current: {DATABASE_URL[:20]}...")
        if "sqlite" in DATABASE_URL:
            print("   You're still using SQLite!")
            sys.exit(1)
    
    try:
        print("\n🔌 Attempting connection...")
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            echo=False
        )
        
        with engine.connect() as conn:
            # Test basic query
            result = conn.execute(text("SELECT version();"))
            version = result.scalar()
            print(f"✅ Connection successful!")
            print(f"   Version: {version}")
            
            # Get current database
            result = conn.execute(text("SELECT current_database();"))
            db_name = result.scalar()
            print(f"   Database: {db_name}")
            
            # Get current user
            result = conn.execute(text("SELECT current_user;"))
            user = result.scalar()
            print(f"   User: {user}")
            
            # Check existing tables
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """))
            tables = [row[0] for row in result]
            
            print(f"\n📊 Existing tables: {len(tables)}")
            if tables:
                for table in tables:
                    # Get row count
                    try:
                        count_result = conn.execute(text(f"SELECT COUNT(*) FROM {table};"))
                        count = count_result.scalar()
                        print(f"   - {table}: {count} rows")
                    except:
                        print(f"   - {table}")
            else:
                print("   (No tables found - run migration script to create)")
            
            print("\n" + "=" * 70)
            print("✅ All checks passed! PostgreSQL is ready to use.")
            print("=" * 70)
            print("\n📝 Next steps:")
            
            if not tables:
                print("1. Run: python migrate_to_postgres.py --init-only")
                print("   (This will create all database tables)")
            else:
                print("1. ✅ Tables already exist")
            
            print("2. Start your application")
            print("3. Test API endpoints")
            
    except Exception as e:
        print(f"\n❌ Connection failed!")
        print(f"   Error: {e}")
        print("\n🔧 Troubleshooting:")
        print("1. Check DATABASE_URL in .env file")
        print("2. Verify username and password are correct")
        print("3. Ensure you're in the same VPC as the database")
        print("4. Check database firewall/ACG rules")
        print("\nExample DATABASE_URL format:")
        print("postgresql://username:password@10.0.1.6:5432/naverbank")
        sys.exit(1)

if __name__ == "__main__":
    main()
