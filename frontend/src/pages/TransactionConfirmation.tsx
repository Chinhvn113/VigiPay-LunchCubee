import { DashboardLayout } from "@/components/DashboardLayout";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useExecuteTransfer } from "@/hooks/useBankAccount";
import { formatCurrency, executeInternalTransfer } from "@/apis/bankService";
import { useEffect, useState } from "react";
import { TransactionProgressHeader } from "@/components/TransactionProgressHeader";
import { toast } from "sonner";

interface ConfirmationData {
  sender_account_id: number;
  sender_account_number: string;
  sender_account_type: string;
  sender_balance: number;
  receiver_account_number: string;
  receiver_bank: string;
  receiver_name: string;
  amount: number;
  description?: string;
  // fee and fee_payer are technically no longer needed here, 
  // but kept optional in interface to prevent type errors if passed from history
  fee?: number;
  fee_payer?: 'sender' | 'receiver';
}

const TransactionConfirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const executeTransfer = useExecuteTransfer();
  
  const confirmationData = location.state as ConfirmationData;

  useEffect(() => {
    // Redirect if no data
    if (!confirmationData) {
      navigate("/transaction");
    }
  }, [confirmationData, navigate]);

  if (!confirmationData) {
    return null;
  }

  // Calculate remaining balance locally to ensure it assumes 0 fee
  const finalRemainingBalance = confirmationData.sender_balance - confirmationData.amount;

  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    // Check if this is VigiPay internal transfer
    const isInternalTransfer = confirmationData.receiver_bank === 'vigipay';
    
    if (isInternalTransfer) {
      // Handle VigiPay internal transfer (REAL MONEY)
      setIsProcessing(true);
      try {
        const result = await executeInternalTransfer({
          sender_account_id: confirmationData.sender_account_id,
          receiver_account_number: confirmationData.receiver_account_number,
          amount: confirmationData.amount,
          description: confirmationData.description,
          fee_payer: 'sender',
        });
        
        toast.success(result.message || 'Transfer completed successfully!');
        
        navigate("/transaction-success", {
          state: {
            transferId: result.transfer_id,
            amount: result.amount_sent,
            fee: result.fee || 0,
            recipientAccount: confirmationData.receiver_account_number,
            recipientBank: 'VigiPay',
            recipientName: result.receiver_name,
            description: confirmationData.description,
            timestamp: new Date().toISOString(),
            isInternal: true,
          }
        });
      } catch (error: any) {
        console.error('Internal transfer error:', error);
        const errorMsg = error.response?.data?.detail || error.message || 'Transfer failed';
        toast.error(errorMsg);
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Handle external/mock transfer
      const transferData: any = {
        sender_account_id: confirmationData.sender_account_id,
        receiver_account_number: confirmationData.receiver_account_number,
        receiver_bank: confirmationData.receiver_bank,
        receiver_name: confirmationData.receiver_name,
        amount: confirmationData.amount,
      };
      
      if (confirmationData.description) {
        transferData.description = confirmationData.description;
      }
      
      executeTransfer.mutate(transferData, {
        onSuccess: (data) => {
          navigate("/transaction-success", {
            state: {
              transferId: data.id,
              amount: data.amount,
              fee: 0,
              recipientAccount: data.receiver_account_number,
              recipientBank: data.receiver_bank,
              recipientName: data.receiver_name,
              description: data.description,
              timestamp: data.created_at,
              isInternal: false,
            }
          });
        }
      });
    }
  };

  const handleEdit = () => {
    navigate("/transaction", {
      state: {
        editData: {
          sourceAccount: confirmationData.sender_account_id.toString(),
          recipientAccount: confirmationData.receiver_account_number,
          recipientName: confirmationData.receiver_name,
          bank: confirmationData.receiver_bank,
          amount: confirmationData.amount.toString(),
          description: confirmationData.description || '',
          // Removed fee preference from edit data
        }
      }
    });
  };

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

  return (
    <DashboardLayout sidebar={<AppSidebar />}>
      <div className="p-4 md:p-8 max-w-[800px] mx-auto animate-fade-in">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleEdit}
          className="mb-4 md:mb-6 text-foreground hover:text-primary gap-2 transition-all duration-300 hover:scale-105"
          disabled={executeTransfer.isPending}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('backToEdit') || 'Back to edit'}</span>
        </Button>
        <TransactionProgressHeader currentStep={3} />
        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-green/10 mb-4">
            <CheckCircle2 className="h-8 w-8 text-accent-green" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            {t('confirmTransfer') || 'Confirm Transfer'}
          </h1>
          <p className="text-muted-foreground">
            {t('reviewTransferDetails') || 'Please review your transfer details carefully'}
          </p>
        </div>

        {/* Transfer Details Card */}
        <Card className="glass-card border-border/30 mb-6">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              {t('transferDetails') || 'Transfer Details'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* From Account */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase">
                {t('fromAccount') || 'From Account'}
              </h3>
              <div className="flex justify-between items-start p-4 rounded-lg bg-background/50">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{confirmationData.sender_account_number}</p>
                  <p className="text-sm text-muted-foreground capitalize">{confirmationData.sender_account_type}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('currentBalance')}: {formatCurrency(confirmationData.sender_balance)}
                  </p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/50"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-sm text-muted-foreground">
                  {t('toAccount') || 'To Account'}
                </span>
              </div>
            </div>

            {/* To Account */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase">
                {t('toAccount') || 'To Account'}
              </h3>
              <div className="flex justify-between items-start p-4 rounded-lg bg-background/50">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{confirmationData.receiver_account_number}</p>
                  <p className="text-sm text-accent-green">{confirmationData.receiver_name}</p>
                  <p className="text-xs text-muted-foreground">{getBankName(confirmationData.receiver_bank)}</p>
                </div>
              </div>
            </div>

            {/* Amount Breakdown */}
            <div className="space-y-3 pt-4 border-t border-border/30">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t('transferAmount') || 'Transfer Amount'}</span>
                <span className="font-semibold text-foreground">{formatCurrency(confirmationData.amount)}</span>
              </div>
              
              {/* Fee and Total Deduction sections removed */}
                  
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t('remainingBalance') || 'Remaining Balance'}</span>
                <span className={`font-semibold ${
                  finalRemainingBalance >= 0 ? 'text-accent-green' : 'text-red-500'
                }`}>
                  {formatCurrency(finalRemainingBalance)}
                </span>
              </div>
            </div>

            {/* Description */}
            {confirmationData.description && (
              <div className="space-y-2 pt-4 border-t border-border/30">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {t('transactionContent') || 'Description'}
                </h3>
                <p className="text-foreground italic">"{confirmationData.description}"</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Warning Message */}
        <Card className="glass-card border-yellow-500/30 bg-yellow-500/5 mb-6">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {t('importantNotice') || 'Important Notice'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('transferWarning') || 'Please double-check all information. Once confirmed, the transfer will be processed immediately and cannot be reversed.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
          <Button 
            variant="outline" 
            className="flex-1 border-border/30 h-11 md:h-12 transition-all duration-300 hover:scale-[1.02]"
            onClick={handleEdit}
            disabled={executeTransfer.isPending}
          >
            {t('edit') || 'Edit'}
          </Button>
          <Button 
            className="flex-1 bg-accent-green hover:bg-accent-green/90 text-background h-11 md:h-12 transition-all duration-300 hover:scale-[1.02]"
            onClick={handleConfirm}
            disabled={executeTransfer.isPending || isProcessing}
          >
            {(executeTransfer.isPending || isProcessing) ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('processing') || 'Processing...'}
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t('confirmAndTransfer') || 'Confirm & Transfer'}
              </>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TransactionConfirmation;