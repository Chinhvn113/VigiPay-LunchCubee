/**
 * Bank Account Service
 * API calls for bank account management
 */

import api from './api';

export interface BankAccount {
  id: number;
  user_id: number;
  account_number: string;
  account_type: 'main' | 'savings' | 'investment';
  balance: number;
  is_active: boolean;
  created_at: string;
}

export interface CreateAccountRequest {
  account_type: 'main' | 'savings' | 'investment';
}

export interface TransferRequest {
  sender_account_id: number;
  receiver_account_number: string;
  receiver_bank: string;
  receiver_name: string; // Required
  amount: number;
  description?: string; // Optional
  fee_payer: 'sender' | 'receiver';
}

export interface TransferTransaction {
  id: number;
  sender_account_id: number;
  sender_account_number: string;
  receiver_account_number: string;
  receiver_bank: string;
  receiver_name: string | null;
  amount: number;
  fee: number;
  fee_payer: 'sender' | 'receiver';
  description: string | null;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

/**
 * Get all bank accounts for current user
 */
export const getBankAccounts = async (): Promise<BankAccount[]> => {
  const response = await api.get<BankAccount[]>('/accounts');
  return response.data;
};

/**
 * Get specific bank account by ID
 */
export const getBankAccountById = async (accountId: number): Promise<BankAccount> => {
  const response = await api.get<BankAccount>(`/accounts/${accountId}`);
  return response.data;
};

/**
 * Create new bank account
 */
export const createBankAccount = async (data: CreateAccountRequest): Promise<BankAccount> => {
  const response = await api.post<BankAccount>('/accounts', data);
  return response.data;
};

/**
 * Execute money transfer
 */
export const executeTransfer = async (data: TransferRequest): Promise<TransferTransaction> => {
  const response = await api.post<TransferTransaction>('/transfers', data);
  return response.data;
};

/**
 * Execute internal VigiPay transfer (REAL MONEY TRANSFER)
 */
export const executeInternalTransfer = async (data: {
  sender_account_id: number;
  receiver_account_number: string;
  amount: number;
  description?: string;
  fee_payer?: string;
}): Promise<any> => {
  const response = await api.post('/transfer/internal', {
    sender_account_id: data.sender_account_id,
    receiver_account_number: data.receiver_account_number,
    amount: data.amount,
    description: data.description || 'Internal transfer',
    fee_payer: data.fee_payer || 'sender',
  });
  return response.data;
};

/**
 * Get transfer history
 */
export const getTransferHistory = async (params?: {
  account_id?: number;
  skip?: number;
  limit?: number;
}): Promise<TransferTransaction[]> => {
  const response = await api.get<TransferTransaction[]>('/transfers', { params });
  return response.data;
};

/**
 * Get specific transfer by ID
 */
export const getTransferById = async (transferId: number): Promise<TransferTransaction> => {
  const response = await api.get<TransferTransaction>(`/transfers/${transferId}`);
  return response.data;
};

/**
 * Calculate transfer fee (client-side preview)
 */
export const calculateTransferFee = (amount: number): number => {
  return amount >= 500000 ? 5500 : 1100;
};

/**
 * Format account number for display (e.g., 1234567890 -> 1234 5678 90)
 */
export const formatAccountNumber = (accountNumber: string): string => {
  return accountNumber.replace(/(\d{4})(\d{4})(\d{2})/, '$1 $2 $3');
};

/**
 * Format currency (VND)
 */
export const formatCurrency = (amount: number): string => {
  const formatted = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
  
  return formatted.replace('₫', 'VND');
};

export default {
  getBankAccounts,
  getBankAccountById,
  createBankAccount,
  executeTransfer,
  getTransferHistory,
  getTransferById,
  calculateTransferFee,
  formatAccountNumber,
  formatCurrency,
};
