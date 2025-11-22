import { DashboardLayout } from "@/components/DashboardLayout";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, ArrowDownLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useState } from "react";
import { useBankAccounts } from "@/hooks/useBankAccount";
import { formatCurrency } from "@/apis/bankService";
import { useQuery } from "@tanstack/react-query";

// Transaction interface matching backend
interface Transaction {
  id: number;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  amount: number;
  description: string;
  transaction_date: string;
  created_at: string;
  account_id?: number;
  transfer_id?: number;
}

// Helper to check if transaction is incoming
const isIncomeTransaction = (type: string): boolean => {
  return type === 'income' || type === 'transfer_in';
};

const TransactionHistory = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  
  // Fetch accounts for filter
  const { data: accounts } = useBankAccounts();
  
  // Fetch transactions from /api/transactions
  const { data: transactions, isLoading, isError, error } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/transactions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      return response.json();
    }
  });

  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  // Helper function to render the main content based on the query state
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      );
    }

    if (isError) {
      return (
        <Card className="glass-card border-red-500/30">
          <CardContent className="py-12 text-center text-red-500">
            {error?.message || t('errorLoadingTransfers') || 'Error loading transfers'}
          </CardContent>
        </Card>
      );
    }

    // Filter transactions
    const filteredTransactions = transactions?.filter(txn => {
      // Filter by account if selected
      if (selectedAccountId && txn.account_id !== selectedAccountId) {
        return false;
      }
      
      // Filter by type
      if (filter === 'income') {
        return isIncomeTransaction(txn.type);
      } else if (filter === 'expense') {
        return !isIncomeTransaction(txn.type);
      }
      
      return true;
    }) || [];

    if (filteredTransactions.length === 0) {
      return (
        <Card className="glass-card border-border/30">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-2">
              {selectedAccountId 
                ? (t('noTransfersForAccount') || 'No transactions for this account')
                : (t('noTransfers') || 'No transactions yet')}
            </p>
            <Button onClick={() => navigate("/transaction")} className="mt-4 bg-gradient-to-r from-primary to-accent-blue">
              {t('transfer')}
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {filteredTransactions.map((transaction) => {
          // Determine if this is income or expense
          const isIncome = isIncomeTransaction(transaction.type);
          
          return (
            <Card
              key={transaction.id}
              className="glass-card border-border/30 hover:border-primary/30 transition-all duration-300"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Icon */}
                    <div
                      className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center ${
                        isIncome ? "bg-green-500/10" : "bg-red-500/10"
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownLeft className="h-6 w-6 text-green-500" />
                      ) : (
                        <ArrowUpRight className="h-6 w-6 text-red-500" />
                      )}
                    </div>

                    {/* Transaction Details */}
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-foreground">
                            {transaction.type === 'transfer_in' && (t('receivedMoney') || 'Received Money')}
                            {transaction.type === 'transfer_out' && (t('sentMoney') || 'Sent Money')}
                            {transaction.type === 'income' && (t('income') || 'Income')}
                            {transaction.type === 'expense' && (t('expense') || 'Expense')}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {transaction.description}
                          </p>
                        </div>
                        <span
                          className={`text-lg font-bold flex-shrink-0 ${
                            isIncome ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {isIncome ? "+" : "-"}
                          {formatCurrency(Math.abs(transaction.amount))}
                        </span>
                      </div>

                      {/* Additional Info */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>{formatDate(transaction.transaction_date)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <DashboardLayout sidebar={<AppSidebar />}>
      <div className="p-4 md:p-8 max-w-[1200px] mx-auto animate-fade-in">
        {/* Header with Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              {t('transactionHistory')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('viewTransactionHistory') || 'View your transaction history'}
            </p>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            {/* Type Filter */}
            <Select 
              value={filter} 
              onValueChange={(value: 'all' | 'income' | 'expense') => setFilter(value)}
            >
              <SelectTrigger className="bg-background/50 border-border/30 min-w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allTransactions') || 'All'}</SelectItem>
                <SelectItem value="income">{t('income') || 'Income'}</SelectItem>
                <SelectItem value="expense">{t('expense') || 'Expense'}</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Account Filter */}
            {accounts && accounts.length > 0 && (
              <Select 
                value={selectedAccountId?.toString() || "all"} 
                onValueChange={(value) => setSelectedAccountId(value === "all" ? undefined : parseInt(value))}
              >
                <SelectTrigger className="bg-background/50 border-border/30 min-w-[180px]">
                  <SelectValue placeholder={t('allAccounts') || 'All Accounts'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allAccounts') || 'All Accounts'}</SelectItem>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.account_number} ({account.account_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Transfers List */}
        {renderContent()}
      </div>
    </DashboardLayout>
  );
};

export default TransactionHistory;