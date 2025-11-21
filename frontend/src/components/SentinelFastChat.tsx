import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, ShieldCheck, X, ShieldAlert, CheckCircle2, MessageCircle, ImagePlus } from "lucide-react";
import { useState, useCallback, ChangeEvent, DragEvent, KeyboardEvent, useRef, ClipboardEvent } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type AnalysisResult = {
  category: 'BILL' | 'SCAM_CHECK' | 'CHAT' | 'ERROR';
  success: boolean;
  message?: string;
  amount?: number;
  description?: string;
  verdict?: string;
  extracted_text?: string;
  reply?: string;
};

export const SentinelFastChat = () => {
  const [inputText, setInputText] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- LOGIC XỬ LÝ (GIỮ NGUYÊN) ---
  const validateAndSetFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file (e.g., JPG, PNG).");
      return;
    }
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setResult(null);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          validateAndSetFile(file);
          toast.info("Image pasted from clipboard");
          return;
        }
      }
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleRemoveImage = () => {
    setImageFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAnalyze = async () => {
    if (!inputText.trim() && !imageFile) {
        toast.error("Please enter text or upload an image to analyze.");
        return;
    }
    setIsLoading(true);
    setResult(null);

    try {
        const token = localStorage.getItem('accessToken'); 
        if (!token) throw new Error("Please log in.");

        const formData = new FormData();
        if (imageFile) formData.append("image", imageFile);
        if (inputText.trim()) formData.append("text", inputText);

        const response = await fetch("/api/unified-analyze", {
          method: "POST",
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });

        if (!response.ok) throw new Error("Analysis failed.");

        const data: AnalysisResult = await response.json();
        setResult(data);

        if (data.category === 'BILL') {
            toast.success("Transaction saved successfully!");
            await queryClient.invalidateQueries({ queryKey: ['transactions'] });
            handleRemoveImage();
            setInputText("");
        } else if (data.category === 'SCAM_CHECK') {
            toast.success("Analysis complete.");
        }

    } catch (error: any) {
      toast.error(error.message);
      setResult({ category: 'ERROR', success: false, message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (inputText.trim() || imageFile) handleAnalyze();
    }
  };

  // --- UI RENDER KẾT QUẢ (GIỮ NGUYÊN) ---
  const renderResult = () => {
    if (!result) return null;

    if (result.category === 'BILL') {
        return (
            <div className="mt-4 rounded-lg border bg-green-500/10 border-green-500/30 p-4 animate-fade-in">
                <div className="flex flex-col items-center text-center gap-2 text-green-500">
                    <CheckCircle2 className="h-10 w-10" />
                    <h3 className="text-xl font-bold">Transaction Saved</h3>
                    <p className="text-foreground font-mono text-lg font-bold">-{result.amount?.toLocaleString()} VND</p>
                    <p className="text-sm text-muted-foreground">{result.description}</p>
                </div>
            </div>
        );
    }

    if (result.category === 'CHAT') {
        return (
            <div className="mt-4 rounded-lg border bg-blue-500/10 border-blue-500/30 p-4 animate-fade-in">
                <div className="flex items-start gap-3">
                    <div className="bg-blue-500/20 p-2 rounded-full">
                         <MessageCircle className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-blue-500">Sentinel</p>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{result.reply}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (result.category === 'SCAM_CHECK') {
        const text = result.verdict || "";
        const isScam = text.toLowerCase().includes("scam") || text.toLowerCase().includes("fraud") || text.toLowerCase().includes("suspicious");
        const isSafe = text.toLowerCase().includes("safe") || text.toLowerCase().includes("legit");
        
        const borderColor = isScam ? "border-red-500/30" : (isSafe ? "border-green-500/30" : "border-yellow-500/30");
        const bgGradient = isScam 
            ? "bg-gradient-to-b from-[#2a1e25] to-[#1a1a2e]" 
            : (isSafe ? "bg-gradient-to-b from-[#1e2a25] to-[#1a1a2e]" : "bg-gradient-to-b from-[#2a2a1e] to-[#1a1a2e]");
        
        const titleColor = isScam ? "text-red-500" : (isSafe ? "text-green-500" : "text-yellow-500");
        const Icon = isScam ? ShieldAlert : ShieldCheck;

        let explanationText = text;
        if (isScam) explanationText = explanationText.replace(/this is a scam\.?/i, "").replace(/^[\.\s]+/, "");

        return (
            <div className={`mt-4 rounded-xl border ${borderColor} ${bgGradient} overflow-hidden animate-fade-in`}>
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <Icon className={`h-12 w-12 ${titleColor}`} />
                    <h3 className={`text-2xl font-bold ${titleColor}`}>
                        {isScam ? "This is a scam." : (isSafe ? "This appears safe." : "Caution Advised.")}
                    </h3>
                    <p className="text-sm text-gray-300 max-w-md leading-relaxed">
                        {isScam 
                         ? "Do not click on any suspicious links or enter your personal information. Verify the authenticity of the message directly through official channels."
                         : "Always verify the source before proceeding with any financial transactions, even if the content looks legitimate."
                        }
                    </p>
                </div>
                <div className="border-t border-white/5 bg-black/20 p-5 text-left">
                    <h4 className="font-bold text-white/90 mb-2 text-sm">CLOVA Studio's Explanation:</h4>
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{explanationText}</p>
                </div>
            </div>
        );
    }

    return null;
  };

  // --- UI CHÍNH ---
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <CardTitle>Sentinel AI Check</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1">
        <p className="text-sm text-muted-foreground mb-4">
          Paste text to check for scams, or upload a receipt to update your finances.
        </p>
        
        {/* 
            Sử dụng flex-1 để đẩy nút Analyze xuống dưới (nếu muốn),
            hoặc bỏ flex-1 để nó nằm ngay dưới ô chat.
        */}
        <div className="flex-1 flex flex-col mb-4">
          {/* 
              Cái DIV này đóng vai trò là khung viền (Card) duy nhất. 
              Nó có border và rounded.
          */}
          <div
            className="relative flex-1 flex flex-col border border-input rounded-lg bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {/* 
                Textarea này đã được xóa hết viền (border-0, shadow-none, focus-visible:ring-0).
                Nó trong suốt và nằm gọn trong DIV cha.
            */}
            <Textarea
              placeholder="e.g., 'Congratulations!...' or Paste image (Ctrl+V)"
              className="flex-1 resize-none border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-base px-4 pt-3 pb-14 mt-0"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
            />
            
            {/* NÚT ADD FILE (Góc dưới phải) */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
              
              {/* Thumbnail Preview */}
              {imagePreviewUrl && (
                <div className="relative">
                  <img 
                    src={imagePreviewUrl} 
                    alt="Selected" 
                    className="h-9 w-9 rounded object-cover border border-border"
                  />
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }}
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center"
                  >
                    <X className="h-2.5 w-2.5" />
                  </Button>
                </div>
              )}

              {/* Nút Add Image nổi bật */}
              <Button
                  variant="secondary" 
                  size="sm"
                  className="h-9 px-3 rounded-full font-medium text-xs shadow-sm hover:bg-secondary/80 border border-transparent hover:border-border transition-all"
                  onClick={() => fileInputRef.current?.click()}
              >
                  <ImagePlus className="h-4 w-4 mr-2" />
                  Add Image
              </Button>

              <input
                  id="image-upload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
              />
            </div>
          </div>
        </div>

        <Button 
            className="w-full" 
            onClick={handleAnalyze} 
            disabled={isLoading || (!inputText.trim() && !imageFile)}
        >
          {isLoading ? (
            <>
              <Sparkles className="mr-2 h-4 w-4 animate-spin" /> Analyzing...
            </>
          ) : (
            <>
              <ShieldCheck className="mr-2 h-4 w-4" /> Analyze
            </>
          )}
        </Button>
        
        {result && renderResult()}
        
        {result?.category === 'ERROR' && (
            <div className="mt-4 p-4 rounded-lg border bg-destructive/10 border-destructive/30 text-center text-destructive">
                <ShieldAlert className="h-8 w-8 mx-auto mb-2" />
                <p className="font-semibold">Analysis Failed</p>
                <p className="text-sm opacity-80">{result.message}</p>
            </div>
        )}

      </CardContent>
    </Card>
  );
};