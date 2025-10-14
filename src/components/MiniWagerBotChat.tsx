import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Bot, X, Loader2 } from 'lucide-react';
import { chatSessionManager, ChatSession } from '@/utils/chatSession';
import { ChatKitWrapper } from '@/components/ChatKitWrapper';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function MiniWagerBotChat() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Load or create session when opened
  useEffect(() => {
    if (isOpen && user && !currentSession && !isLoading) {
      loadOrCreateSession();
    }
  }, [isOpen, user]);

  const loadOrCreateSession = async () => {
    if (!user) return;

    setIsLoading(true);
    setError('');

    try {
      // Try to get current session
      let session = chatSessionManager.getCurrentSession(user.id);
      
      // If no session exists, create one
      if (!session) {
        session = await chatSessionManager.createNewSession(user);
      }
      
      setCurrentSession(session);
    } catch (err) {
      setError('Failed to initialize chat. Please try again.');
      console.error('Mini chat session error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  if (!user) {
    return null; // Don't show if user is not authenticated
  }

  return (
    <>
      {/* Chat Popup Overlay */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-[400px] h-[600px] flex flex-col shadow-2xl rounded-xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <span className="font-semibold text-sm">WagerBot</span>
            </div>
            <Button
              onClick={toggleChat}
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Chat Content */}
          <div className="flex-1 overflow-hidden">
            {error ? (
              <div className="h-full flex items-center justify-center p-4">
                <Alert variant="destructive" className="max-w-md">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            ) : isLoading || !currentSession ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  <p className="text-xs text-muted-foreground">Loading chat...</p>
                </div>
              </div>
            ) : (
              <ChatKitWrapper
                user={user}
                sessionId={currentSession.id}
                theme={theme === 'dark' ? 'dark' : 'light'}
              />
            )}
          </div>
        </Card>
      )}

      {/* Floating Action Button */}
      <Button
        onClick={toggleChat}
        size="lg"
        className={`fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl z-50 hover:scale-110 transition-all duration-200 ${
          theme === 'dark' 
            ? 'bg-white hover:bg-zinc-50 text-zinc-900' 
            : 'bg-zinc-800 hover:bg-zinc-700 text-white'
        }`}
        style={{
          boxShadow: theme === 'dark' 
            ? '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)' 
            : '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
        }}
        aria-label="Toggle WagerBot Chat"
      >
        {isOpen ? (
          <X className="h-7 w-7" />
        ) : (
          <Bot className="h-10 w-10" />
        )}
      </Button>
    </>
  );
}

