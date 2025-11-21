// --- START OF FILE VoiceCommandButton.tsx ---

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button, ButtonProps } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// Global definition for Web Speech API
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
  const [isRecording, setIsRecording] = useState(false);
  
  // Stores the accumulated text
  const finalTranscriptRef = useRef(""); 
  const recognitionRef = useRef<any>(null); 
  
  // Ref for the silence detection timer
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { accessToken } = useAuth();

  // --- 1. Logic to Send to Server ---
  const sendCommandToServer = async (text: string) => {
    onProcessing(true);
    
    if (!accessToken) {
      toast.error('Authentication required.');
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
        throw new Error(err.detail || 'Could not process command.');
      }

      const result = await response.json();
      
      if (!result.transcript) {
        result.transcript = text;
      }

      onSuccess(result);

    } catch (error: any) {
      console.error("Voice processing error:", error);
      toast.error("Voice processing failed. Please try again.");
    } finally {
      onProcessing(false);
    }
  };

  // --- 2. Handle Stop Recording ---
  // Wrapped in useCallback so we can safely reference it via ref in the Event Listener
  const handleStopRecording = useCallback(() => {
    // Clear any pending silence timers so they don't fire after we manually stop
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Stop the browser recognition
    if (recognitionRef.current) {
      // This will trigger 'onend'
      recognitionRef.current.stop();
    }
    
    setIsRecording(false);
    
    // Small delay to allow the last "final" result to trigger before sending
    setTimeout(() => {
      const textToSend = finalTranscriptRef.current.trim();
      if (textToSend) {
        sendCommandToServer(textToSend);
      } else {
        // Only warn if we manually stopped and it was empty. 
        // If auto-stop triggered it, we usually have text.
        toast.warning("No voice detected.");
      }
    }, 500);
  }, [accessToken, onSuccess, onProcessing]); // Dependencies for sendCommandToServer logic

  // --- 3. Keep a Ref to the latest handleStopRecording ---
  // This allows the SpeechRecognition 'onresult' (created once on mount) 
  // to call the latest version of the function without re-initializing the recognition object.
  const stopFnRef = useRef(handleStopRecording);
  useEffect(() => {
    stopFnRef.current = handleStopRecording;
  }, [handleStopRecording]);


  // --- 4. Initialize Speech Recognition ---
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

        // --- Silence Detection Logic ---
        // 1. Clear existing timer
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        // 2. Set a new timer. If 1500ms passes without this being cleared by a new result,
        // we assume the user stopped speaking.
        silenceTimerRef.current = setTimeout(() => {
          // Only auto-stop if we actually have captured some text
          if (displayParams.length > 0) {
            toast.info("Processing...");
            stopFnRef.current(); // Call the fresh handleStopRecording function
          }
        }, 1500);
      };

      recognition.onend = () => {
        setIsRecording(false);
        // Ensure timer is cleared when recognition naturally ends
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          toast.error("Microphone access denied.");
          setIsRecording(false);
        }
        // Clear timer on error
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };

      recognitionRef.current = recognition;
    } else {
      console.error("Web Speech API not supported in this browser.");
    }

    // Cleanup on unmount
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [onTranscript]); // Only re-run if onTranscript changes (usually doesn't)

  const handleStartRecording = () => {
    if (!recognitionRef.current) {
      toast.error("Voice recognition not supported in this browser.");
      return;
    }

    try {
      // Reset transcript storage
      finalTranscriptRef.current = "";
      if (onTranscript) onTranscript("");

      recognitionRef.current.start();
      setIsRecording(true);
      toast.info('Listening...', { duration: 2000 });
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
    <Button
      onClick={handleClick}
      variant={isRecording ? 'destructive' : 'outline'}
      className={`${isRecording ? "ring-2 ring-destructive/30" : ""} transition-all duration-200`}
      type="button"
      {...props}
    >
      {props.disabled && !isRecording ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
      ) : isRecording ? (
        <><Square className="h-4 w-4 mr-2 fill-current" /> Stop</>
      ) : (
        <><Mic className="h-4 w-4 mr-2" /> {children || 'Use Voice'}</>
      )}
    </Button>
  );
};