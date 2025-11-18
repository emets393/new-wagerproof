import React, { useState, useEffect, useRef } from "react";
import { Bot } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isTyping?: boolean;
}

const MicroChat = ({ isOpen }: { isOpen: boolean }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const conversationRef = useRef(0);

  const conversation = [
    {
      user: "Can you summarize the public market vs Vegas value outliers for today?",
      assistant: "Based on today's data, I've identified several key value opportunities:\n\n**Top Contrarian Plays:**\n• Cincinnati +8.5 vs New England (21% public, model shows 58% value)\n• Minnesota +6.5 vs Green Bay (28% public, model shows 80% confidence)\n\n**Public Fades:**\n• Seattle -13.5 (89% public backing) shows potential overvaluation\n• Baltimore -13.5 (89% public) may be inflated\n\n**Best Value:**\nThe model strongly favors Cincinnati and Minnesota as contrarian plays where public sentiment diverges significantly from our predictive models."
    }
  ];

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Start the conversation
      conversationRef.current = 0;
      setMessages([]);
      setDisplayedText("");
      startConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const startConversation = () => {
    const conv = conversation[conversationRef.current % conversation.length];
    
    // Add user message
    setMessages([{ id: "user-1", role: "user", content: conv.user }]);
    setIsTyping(true);
    setDisplayedText("");
    
    // Start typing user message (instant for demo)
    setTimeout(() => {
      setIsTyping(false);
      
      // Start AI response after a brief pause
      setTimeout(() => {
        typeMessage(conv.assistant);
      }, 500);
    }, 100);
  };

  const typeMessage = (text: string) => {
    setIsTyping(true);
    let charIndex = 0;
    
    const typeChar = () => {
      if (charIndex < text.length) {
        const char = text[charIndex];
        setDisplayedText(text.substring(0, charIndex + 1));
        charIndex++;
        
        // Faster typing speed (15ms per char, pause on punctuation)
        const isPunctuation = ['.', '!', '?', ',', '\n'].includes(char);
        const delay = isPunctuation ? 30 : 15;
        
        setTimeout(typeChar, delay);
      } else {
        setIsTyping(false);
        // Add assistant message to state
        setMessages(prev => [
          ...prev,
          { id: `assistant-${Date.now()}`, role: "assistant", content: text }
        ]);
        
        // Loop: wait 3 seconds then restart
        setTimeout(() => {
          conversationRef.current++;
          setMessages([]);
          setDisplayedText("");
          startConversation();
        }, 3000);
      }
    };
    
    typeChar();
  };

  if (!isOpen) return null;

  return (
    <div className="absolute -top-4 -right-4 z-20 w-[320px] sm:w-[360px] pointer-events-none" style={{ position: 'absolute', isolation: 'isolate' }}>
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 border-green-500 dark:border-green-400 overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-500 pointer-events-none">
        {/* Header */}
        <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-green-500 to-emerald-600 pointer-events-none">
          <div className="p-1.5 bg-white/20 rounded-lg pointer-events-none">
            <Bot className="w-4 h-4 text-white pointer-events-none" />
          </div>
          <div className="pointer-events-none">
            <h3 className="font-semibold text-white text-sm pointer-events-none">WagerBot</h3>
            <p className="text-xs text-white/80 pointer-events-none">Explaining dashboard data</p>
          </div>
        </div>

        {/* Messages */}
        <div className="h-64 overflow-hidden p-3 space-y-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm pointer-events-none" style={{ overflowY: 'hidden' }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex pointer-events-none ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 pointer-events-none ${
                  msg.role === "user"
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600"
                }`}
              >
                <p className="text-xs whitespace-pre-wrap leading-relaxed pointer-events-none">
                  {msg.content.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={i} className="pointer-events-none">{part.slice(2, -2)}</strong>;
                    }
                    return <span key={i} className="pointer-events-none">{part}</span>;
                  })}
                </p>
              </div>
            </div>
          ))}
          
          {/* Typing indicator for AI response */}
          {isTyping && displayedText && (
            <div className="flex justify-start pointer-events-none">
              <div className="max-w-[85%] rounded-lg px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 pointer-events-none">
                <p className="text-xs whitespace-pre-wrap leading-relaxed pointer-events-none">
                  {displayedText.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={i} className="pointer-events-none">{part.slice(2, -2)}</strong>;
                    }
                    return <span key={i} className="pointer-events-none">{part}</span>;
                  })}
                  <span className="inline-block w-1.5 h-3 bg-green-500 ml-1 animate-pulse pointer-events-none" />
                </p>
              </div>
            </div>
          )}
          
          {/* Typing dots when waiting */}
          {isTyping && !displayedText && (
            <div className="flex justify-start pointer-events-none">
              <div className="rounded-lg px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 pointer-events-none">
                <div className="flex gap-1 pointer-events-none">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce pointer-events-none" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce pointer-events-none" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce pointer-events-none" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MicroChat;

