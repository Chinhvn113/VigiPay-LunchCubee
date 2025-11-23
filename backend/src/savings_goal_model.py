from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from auth.database import Base


class SavingsGoal(Base):
    """Savings Goal model for tracking user financial goals per account"""
    __tablename__ = "savings_goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Goal details
    name = Column(String(100), nullable=False)
    target_amount = Column(Float, nullable=False)
    allocated_amount = Column(Float, nullable=False, default=0)
    color = Column(String(20), nullable=False, default="bg-blue-500")
    
    # Metadata
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<SavingsGoal(id={self.id}, name='{self.name}', user_id={self.user_id}, account_id={self.account_id})>"
