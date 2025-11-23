#!/usr/bin/env python3
"""
Create public schema and grant permissions
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL").split("?")[0]  

print("=" * 70)
print("🏗️  Creating PUBLIC Schema")
print("=" * 70)
print()

try:
    engine = create_engine(DATABASE_URL, isolation_level="AUTOCOMMIT", pool_pre_ping=True)
    
    with engine.connect() as conn:
        print("✅ Connected to naverbank database")
        
        result = conn.execute(text("SELECT current_user;"))
        user = result.scalar()
        print(f"   User: {user}")
        print()
        
        print("🔨 Creating schema 'public' (if not exists)...")
        try:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS public;"))
            print("✅ Schema 'public' created/exists")
        except Exception as e:
            print(f"⚠️  {e}")
            print("   Schema might already exist")
        
        print(f"\n🔑 Granting privileges to {user}...")
        try:
            conn.execute(text(f"GRANT ALL ON SCHEMA public TO {user};"))
            print(f"✅ Granted schema privileges")
        except Exception as e:
            print(f"⚠️  {e}")
        
        try:
            conn.execute(text(f"GRANT CREATE ON SCHEMA public TO {user};"))
            print(f"✅ Granted CREATE privilege")
        except Exception as e:
            print(f"⚠️  {e}")
        
        try:
            conn.execute(text("GRANT USAGE ON SCHEMA public TO PUBLIC;"))
            conn.execute(text("GRANT CREATE ON SCHEMA public TO PUBLIC;"))
            print(f"✅ Granted public access")
        except Exception as e:
            print(f"⚠️  {e}")
        
        print(f"\n🔍 Setting default search_path...")
        try:
            conn.execute(text(f"ALTER USER {user} SET search_path TO public;"))
            print(f"✅ Set search_path for {user}")
        except Exception as e:
            print(f"⚠️  {e}")
        
        print("\n📊 Verifying schemas...")
        result = conn.execute(text("""
            SELECT schema_name, schema_owner 
            FROM information_schema.schemata 
            WHERE schema_name = 'public';
        """))
        
        for row in result:
            print(f"   Schema: {row[0]}, Owner: {row[1]}")
        
        print("\n" + "=" * 70)
        print("✅ Schema setup completed!")
        print("=" * 70)
        print("\n📝 Now try:")
        print("   python3 migrate_to_postgres.py --init-only")
        
except Exception as e:
    print(f"❌ Error: {e}")
    print("\n" + "=" * 70)
    print("💡 ALTERNATIVE SOLUTION:")
    print("=" * 70)
    print("\nKhi tạo database trên Naver Cloud Console,")
    print("thêm Configuration Parameter:")
    print("   search_path = public")
    print("\nHoặc chọn template database: template0")
