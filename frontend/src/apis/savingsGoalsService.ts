/**
 * Savings Goals Service
 * API calls for savings goals management
 */

import api from './api';

export interface SavingsGoal {
  id: number;
  user_id: number;
  account_id: number;
  name: string;
  target_amount: number;
  allocated_amount: number;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalRequest {
  account_id: number;
  name: string;
  target_amount: number;
  allocated_amount: number;
  color: string;
}

export interface UpdateGoalRequest {
  name?: string;
  target_amount?: number;
  allocated_amount?: number;
  color?: string;
}

export interface AccountSummary {
  account_id: number;
  total_balance: number;
  total_allocated: number;
  available_balance: number;
  goals_count: number;
  is_over_allocated: boolean;
}

/**
 * Get all savings goals for the current user, optionally filtered by account
 */
export const getSavingsGoals = async (accountId?: number): Promise<SavingsGoal[]> => {
  const params = accountId ? { account_id: accountId } : {};
  const response = await api.get('/savings-goals/', { params });
  return response.data;
};

/**
 * Get a single savings goal by ID
 */
export const getSavingsGoal = async (goalId: number): Promise<SavingsGoal> => {
  const response = await api.get(`/savings-goals/${goalId}`);
  return response.data;
};

/**
 * Get account summary with allocated amounts
 */
export const getAccountSummary = async (accountId: number): Promise<AccountSummary> => {
  const response = await api.get(`/savings-goals/summary/${accountId}`);
  return response.data;
};

/**
 * Create a new savings goal
 */
export const createSavingsGoal = async (goal: CreateGoalRequest): Promise<SavingsGoal> => {
  const response = await api.post('/savings-goals/', goal);
  return response.data;
};

/**
 * Update an existing savings goal
 */
export const updateSavingsGoal = async (
  goalId: number,
  updates: UpdateGoalRequest
): Promise<SavingsGoal> => {
  const response = await api.put(`/savings-goals/${goalId}`, updates);
  return response.data;
};

/**
 * Delete a savings goal (soft delete)
 */
export const deleteSavingsGoal = async (goalId: number): Promise<void> => {
  await api.delete(`/savings-goals/${goalId}`);
};
