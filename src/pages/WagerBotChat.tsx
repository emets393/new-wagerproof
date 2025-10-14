import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, MessageSquare } from 'lucide-react';
import { chatSessionManager, ChatSession } from '@/utils/chatSession';
import { ChatKitWrapper } from '@/components/ChatKitWrapper';

export default function WagerBotChat() {
  const { user, session, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [error, setError] = useState<string>('');
  const [shouldShowWelcome, setShouldShowWelcome] = useState(false);

  // Check for first login welcome flag
  useEffect(() => {
    const showWelcome = localStorage.getItem('wagerproof_show_welcome');
    console.log('🔍 WagerBotChat checking welcome flag:', showWelcome);
    if (showWelcome === 'true') {
      console.log('✅ Welcome flag detected! Setting shouldShowWelcome to true');
      setShouldShowWelcome(true);
      // Clear the flag so it doesn't show again
      localStorage.removeItem('wagerproof_show_welcome');
    } else {
      console.log('ℹ️ No welcome flag found');
    }
  }, []);

  // Load user sessions on mount
  useEffect(() => {
    if (user && !authLoading) {
      loadUserSessions();
    }
  }, [user, authLoading]);

  const loadUserSessions = useCallback(() => {
    if (!user) return;

    const userSessions = chatSessionManager.getUserSessions(user.id);
    setSessions(userSessions);

    // Load current session or create new one if none exists
    const current = chatSessionManager.getCurrentSession(user.id);
    if (current) {
      setCurrentSession(current);
    } else if (userSessions.length === 0) {
      // Auto-create first session
      handleCreateNewSession();
    }
  }, [user]);

  const handleCreateNewSession = async () => {
    if (!user) return;

    setIsCreatingSession(true);
    setError('');

    try {
      const newSession = await chatSessionManager.createNewSession(user);
      setCurrentSession(newSession);
      setSessions(prev => [...prev, newSession]);
    } catch (err) {
      setError('Failed to create new chat session. Please try again.');
      console.error('Session creation error:', err);
    } finally {
      setIsCreatingSession(false);
    }
  };


  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert className="max-w-md">
          <MessageSquare className="h-4 w-4" />
          <AlertDescription>
            Please sign in to access WagerBot Chat.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Initializing WagerBot...</p>
        </div>
      </div>
    );
  }

  console.log('🎯 WagerBotChat rendering with shouldShowWelcome:', shouldShowWelcome);

  return (
    <div className="h-[calc(100vh-8rem)] w-full overflow-hidden rounded-lg">
      <ChatKitWrapper
        user={user}
        sessionId={currentSession.id}
        theme={theme === 'dark' ? 'dark' : 'light'}
        autoSendWelcome={shouldShowWelcome}
      />
    </div>
  );
}
