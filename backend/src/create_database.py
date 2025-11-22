#!/usr/bin/env python3
"""
Create 'naverbank' database if it doesn't exist
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
parts = DATABASE_URL.split("@")
creds = parts[0].replace("postgresql://", "")
server_info = parts[1].split("/")[0]

username = creds.split(":")[0]
password = creds.split(":")[1] if ":" in creds else ""

print("=" * 70)
print("🏗️  Creating 'naverbank' Database")
print("=" * 70)
print()

# Connect to template1 to create new database
template_url = f"postgresql://{username}:{password}@{server_info}/template1"

try:
    print("🔌 Connecting to template1...")
    engine = create_engine(
        template_url,
        isolation_level="AUTOCOMMIT",  # Required for CREATE DATABASE
        pool_pre_ping=True
    )
    
    with engine.connect() as conn:
        print("✅ Connected!")
        
        # Check if database already exists
        result = conn.execute(text("""
            SELECT 1 FROM pg_database WHERE datname = 'naverbank';
        """))
        
        if result.fetchone():
            print("\n✅ Database 'naverbank' already exists!")
        else:
            print("\n🏗️  Creating database 'naverbank'...")
            conn.execute(text("CREATE DATABASE naverbank;"))
            print("✅ Database 'naverbank' created successfully!")
        
        # Verify by listing databases
        result = conn.execute(text("""
            SELECT datname FROM pg_database 
            WHERE datistemplate = false 
            ORDER BY datname;
        """))
        
        databases = [row[0] for row in result]
        print(f"\n📊 Available databases ({len(databases)}):")
        for db in databases:
            marker = "✅" if db == "naverbank" else "  "
            print(f"   {marker} {db}")
        
        print("\n" + "=" * 70)
        print("✅ SUCCESS!")
        print("=" * 70)
        print("\nYour .env DATABASE_URL is now correct:")
        print(f"   DATABASE_URL=\"postgresql://{username}:PASSWORD@{server_info}/naverbank\"")
        print("\n📝 Next steps:")
        print("   1. python3 test_postgres_connection.py")
        print("   2. python3 migrate_to_postgres.py --init-only")
        
except Exception as e:
    print(f"❌ Error: {e}")
    print("\n💡 Troubleshooting:")
    print("   1. User may not have CREATEDB permission")
    print("   2. Create database manually on Naver Cloud Console:")
    print("      - Go to Database > naverbank > Database Management")
    print("      - Create new database: 'naverbank'")
    print("   3. Or contact database admin for help")
