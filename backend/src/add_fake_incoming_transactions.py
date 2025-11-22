#!/usr/bin/env python3
"""
Add 15 fake incoming transactions to camkhonghat account for fraud demo
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(__file__))
from hyperclovax import User, BankAccount, Transaction, Base

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://naverbank3:naverbank@10.0.1.7:5432/template1")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def add_fake_incoming_transactions():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "camkhonghat").first()
        if not user:
            print("❌ User camkhonghat not found!")
            return
        account = db.query(BankAccount).filter(BankAccount.user_id == user.id).first()
        if not account:
            print("❌ Bank account for camkhonghat not found!")
            return
        amount = 5000000  # 5M VND
        description = "Nhan tien scam demo"
        base_time = datetime.now(timezone.utc)
        for i in range(15):
            transaction_date = base_time - timedelta(minutes=i*5)
            transaction = Transaction(
                user_id=user.id,
                account_id=account.id,
                type="transfer_in",
                amount=amount,
                description=description,
                transaction_date=transaction_date
            )
            db.add(transaction)
            # Update account balance
            account.balance += amount
        db.commit()
        print(f"✅ Added 15 fake incoming transactions to account {account.account_number} (new balance: {account.balance:,} VND)")
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_fake_incoming_transactions()
