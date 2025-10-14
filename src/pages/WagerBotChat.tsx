import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, MessageSquare, Plus, Trash2, Bot } from 'lucide-react';
import { chatSessionManager, ChatSession } from '@/utils/chatSession';
import { ChatKitWrapper } from '@/components/ChatKitWrapper';

export default function WagerBotChat() {
  const { user, session, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [error, setError] = useState<string>('');

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

  const handleSelectSession = (session: ChatSession) => {
    setCurrentSession(session);
    chatSessionManager.setCurrentSession(session.id);
  };

  const handleDeleteSession = (sessionId: string) => {
    chatSessionManager.deleteSession(sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    
    if (currentSession?.id === sessionId) {
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      if (remainingSessions.length > 0) {
        handleSelectSession(remainingSessions[0]);
      } else {
        setCurrentSession(null);
      }
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

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-3">
      {/* Main Chat Area - LEFT */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" />
              WagerBot Chat
              {currentSession && (
                <span className="text-xs font-normal text-muted-foreground">
                  Session {currentSession.id.slice(-8)}
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!currentSession ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <Bot className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Welcome to WagerBot</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a new chat session to start talking with WagerBot about sports betting insights.
                  </p>
                  <Button onClick={handleCreateNewSession} disabled={isCreatingSession}>
                    {isCreatingSession ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Creating Session...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Start New Chat
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              {/* ChatKit Integration */}
              <div className="flex-1 border rounded-lg overflow-hidden">
                <ChatKitWrapper
                  user={user}
                  sessionId={currentSession.id}
                  theme={theme === 'dark' ? 'dark' : 'light'}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sidebar - Chat Sessions - RIGHT */}
      <Card className="w-64 flex flex-col">
        <CardHeader className="py-2 px-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Sessions
            </CardTitle>
            <Button
              onClick={handleCreateNewSession}
              disabled={isCreatingSession}
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
            >
              {isCreatingSession ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <MessageSquare className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
              <p className="text-xs">No sessions</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`group relative p-2 rounded border cursor-pointer transition-colors ${
                  currentSession?.id === session.id
                    ? 'bg-primary/10 border-primary'
                    : 'hover:bg-muted/50 border-transparent'
                }`}
                onClick={() => handleSelectSession(session)}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {session.id.slice(-8)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(session.lastActive).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {session.messages.length} msgs
                    </p>
                  </div>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(session.id);
                    }}
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
