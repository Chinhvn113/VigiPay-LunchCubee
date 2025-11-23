import { DashboardLayout } from "@/components/DashboardLayout";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Home, FileText, ArrowRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

interface TransactionData {
  sourceAccount: string;
  recipientAccount: string;
  bank: string;
  amount: string;
  description: string;
}

const TransactionSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [transactionData, setTransactionData] = useState<TransactionData | null>(null);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const data = location.state as TransactionData;
    
    if (!data) {
      navigate("/");
      return;
    }

    setTransactionData(data);

    const transaction = {
      id: Date.now().toString(),
      sender: data.sourceAccount,
      receiver: data.recipientAccount,
      bank: data.bank,
      amount: parseFloat(data.amount),
      description: data.description || t('transfer'),
      time: new Date().toISOString(),
      type: "sent" as const,
    };

    const stored = localStorage.getItem("transactions");
    const transactions = stored ? JSON.parse(stored) : [];
    transactions.unshift(transaction);
    localStorage.setItem("transactions", JSON.stringify(transactions));

    setTimeout(() => setShowConfetti(false), 3000);
  }, [location.state, navigate, t]);

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(parseFloat(amount));
  };

  const formatDate = () => {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date());
  };

  if (!transactionData) return null;

  return (
    <DashboardLayout sidebar={<AppSidebar />}>
      <div className="p-4 md:p-8 max-w-[800px] mx-auto">
        {/* Success Animation */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full bg-green-500/20 mb-4 animate-bounce">
            <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12 text-green-500" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            {t('transactionSuccessTitle') || 'Transaction Successful!'}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {t('transactionSuccessDesc') || 'Your money has been transferred successfully'}
          </p>
        </div>

        {/* Transaction Details Card */}
        <Card className="glass-card border-border/30 mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <CardContent className="p-6 md:p-8 space-y-6">
            {/* Amount */}
            <div className="text-center py-6 border-b border-border/30">
              <p className="text-sm text-muted-foreground mb-2">{t('amount')}</p>
              <p className="text-3xl md:text-4xl font-bold text-accent-green">
                {formatCurrency(transactionData.amount)}
              </p>
            </div>

            {/* Transaction Info */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-border/10">
                <span className="text-sm text-muted-foreground mb-1 sm:mb-0">{t('sourceAccount')}</span>
                <span className="text-sm md:text-base font-medium text-foreground font-mono">
                  {transactionData.sourceAccount}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-border/10">
                <span className="text-sm text-muted-foreground mb-1 sm:mb-0">{t('receiverBank')}</span>
                <span className="text-sm md:text-base font-medium text-foreground">
                  {transactionData.bank === 'vcb' ? 'Vietcombank' : 
                   transactionData.bank === 'vietinbank' ? 'VietinBank' : 
                   transactionData.bank === 'bidv' ? 'BIDV' : transactionData.bank}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-border/10">
                <span className="text-sm text-muted-foreground mb-1 sm:mb-0">{t('recipientAccount')}</span>
                <span className="text-sm md:text-base font-medium text-foreground font-mono">
                  {transactionData.recipientAccount}
                </span>
              </div>

              {/*Transaction Fee Row */}

              <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-border/10">
                <span className="text-sm text-muted-foreground mb-1 sm:mb-0">{t('transactionContent')}</span>
                <span className="text-sm md:text-base font-medium text-foreground text-right sm:max-w-[60%]">
                  {transactionData.description || t('transfer')}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between py-3">
                <span className="text-sm text-muted-foreground mb-1 sm:mb-0">{t('date') || 'Date & Time'}</span>
                <span className="text-sm md:text-base font-medium text-foreground">
                  {formatDate()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/")}
            className="w-full gap-2 border-border/30 hover:bg-accent/50 transition-all duration-300 hover:scale-[1.02]"
          >
            <Home className="h-5 w-5" />
            <span>{t('backToHome')}</span>
          </Button>

          <Button
            size="lg"
            onClick={() => navigate("/transaction-history")}
            className="w-full gap-2 bg-accent-green hover:bg-accent-green/90 transition-all duration-300 hover:scale-[1.02]"
          >
            <FileText className="h-5 w-5" />
            <span>{t('viewHistory') || 'View History'}</span>
          </Button>
        </div>

        {/* Transaction Button */}
        <div className="mt-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => navigate("/transaction")}
            className="w-full gap-2 text-primary hover:bg-primary/10 transition-all duration-300 hover:scale-[1.02]"
          >
            <span>{t('newTransaction') || 'Make Another Transaction'}</span>
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TransactionSuccess;