import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Loader2, AlertTriangle } from 'lucide-react';
import { Button, ButtonProps } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from "@/i18n/LanguageContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface VoiceCommandButtonProps extends ButtonProps {
  onSuccess: (data: any) => void;
  onProcessing: (isProcessing: boolean) => void;
  onTranscript?: (text: string) => void;
}

export const VoiceCommandButton = ({ 
  onSuccess, 
  onProcessing, 
  onTranscript, 
  children,
  ...props 
}: VoiceCommandButtonProps) => {
  const { t } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  
  const [showFraudAlert, setShowFraudAlert] = useState(false);
  const [fraudMessage, setFraudMessage] = useState("");

  const finalTranscriptRef = useRef(""); 
  const recognitionRef = useRef<any>(null); 
  
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { accessToken } = useAuth();

  const sendCommandToServer = async (text: string) => {
    onProcessing(true);
    
    if (!accessToken) {
      toast.error(t('authRequired'));
      onProcessing(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('text', text); 

      const response = await fetch('/api/voice-command', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || t('couldNotProcessCommand'));
      }

      const result = await response.json();
      
      if (!result.transcript) {
        result.transcript = text;
      }

      if (result.intent === 'check_scam' && result.scam_check_result) {
        const { verdict, success } = result.scam_check_result;
        
        if (success && verdict) {
           const isDanger = verdict.toLowerCase().includes('scam') || 
                            verdict.toLowerCase().includes('suspicious') || 
                            verdict.toLowerCase().includes('fraud');

           if (isDanger) {
             setFraudMessage(verdict);
             setShowFraudAlert(true);
           } else {
             toast.success(verdict);
           }
        } else {
          toast.error(t('couldNotAnalyzeScam'));
        }
      }

      onSuccess(result);

    } catch (error: any) {
      console.error("Voice processing error:", error);
      toast.error(t('voiceProcessingFailed'));
    } finally {
      onProcessing(false);
    }
  };

  const handleStopRecording = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    setIsRecording(false);
    
    setTimeout(() => {
      const textToSend = finalTranscriptRef.current.trim();
      if (textToSend) {
        sendCommandToServer(textToSend);
      } else {
        toast.warning(t('noVoiceDetected'));
      }
    }, 500);
  }, [accessToken, onSuccess, onProcessing]); 

  const stopFnRef = useRef(handleStopRecording);
  useEffect(() => {
    stopFnRef.current = handleStopRecording;
  }, [handleStopRecording]);


  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;      
      recognition.interimResults = true;  
      recognition.lang = 'en-US';         

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let newFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            newFinal += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (newFinal) {
          finalTranscriptRef.current += " " + newFinal;
        }

        const displayParams = (finalTranscriptRef.current + " " + interimTranscript).trim();
        
        if (onTranscript) {
          onTranscript(displayParams);
        }

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        silenceTimerRef.current = setTimeout(() => {
          if (displayParams.length > 0) {
            toast.info(t('processing'));
            stopFnRef.current(); 
          }
        }, 1500);
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          toast.error(t('microphoneAccessDenied'));
          setIsRecording(false);
        }
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };

      recognitionRef.current = recognition;
    }
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [onTranscript]);

  const handleStartRecording = () => {
    if (!recognitionRef.current) {
      toast.error(t('voiceRecognitionNotSupported'));
      return;
    }
    try {
      finalTranscriptRef.current = "";
      if (onTranscript) onTranscript("");
      recognitionRef.current.start();
      setIsRecording(true);
      toast.info(t('listening'), { duration: 2000 });
    } catch (e) {
      console.error("Failed to start recognition:", e);
    }
  };

  const handleClick = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  return (
    <>
      <Button
        onClick={handleClick}
        variant={isRecording ? 'destructive' : 'outline'}
        className={`${isRecording ? "ring-2 ring-destructive/30" : ""} transition-all duration-200`}
        type="button"
        {...props}
      >
        {props.disabled && !isRecording ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('processing')}</>
        ) : isRecording ? (
          <><Square className="h-4 w-4 mr-2 fill-current" /> {t('stop')}</>
        ) : (
          <><Mic className="h-4 w-4 mr-2" /> {children || t('useVoice')}</>
        )}
      </Button>

      <AlertDialog open={showFraudAlert} onOpenChange={setShowFraudAlert}>
        <AlertDialogContent className="max-w-md border-l-4 border-red-500">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-6 w-6" />
              <AlertDialogTitle>{t('safetyAlert')}</AlertDialogTitle>
            </div>
          </AlertDialogHeader>
          <AlertDialogDescription className="text-base mt-2 font-medium text-foreground">
            {fraudMessage}
          </AlertDialogDescription>
          <div className="flex justify-end gap-3 mt-4">
            <AlertDialogCancel>{t('close')}</AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};