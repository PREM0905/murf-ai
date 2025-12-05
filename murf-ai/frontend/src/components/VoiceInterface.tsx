import { useState, useRef, useEffect } from "react";
import { Send, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/lib/api";

interface VoiceInterfaceProps {
  onTaskAdded?: () => void;
  onHabitAdded?: () => void;
}

const VoiceInterface = ({ onTaskAdded, onHabitAdded }: VoiceInterfaceProps) => {
  const [inputText, setInputText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [proactiveMessage, setProactiveMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  // Check for proactive messages periodically
  useEffect(() => {
    const checkProactiveMessage = async () => {
      try {
        const response = await apiService.getProactiveCheck();
        if (response.message) {
          setProactiveMessage(response.message);
          setTimeout(() => {
            setTranscript(`Assistant: ${response.message}`);
          }, 2000);
        }
      } catch (error) {
        console.log('No proactive message available');
      }
    };

    // Check immediately and then every 10 minutes
    checkProactiveMessage();
    const intervalId = setInterval(checkProactiveMessage, 10 * 60000);
    
    return () => clearInterval(intervalId);
  }, []);



  const handleSubmit = async (messageText?: string) => {
    const textToSend = messageText || inputText;
    if (!textToSend.trim()) return;
    
    setIsProcessing(true);
    
    try {
      setTranscript(`You: ${textToSend}`);
      
      // Send to backend for AI response
      const response = await apiService.sendVoiceMessage(textToSend);
      
      // Update transcript with response
      setTranscript(`You: ${textToSend}\n\nAssistant: ${response.response}`);
      
      // Check if a task was added and trigger refresh
      if (response.response.toLowerCase().includes("added") && response.response.toLowerCase().includes("task") && onTaskAdded) {
        onTaskAdded();
      }
      
      // Check if a habit was added and trigger refresh
      if (response.response.toLowerCase().includes("added") && (response.response.toLowerCase().includes("habit") || response.response.toLowerCase().includes("track")) && onHabitAdded) {
        onHabitAdded();
      }
      
      // Check if a habit was marked done and trigger refresh
      if (response.response.toLowerCase().includes("marked") && (response.response.toLowerCase().includes("done for today") || response.response.toLowerCase().includes("done for friday") || response.response.toLowerCase().includes("done for monday") || response.response.toLowerCase().includes("done for tuesday") || response.response.toLowerCase().includes("done for wednesday") || response.response.toLowerCase().includes("done for thursday") || response.response.toLowerCase().includes("done for saturday") || response.response.toLowerCase().includes("done for sunday")) && onHabitAdded) {
        onHabitAdded();
      }
      
      // Check if task/goal/subgoal was marked complete and trigger refresh
      if (response.response.toLowerCase().includes("marked") && response.response.toLowerCase().includes("complete")) {
        if (onTaskAdded) onTaskAdded();
        if (onHabitAdded) onHabitAdded();
      }
      
      // Generate and play speech
      try {
        const audioResponse = await apiService.textToSpeech(response.response);
        if (audioResponse.audio) {
          const audio = new Audio(`data:audio/wav;base64,${audioResponse.audio}`);
          currentAudioRef.current = audio;
          audio.play();
        }
      } catch (error) {
        console.log("TTS failed, but text response shown");
      }
      
      setInputText("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process message",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    // Stop any currently playing audio when starting to record
    if (currentAudioRef.current && !currentAudioRef.current.paused) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      
      // Try different audio formats for better compatibility
      let options = { mimeType: 'audio/webm;codecs=opus' };
      
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm';
      }
      
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/wav';
      }
      
      console.log('Using audio format:', options.mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType });
        console.log('Audio blob created:', audioBlob.size, 'bytes, type:', options.mimeType);
        
        if (audioBlob.size > 1000) { // Only process if we have substantial audio
          await processAudio(audioBlob);
        } else {
          toast({
            title: "Recording Too Short",
            description: "Please record for at least 1-2 seconds.",
            variant: "destructive",
          });
        }
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone error:', error);
      toast({
        title: "Microphone Access Required",
        description: "Please allow microphone access to use voice input.",
        variant: "destructive",
      });
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);
      console.log('Processing audio blob:', audioBlob.size, 'bytes, type:', audioBlob.type);
      
      const response = await apiService.speechToText(audioBlob);
      
      if (response.transcript && response.transcript.trim()) {
        console.log('Transcript received:', response.transcript);
        setInputText(response.transcript);
        
        // Auto-submit the transcribed text immediately
        handleSubmit(response.transcript);
        
        toast({
          title: "Speech Recognized",
          description: `Heard: "${response.transcript.substring(0, 50)}..."`
        });
      } else {
        toast({
          title: "No Speech Detected",
          description: "Please try speaking more clearly and closer to the microphone.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Speech recognition error:', error);
      toast({
        title: "Speech Recognition Failed",
        description: "Could not process audio. Check your internet connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Voice Button */}
      <div className="flex items-center justify-center mb-8">
        <Button
          onClick={toggleRecording}
          disabled={isProcessing}
          size="lg"
          variant={isRecording ? "destructive" : "default"}
          className={`w-20 h-20 rounded-full ${
            isRecording ? 'animate-pulse' : ''
          }`}
        >
          {isRecording ? (
            <MicOff className="w-8 h-8" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </Button>
      </div>

      {/* Text Input */}
      <div className="w-full max-w-2xl flex gap-3">
        <Input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message or use voice input"
          disabled={isProcessing}
          className="flex-1"
        />
        <Button
          onClick={handleSubmit}
          disabled={isProcessing || !inputText.trim()}
        >
          {isProcessing ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Status Text */}
      <div className="text-center">
        <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
          {isProcessing ? "Processing..." : isRecording ? "Listening..." : proactiveMessage ? "I have something to ask you!" : "Ready to help"}
        </p>
        {proactiveMessage && !transcript && (
          <p className="text-sm text-blue-600 dark:text-blue-400 animate-pulse">
            Your AI friend wants to check in with you...
          </p>
        )}
      </div>

      {/* Transcript Display */}
      {transcript && (
        <div className="w-full max-w-2xl">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
            <div className="space-y-3">
              {transcript.split('\n\n').map((section, index) => {
                if (section.startsWith('You:')) {
                  return (
                    <div key={index} className="flex justify-end">
                      <div className="bg-blue-500 text-white rounded-lg px-3 py-2 max-w-[80%]">
                        <p className="text-sm">{section.replace('You: ', '')}</p>
                      </div>
                    </div>
                  );
                } else if (section.startsWith('Assistant:')) {
                  return (
                    <div key={index} className="flex justify-start">
                      <div className="bg-white dark:bg-gray-700 border rounded-lg px-3 py-2 max-w-[80%]">
                        <p className="text-sm">{section.replace('Assistant: ', '')}</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceInterface;