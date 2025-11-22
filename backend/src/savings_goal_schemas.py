"""
Savings Goals Pydantic Schemas
"""
from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional


class SavingsGoalBase(BaseModel):
    """Base schema for Savings Goal"""
    name: str = Field(..., min_length=1, max_length=100, description="Goal name")
    target_amount: float = Field(..., gt=0, description="Target amount to achieve")
    allocated_amount: float = Field(..., ge=0, description="Currently allocated amount")
    color: str = Field(default="bg-blue-500", description="Color for UI display")

    @validator('color')
    def validate_color(cls, v):
        """Validate color is one of allowed Tailwind colors"""
        allowed_colors = [
            'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500',
            'bg-pink-500', 'bg-yellow-500', 'bg-red-500', 'bg-indigo-500'
        ]
        if v not in allowed_colors:
            return 'bg-blue-500'  # Default fallback
        return v


class SavingsGoalCreate(SavingsGoalBase):
    """Schema for creating a new savings goal"""
    account_id: int = Field(..., description="Bank account ID this goal belongs to")


class SavingsGoalUpdate(BaseModel):
    """Schema for updating an existing savings goal"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    target_amount: Optional[float] = Field(None, gt=0)
    allocated_amount: Optional[float] = Field(None, ge=0)
    color: Optional[str] = None

    @validator('color')
    def validate_color(cls, v):
        if v is None:
            return v
        allowed_colors = [
            'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500',
            'bg-pink-500', 'bg-yellow-500', 'bg-red-500', 'bg-indigo-500'
        ]
        if v not in allowed_colors:
            return 'bg-blue-500'
        return v


class SavingsGoalResponse(SavingsGoalBase):
    """Schema for savings goal response"""
    id: int
    account_id: int
    user_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SavingsGoalSummary(BaseModel):
    """Summary of savings goals for an account"""
    account_id: int
    total_balance: float
    total_allocated: float
    available_balance: float
    goals_count: int
    is_over_allocated: bool
    goals: list[SavingsGoalResponse]


class MessageResponse(BaseModel):
    """Generic message response"""
    message: str
