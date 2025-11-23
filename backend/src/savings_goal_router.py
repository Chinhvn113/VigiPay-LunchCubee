from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, TYPE_CHECKING

if TYPE_CHECKING:
    from hyperclovax import User, SavingsGoal, BankAccount

from savings_goal_schemas import (
    SavingsGoalCreate, 
    SavingsGoalUpdate, 
    SavingsGoalResponse,
    SavingsGoalSummary,
    MessageResponse
)

router = APIRouter(prefix="/api/savings-goals", tags=["Savings Goals"])


@router.get("/", response_model=List[SavingsGoalResponse])
async def get_all_savings_goals(
    account_id: int = None,
    current_user = Depends(None),  # Will be set by hyperclovax
    db: Session = Depends(None)  # Will be set by hyperclovax
):
    """
    Get all savings goals for current user
    
    - **account_id** (optional): Filter by specific bank account
    
    Returns list of all savings goals
    """
    from hyperclovax import SavingsGoal
    
    query = db.query(SavingsGoal).filter(
        SavingsGoal.user_id == current_user.id,
        SavingsGoal.is_active == True
    )
    
    if account_id:
        query = query.filter(SavingsGoal.account_id == account_id)
    
    goals = query.order_by(SavingsGoal.created_at.desc()).all()
    return goals


@router.get("/summary/{account_id}", response_model=SavingsGoalSummary)
async def get_account_summary(
    account_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get summary of savings goals for a specific account
    
    Returns total balance, allocated amount, available balance, and goals list
    """
    from auth.models import SavingsGoal, BankAccount
    
    # Verify account belongs to user
    account = db.query(BankAccount).filter(
        BankAccount.id == account_id,
        BankAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank account not found"
        )
    
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
        total_balance=account.balance,
        total_allocated=total_allocated,
        available_balance=available_balance,
        goals_count=len(goals),
        is_over_allocated=available_balance < 0,
        goals=[SavingsGoalResponse.model_validate(goal) for goal in goals]
    )


@router.get("/{goal_id}", response_model=SavingsGoalResponse)
async def get_savings_goal(
    goal_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific savings goal by ID"""
    from auth.models import SavingsGoal
    
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id,
        SavingsGoal.user_id == current_user.id
    ).first()
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Savings goal not found"
        )
    
    return goal


@router.post("/", response_model=SavingsGoalResponse, status_code=status.HTTP_201_CREATED)
async def create_savings_goal(
    goal_data: SavingsGoalCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a new savings goal
    
    Validates that:
    - Account belongs to user
    - Allocated amount doesn't exceed available balance
    """
    from auth.models import SavingsGoal, BankAccount
    
    # Verify account belongs to user
    account = db.query(BankAccount).filter(
        BankAccount.id == goal_data.account_id,
        BankAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank account not found"
        )
    
    # Calculate current total allocated for this account
    existing_goals = db.query(SavingsGoal).filter(
        SavingsGoal.account_id == goal_data.account_id,
        SavingsGoal.user_id == current_user.id,
        SavingsGoal.is_active == True
    ).all()
    
    total_allocated = sum(goal.allocated_amount for goal in existing_goals)
    available_balance = account.balance - total_allocated
    
    # Validate allocation doesn't exceed available balance
    if goal_data.allocated_amount > available_balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot allocate {goal_data.allocated_amount:,.0f}đ. Available balance: {available_balance:,.0f}đ"
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


@router.put("/{goal_id}", response_model=SavingsGoalResponse)
async def update_savings_goal(
    goal_id: int,
    goal_data: SavingsGoalUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update an existing savings goal
    
    Validates allocation doesn't exceed available balance
    """
    from auth.models import SavingsGoal, BankAccount
    
    # Get existing goal
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id,
        SavingsGoal.user_id == current_user.id
    ).first()
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Savings goal not found"
        )
    
    # Get account
    account = db.query(BankAccount).filter(
        BankAccount.id == goal.account_id
    ).first()
    
    # If updating allocated amount, validate available balance
    if goal_data.allocated_amount is not None:
        # Calculate total allocated excluding current goal
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
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot allocate {goal_data.allocated_amount:,.0f}đ. Available balance: {available:,.0f}đ"
            )
    
    # Update fields
    update_data = goal_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(goal, field, value)
    
    db.commit()
    db.refresh(goal)
    
    return goal


@router.delete("/{goal_id}", response_model=MessageResponse)
async def delete_savings_goal(
    goal_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete (soft delete) a savings goal
    
    Sets is_active to False instead of actually deleting
    """
    from auth.models import SavingsGoal
    
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id,
        SavingsGoal.user_id == current_user.id
    ).first()
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Savings goal not found"
        )
    
    # Soft delete
    goal.is_active = False
    db.commit()
    
    return MessageResponse(message="Savings goal deleted successfully")
