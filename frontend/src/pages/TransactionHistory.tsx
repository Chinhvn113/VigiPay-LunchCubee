import { DashboardLayout } from "@/components/DashboardLayout";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, ArrowDownLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useState } from "react";
import { useBankAccounts, useTransferHistory } from "@/hooks/useBankAccount";
import { formatCurrency } from "@/services/bankService";

const TransactionHistory = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  
  // Fetch accounts for filter
  const { data: accounts } = useBankAccounts();
  
  // Fetch transfer history
  const { data: transfers, isLoading, isError, error } = useTransferHistory(selectedAccountId);

  
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
  
  // Get bank name display
  const getBankName = (bankCode: string) => {
    const bankNames: Record<string, string> = {
      'vcb': 'Vietcombank',
      'vietinbank': 'VietinBank',
      'bidv': 'BIDV',
      'acb': 'ACB',
      'techcombank': 'Techcombank',
      'mbbank': 'MB Bank',
      'tpbank': 'TPBank',
      'vpbank': 'VPBank',
    };
    return bankNames[bankCode] || bankCode.toUpperCase();
  };
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-500';
      case 'pending':
        return 'text-yellow-500';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };
  
  // Get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return t('completed');
      case 'pending':
        return t('pending');
      case 'failed':
        return t('failed');
      default:
        return status;
    }
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

    if (!transfers || transfers.length === 0) {
      return (
        <Card className="glass-card border-border/30">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-2">
              {selectedAccountId 
                ? (t('noTransfersForAccount') || 'No transfers for this account')
                : (t('noTransfers') || 'No transfers yet')}
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
        {transfers.map((transfer) => {
          // Determine if this is a sent or received transfer (for our user)
          const isSent = accounts?.some(acc => acc.id === transfer.sender_account_id);
          
          return (
            <Card
              key={transfer.id}
              className="glass-card border-border/30 hover:border-primary/30 transition-all duration-300"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Icon */}
                    <div
                      className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center ${
                        isSent ? "bg-red-500/10" : "bg-green-500/10"
                      }`}
                    >
                      {isSent ? (
                        <ArrowUpRight className="h-6 w-6 text-red-500" />
                      ) : (
                        <ArrowDownLeft className="h-6 w-6 text-green-500" />
                      )}
                    </div>

                    {/* Transfer Details */}
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-foreground">
                            {isSent ? t('sentTo') || 'Sent to' : t('receivedFrom') || 'Received from'}: {transfer.receiver_account_number}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {getBankName(transfer.receiver_bank)}
                            {transfer.receiver_name && ` - ${transfer.receiver_name}`}
                          </p>
                        </div>
                        <span
                          className={`text-lg font-bold flex-shrink-0 ${
                            isSent ? "text-red-500" : "text-green-500"
                          }`}
                        >
                          {isSent ? "-" : "+"}
                          {formatCurrency(transfer.amount)}
                        </span>
                      </div>

                      {/* Additional Info */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>{formatDate(transfer.created_at)}</span>
                        <span>•</span>
                        <span>{t('fee')}: {formatCurrency(transfer.fee)} ({transfer.fee_payer === 'sender' ? t('senderPays') : t('receiverPays')})</span>
                        <span>•</span>
                        <span className={getStatusColor(transfer.status)}>
                          {getStatusText(transfer.status)}
                        </span>
                      </div>
                      
                      {transfer.description && (
                        <p className="text-sm text-muted-foreground italic">
                          "{transfer.description}"
                        </p>
                      )}
                      
                      {/* Sender Account */}
                      {isSent && (
                        <p className="text-xs text-muted-foreground">
                          {t('from')}: {transfer.sender_account_number}
                        </p>
                      )}
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
        {/* Header with Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              {t('transactionHistory')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('viewTransferHistory') || 'View your transfer history'}
            </p>
          </div>
          
          {/* Account Filter */}
          {accounts && accounts.length > 0 && (
            <div className="w-full sm:w-auto min-w-[200px]">
              <Select 
                value={selectedAccountId?.toString() || "all"} 
                onValueChange={(value) => setSelectedAccountId(value === "all" ? undefined : parseInt(value))}
              >
                <SelectTrigger className="bg-background/50 border-border/30">
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
            </div>
          )}
        </div>

        {/* Transfers List */}
        {renderContent()}
      </div>
    </DashboardLayout>
  );
};

export default TransactionHistory;