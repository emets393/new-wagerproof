import React, { useEffect } from 'react';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { User } from '@supabase/supabase-js';
import { chatSessionManager } from '@/utils/chatSession';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { ChatKitErrorBoundary } from './ChatKitErrorBoundary';

interface ChatKitWrapperProps {
  user: User;
  sessionId: string;
  theme?: 'light' | 'dark';
}

export function ChatKitWrapper({ user, sessionId, theme = 'dark' }: ChatKitWrapperProps) {
  console.log('🔵 ChatKitWrapper rendering', { userId: user.id, sessionId });
  
  // Use workflow ID as the identifier for ChatKit
  const workflowId = 'wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0';
  
  const [initError, setInitError] = React.useState<string | null>(null);
  
  let hookResult;
  try {
    hookResult = useChatKit({
      api: {
        async getClientSecret(existing) {
          try {
            // If we have an existing secret, we could refresh it here
            if (existing) {
              console.log('🔄 Using existing client secret');
            }

            console.log('🔑 Getting client secret for workflow:', workflowId);
            
            // Get client secret from BuildShip workflow
            const result = await chatSessionManager.getClientSecret(user, existing);
            
            console.log('✅ Client secret obtained:', {
              length: result.clientSecret.length,
              prefix: result.clientSecret.substring(0, 20) + '...'
            });
            
            return result.clientSecret;
          } catch (error) {
            console.error('❌ Error getting client secret:', error);
            setInitError(`Failed to get client secret: ${error}`);
            throw error;
          }
        },
      },
      theme: {
        colorScheme: theme === 'dark' ? 'dark' : 'light',
        color: {
          accent: {
            primary: theme === 'dark' ? '#3B82F6' : '#2563EB', // Blue accent that works in both themes
            level: 2
          }
        },
        radius: 'round',
        density: 'normal',
        typography: { 
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" 
        },
      },
      composer: {
        placeholder: "Ask WagerBot about sports betting insights...",
      },
      startScreen: {
        greeting: "Welcome to WagerBot!",
        prompts: [
          {
            label: "NFL Analysis",
            prompt: "What are your thoughts on this week's NFL games?",
            icon: "search"
          },
          {
            label: "Betting Strategy", 
            prompt: "Can you help me understand betting strategies?",
            icon: "write"
          },
          {
            label: "Line Movement",
            prompt: "Explain how line movement affects betting decisions",
            icon: "chart"
          },
        ],
      },
    });
  } catch (error: any) {
    console.error('❌ useChatKit hook error:', error);
    setInitError(`ChatKit initialization error: ${error.message || error}`);
    hookResult = { control: null };
  }
  
  const { control } = hookResult;

  console.log('📦 Hook result:', { hasControl: !!control, hookResultKeys: Object.keys(hookResult) });

  // Log control object when ready
  useEffect(() => {
    if (control) {
      console.log('🎯 Control object ready:', {
        hasControl: !!control,
        controlKeys: Object.keys(control)
      });
    }
  }, [control]);

  useEffect(() => {
    console.log('🔵 ChatKit control state:', { hasControl: !!control });
    if (control) {
      console.log('✅ ChatKit control object:', control);
    }
  }, [control]);

  if (initError) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            {initError}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!control) {
    console.log('⏳ Waiting for ChatKit control...');
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Initializing chat...</p>
          <p className="text-xs text-muted-foreground">
            If this takes too long, check your BuildShip workflow configuration
          </p>
        </div>
      </div>
    );
  }

  console.log('🎉 ChatKit ready, rendering component');
  
  return (
    <ChatKitErrorBoundary>
      <div className="h-full w-full">
        <ChatKit 
          control={control}
          className="h-full w-full"
        />
      </div>
    </ChatKitErrorBoundary>
  );
}

