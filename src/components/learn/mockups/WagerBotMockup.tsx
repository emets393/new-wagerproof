import { Card } from '@/components/ui/card';
import { Bot, Send } from 'lucide-react';
import { mockChatMessages } from '@/data/learnMockData';

export function WagerBotMockup() {
  return (
    <Card className="max-w-2xl mx-auto opacity-95 overflow-hidden shadow-xl">
      <div className="flex flex-col h-[600px]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-semibold">WagerBot</span>
          </div>
          <div className="text-xs text-muted-foreground">AI Assistant</div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
          {mockChatMessages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-background border border-border'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-primary">WagerBot</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-line">{message.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-background">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-100 dark:bg-muted rounded-lg px-4 py-2 text-sm text-muted-foreground flex items-center border border-gray-200 dark:border-border">
              Ask me anything about the games...
            </div>
            <button className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

