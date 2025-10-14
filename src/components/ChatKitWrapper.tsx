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
  systemContext?: string;
}

export function ChatKitWrapper({ user, sessionId, theme = 'dark', systemContext }: ChatKitWrapperProps) {
  console.log('🔵 ChatKitWrapper rendering', { userId: user.id, sessionId });
  
  // Use workflow ID as the identifier for ChatKit
  const workflowId = 'wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0';
  
  const [initError, setInitError] = React.useState<string | null>(null);
  
  let hookResult;
  try {
    const chatKitConfig: any = {
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
              prefix: result.clientSecret.substring(0, 20) + '...',
              hasContext: !!systemContext
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
        placeholder: systemContext 
          ? "Ask about the games and predictions on this page..." 
          : "Ask WagerBot about sports betting insights...",
      },
      startScreen: {
        greeting: systemContext 
          ? "I can help you analyze the games on this page! I have access to all the game data and predictions." 
          : "Welcome to WagerBot!",
        prompts: systemContext ? [
          {
            label: "Compare Games",
            prompt: "Which games have the best value according to the model?",
            icon: "search"
          },
          {
            label: "Betting Edges", 
            prompt: "Where do you see the biggest edges in these matchups?",
            icon: "chart"
          },
          {
            label: "Weather Impact",
            prompt: "How might weather affect these games?",
            icon: "info"
          },
        ] : [
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
    };

    // Note: ChatKit doesn't support setting system messages via config
    // The system context needs to be handled by the BuildShip workflow backend
    // For now, we'll inform users about the context in the greeting

    hookResult = useChatKit(chatKitConfig);
  } catch (error: any) {
    console.error('❌ useChatKit hook error:', error);
    setInitError(`ChatKit initialization error: ${error.message || error}`);
    hookResult = { control: null };
  }
  
  const { control } = hookResult;

  console.log('📦 Hook result:', { hasControl: !!control, hookResultKeys: Object.keys(hookResult) });

  // Track if we've initialized the thread for this context
  const [initializedContext, setInitializedContext] = React.useState<string | null>(null);

  // Log control object when ready and initialize with system context
  useEffect(() => {
    if (control && systemContext) {
      console.log('🎯 Control object ready:', {
        hasControl: !!control,
        controlKeys: Object.keys(control),
        contextLength: systemContext.length,
        alreadyInitialized: initializedContext === systemContext
      });

      // Only create thread if we haven't initialized this context yet
      if (initializedContext !== systemContext && typeof control.createThread === 'function') {
        console.log('📝 Creating NEW thread with system context (context changed or first time)');
        console.log('📊 Context preview:', systemContext.substring(0, 200) + '...');
        
        try {
          control.createThread({
            messages: [
              {
                role: "system",
                content: `You are WagerBot, an expert sports betting analyst. You have access to detailed game data and predictions for the games the user is currently viewing.

${systemContext}

Use this data to provide insightful analysis, identify value bets, explain model predictions, and answer questions about specific matchups. Be specific and reference the actual data provided when answering questions.`
              }
            ]
          });
          
          setInitializedContext(systemContext);
          console.log('✅ Thread created successfully with page-specific context');
        } catch (error) {
          console.error('❌ Error creating thread with system context:', error);
        }
      } else if (initializedContext === systemContext) {
        console.log('⏭️  Skipping thread creation - already initialized with this context');
      }
    }
  }, [control, systemContext]);

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

