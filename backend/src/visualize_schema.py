#!/usr/bin/env python3
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
inspector = inspect(engine)

print("=" * 80)
print("DATABASE SCHEMA VISUALIZATION")
print("=" * 80)
print()

for table_name in inspector.get_table_names():
    print(f"📊 TABLE: {table_name}")
    print("-" * 80)
    
    columns = inspector.get_columns(table_name)
    pk_constraint = inspector.get_pk_constraint(table_name)
    fk_constraints = inspector.get_foreign_keys(table_name)
    indexes = inspector.get_indexes(table_name)
    
    pk_columns = pk_constraint.get('constrained_columns', [])
    
    fk_map = {}
    for fk in fk_constraints:
        for col in fk['constrained_columns']:
            fk_map[col] = f"{fk['referred_table']}.{fk['referred_columns'][0]}"
    
    print(f"{'Column':<30} {'Type':<25} {'Nullable':<10} {'Key'}")
    print("-" * 80)
    
    for col in columns:
        col_name = col['name']
        col_type = str(col['type'])
        nullable = "NULL" if col['nullable'] else "NOT NULL"
        
        key = ""
        if col_name in pk_columns:
            key = "🔑 PRIMARY KEY"
        elif col_name in fk_map:
            key = f"🔗 FK → {fk_map[col_name]}"
        
        print(f"{col_name:<30} {col_type:<25} {nullable:<10} {key}")
    
    if indexes:
        print("\n📇 Indexes:")
        for idx in indexes:
            print(f"   - {idx['name']}: {', '.join(idx['column_names'])}")
    
    print("\n")

print("=" * 80)
print("RELATIONSHIPS SUMMARY")
print("=" * 80)
print()

for table_name in inspector.get_table_names():
    fk_constraints = inspector.get_foreign_keys(table_name)
    if fk_constraints:
        for fk in fk_constraints:
            print(f"• {table_name} → {fk['referred_table']}")
            print(f"  ({', '.join(fk['constrained_columns'])}) references ({', '.join(fk['referred_columns'])})")
            print()
