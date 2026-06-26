import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Send, 
  X, 
  Loader2, 
  Sparkles, 
  ArrowRight,
  HelpCircle,
  CheckCircle,
  Play
} from "lucide-react";
import { Task } from "../types";

// Setup speech recognition
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

interface VoiceAssistantProps {
  userId: string;
  onTaskCreated: (newTask: Task) => void;
  onRefreshTasks: () => void;
  onClose?: () => void;
}

export default function VoiceAssistant({ userId, onTaskCreated, onRefreshTasks, onClose }: VoiceAssistantProps) {
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isInitializingMic, setIsInitializingMic] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem("taskmate_voice_enabled");
    return saved !== "false"; // default to true
  });
  
  const [inputText, setInputText] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [assistantReply, setAssistantReply] = useState("Hi! I'm your TaskMate Voice Assistant. Click the microphone or type below to talk to me. You can ask things like:\n• 'Do I have any overdue tasks?'\n• 'What should I do first?'\n• 'Remind me to submit my DBMS assignment tomorrow at 6 PM'");
  const [errorText, setErrorText] = useState("");

  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // References to keep track of speech state, continuous silence timers, and auto-restart behavior
  const startTimeRef = useRef<number>(0);
  const hasSpeechRef = useRef<boolean>(false);
  const silenceTimeoutRef = useRef<any>(null);
  const noSpeechTimeoutRef = useRef<any>(null);
  const hasAutoRestartedRef = useRef<boolean>(false);
  const finalTranscriptRef = useRef<string>("");
  const blockAutoRestartRef = useRef<boolean>(false);

  // Suggested commands
  const suggestions = [
    "What are my tasks for today?",
    "Which task should I do first?",
    "Do I have any overdue tasks?",
    "What is my next task?",
    "Remind me to submit DBMS assignment tomorrow at 6 PM"
  ];

  const startRecognitionOnDemand = (isAutoRestart = false) => {
    console.log("Starting speech recognition on demand. Is auto-restart:", isAutoRestart);
    
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // 1. Abort existing instance safely
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (e) {
        console.warn("Error aborting previous speech recognition:", e);
      }
      recognitionRef.current = null;
    }

    // Clear timers
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (noSpeechTimeoutRef.current) clearTimeout(noSpeechTimeoutRef.current);

    startTimeRef.current = Date.now();
    if (!isAutoRestart) {
      setErrorText("");
      finalTranscriptRef.current = "";
      setLiveTranscript("");
    }
    
    blockAutoRestartRef.current = false;
    hasSpeechRef.current = false;

    if (!SpeechRecognition) {
      console.warn("SpeechRecognition not supported in this browser.");
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        console.log("Speech recognition started.");
        setIsInitializingMic(false);
        setIsListening(true);
        
        // Ensure we keep listening for at least 6 seconds before auto-closing
        const elapsed = Date.now() - startTimeRef.current;
        const remainingTime = Math.max(1000, 6000 - elapsed);
        
        if (noSpeechTimeoutRef.current) clearTimeout(noSpeechTimeoutRef.current);
        noSpeechTimeoutRef.current = setTimeout(() => {
          if (!hasSpeechRef.current) {
            console.log("No speech detected for full timeout duration. Stopping...");
            recognition.stop();
          }
        }, remainingTime);
      };

      recognition.onresult = (event: any) => {
        console.log("Speech recognition result received.");
        hasSpeechRef.current = true;
        
        if (noSpeechTimeoutRef.current) {
          clearTimeout(noSpeechTimeoutRef.current);
          noSpeechTimeoutRef.current = null;
        }

        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = 0; i < event.results.length; ++i) {
          const textSegment = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += textSegment + " ";
          } else {
            interimTranscript += textSegment;
          }
        }

        const transcriptText = (finalTranscript + interimTranscript).trim();
        setLiveTranscript(transcriptText);
        finalTranscriptRef.current = transcriptText;

        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = setTimeout(() => {
          console.log("3 seconds of silence after user spoke. Stopping...");
          recognition.stop();
        }, 3000);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error event:", event.error);
        setIsInitializingMic(false);
        if (event.error === "not-allowed") {
          setErrorText("Microphone access is blocked. Since the application runs inside an iframe, please try: 1) Reloading this page to apply mic permissions, or 2) Clicking 'Open in New Tab' at the top right of the screen.");
          blockAutoRestartRef.current = true;
          setIsListening(false);
        } else if (event.error === "no-speech") {
          console.log("Speech recognition reported 'no-speech'.");
        } else if (event.error === "aborted") {
          console.log("Speech recognition aborted.");
        } else {
          setErrorText(`Speech error: ${event.error}`);
          blockAutoRestartRef.current = true;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        console.log("Speech recognition end event. hasSpeech:", hasSpeechRef.current, "blockAutoRestart:", blockAutoRestartRef.current);
        setIsInitializingMic(false);
        setIsListening(false);

        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        if (noSpeechTimeoutRef.current) clearTimeout(noSpeechTimeoutRef.current);

        if (blockAutoRestartRef.current) {
          console.log("Speech auto-restart blocked.");
          return;
        }

        if (!hasSpeechRef.current) {
          const elapsed = Date.now() - startTimeRef.current;
          if (elapsed < 6000) {
            console.log(`No speech detected, but only ${elapsed}ms passed. Restarting silently to keep listening...`);
            setTimeout(() => {
              if (!blockAutoRestartRef.current) {
                startRecognitionOnDemand(true);
              }
            }, 300);
          } else {
            setErrorText("No voice detected. Try clicking the microphone again and speaking your command, or simply type it below!");
          }
          return;
        }

        const finishedTranscript = finalTranscriptRef.current;
        if (finishedTranscript.trim()) {
          console.log("Submitting final transcript:", finishedTranscript.trim());
          handleSubmitText(finishedTranscript.trim());
        } else {
          setErrorText("No voice detected. Try clicking the microphone again and speaking your command, or simply type it below!");
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start SpeechRecognition:", err);
      setIsInitializingMic(false);
      setErrorText("Failed to initialize microphone. Please ensure your browser supports speech recognition.");
    }
  };

  useEffect(() => {
    if (!SpeechRecognition) {
      setIsSupported(false);
    }

    return () => {
      blockAutoRestartRef.current = true;
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (noSpeechTimeoutRef.current) clearTimeout(noSpeechTimeoutRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch (e) {}
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [userId]);

  // Handle auto scrolling
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [assistantReply, liveTranscript, isProcessing]);

  // Voice Toggle persistence
  const toggleVoice = () => {
    setVoiceEnabled(prev => {
      const next = !prev;
      localStorage.setItem("taskmate_voice_enabled", String(next));
      if (!next && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      return next;
    });
  };

  // Speaks response using SpeechSynthesis
  const speak = (text: string) => {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;
    
    try {
      window.speechSynthesis.cancel();
      
      // Clean text of markdown characters so it reads properly
      const cleanText = text
        .replace(/[*#_`~•\-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = "en-US";
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("TTS failed:", e);
    }
  };

  const handleStartListening = () => {
    setIsInitializingMic(true);
    setErrorText("");
    startRecognitionOnDemand(false);
  };

  const handleStopListening = () => {
    console.log("Stopping speech recognition manually.");
    blockAutoRestartRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
  };

  const handleSubmitText = async (command: string) => {
    if (!command.trim() || isProcessing) return;

    setIsProcessing(true);
    setLiveTranscript("");
    setErrorText("");
    setInputText("");

    try {
      const response = await fetch("/api/ai/voice-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          text: command,
          clientDate: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error("Failed to process command with backend");
      }

      const data = await response.json();
      
      setAssistantReply(data.replyText || "Command handled successfully.");
      
      // If a task was created, notify App.tsx immediately
      if (data.action === "CREATE_TASK" && data.task) {
        onTaskCreated(data.task);
      } else {
        // If query or other modification occurred, request refresh
        onRefreshTasks();
      }

      // Play vocal feedback
      speak(data.replyText);

    } catch (err: any) {
      console.error(err);
      setErrorText("Sorry, I had trouble communicating with the server. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[500px] min-h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-950/50 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
              AI Voice Assistant
            </h3>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block">
              REAL-TIME CO-PILOT
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Mute/Unmute speech synthesis */}
          <button 
            onClick={toggleVoice} 
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              voiceEnabled 
                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400" 
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}
            title={voiceEnabled ? "Mute Voice Output" : "Enable Voice Output"}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          
          {onClose && (
            <button 
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Conversation Box */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
      >
        {/* Assistant Response Card */}
        <div className="bg-slate-500/5 dark:bg-slate-400/5 rounded-2xl p-4 border border-slate-200/30 dark:border-slate-800/30">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider font-mono">Response</span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line font-medium">
            {assistantReply}
          </p>
        </div>

        {/* Live Speech Recognition / Transcript */}
        <AnimatePresence>
          {liveTranscript && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl p-4 border border-indigo-100 dark:border-indigo-900/30 flex gap-3 items-start"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 mt-1 flex-shrink-0 animate-pulse" />
              <div>
                <p className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-mono">You are saying...</p>
                <p className="text-xs text-slate-700 dark:text-indigo-300 font-semibold italic mt-0.5">"{liveTranscript}"</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Listen / Processing / Speaking state indicators */}
        <div className="flex items-center justify-center py-2">
          {isListening && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1 h-6">
                {[1, 2, 3, 4, 5].map((bar) => (
                  <span 
                    key={bar} 
                    className="w-1 bg-gradient-to-t from-indigo-500 to-purple-500 rounded-full animate-pulse"
                    style={{ 
                      height: `${Math.random() * 20 + 8}px`,
                      animationDelay: `${bar * 120}ms`,
                      animationDuration: '600ms'
                    }}
                  />
                ))}
              </div>
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 animate-pulse">Listening... Speak clearly</span>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              <span>Analyzing speech query...</span>
            </div>
          )}

          {isSpeaking && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Speaking audio reply...</span>
            </div>
          )}
        </div>

        {/* Suggestion Bubbles */}
        {!isListening && !isProcessing && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1 font-mono">
              <HelpCircle className="w-3.5 h-3.5" /> Tap a suggested command
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSubmitText(s)}
                  className="bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-indigo-400 text-[11px] font-semibold py-1.5 px-3 rounded-xl border border-slate-200/60 dark:border-slate-800/80 transition-all text-left flex items-center gap-1 cursor-pointer"
                >
                  <ArrowRight className="w-3 h-3 text-indigo-500" />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Errors / Warnings */}
        {errorText && (
          <div className={`border rounded-xl p-3 text-xs font-semibold flex flex-col gap-2 ${
            errorText.includes("hear")
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
          }`}>
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex-shrink-0">⚠️</span>
              <span className="leading-relaxed">{errorText}</span>
            </div>
            {errorText.includes("iframe") && (
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => window.open(window.location.origin, "_blank")}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-3.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
                >
                  Open App in New Tab ↗
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inputs Footer */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
        {/* Glowing Microphone Button */}
        <button
          onClick={isListening ? handleStopListening : handleStartListening}
          disabled={isInitializingMic || isProcessing}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg cursor-pointer flex-shrink-0 ${
            isListening 
              ? "bg-gradient-to-r from-rose-500 to-red-600 text-white ring-4 ring-rose-500/30 scale-105 animate-pulse" 
              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 disabled:opacity-50 disabled:hover:bg-indigo-600"
          }`}
          title={isListening ? "Stop listening" : isInitializingMic ? "Initializing..." : "Start speaking"}
        >
          {isInitializingMic ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isListening ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>

        {/* Manual Keyboard Text Input */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmitText(inputText);
          }} 
          className="flex-1 flex gap-2 relative"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={!isSupported ? "Type your command here..." : "Ask or type a command..."}
            className="w-full bg-slate-500/5 dark:bg-slate-400/5 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-2.5 pl-4 pr-10 text-slate-800 dark:text-slate-100 outline-none transition-all placeholder:text-slate-400 text-xs font-medium"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 disabled:opacity-30 disabled:hover:text-indigo-500 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {!isSupported ? (
        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block mt-2 text-center">
          ⚠️ Speech-to-text is not supported by your current browser. You can type commands directly!
        </span>
      ) : (
        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium block mt-2 text-center">
          💡 If microphone doesn't respond, try reloading the page to apply iframe permissions, or click "Open in New Tab" at the top right of the screen.
        </span>
      )}
    </div>
  );
}
