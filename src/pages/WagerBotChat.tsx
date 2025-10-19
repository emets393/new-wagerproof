import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import { chatSessionManager, ChatSession } from '@/utils/chatSession';
import { ChatKitWrapper } from '@/components/ChatKitWrapper';
import { ChatKitErrorBoundary } from '@/components/ChatKitErrorBoundary';
import debug from '@/utils/debug';
import { trackWagerBotOpened } from '@/lib/mixpanel';

export default function WagerBotChat() {
  const { user, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [error, setError] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);
  const hasInitializedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  // Clear welcome flag if present
  useEffect(() => {
    const showWelcome = localStorage.getItem('wagerproof_show_welcome');
    if (showWelcome === 'true') {
      localStorage.removeItem('wagerproof_show_welcome');
    }
  }, []);

  // Track WagerBot opened on mount
  useEffect(() => {
    trackWagerBotOpened();
    debug.log('🚀 WagerBotChat page loaded at', new Date().toISOString());
  }, []);

  // Simplified session initialization with better error handling
  const initializeSession = useCallback(async () => {
    if (!user) {
      debug.log('⏸️ No user, skipping initialization');
      return;
    }

    // Prevent re-initialization for the same user
    if (hasInitializedRef.current && userIdRef.current === user.id) {
      debug.log('✅ Already initialized for user:', user.id);
      return;
    }

    debug.log('🎬 Initializing WagerBot session for user:', user.id);
    setIsInitializing(true);
    setError('');
    hasInitializedRef.current = true;
    userIdRef.current = user.id;

    try {
      // Try to get existing session first
      let session = chatSessionManager.getCurrentSession(user.id);
      
      if (!session) {
        debug.log('📝 No existing session found, creating new one...');
        // Create new session if none exists
        session = await Promise.race([
          chatSessionManager.createNewSession(user),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Session creation timeout')), 10000)
          )
        ]);
        debug.log('✅ Session created:', session.id);
      } else {
        debug.log('✅ Using existing session:', session.id);
      }

      setCurrentSession(session);
      setIsInitializing(false);
      debug.log('🎉 Initialization complete, session set');
    } catch (err: any) {
      debug.error('❌ Session initialization error:', err);
      setError(err.message || 'Failed to initialize chat. Please try again.');
      setIsInitializing(false);
      hasInitializedRef.current = false; // Allow retry
      userIdRef.current = null;
    }
  }, [user]);

  // Initialize when user is ready - only run once
  useEffect(() => {
    if (user && !authLoading && !hasInitializedRef.current) {
      debug.log('🔄 Effect triggering initialization');
      initializeSession();
    } else {
      debug.log('⏭️ Skipping initialization:', {
        hasUser: !!user,
        authLoading,
        hasInitialized: hasInitializedRef.current
      });
    }
  }, [user, authLoading, initializeSession]);

  // Manual retry handler
  const handleRetry = useCallback(() => {
    debug.log('🔄 Manual retry triggered');
    hasInitializedRef.current = false;
    userIdRef.current = null;
    setCurrentSession(null);
    setError('');
    initializeSession();
  }, [initializeSession]);


  // Show loading state while auth is loading
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

  // Show message if no user
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

  // Show error state with retry button
  if (error) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription className="space-y-4">
            <div>{error}</div>
            <Button
              onClick={handleRetry}
              className="flex items-center gap-2 mx-auto"
              variant="default"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show initializing state ONLY if we haven't successfully initialized yet
  if (isInitializing && !currentSession) {
    debug.log('🔄 Rendering loading state (initializing)');
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Initializing WagerBot...</p>
          <p className="text-xs text-muted-foreground">
            This should only take a few seconds
          </p>
        </div>
      </div>
    );
  }

  // If session exists, render it even if isInitializing is true (prevents flickering)
  if (currentSession && user) {
    debug.log('✅ Rendering ChatKit with session:', currentSession.id);
    return (
      <ChatKitErrorBoundary>
        <div className="h-[calc(100vh-8rem)] w-full overflow-hidden rounded-lg">
          <ChatKitWrapper
            user={user}
            sessionId={currentSession.id}
            theme={theme === 'dark' ? 'dark' : 'light'}
          />
        </div>
      </ChatKitErrorBoundary>
    );
  }

  // Fallback: something went wrong
  debug.warn('⚠️ Unexpected state - no session but not initializing');
  return (
    <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
