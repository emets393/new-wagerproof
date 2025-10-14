import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Bot, X, Loader2 } from 'lucide-react';
import { chatSessionManager, ChatSession } from '@/utils/chatSession';
import { ChatKitWrapper } from '@/components/ChatKitWrapper';
import { Alert, AlertDescription } from '@/components/ui/alert';
import GlassIcon from '@/components/magicui/glass-icon';

interface MiniWagerBotChatProps {
  pageContext?: string;
  pageId?: string; // Add pageId to distinguish between pages
}

export function MiniWagerBotChat({ pageContext, pageId = 'default' }: MiniWagerBotChatProps = {}) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Log context for debugging
  React.useEffect(() => {
    if (pageContext) {
      console.log('📊 MiniWagerBotChat pageContext length:', pageContext.length);
      console.log('📄 MiniWagerBotChat pageId:', pageId);
    }
  }, [pageContext, pageId]);

  // Load or create session when opened or when page changes
  useEffect(() => {
    if (isOpen && user && !isLoading) {
      loadOrCreateSession();
    }
  }, [isOpen, user, pageId]);

  // Clear session when page changes (force new thread)
  useEffect(() => {
    if (currentSession) {
      console.log('🔄 Page changed, clearing session to force new thread');
      setCurrentSession(null);
    }
  }, [pageId]);

  const loadOrCreateSession = async () => {
    if (!user) return;

    setIsLoading(true);
    setError('');

    try {
      // Try to get page-specific session
      let session = chatSessionManager.getCurrentSession(user.id, pageId);
      
      // If no session exists, create one for this page
      if (!session) {
        console.log('🆕 Creating new session for page:', pageId);
        session = await chatSessionManager.createNewSession(user, pageId);
      } else {
        console.log('♻️ Reusing existing session for page:', pageId);
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
        <Card className="fixed bottom-24 right-32 w-[400px] h-[600px] flex flex-col shadow-2xl rounded-xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-hidden bg-gradient-to-br from-green-500/10 to-green-600/10 backdrop-blur-sm">
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
                systemContext={pageContext}
              />
            )}
          </div>
        </Card>
      )}

      {/* Floating Action Button */}
      <div
        onClick={toggleChat}
        className="fixed bottom-6 right-6 h-24 w-24 rounded-lg z-50 cursor-pointer"
        aria-label="Toggle WagerBot Chat"
      >
        <div className="relative bg-transparent outline-none w-24 h-24 [perspective:24em] [transform-style:preserve-3d]">
          <span
            className={`absolute top-0 left-0 w-full h-full rounded-[1.25em] block transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.83,0,0.17,1)] origin-[100%_100%] ${
              isOpen ? '[transform:rotate(25deg)_translate3d(-0.5em,-0.5em,0.5em)]' : 'rotate-[15deg]'
            }`}
            style={{
              background: 'linear-gradient(hsl(123, 90%, 40%), hsl(108, 90%, 40%))',
              boxShadow: '0.5em -0.5em 0.75em hsla(223, 10%, 10%, 0.15)'
            }}
          ></span>

          <span
            className={`absolute top-0 left-0 w-full h-full rounded-[1.25em] bg-[hsla(0,0%,100%,0.15)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.83,0,0.17,1)] origin-[80%_50%] flex backdrop-blur-[0.75em] [-webkit-backdrop-filter:blur(0.75em)] ${
              isOpen ? '[transform:translateZ(2em)]' : 'transform'
            }`}
            style={{
              boxShadow: '0 0 0 0.1em hsla(0, 0%, 100%, 0.3) inset'
            }}
          >
            <span className="m-auto flex items-center justify-center text-white">
              {isOpen ? (
                <X className="h-12 w-12 text-white" />
              ) : (
                <Bot className="h-12 w-12 text-white" />
              )}
            </span>
          </span>
        </div>
      </div>
    </>
  );
}

