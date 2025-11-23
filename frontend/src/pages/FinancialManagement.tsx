import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  PiggyBank, 
  Loader2, 
  Plus, 
  Pencil, 
  Trash2,
  Wallet
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useBankAccounts } from "@/hooks/useBankAccount";
import * as savingsGoalsService from "@/apis/savingsGoalsService";
import type { SavingsGoal, UpdateGoalRequest } from "@/apis/savingsGoalsService";

interface Transaction {
  id: number;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  amount: number;
  description: string;
  transaction_date: string;
}

const isIncomeTransaction = (type: string): boolean => {
  return type === 'income' || type === 'transfer_in';
};

const getDisplayAmount = (amount: number): number => {
  return Math.abs(amount);
};

const fetchTransactions = async (): Promise<Transaction[]> => {
  const token = localStorage.getItem('accessToken');
  if (!token) throw new Error("Authentication token not found.");

  const response = await fetch('/api/transactions', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    // Fallback for demo purposes if API fails or doesn't exist yet
    return [
      { id: 1, type: 'expense', amount: 150000, description: 'Grocery Shopping', transaction_date: new Date().toISOString() },
      { id: 2, type: 'income', amount: 5000000, description: 'Freelance Project', transaction_date: new Date().toISOString() },
      { id: 3, type: 'expense', amount: 50000, description: 'Coffee', transaction_date: new Date().toISOString() },
    ];
  }
  return response.json();
};

const FinancialManagement = () => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  
  const { data: accounts, isLoading: accountsLoading } = useBankAccounts();
  
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  
  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccountId) {
      const savingsAccount = accounts.find(acc => acc.account_type === 'savings');
      const defaultAccount = savingsAccount || accounts.find(acc => acc.account_type === 'main') || accounts[0];
      setSelectedAccountId(defaultAccount.id);
    }
  }, [accounts, selectedAccountId]);
  
  const { data: goals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ['savingsGoals', selectedAccountId],
    queryFn: () => selectedAccountId ? savingsGoalsService.getSavingsGoals(selectedAccountId) : Promise.resolve([]),
    enabled: !!selectedAccountId,
  });
  
  const { data: summary } = useQuery({
    queryKey: ['accountSummary', selectedAccountId],
    queryFn: () => selectedAccountId ? savingsGoalsService.getAccountSummary(selectedAccountId) : Promise.resolve(null),
    enabled: !!selectedAccountId,
  });
  
  const createGoalMutation = useMutation({
    mutationFn: savingsGoalsService.createSavingsGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savingsGoals'] });
      queryClient.invalidateQueries({ queryKey: ['accountSummary'] });
      toast.success('Savings goal created successfully');
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create goal');
    },
  });
  
  const updateGoalMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateGoalRequest }) => 
      savingsGoalsService.updateSavingsGoal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savingsGoals'] });
      queryClient.invalidateQueries({ queryKey: ['accountSummary'] });
      toast.success('Goal updated successfully');
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update goal');
    },
  });
  
  const deleteGoalMutation = useMutation({
    mutationFn: savingsGoalsService.deleteSavingsGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savingsGoals'] });
      queryClient.invalidateQueries({ queryKey: ['accountSummary'] });
      toast.success('Goal deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete goal');
    },
  });
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [allocatedAmount, setAllocatedAmount] = useState("");
  const [goalColor, setGoalColor] = useState("bg-blue-500");

  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: fetchTransactions,
    retry: false
  });

  const openAddDialog = () => {
    setEditingGoal(null);
    setGoalName("");
    setTargetAmount("");
    setAllocatedAmount("");
    setGoalColor("bg-blue-500");
    setIsDialogOpen(true);
  };

  const openEditDialog = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setGoalName(goal.name);
    setTargetAmount(goal.target_amount.toString());
    setAllocatedAmount(goal.allocated_amount.toString());
    setGoalColor(goal.color);
    setIsDialogOpen(true);
  };

  const handleSaveGoal = () => {
    if (!goalName || !targetAmount || !allocatedAmount) {
      toast.error(t('fillAllFields'));
      return;
    }

    if (!selectedAccountId) {
      toast.error(t('selectAccountFirst'));
      return;
    }

    const allocated = parseFloat(allocatedAmount);
    const target = parseFloat(targetAmount);

    if (allocated < 0 || target < 0) {
      toast.error(t('positiveAmountReq'));
      return;
    }

    if (editingGoal) {
      updateGoalMutation.mutate({
        id: editingGoal.id,
        data: {
          name: goalName,
          target_amount: target,
          allocated_amount: allocated,
          color: goalColor,
        },
      });
    } else {
      createGoalMutation.mutate({
        account_id: selectedAccountId,
        name: goalName,
        target_amount: target,
        allocated_amount: allocated,
        color: goalColor,
      });
    }
  };

  const handleDeleteGoal = (id: number) => {
    if (window.confirm(t('confirmDelete'))) {
      deleteGoalMutation.mutate(id);
    }
  };

  const selectedAccount = accounts?.find(acc => acc.id === selectedAccountId);

  const totalIncome = transactions?.filter(t => isIncomeTransaction(t.type)).reduce((sum, t) => sum + getDisplayAmount(t.amount), 0) || 0;
  const totalExpense = transactions?.filter(t => !isIncomeTransaction(t.type)).reduce((sum, t) => sum + getDisplayAmount(t.amount), 0) || 0;
  const currentSavings = totalIncome - totalExpense;
  
  const accountGoals = goals;
  const totalBalance = summary?.total_balance || selectedAccount?.balance || 0;
  const totalAllocated = summary?.total_allocated || 0;
  const availableBalance = summary?.available_balance || (totalBalance - totalAllocated);
  const isOverAllocated = summary?.is_over_allocated || false;

  const stats = [
    { title: t('income'), value: `${totalIncome.toLocaleString('vi-VN')}đ`, icon: ArrowUpRight, color: "text-green-500" },
    { title: t('expense'), value: `${totalExpense.toLocaleString('vi-VN')}đ`, icon: ArrowDownRight, color: "text-red-500" },
    { title: t('netBalance') || 'Net Balance', value: `${currentSavings.toLocaleString('vi-VN')}đ`, icon: PiggyBank, color: "text-purple-500" },
  ];
  
  const recentTransactions = transactions?.slice(0, 5) || [];

  if (isLoading) {
    return (
      <DashboardLayout sidebar={<AppSidebar />}>
        <div className="flex justify-center items-center h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout sidebar={<AppSidebar />}>
      <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t('financialManagement')}</h1>
          </div>
          <p className="text-muted-foreground">{t('personalFinance')}</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6">
          {stats.map((stat, index) => (
            <Card key={index} className="glass-card hover:shadow-md transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                {/* Removed the percentage text paragraph */}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Recent Transactions */}
          <Card className="glass-card h-full">
            <CardHeader>
              <CardTitle>{t('recentTransactions')}</CardTitle>
              <CardDescription>{t('allTransactions')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                 {recentTransactions.length > 0 ? (
                  recentTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${isIncomeTransaction(transaction.type) ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                          {isIncomeTransaction(transaction.type) ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{transaction.description}</p>
                          <p className="text-xs text-muted-foreground">{new Date(transaction.transaction_date).toLocaleDateString('vi-VN')}</p>
                        </div>
                      </div>
                      <div className={`font-bold text-sm ${isIncomeTransaction(transaction.type) ? 'text-green-500' : 'text-red-500'}`}>
                        {isIncomeTransaction(transaction.type) ? '+' : '-'}{getDisplayAmount(transaction.amount).toLocaleString('vi-VN')}đ
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-4">{t('noTransactions')}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* SAVINGS GOALS FOR SELECTED ACCOUNT */}
          <Card className="glass-card h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>{t('savingsGoal')}</CardTitle>
                <CardDescription>{t('trackSavings')}</CardDescription>
              </div>
              <Button 
                size="sm" 
                onClick={openAddDialog} 
                className="gap-1"
                disabled={!selectedAccountId}
              >
                <Plus className="h-4 w-4" /> {t('add')}
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto space-y-4">
              {/* Account Selector - Compact */}
              {accounts && accounts.length > 0 && (
                <div className="flex items-center gap-2 pb-3 pt-3 border-b">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={selectedAccountId?.toString()}
                    onValueChange={(value) => setSelectedAccountId(parseInt(value))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{account.account_number}</span>
                            <span className="text-xs text-muted-foreground">({account.account_type})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Account Summary - Compact */}
              {selectedAccount && (
                <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/50 mb-4">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Balance</div>
                    <div className="text-sm font-bold">{totalBalance.toLocaleString('vi-VN')}đ</div>
                  </div>
                  <div className="text-center border-x">
                    <div className="text-xs text-muted-foreground mb-1">Allocated</div>
                    <div className="text-sm font-bold text-orange-500">{totalAllocated.toLocaleString('vi-VN')}đ</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                      Available
                      {isOverAllocated && (
                        <span className="px-1 py-0.5 text-[10px] bg-red-500 text-white rounded">!</span>
                      )}
                    </div>
                    <div className={`text-sm font-bold ${isOverAllocated ? 'text-red-500' : 'text-green-600'}`}>
                      {availableBalance.toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                </div>
              )}

              {/* Goals List */}
              <div className="space-y-4">
                {goalsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : accountGoals.map((goal) => {
                  const percentage = Math.min(Math.round((goal.allocated_amount / goal.target_amount) * 100), 100);
                  
                  return (
                    <div key={goal.id} className="group relative">
                      <div className="flex justify-between mb-2 items-end">
                        <div>
                          <span className="text-sm font-medium block">{goal.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {t('allocated')}: {goal.allocated_amount.toLocaleString('vi-VN')}đ / {t('targetAmount')}: {goal.target_amount.toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 -top-1 md:relative md:top-auto md:right-auto bg-background md:bg-transparent p-1 rounded shadow md:shadow-none">
                           <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditDialog(goal)}>
                             <Pencil className="h-3 w-3" />
                           </Button>
                           <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeleteGoal(goal.id)}>
                             <Trash2 className="h-3 w-3" />
                           </Button>
                        </div>
                        <span className="text-sm font-bold md:hidden block">{percentage}%</span>
                      </div>
                      
                      <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden relative">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${goal.color || 'bg-primary'}`} 
                          style={{ width: `${percentage}%` }} 
                        />
                      </div>
                      <div className="text-right mt-1 hidden md:block">
                         <span className="text-xs font-medium text-muted-foreground">{percentage}% {t('progress')}</span>
                      </div>
                    </div>
                  );
                })}

                {!goalsLoading && accountGoals.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <PiggyBank className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">{t('noGoals')}</p>
                    <Button variant="link" size="sm" onClick={openAddDialog} disabled={!selectedAccountId}>
                      {t('createFirstGoal')}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* ADD / EDIT GOAL DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingGoal ? t('editGoal') : t('createGoal')}</DialogTitle>
            <DialogDescription>
              {t('setTargetDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Goal Name */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                {t('name')}
              </Label>
              <Input
                id="name"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                className="col-span-3"
                placeholder="e.g. New Laptop"
              />
            </div>

            {/* Target Amount */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="target" className="text-right">
                {t('targetAmount')}
              </Label>
              <Input
                id="target"
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="col-span-3"
                placeholder="30000000"
              />
            </div>

            {/* Allocated Amount */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="allocated" className="text-right">
                {t('allocateAmount')}
              </Label>
              <div className="col-span-3 space-y-2">
                <Input
                  id="allocated"
                  type="number"
                  value={allocatedAmount}
                  onChange={(e) => setAllocatedAmount(e.target.value)}
                  placeholder="15000000"
                />
                {selectedAccount && (
                  <div className="text-xs text-muted-foreground">
                    {t('availableBalance')} <span className="font-semibold text-green-600">
                      {(() => {
                        const otherTotal = accountGoals
                          .filter(g => g.id !== editingGoal?.id)
                          .reduce((sum, g) => sum + g.allocated_amount, 0);
                        const available = totalBalance - otherTotal;
                        return available.toLocaleString('vi-VN');
                      })()}đ
                    </span>
                    {allocatedAmount && parseFloat(allocatedAmount) > 0 && (
                      <>
                        {' '} → {t('afterAllocation')} <span className={`font-semibold ${
                          (() => {
                            const otherTotal = accountGoals
                              .filter(g => g.id !== editingGoal?.id)
                              .reduce((sum, g) => sum + g.allocated_amount, 0);
                            const remaining = totalBalance - otherTotal - parseFloat(allocatedAmount);
                            return remaining >= 0 ? 'text-green-600' : 'text-red-500';
                          })()
                        }`}>
                          {(() => {
                            const otherTotal = accountGoals
                              .filter(g => g.id !== editingGoal?.id)
                              .reduce((sum, g) => sum + g.allocated_amount, 0);
                            const remaining = totalBalance - otherTotal - parseFloat(allocatedAmount);
                            return remaining.toLocaleString('vi-VN');
                          })()}đ
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Color Picker */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">
                {t('color')}
              </Label>
              <div className="col-span-3 flex gap-2 flex-wrap">
                {['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-yellow-500', 'bg-red-500', 'bg-indigo-500'].map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setGoalColor(color)}
                    className={`w-8 h-8 rounded-full ${color} transition-all ${
                      goalColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('cancel')}</Button>
            <Button 
              onClick={handleSaveGoal}
              disabled={createGoalMutation.isPending || updateGoalMutation.isPending}
            >
              {(createGoalMutation.isPending || updateGoalMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingGoal ? t('updateGoal') : t('createGoal')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
};

export default FinancialManagement;