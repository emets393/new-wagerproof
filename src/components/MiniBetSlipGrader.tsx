import debug from '@/utils/debug';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileImage, X, Loader2 } from 'lucide-react';
import { chatSessionManager, ChatSession } from '@/utils/chatSession';
import { ChatKitWrapper } from '@/components/ChatKitWrapper';
import { Alert, AlertDescription } from '@/components/ui/alert';
import GlassIcon from '@/components/magicui/glass-icon';

const BET_SLIP_GRADER_PAGE_ID = 'mini-bet-slip-grader-landing';
const BET_SLIP_GRADER_WORKFLOW_ID = 'wf_68f14e36a2588190a185e02e637f163e086aff574c3be293';

interface MiniBetSlipGraderProps {
  inline?: boolean;
}

export function MiniBetSlipGrader({ inline = false }: MiniBetSlipGraderProps = {}) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(inline); // If inline, always open
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Drag functionality state
  const getInitialPosition = () => {
    const isMobile = window.innerWidth < 768;
    const chatWidth = isMobile ? Math.min(window.innerWidth * 0.95, 440) : 440;
    const chatHeight = isMobile ? Math.min(window.innerHeight * 0.8, 650) : 650;
    
    if (isMobile) {
      // Center on mobile devices
      return {
        x: Math.max(0, (window.innerWidth - chatWidth) / 2),
        y: Math.max(0, (window.innerHeight - chatHeight) / 2)
      };
    }
    
    // Desktop positioning (bottom-right)
    return {
      x: window.innerWidth - 480,
      y: window.innerHeight - 700
    };
  };
  
  const [position, setPosition] = useState(getInitialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Load or create session when opened
  useEffect(() => {
    if (isOpen && !isLoading) {
      // For inline mode (landing page), allow without user
      if (inline || user) {
        loadOrCreateSession();
      }
    }
  }, [isOpen, user, inline]);

  // Reset position to initial when chat is opened (only for floating mode)
  useEffect(() => {
    if (isOpen && !inline) {
      setPosition(getInitialPosition());
    }
  }, [isOpen, inline]);

  const loadOrCreateSession = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Create a guest user if no user is signed in (for landing page)
      const guestUser = user || {
        id: 'guest-' + Math.random().toString(36).substr(2, 9),
        email: 'guest@wagerproof.com',
        created_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        updated_at: new Date().toISOString()
      } as any;

      // Try to get existing session for this specific page
      let session = chatSessionManager.getCurrentSession(guestUser.id, BET_SLIP_GRADER_PAGE_ID);
      
      if (!session) {
        debug.log('Creating new Bet Slip Grader session...');
        session = await chatSessionManager.createNewSession(guestUser, BET_SLIP_GRADER_PAGE_ID);
      }

      setCurrentSession(session);
    } catch (err: any) {
      debug.error('Error loading session:', err);
      setError(err.message || 'Failed to load chat session');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChat = () => {
    if (!user) {
      // Redirect to sign in or show a message
      window.location.href = '/welcome';
      return;
    }
    setIsOpen(!isOpen);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    // Keep window within viewport bounds
    const isMobile = window.innerWidth < 768;
    const chatWidth = isMobile ? Math.min(window.innerWidth * 0.95, 440) : 440;
    const chatHeight = isMobile ? Math.min(window.innerHeight * 0.8, 650) : 650;
    
    const maxX = window.innerWidth - chatWidth;
    const maxY = window.innerHeight - chatHeight;
    
    const boundedX = Math.max(0, Math.min(newX, maxX));
    const boundedY = Math.max(0, Math.min(newY, maxY));

    setPosition({ x: boundedX, y: boundedY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // Inline mode - render directly in page
  if (inline) {
    // Create guest user for rendering if needed
    const renderUser = user || {
      id: 'guest-render',
      email: 'guest@wagerproof.com',
      created_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      updated_at: new Date().toISOString()
    } as any;

    return (
      <Card className="w-full h-[700px] shadow-xl flex flex-col overflow-hidden border-2 border-green-500/20">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-500/10 to-emerald-500/10">
          <div className="flex items-center gap-2">
            <FileImage className="h-5 w-5 text-green-500" />
            <span className="font-semibold">Bet Slip Grader</span>
          </div>
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
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Loading Bet Slip Grader...</p>
              </div>
            </div>
          ) : (
            <ChatKitWrapper
              user={renderUser}
              sessionId={currentSession.id}
              theme={theme === 'dark' ? 'dark' : 'light'}
              workflowId={BET_SLIP_GRADER_WORKFLOW_ID}
              enableImageUpload={true}
            />
          )}
        </div>
      </Card>
    );
  }

  // Floating mode - original behavior
  return (
    <>
      {/* Floating Chat Window */}
      {isOpen && (
        <Card 
          className="fixed z-50 w-[95vw] max-w-[440px] h-[80vh] max-h-[650px] md:w-[440px] md:h-[650px] shadow-2xl flex flex-col overflow-hidden border-2 border-green-500/20"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
          onMouseDown={handleMouseDown}
        >
          {/* Header */}
          <div className="drag-handle flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-500/10 to-emerald-500/10 cursor-move">
            <div className="flex items-center gap-2">
              <FileImage className="h-5 w-5 text-green-500" />
              <span className="font-semibold text-sm">Bet Slip Grader</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="h-6 w-6 p-0"
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
                  <p className="text-xs text-muted-foreground">Loading Bet Slip Grader...</p>
                </div>
              </div>
            ) : (
              <ChatKitWrapper
                user={user!}
                sessionId={currentSession.id}
                theme={theme === 'dark' ? 'dark' : 'light'}
                workflowId={BET_SLIP_GRADER_WORKFLOW_ID}
                enableImageUpload={true}
              />
            )}
          </div>
        </Card>
      )}

      {/* Floating Action Button - Hidden on mobile when chat is open */}
      <div
        onClick={toggleChat}
        className={`
          fixed bottom-6 right-6 z-40
          ${isOpen ? 'hidden md:block md:opacity-0 md:pointer-events-none' : 'block opacity-100'}
          transition-all duration-300 ease-in-out
          cursor-pointer group
        `}
      >
        <GlassIcon
          icon={<FileImage className="h-6 w-6" />}
          size="lg"
          className="shadow-lg hover:shadow-xl transition-all duration-200 group-hover:scale-110"
          aria-label="Open Bet Slip Grader"
        />
        
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Try Bet Slip Grader
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
        </div>
      </div>
    </>
  );
}

