import { DashboardLayout } from "@/components/DashboardLayout";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle2, FileUp, Quote, AlertTriangle } from "lucide-react";
import { useState, useCallback, DragEvent, ChangeEvent, FormEvent, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { VoiceCommandButton } from "@/components/VoiceCommandButton";
import { useAuth } from "@/contexts/AuthContext";
import { toast as sonnerToast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useBankAccounts } from "@/hooks/useBankAccount";
import { calculateTransferFee } from "@/apis/bankService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


const formatCurrency = (value: string) => {
  if (!value) return '';
  const numberValue = parseInt(value.replace(/,/g, ''), 10);
  if (isNaN(numberValue)) return '';
  return numberValue.toLocaleString('en-US');
};

const SafetyChecking = () => {
  const [senderAccountId, setSenderAccountId] = useState("");
  const [recipientAccount, setRecipientAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiChecking, setIsAiChecking] = useState(false); 
  const [isDragging, setIsDragging] = useState(false);
  
  const [voiceTranscript, setVoiceTranscript] = useState("");
  
  const [showFraudAlert, setShowFraudAlert] = useState(false);
  const [fraudMessage, setFraudMessage] = useState("");
  const [fraudImageData, setFraudImageData] = useState<string | null>(null);

  const { t } = useLanguage();
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: userAccounts, isLoading: accountsLoading } = useBankAccounts();

  const handleVoiceSuccess = (data: any) => {
    if (data.transcript) {
      setVoiceTranscript(data.transcript);
    }

    if (data.intent === 'transfer_money') {
      sonnerToast.success("Voice command recognized!");

      const accNum = data.recipient_account || data.entities?.account_number;
      
      if (accNum && accNum !== "UNKNOWN_ACCOUNT") {
        setRecipientAccount(accNum);
      }

      const valAmount = data.amount || data.entities?.amount;
      if (valAmount) {
        setAmount(formatCurrency(String(valAmount)));
      }

      const desc = data.description || data.entities?.description;
      if (desc) {
        setReason(desc);
      }
      
    } else {
      sonnerToast.error("Could not recognize transfer details from your command.");
    }
  };

  const handleScamCheck = async (userMessage: string, imageData: string | undefined, toastId: string | number) => {
    try {
      const payload = { 
        messages: [{ 
          role: "user", 
          content: userMessage,
          image_data: imageData,
          text: userMessage
        }],
        max_tokens: 100 
      };
      const response = await fetch("/api/chat-with-rag", {
        method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("Scam check failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let scamVerdict = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n').filter((line: string) => line.trim() !== '');
        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[ERROR]')) {
            scamVerdict += line.substring(6);
          }
        }
      }

      const isSuspicious = scamVerdict.toLowerCase().includes('scam') || 
                          scamVerdict.toLowerCase().includes('suspicious') || 
                          scamVerdict.toLowerCase().includes('fraud');

      if (isSuspicious) {
        sonnerToast.dismiss(toastId);
        setFraudMessage(scamVerdict || "Potential scam detected in the transaction details.");
        setFraudImageData(imageData || null);
        setShowFraudAlert(true);
      } else {
        sonnerToast.success("Scam check passed. Extracting details...", { id: toastId });
      }
    } catch (error: any) {
      sonnerToast.error("Scam check error: " + error.message, { id: toastId });
    }
  };

  const detectIntentAndRoute = async (userMessage: string, imageData: string | undefined, toastId: string | number) => {
    try {
      const payload = { messages: [{ role: "user", content: userMessage, image_data: imageData }] };
      const response = await fetch("/api/chat", {
        method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("Intent detection failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let fullResponse = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n').filter((line: string) => line.trim() !== '');
        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[ERROR]')) {
            fullResponse += line.substring(6);
          }
        }
      }

      if (fullResponse.toLowerCase().includes('scam') || fullResponse.toLowerCase().includes('suspicious') || fullResponse.toLowerCase().includes('fraud')) {
        await handleScamCheck(userMessage, imageData, toastId);
      } else {
        sonnerToast.success("Analysis complete. Safe to proceed.", { id: toastId });
      }
    } catch (error: any) {
      sonnerToast.error("Intent detection error: " + error.message, { id: toastId });
    }
  };

  const processImageUpload = async (file: File) => {
    setIsAiChecking(true);
    const toastId = sonnerToast.loading("Analyzing image with OCR and AI...");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/extract-transfer-details", {
        method: "POST",
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData,
      });
      if (!response.ok) throw new Error((await response.json()).detail || "Failed to process image.");
      const data = await response.json();

      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });

      setRecipientAccount(data.account_number || "");
      setAmount(data.amount ? formatCurrency(String(data.amount)) : "");
      setReason(data.description || "");
      sonnerToast.success("Image details extracted! Now checking for threats...", { id: toastId });

      await detectIntentAndRoute(
        data.description || `Transfer ${data.amount} to ${data.account_number}`,
        imageBase64,
        toastId
      );
    } catch (error: any) {
      sonnerToast.error(error.message, { id: toastId });
    } finally {
      setIsAiChecking(false);
    }
  };
  
  const processAudioUpload = async (file: File) => {
    const toastId = sonnerToast.loading("Transcribing audio and analyzing...");
    const formData = new FormData();
    formData.append("file", file, file.name);

    try {
      const response = await fetch("/api/extract-transfer-details", {
        method: "POST",
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData,
      });
      if (!response.ok) throw new Error((await response.json()).detail || "Failed to process audio file.");
      const data = await response.json();

      setRecipientAccount(data.account_number || "");
      setAmount(data.amount ? formatCurrency(String(data.amount)) : "");
      setReason(data.description || "");
      sonnerToast.success("Audio details extracted successfully!", { id: toastId });
    } catch (error: any) {
      sonnerToast.error(error.message, { id: toastId });
    }
  };

  const handleFileUpload = async (file: File | null | undefined) => {
    if (!file) return;
    if (!accessToken) {
      sonnerToast.error("Authentication error. Please log in again.");
      return;
    }
    
    if (file.type.startsWith('image/')) {
      await processImageUpload(file);
    } else if (file.type.startsWith('audio/')) {
      setIsProcessing(true);
      try {
        await processAudioUpload(file);
      } finally {
        setIsProcessing(false);
      }
    } else {
      sonnerToast.error("Unsupported file type.");
    }
  };

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!senderAccountId) return sonnerToast.error("Please select a sending account.");
    if (!recipientAccount || !amount) return sonnerToast.error("Please enter recipient and amount.");
    if (!userAccounts || userAccounts.length === 0) return sonnerToast.error(accountsLoading ? "Loading accounts..." : "No sending account found.");
    
    setIsProcessing(true);
    const toastId = sonnerToast.loading("Performing safety check...");
    const senderAccount = userAccounts.find(acc => acc.id === parseInt(senderAccountId));
    
    if (!senderAccount) {
      sonnerToast.error("Selected account not found.", { id: toastId });
      setIsProcessing(false);
      return;
    }
    
    const numericAmount = parseInt(amount.replace(/,/g, ''), 10);
    
    try {
      const response = await fetch("/api/safety-check", {
        method: "POST",
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_account_id: senderAccount.id, amount: numericAmount })
      });
      if (!response.ok) throw new Error((await response.json()).detail || "Safety check failed.");
      const result = await response.json();
      
      if (result.is_safe) {
        sonnerToast.success("Transaction safe.", { id: toastId });
        const fee = calculateTransferFee(numericAmount);
        navigate("/transaction-confirmation", { state: { sender_account_id: senderAccount.id, sender_account_number: senderAccount.account_number, sender_balance: senderAccount.balance, receiver_account_number: recipientAccount, receiver_bank: "SENTINEL-BANK", receiver_name: "Recipient", amount: numericAmount, fee, fee_payer: "sender", description: reason, total_deduction: numericAmount + fee, remaining_balance: senderAccount.balance - (numericAmount + fee) } });
      } else {
        sonnerToast.warning("This account is ambiguous.", { id: toastId });
        navigate("/transaction", { state: { prefill: { recipientAccount, amount: numericAmount, description: reason } } });
      }
    } catch (error: any) {
      sonnerToast.error(error.message, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFraudContinue = () => { setShowFraudAlert(false); sonnerToast.info("Proceeding with transaction. Please verify details carefully."); };
  const handleFraudStop = () => { setShowFraudAlert(false); setRecipientAccount(""); setAmount(""); setReason(""); setFraudImageData(null); sonnerToast.warning("Transaction cancelled."); };

  return (
    <DashboardLayout sidebar={<AppSidebar />}>
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Safety Checking</h1>
          </div>
          <p className="text-muted-foreground">
            Auto-fill transfer details using AI and check for potential threats before you send money.
          </p>
        </div>

        <Card
          onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
          className={`transition-all ${isDragging ? 'border-primary ring-2 ring-primary' : ''}`}
        >
          <CardHeader>
            <CardTitle>Transaction Checking</CardTitle>
            <CardDescription>
              Use live voice, or upload/drag an image or audio file to auto-fill the form.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-background/50 rounded-lg border border-dashed flex flex-col sm:flex-row items-center justify-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">Auto-fill with:</span>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isProcessing || isAiChecking}>
                <FileUp className="mr-2 h-4 w-4" />
                Upload File
              </Button>
              
              <VoiceCommandButton 
                onProcessing={setIsProcessing} 
                onSuccess={handleVoiceSuccess} 
                onTranscript={setVoiceTranscript} 
                size="sm" 
                disabled={isProcessing || isAiChecking} 
              />
              
              <input
                id="file-upload" ref={fileInputRef} type="file" accept="image/*,audio/*" className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleFileUpload(e.target.files?.[0])}
              />
            </div>
            
            {voiceTranscript && (
              <div className="bg-primary/5 border border-primary/20 rounded-md p-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start gap-3">
                  <Quote className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-primary mb-0.5">Listening / Detected:</p>
                    <p className="text-sm text-foreground/90 italic">"{voiceTranscript}"</p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="sender-account">Sending Account</Label>
                <Select value={senderAccountId} onValueChange={setSenderAccountId}>
                  <SelectTrigger id="sender-account"><SelectValue placeholder="Select an account to send from" /></SelectTrigger>
                  <SelectContent>
                    {userAccounts?.map((account) => (
                      <SelectItem key={account.id} value={String(account.id)}>
                        {account.account_number} - {formatCurrency(String(account.balance))} VND
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Account Number</Label>
                <Input id="recipient" placeholder="Enter 10-digit account number" value={recipientAccount}
                  onChange={(e) => setRecipientAccount(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (VND)</Label>
                <Input id="amount" placeholder="e.g., 500,000" value={amount}
                  onChange={(e) => setAmount(formatCurrency(e.target.value))} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Description</Label>
                <Textarea id="reason" placeholder="e.g., Monthly rent payment (Optional)" value={reason}
                  onChange={(e) => setReason(e.target.value)} rows={3} />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="submit" className="flex-1" disabled={isProcessing || accountsLoading || isAiChecking}>
                  {isProcessing ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Processing...</>
                  ) : isAiChecking ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />AI Checking...</>
                  ) : (
                    <><CheckCircle2 className="mr-2 h-4 w-4" />Confirm</>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setSenderAccountId(""); setRecipientAccount(""); setAmount(""); setReason(""); setVoiceTranscript(""); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showFraudAlert} onOpenChange={setShowFraudAlert}>
        <AlertDialogContent className="max-w-2xl w-full sm:max-w-md md:max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
          <AlertDialogHeader className="flex-shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <AlertDialogTitle>Potential Fraud Detected</AlertDialogTitle>
            </div>
          </AlertDialogHeader>
          <AlertDialogDescription className="flex-1 overflow-y-auto space-y-3 pr-4">
            <p className="font-semibold text-foreground break-words whitespace-pre-wrap">{fraudMessage}</p>
            {fraudImageData && (
              <img src={fraudImageData} alt="Suspicious transaction" className="w-full h-auto rounded-lg border" />
            )}
            <p className="text-sm text-muted-foreground">
              Please review the details carefully before proceeding. Do you want to continue or stop this transaction?
            </p>
          </AlertDialogDescription>
          <div className="flex gap-3 flex-shrink-0 mt-4">
            <AlertDialogCancel onClick={handleFraudStop}>Stop Transaction</AlertDialogCancel>
            <AlertDialogAction onClick={handleFraudContinue} className="bg-orange-600 hover:bg-orange-700">Skip & Continue</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default SafetyChecking;