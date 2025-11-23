/**
 * React Query Hooks for Bank Accounts
 * Custom hooks for data fetching and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import {
  getBankAccounts,
  getBankAccountById,
  createBankAccount,
  executeTransfer,
  getTransferHistory,
  getTransferById,
  type BankAccount,
  type CreateAccountRequest,
  type TransferRequest,
  type TransferTransaction,
} from '@/apis/bankService';

// Query Keys
export const bankQueryKeys = {
  all: ['bank'] as const,
  accounts: () => [...bankQueryKeys.all, 'accounts'] as const,
  account: (id: number) => [...bankQueryKeys.accounts(), id] as const,
  transfers: () => [...bankQueryKeys.all, 'transfers'] as const,
  transfer: (id: number) => [...bankQueryKeys.transfers(), id] as const,
  transferHistory: (accountId?: number) => 
    [...bankQueryKeys.transfers(), 'history', accountId] as const,
};

/**
 * Fetch all bank accounts for current user
 */
export const useBankAccounts = () => {
  return useQuery({
    queryKey: bankQueryKeys.accounts(),
    queryFn: getBankAccounts,
    staleTime: 30000, // 30 seconds
  });
};

/**
 * Fetch specific bank account by ID
 */
export const useBankAccount = (accountId: number) => {
  return useQuery({
    queryKey: bankQueryKeys.account(accountId),
    queryFn: () => getBankAccountById(accountId),
    enabled: !!accountId,
    staleTime: 30000,
  });
};

/**
 * Create new bank account
 */
export const useCreateBankAccount = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateAccountRequest) => createBankAccount(data),
    onSuccess: (newAccount) => {
      queryClient.invalidateQueries({ queryKey: bankQueryKeys.accounts() });
      
      toast({
        title: 'Account created successfully',
        description: `New ${newAccount.account_type} account created with number ${newAccount.account_number}`,
      });
    },
    onError: (error: any) => {
      let errorMessage = 'An error occurred';
      
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          errorMessage = detail.map((err: any) => err.msg || JSON.stringify(err)).join(', ');
        } else if (typeof detail === 'object') {
          errorMessage = JSON.stringify(detail);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Failed to create account',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });
};

/**
 * Execute money transfer
 */
export const useExecuteTransfer = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: TransferRequest) => executeTransfer(data),
    onSuccess: (transfer) => {
      queryClient.invalidateQueries({ queryKey: bankQueryKeys.accounts() });
      queryClient.invalidateQueries({ 
        queryKey: bankQueryKeys.account(transfer.sender_account_id) 
      });
      
      queryClient.invalidateQueries({ queryKey: bankQueryKeys.transfers() });
      
      toast({
        title: 'Transfer successful',
        description: `Transferred ${transfer.amount.toLocaleString('vi-VN')} VND to ${transfer.receiver_account_number}`,
      });
    },
    onError: (error: any) => {
      let errorMessage = 'An error occurred';
      
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        
        if (typeof detail === 'string') {
          errorMessage = detail;
        } 
        else if (Array.isArray(detail)) {
          errorMessage = detail.map((err: any) => err.msg || JSON.stringify(err)).join(', ');
        }
        else if (typeof detail === 'object') {
          errorMessage = JSON.stringify(detail);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Transfer failed',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });
};

/**
 * Fetch transfer history
 */
export const useTransferHistory = (accountId?: number) => {
  return useQuery({
    queryKey: bankQueryKeys.transferHistory(accountId),
    queryFn: () => getTransferHistory({ account_id: accountId }),
    staleTime: 10000, // 10 seconds
  });
};

/**
 * Fetch specific transfer by ID
 */
export const useTransfer = (transferId: number) => {
  return useQuery({
    queryKey: bankQueryKeys.transfer(transferId),
    queryFn: () => getTransferById(transferId),
    enabled: !!transferId,
  });
};

/**
 * Get main account (helper hook)
 */
export const useMainAccount = () => {
  const { data: accounts, ...rest } = useBankAccounts();
  
  const mainAccount = accounts?.find(acc => acc.account_type === 'main');
  
  return {
    ...rest,
    data: mainAccount,
    accounts,
  };
};

/**
 * Get total balance across all accounts
 */
export const useTotalBalance = () => {
  const { data: accounts, ...rest } = useBankAccounts();
  
  const totalBalance = accounts?.reduce((sum, acc) => sum + acc.balance, 0) || 0;
  
  return {
    ...rest,
    totalBalance,
    accounts,
  };
};
