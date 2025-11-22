import { DashboardLayout } from "@/components/DashboardLayout";
import { AppSidebar } from "@/components/AppSidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles, User, Mic, Paperclip, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate } from "react-router-dom";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  image_data?: string; // Optional base64 image data
}

const ChatInputBar = ({ 
  input, 
  setInput, 
  isTyping, 
  selectedImage, 
  imagePreview,
  setSelectedImage,
  setImagePreview,
  handleFileSelect,
  clearSelectedImage,
  handleSend,
  handleKeyPress,
  t
}: {
  input: string;
  setInput: (val: string) => void;
  isTyping: boolean;
  selectedImage: string | null;
  imagePreview: string | null;
  setSelectedImage: (val: string | null) => void;
  setImagePreview: (val: string | null) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearSelectedImage: () => void;
  handleSend: () => void;
  handleKeyPress: (e: React.KeyboardEvent) => void;
  t: (key: string) => string;
}) => {
  // Create the ref *inside* this component
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Check if the pasted item is an image
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;

        // Read file as base64 and directly update state via props
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64String = event.target?.result as string;
          // Directly set the image states using the passed props
          setSelectedImage(base64String);
          setImagePreview(base64String);
          console.log('📸 Image pasted from clipboard, size:', file.size);
        };
        reader.readAsDataURL(file);
        break; // Only process the first image
      }
    }
  };

  const handleMicrophoneClick = async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          // Get the audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());

          // Call ASR API
          await callASRApi(audioBlob);
        };

        mediaRecorder.start();
        setIsRecording(true);
        console.log('🎤 Recording started');
      } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Could not access microphone. Please check permissions.');
      }
    }
  };

  const callASRApi = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      console.log('📤 Sending audio to ASR API...');
      const response = await fetch('/api/voice-command', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`ASR API error: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ ASR Result:', result);

      // If we got text, add it to the input
      if (result.text) {
        const newText = input ? input + ' ' + result.text : result.text;
        setInput(newText);
        console.log('🗣️ Transcribed text:', result.text);
      } else {
        alert('Could not transcribe audio. Please try again.');
      }
    } catch (error) {
      console.error('Error calling ASR API:', error);
      alert('Failed to transcribe audio. Please try again.');
    }
  };

  return (
    <div className="flex flex-col gap-0 w-full max-w-4xl mx-auto">
      {/* Hidden File Input - Must be rendered in DOM */}
      <input
        ref={fileInputRef} // This now refers to the locally created ref
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      
      {/* Input Bar with inline image thumbnail */}
      <div className="relative flex items-center w-full bg-muted rounded-full shadow-lg">
        <Input
          ref={inputRef}
          placeholder={t('typeYourMessage')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          onPaste={handlePaste}
          disabled={isTyping}
          className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 pl-4 pr-32"
        />
        
        <div className="absolute right-2 flex items-center gap-2">
          {/* Image Thumbnail Preview (same size as paperclip button) */}
          {imagePreview && (
            <div className="relative">
              <img 
                src={imagePreview} 
                alt="Selected" 
                className="h-8 w-8 rounded object-cover border border-muted-foreground/30"
              />
              <Button
                onClick={clearSelectedImage}
                size="icon"
                variant="destructive"
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center"
              >
                <X className="h-2.5 w-2.5" />
              </Button>
            </div>
          )}

          {/* File Upload Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              // This also refers to the local ref now, and it will work correctly
              fileInputRef.current?.click();
            }}
            type="button"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {/* Voice Button
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-8 w-8 rounded-full transition-colors ${
              isRecording 
                ? 'text-red-500 bg-red-50 hover:bg-red-100' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={handleMicrophoneClick}
            disabled={isTyping && !isRecording}
            type="button"
            title={isRecording ? 'Stop recording' : 'Start recording'}
          >
            <Mic className="h-4 w-4" />
          </Button> */}

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={(!input.trim() && !selectedImage) || isTyping}
            size="icon"
            className="h-7 w-7 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const AIChat = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: t('askAssistant'),
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // Base64 image
  const [imagePreview, setImagePreview] = useState<string | null>(null); // For UI preview
  // const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isNewChat = messages.length <= 1;

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
        if (viewport) {
            setTimeout(() => {
                viewport.scrollTop = viewport.scrollHeight;
            }, 0);
        }
    }
  };

  useEffect(() => {
    if (!isNewChat) {
        scrollToBottom();
    }
  }, [messages, isTyping, isNewChat]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setSelectedImage(base64String);
      setImagePreview(base64String); // For showing preview
      console.log('📸 Image selected, size:', file.size);
    };
    reader.readAsDataURL(file);
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    // if (fileInputRef.current) {
    //   fileInputRef.current.value = '';
    // }
  };
  
  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isTyping) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
      image_data: selectedImage || undefined
    };

    const historyForAPI = [...messages, userMessage];
    
    setMessages(prev => [...prev, userMessage, { role: 'assistant', content: '', timestamp: new Date() }]);
    setInput("");
    clearSelectedImage();
    setIsTyping(true);

    try {
      // Format messages for API - include image data
      const formattedMessages = historyForAPI.map(msg => ({
        role: msg.role,
        content: msg.content,
        image_data: msg.image_data,
        text: msg.content
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: formattedMessages }), 
      });

      if (!response.ok || !response.body) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let transferData: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            
            // Check if this is a transfer data block
            if (data.includes('<<<TRANSFER_DATA>>>')) {
              const jsonStart = data.indexOf('{');
              const jsonEnd = data.lastIndexOf('}') + 1;
              if (jsonStart !== -1 && jsonEnd > jsonStart) {
                try {
                  transferData = JSON.parse(data.substring(jsonStart, jsonEnd));
                } catch (e) {
                  console.error("Failed to parse transfer data:", e);
                }
              }
            } else if (!data.includes('[ERROR]')) {
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                lastMessage.content += data;
                return newMessages;
              });
            } else {
              throw new Error("Received an error from the stream.");
            }
          }
        }
      }

      // If we received transfer data, switch to the transaction page with auto-filled form
      if (transferData && transferData.type === 'TRANSFER_INTENT') {
        console.log("🔄 Transfer data detected:", transferData);
        // Wait a moment for the message to display, then navigate
        setTimeout(() => {
          const stateData = {
            account_number: transferData.account_number || null,
            amount: transferData.amount || null,
            description: transferData.description || null
          };
          console.log("📤 Navigating with state:", stateData);
          navigate('/transaction', { state: stateData });
        }, 1500);
      }
    } catch (error) {
      console.error("Failed to fetch streaming response:", error);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        lastMessage.content = 'Sorry, I am having trouble connecting. Please try again later.';
        return newMessages;
      });
    } finally {
      setIsTyping(false);
      setTimeout(() => scrollToBottom(), 100);
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <DashboardLayout sidebar={<AppSidebar />} fullHeight>
      <div className="flex-1 flex flex-col bg-background text-foreground animate-fade-in">
        
        <div className="flex-shrink-0 flex items-center gap-2 p-4 border-b">
          <h1 className="text-xl font-bold text-foreground">Sentinel</h1>
        </div>

        <div className="flex-1 flex flex-col relative min-h-0">
          {isNewChat ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-4">
              <h1 className="text-3xl md:text-4xl font-bold">{t('chatWithAI')}</h1>
              <div className="w-full mt-6 px-4">
                <ChatInputBar 
                  input={input}
                  setInput={setInput}
                  isTyping={isTyping}
                  selectedImage={selectedImage}
                  imagePreview={imagePreview}
                  setSelectedImage={setSelectedImage}
                  setImagePreview={setImagePreview}
                  handleFileSelect={handleFileSelect}
                  clearSelectedImage={clearSelectedImage}
                  handleSend={handleSend}
                  handleKeyPress={handleKeyPress}
                  t={t}
                />
              </div>
            </div>
          ) : (
            <>
               <div className="h-[72vh]">
                <ScrollArea className="h-full" ref={scrollAreaRef}>
                  <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4 pb-32">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex gap-3 ${
                          message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        <div
                          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {message.role === 'user' ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </div>
                        <div
                          className={`max-w-[80%] rounded-lg p-3 md:p-4 ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          {/* Display image if present */}
                          {message.image_data && (
                            <img 
                              src={message.image_data} 
                              alt="Message attachment" 
                              className="w-full h-auto rounded mb-2 max-w-xs"
                            />
                          )}
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p
                            className={`text-xs mt-2 ${
                              message.role === 'user'
                                ? 'text-primary-foreground/70'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {message.timestamp.toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex-shrink-0 bg-gradient-to-t from-background via-background/90 to-transparent border-t">
                <div className="px-4 pt-4 pb-6 md:px-8">
                  <ChatInputBar 
                    input={input}
                    setInput={setInput}
                    isTyping={isTyping}
                    selectedImage={selectedImage}
                    imagePreview={imagePreview}
                    setSelectedImage={setSelectedImage}
                    setImagePreview={setImagePreview}
                    handleFileSelect={handleFileSelect}
                    clearSelectedImage={clearSelectedImage}
                    handleSend={handleSend}
                    handleKeyPress={handleKeyPress}
                    t={t}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AIChat;