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

  const transactionData = location.state;

  // --- 1. Initial ML Safety Check ---
  useEffect(() => {
    if (!transactionData || !token) {
      toast.error("Missing transaction data. Redirecting...");
      navigate("/transaction");
      return;
    }

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
          })
        });

        if (!response.ok) {
          throw new Error("Failed to perform safety check.");
        }

        const result = await response.json();

        if (result.is_safe) {
          setStatus('safe');
          toast.success("Transaction is safe. Proceeding to confirmation.");
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
        toast.error("Could not complete safety check due to a server error.");
      }
    };

    runInitialCheck();
  }, [token, transactionData, navigate]);

  // --- 2. Deeper LLM Scam Check ---
  const handleLlmCheck = async () => {
    if (!additionalInfo.trim()) {
      toast.error("Please provide some context about this transaction.");
      return;
    }
    setStatus('checking_llm');
    
    // Combine transaction details with user's context for a better prompt
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
        toast.success("AI analysis suggests this is likely safe. Proceeding.");
        setStatus('safe');
        setTimeout(() => {
          navigate("/transaction-confirmation", { state: transactionData });
        }, 1500);
      } else {
        setLlmVerdict(result.verdict);
        setStatus('llm_warning');
      }
    } catch (error) {
      toast.error("Could not complete AI analysis. Please try again.");
      setStatus('ml_warning'); // Revert to the previous state
    }
  };

  const handleSkipAndContinue = () => {
    navigate("/transaction-confirmation", { state: transactionData });
  };
  
  const handleCancel = () => {
    toast.info("Transaction cancelled.");
    navigate("/transaction");
  }

  // --- UI Rendering based on Status ---
  const renderContent = () => {
    switch (status) {
      case 'checking_ml':
      case 'checking_llm':
        return (
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <h2 className="text-xl font-semibold">Analyzing Transaction...</h2>
            <p className="text-muted-foreground">Please wait while we check your transaction for potential risks.</p>
          </div>
        );

      case 'safe':
        return (
          <div className="text-center space-y-4 text-green-500">
            <ShieldCheck className="h-12 w-12 mx-auto" />
            <h2 className="text-xl font-semibold">All Clear!</h2>
            <p>Your transaction appears safe. Redirecting you to the confirmation page...</p>
          </div>
        );

      case 'ml_warning':
        return (
          <div className="space-y-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Potential Risk Detected</AlertTitle>
              <AlertDescription>{mlMessage}</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="context">For a more accurate check, provide context (e.g., chat messages):</Label>
              <Textarea
                id="context"
                placeholder="Copy and paste the conversation that led to this transfer..."
                rows={5}
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={handleLlmCheck} className="flex-1">
                Check with Advanced AI
              </Button>
              <Button onClick={handleSkipAndContinue} variant="secondary" className="flex-1">
                Skip & Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      
      case 'llm_warning':
        return (
          <div className="space-y-6">
            <Alert variant="destructive">
              <MessageSquareWarning className="h-4 w-4" />
              <AlertTitle>High Risk Warning!</AlertTitle>
              <AlertDescription>
                Our advanced AI analysis also indicates a high risk of a scam.
                <p className="font-medium mt-2">AI Verdict:</p>
                <p className="italic">"{llmVerdict}"</p>
              </AlertDescription>
            </Alert>
             <p className="text-center text-lg font-medium">Are you absolutely sure you want to proceed?</p>
            <div className="flex flex-col sm:flex-row gap-4">
               <Button onClick={handleCancel} variant="outline" className="flex-1">
                Cancel Transaction
              </Button>
              <Button onClick={handleSkipAndContinue} variant="destructive" className="flex-1">
                Yes, Continue Anyway
              </Button>
            </div>
          </div>
        );
        
      case 'error':
        return (
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold">An Error Occurred</h2>
            <p className="text-muted-foreground">We couldn't complete the safety check. Please try again.</p>
            <Button onClick={handleCancel}>Back to Transfer</Button>
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
            <CardTitle className="text-2xl text-center">Transaction Safety Check</CardTitle>
          </CardHeader>
          <CardContent className="min-h-[250px] flex items-center justify-center">
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};