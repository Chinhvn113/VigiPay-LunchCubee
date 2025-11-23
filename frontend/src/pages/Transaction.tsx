import { DashboardLayout } from "@/components/DashboardLayout";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Info, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useBankAccounts } from "@/hooks/useBankAccount";
import { formatCurrency, calculateTransferFee } from "@/apis/bankService";
import { useAuth } from "@/contexts/AuthContext";
import { TransactionProgressHeader } from "@/components/TransactionProgressHeader";
import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = '/api';

interface RecentRecipient {
  account_number: string;
  account_name: string;
  bank: string;
  last_transfer: string;
}

const Transaction = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();
  
  const { data: accounts, isLoading: accountsLoading } = useBankAccounts();
  
  const { data: recentRecipients } = useQuery<RecentRecipient[]>({
    queryKey: ['recentRecipients'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/recent-recipients?limit=5`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch recent recipients');
      return response.json();
    }
  });
  
  const [formData, setFormData] = useState({
    sourceAccount: "",
    bank: "",
    recipientAccount: "",
    recipientName: "",
    amount: "",
    fee: "sender" as 'sender' | 'receiver',
    description: "",
  });

  const [lookupState, setLookupState] = useState<{
    loading: boolean;
    error: string | null;
    verified: boolean;
  }>({ loading: false, error: null, verified: false });


  const formatAmountInput = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    if (!cleanValue) return "";
    return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const getRawAmount = (formattedValue: string) => {
    return parseFloat(formattedValue.replace(/\./g, '').replace(/,/g, '')) || 0;
  };
  
  useEffect(() => {
    if (accounts && accounts.length > 0 && !formData.sourceAccount) {
      const mainAccount = accounts.find(acc => acc.account_type === 'main');
      const defaultAccount = mainAccount || accounts[0];
      setFormData(prev => ({ ...prev, sourceAccount: defaultAccount.id.toString() }));
    }
  }, [accounts]);
  
  useEffect(() => {
    if (user && !formData.description) {
      const defaultDescription = `${user.username} CHUYEN TIEN`;
      setFormData(prev => ({ ...prev, description: defaultDescription }));
    }
  }, [user]);
  
  useEffect(() => {
    const editData = location.state?.editData;
    if (editData) {
      setFormData({
        sourceAccount: editData.sourceAccount,
        bank: editData.bank,
        recipientAccount: editData.recipientAccount,
        recipientName: editData.recipientName,
        amount: formatAmountInput(editData.amount),
        fee: editData.fee,
        description: editData.description,
      });
      return;
    }
    
    if (location.state && (location.state.account_number || location.state.recipientAccount || location.state.amount)) {
      setFormData(prevData => ({
        ...prevData,
        recipientAccount: location.state.account_number || location.state.recipientAccount || prevData.recipientAccount,
        amount: location.state.amount ? formatAmountInput(String(location.state.amount)) : prevData.amount,
        description: location.state.description || prevData.description,
      }));
      toast.info("Transfer details have been pre-filled for your review.");
    }
  }, [location.state]);

  useEffect(() => {
    const lookupRecipient = async () => {
      if (formData.bank !== 'vigipay' || formData.recipientAccount.length !== 10) {
        setLookupState({ loading: false, error: null, verified: false });
        setFormData(prev => ({ ...prev, recipientName: '' }));
        return;
      }

      setLookupState({ loading: true, error: null, verified: false });

      try {
        const response = await fetch(`${API_BASE_URL}/bank-accounts/lookup/${formData.recipientAccount}`);
        
        if (!response.ok) {
          const error = await response.json();
          setLookupState({ 
            loading: false, 
            error: error.detail || 'Account not found. Please check the account number.', 
            verified: false 
          });
          setFormData(prev => ({ ...prev, recipientName: '' }));
          return;
        }

        const data = await response.json();
        setFormData(prev => ({ ...prev, recipientName: data.account_holder_name }));
        setLookupState({ loading: false, error: null, verified: true });
        
      } catch (error) {
        console.error('Lookup error:', error);
        setLookupState({ 
          loading: false, 
          error: 'Failed to lookup account. Please try again.', 
          verified: false 
        });
        setFormData(prev => ({ ...prev, recipientName: '' }));
      }
    };

    const timeoutId = setTimeout(lookupRecipient, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.bank, formData.recipientAccount]);
  
  const selectedAccount = useMemo(() => {
    if (!accounts || !formData.sourceAccount) return null;
    return accounts.find(acc => acc.id.toString() === formData.sourceAccount);
  }, [accounts, formData.sourceAccount]);
  
  const transferFee = useMemo(() => {
    const amount = getRawAmount(formData.amount);
    if (amount <= 0) return 0;
    return calculateTransferFee(amount);
  }, [formData.amount]);
  
  const totalDeduction = useMemo(() => {
    const amount = getRawAmount(formData.amount);
    return amount; 
  }, [formData.amount, transferFee, formData.fee]);
  
  const handleRecipientClick = async (recipient: RecentRecipient) => {
    setFormData(prev => ({
      ...prev,
      bank: recipient.bank,
      recipientAccount: recipient.account_number,
      recipientName: recipient.account_name
    }));
    
    if (recipient.bank === 'vigipay') {
      setLookupState({ loading: false, error: null, verified: true });
    }
    
    toast.success(t('recipientSelected') || 'Recipient information filled');
  };

  const handleConfirm = async () => {
    if (!formData.sourceAccount) {
      toast.error(t('selectSourceAccount') || "Please select source account");
      return;
    }
    if (!formData.bank) {
      toast.error(t('selectBank') || "Please select a bank");
      return;
    }
    if (!formData.recipientAccount) {
      toast.error(t('enterRecipientAccount') || "Please enter recipient account number");
      return;
    }
    if (!/^\d{10}$/.test(formData.recipientAccount)) {
      toast.error(t('accountNumberMust10Digits') || "Account number must be exactly 10 digits");
      return;
    }
    if (!formData.recipientName || formData.recipientName.trim() === '') {
      toast.error(t('enterRecipientName') || "Please enter recipient name");
      return;
    }
    
    if (formData.bank === 'vigipay' && lookupState.error) {
      toast.error(lookupState.error);
      return;
    }
    if (formData.bank === 'vigipay' && !lookupState.verified) {
      toast.error("Please wait for account verification to complete");
      return;
    }
    
    const amount = getRawAmount(formData.amount);
    
    if (!formData.amount || amount <= 0) {
      toast.error(t('enterValidAmount') || "Please enter a valid amount");
      return;
    }
    if (selectedAccount && totalDeduction > selectedAccount.balance) {
      toast.error(
        `${t('insufficientBalance') || 'Insufficient balance'}. ${t('available')}: ${formatCurrency(selectedAccount.balance)}, ${t('required')}: ${formatCurrency(totalDeduction)}`
      );
      return;
    }
    navigate("/safety-checking", {
      state: {
        sender_account_id: parseInt(formData.sourceAccount),
        sender_account_number: selectedAccount?.account_number,
        sender_account_type: selectedAccount?.account_type,
        sender_balance: selectedAccount?.balance,
        receiver_account_number: formData.recipientAccount,
        receiver_bank: formData.bank,
        receiver_name: formData.recipientName.trim(),
        amount: amount, 
        fee: transferFee,
        fee_payer: formData.fee,
        description: formData.description && formData.description.trim() ? formData.description.trim() : undefined,
        total_deduction: totalDeduction,
        remaining_balance: (selectedAccount?.balance || 0) - totalDeduction,
      }
    });
  };

  return (
    <DashboardLayout sidebar={<AppSidebar />}>
      <div className="p-4 md:p-8 max-w-[1200px] mx-auto animate-fade-in">
        {accountsLoading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-accent-green" />
          </div>
        )}

        {!accountsLoading && accounts && accounts.length === 0 && (
          <Card className="glass-card border-border/30">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                {t('noAccountsForTransfer') || 'No accounts available for transfer'}
              </p>
              <Button onClick={() => navigate("/")}>
                {t('backToHome')}
              </Button>
            </CardContent>
          </Card>
        )}

        {!accountsLoading && accounts && accounts.length > 0 && (
          <>
        <TransactionProgressHeader currentStep={1} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Left Column - Form */}
          <div className="space-y-4 md:space-y-6">
            {/* Source Account */}
            <Card className="glass-card border-border/30">
              <CardHeader>
                <CardTitle className="text-base md:text-lg font-semibold text-foreground">
                  {t('sourceAccount')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select 
                  value={formData.sourceAccount}
                  onValueChange={(value) => setFormData({ ...formData, sourceAccount: value })}
                >
                  <SelectTrigger className="bg-background/50 border-border/30 h-10 md:h-11">
                    <SelectValue placeholder={t('selectAccount') || 'Select account'} />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(account => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.account_number} - {account.account_type} ({formatCurrency(account.balance)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="flex justify-between items-center p-3 md:p-4 rounded-lg bg-background/30">
                  <span className="text-sm md:text-base text-muted-foreground">{t('currentBalance')}</span>
                  <span className="text-lg md:text-xl font-semibold text-foreground">
                    {selectedAccount ? formatCurrency(selectedAccount.balance) : '---'}
                  </span>
                </div>
                
                {totalDeduction > 0 && selectedAccount && (
                  <div className="flex justify-between items-center p-3 md:p-4 rounded-lg bg-accent-green/10 border border-accent-green/30">
                    <span className="text-sm md:text-base text-foreground">{t('afterTransfer') || 'After transfer'}</span>
                    <span className={`text-lg md:text-xl font-semibold ${
                      selectedAccount.balance - totalDeduction < 0 ? 'text-red-500' : 'text-accent-green'
                    }`}>
                      {formatCurrency(selectedAccount.balance - totalDeduction)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recipient Information */}
            <Card className="glass-card border-border/30">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base md:text-lg font-semibold text-foreground">
                  {t('recipientInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bank" className="text-foreground">{t('Recipient Bank')}</Label>
                  <Select
                    value={formData.bank}
                    onValueChange={(value) => setFormData({ ...formData, bank: value })}
                  >
                    <SelectTrigger id="bank" className="bg-background/50 border-border/30 h-10 md:h-11">
                      <SelectValue placeholder={t('receiverBank')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vigipay">VigiPay (Internal Transfer)</SelectItem>
                      <SelectItem value="vcb">Vietcombank</SelectItem>
                      <SelectItem value="vietinbank">VietinBank</SelectItem>
                      <SelectItem value="bidv">BIDV</SelectItem>
                      <SelectItem value="acb">ACB</SelectItem>
                      <SelectItem value="techcombank">Techcombank</SelectItem>
                      <SelectItem value="mbbank">MB Bank</SelectItem>
                      <SelectItem value="tpbank">TPBank</SelectItem>
                      <SelectItem value="vpbank">VPBank</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Warning for mock transfers */}
                  {formData.bank && formData.bank !== 'vigipay' && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mt-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        <strong>Mock Transfer:</strong> This is a demonstration transfer. Money will be deducted from your account but no real inter-bank transfer will occur.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account" className="text-sm md:text-base text-foreground">
                    {t('recipientAccount')} <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="account"
                      type="text"
                      placeholder="0123456789"
                      className="bg-background/50 border-border/30 pr-10 h-10 md:h-11 text-sm md:text-base"
                      value={formData.recipientAccount}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData({ ...formData, recipientAccount: value });
                      }}
                      maxLength={10}
                    />
                    <Copy 
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent-green cursor-pointer hover:scale-110 transition-all duration-300" 
                      onClick={() => {
                        if (formData.recipientAccount) {
                          navigator.clipboard.writeText(formData.recipientAccount);
                          toast.success("Account number copied!");
                        }
                      }}
                    />
                  </div>
                  <p className={`text-xs ${
                    formData.recipientAccount.length === 10 ? 'text-green-500' : 'text-muted-foreground'
                  }`}>
                    {formData.recipientAccount.length}/10 {t('digits') || 'digits'}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="recipientName" className="text-sm md:text-base text-foreground">
                    {t('recipientName') || 'Recipient name'} <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="recipientName"
                      placeholder={formData.bank === 'vigipay' ? 'Auto-filled for VigiPay' : (t('recipientName') || 'Recipient name')}
                      className="bg-background/50 border-border/30 h-10 md:h-11 text-sm md:text-base pr-10"
                      value={formData.recipientName}
                      onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                      disabled={formData.bank === 'vigipay'}
                    />
                    {formData.bank === 'vigipay' && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {lookupState.loading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                        {lookupState.verified && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        {lookupState.error && <AlertCircle className="h-4 w-4 text-red-500" />}
                      </div>
                    )}
                  </div>
                  {formData.bank === 'vigipay' && lookupState.error && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {lookupState.error}
                    </p>
                  )}
                  {formData.bank === 'vigipay' && lookupState.verified && (
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Account verified: {formData.recipientName}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Transaction Information */}
            <Card className="glass-card border-border/30">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base md:text-lg font-semibold text-foreground">
                  {t('transactionInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm md:text-base text-foreground">{t('amount')}</Label>
                  <div className="relative">
                    <Input
                      id="amount"
                      type="text"
                      placeholder="0"
                      className="bg-background/50 border-border/30 pr-16 h-10 md:h-11 text-sm md:text-base"
                      value={formData.amount}
                      onChange={(e) => {
                        const formatted = formatAmountInput(e.target.value);
                        setFormData({ ...formData, amount: formatted });
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      VNĐ
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-sm md:text-base text-foreground">
                    {t('transactionContent')} <span className="text-xs text-muted-foreground">({t('canEdit') || 'Can edit'})</span>
                  </Label>
                  <Input
                    id="message"
                    placeholder={t('transactionContent')}
                    className="bg-background/50 border-border/30 h-10 md:h-11 text-sm md:text-base"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <Button 
                variant="outline" 
                className="flex-1 border-border/30 h-10 md:h-11 transition-all duration-300 hover:scale-[1.02]"
                onClick={() => navigate("/")}
              >
                {t('cancel')}
              </Button>
              <Button 
                className="flex-1 bg-accent-green hover:bg-accent-green/90 text-background h-10 md:h-11 transition-all duration-300 hover:scale-[1.02]"
                onClick={handleConfirm}
                disabled={!selectedAccount || totalDeduction > selectedAccount.balance}
              >
                {t('confirm')}
              </Button>
            </div>
          </div>

          {/* Right Column - Info Cards (Quick Transactions Removed) */}
          <div className="space-y-4 md:space-y-6">
            {/* Tips */}
            <Card className="glass-card border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base md:text-lg font-semibold text-foreground flex items-center gap-2">
                  <Info className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  {t('transferNotes')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs md:text-sm text-muted-foreground">
                <p>• {t('checkRecipient')}</p>
                <p>• {t('transferLimit')}</p>
                <p>• {t('processingTime')}</p>
              </CardContent>
            </Card>

            {/* Recent Recipients */}
            {recentRecipients && recentRecipients.length > 0 && (
              <Card className="glass-card border-border/30">
                <CardHeader>
                  <CardTitle className="text-base md:text-lg font-semibold text-foreground">
                    {t('recentRecipients') || 'Recent Recipients'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentRecipients.map((recipient, index) => (
                    <button
                      key={index}
                      onClick={() => handleRecipientClick(recipient)}
                      className="w-full p-3 rounded-lg border border-border/30 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {recipient.account_name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {recipient.account_number} • {recipient.bank.toUpperCase()}
                          </p>
                        </div>
                        <Copy className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Transaction;