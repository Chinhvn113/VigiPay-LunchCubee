import { DashboardLayout } from "@/components/DashboardLayout";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShieldCheck, AlertTriangle, MessageSquareWarning, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { TransactionProgressHeader } from "@/components/TransactionProgressHeader";

type CheckStatus = 
  | 'checking_ml'      // Initial check with Random Forest model
  | 'high_amount'      // Transfer amount > 90% of account balance
  | 'ml_warning'       // ML model flagged as potential scam
  | 'checking_llm'     // User submitted more info, checking with LLM
  | 'llm_warning'      // LLM also flagged as a scam
  | 'safe'             // Transaction is safe, redirecting
  | 'error';           // An API error occurred

export const SafetyCheckingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken } = useAuth();
  const token = accessToken;
  const { t } = useLanguage();

  const [status, setStatus] = useState<CheckStatus>('checking_ml');
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [mlMessage, setMlMessage] = useState("");
  const [llmVerdict, setLlmVerdict] = useState("");
  const [highAmountWarning, setHighAmountWarning] = useState("");

  const transactionData = location.state;

  useEffect(() => {
    if (!transactionData || !token) {
      toast.error("Missing transaction data. Redirecting...");
      navigate("/transaction");
      return;
    }

    const runInitialCheck = async () => {
      if (transactionData.sender_account_balance && transactionData.amount) {
        const transferPercentage = (transactionData.amount / transactionData.sender_account_balance) * 100;
        if (transferPercentage > 90) {
          const warning = `You are transferring ${transferPercentage.toFixed(1)}% of your account balance. Please confirm this is intentional.`;
          setHighAmountWarning(warning);
          setStatus('high_amount');
          return;
        }
      }

      try {
        const response = await fetch("/api/safety-check", {
          method: "POST",
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sender_account_id: transactionData.sender_account_id,
            amount: transactionData.amount,
            receiver_account_number: transactionData.receiver_account_number || null
          })
        });

        if (!response.ok) {
          throw new Error("Failed to perform safety check.");
        }

        const result = await response.json();

        if (result.is_safe) {
          setStatus('safe');
          toast.success(t('safeRedirect'));
          setTimeout(() => {
            navigate("/transaction-confirmation", { state: transactionData });
          }, 1500);
        } else {
          setMlMessage(result.message);
          setStatus('ml_warning');
        }
      } catch (error) {
        console.error("Safety check error:", error);
        setStatus('error');
        toast.error(t('checkErrorDesc'));
      }
    };

    runInitialCheck();
  }, [token, transactionData, navigate, t]);

  const handleLlmCheck = async () => {
    if (!additionalInfo.trim()) {
      toast.error(t('provideContext'));
      return;
    }
    setStatus('checking_llm');
    
    const combinedInput = `
      A user is making a transfer with the following details:
      - Amount: ${transactionData.amount}
      - Recipient: ${transactionData.receiver_name} (${transactionData.receiver_account_number})
      - Description: ${transactionData.description || 'Not provided'}

      The user has provided the following additional context or chat messages:
      ---
      ${additionalInfo}
      ---
      Based on all this information, does this sound like a scam?
    `;

    try {
      const response = await fetch("/api/scam-check", {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ input: combinedInput })
      });

      if (!response.ok) throw new Error("LLM scam check failed.");
      const result = await response.json();

      if (result.verdict && result.verdict.toLowerCase().includes("not a scam")) {
        toast.success(t('safeRedirect'));
        setStatus('safe');
        setTimeout(() => {
          navigate("/transaction-confirmation", { state: transactionData });
        }, 1500);
      } else {
        setLlmVerdict(result.verdict);
        setStatus('llm_warning');
      }
    } catch (error) {
      toast.error(t('checkErrorDesc'));
      setStatus('ml_warning'); // Revert to previous state
    }
  };

  const handleSkipAndContinue = () => {
    navigate("/transaction-confirmation", { state: transactionData });
  };

  const handleConfirmHighAmount = () => {
    setStatus('checking_ml');
    // Re-run the safety check
    const runInitialCheck = async () => {
      try {
        const response = await fetch("/api/safety-check", {
          method: "POST",
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sender_account_id: transactionData.sender_account_id,
            amount: transactionData.amount,
            receiver_account_number: transactionData.receiver_account_number || null
          })
        });

        if (!response.ok) {
          throw new Error("Failed to perform safety check.");
        }

        const result = await response.json();

        if (result.is_safe) {
          setStatus('safe');
          toast.success(t('safeRedirect'));
          setTimeout(() => {
            navigate("/transaction-confirmation", { state: transactionData });
          }, 1500);
        } else {
          setMlMessage(result.message);
          setStatus('ml_warning');
        }
      } catch (error) {
        console.error("Safety check error:", error);
        setStatus('error');
        toast.error(t('checkErrorDesc'));
      }
    };
    runInitialCheck();
  };
  
  const handleCancel = () => {
    toast.info(t('cancelTransaction'));
    navigate("/transaction");
  }

  const renderContent = () => {
    switch (status) {
      case 'high_amount':
        return (
          <div className="space-y-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>High Transfer Amount</AlertTitle>
              <AlertDescription>{highAmountWarning}</AlertDescription>
            </Alert>
            <p className="text-center text-sm text-muted-foreground">
              This is an unusual amount to transfer. Please make sure you know the recipient and this transaction is legitimate.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={handleConfirmHighAmount} className="flex-1">
                Confirm and Continue
              </Button>
              <Button onClick={handleCancel} variant="outline" className="flex-1">
                Cancel Transaction
              </Button>
            </div>
          </div>
        );

      case 'checking_ml':
      case 'checking_llm':
        return (
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <h2 className="text-xl font-semibold">{t('analyzing')}</h2>
            <p className="text-muted-foreground">{t('analyzingDesc')}</p>
          </div>
        );

      case 'safe':
        return (
          <div className="text-center space-y-4 text-green-500">
            <ShieldCheck className="h-12 w-12 mx-auto" />
            <h2 className="text-xl font-semibold">{t('allClear')}</h2>
            <p>{t('safeRedirect')}</p>
          </div>
        );

      case 'ml_warning':
        return (
          <div className="space-y-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('potentialRisk')}</AlertTitle>
              <AlertDescription>{mlMessage}</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="context">{t('provideContext')}</Label>
              <Textarea
                id="context"
                placeholder={t('contextPlaceholder')}
                rows={5}
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={handleLlmCheck} className="flex-1">
                {t('checkAI')}
              </Button>
              <Button onClick={handleSkipAndContinue} variant="secondary" className="flex-1">
                {t('skipContinue')} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      
      case 'llm_warning':
        return (
          <div className="space-y-6">
            <Alert variant="destructive">
              <MessageSquareWarning className="h-4 w-4" />
              <AlertTitle>{t('highRisk')}</AlertTitle>
              <AlertDescription>
                {t('highRiskDesc')}
                <p className="font-medium mt-2">{t('aiVerdict')}</p>
                <p className="italic">"{llmVerdict}"</p>
              </AlertDescription>
            </Alert>
             <p className="text-center text-lg font-medium">{t('sureProceed')}</p>
            <div className="flex flex-col sm:flex-row gap-4">
               <Button onClick={handleCancel} variant="outline" className="flex-1">
                {t('cancelTransaction')}
              </Button>
              <Button onClick={handleSkipAndContinue} variant="destructive" className="flex-1">
                {t('continueAnyway')}
              </Button>
            </div>
          </div>
        );
        
      case 'error':
        return (
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold">{t('errorOccurred')}</h2>
            <p className="text-muted-foreground">{t('checkErrorDesc')}</p>
            <Button onClick={handleCancel}>{t('backToTransfer')}</Button>
          </div>
        );
    }
  };

  return (
    <DashboardLayout sidebar={<AppSidebar />}>
      <div className="p-4 md:p-8 max-w-2xl mx-auto animate-fade-in">
        <TransactionProgressHeader currentStep={2} />
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">{t('safetyCheckTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="min-h-[250px] flex items-center justify-center">
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};