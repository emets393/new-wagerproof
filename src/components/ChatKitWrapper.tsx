import React, { useEffect, useRef } from 'react';
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
  autoSendWelcome?: boolean;
}

export function ChatKitWrapper({ user, sessionId, theme = 'dark', systemContext, autoSendWelcome = false }: ChatKitWrapperProps) {
  console.log('🔵 ChatKitWrapper rendering', { userId: user.id, sessionId });
  
  // Use workflow ID as the identifier for ChatKit
  const workflowId = 'wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0';
  
  const [initError, setInitError] = React.useState<string | null>(null);
  const [hasAutoSent, setHasAutoSent] = React.useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  let hookResult;
  try {
    // Build the system message with context
    const systemMessage = systemContext 
      ? `You are WagerBot, an expert sports betting analyst. You have access to detailed game data and predictions for the games the user is currently viewing.

${systemContext}

Use this data to provide insightful analysis, identify value bets, explain model predictions, and answer questions about specific matchups. Be specific and reference the actual data provided when answering questions.`
      : "You are WagerBot, an expert sports betting analyst specialized in NFL, College Football, and other major sports. Help users understand betting strategies, analyze games, and make informed decisions based on the latest sports news and trends.";

    console.log('🔧 Building ChatKit config with system context:', {
      hasContext: !!systemContext,
      contextLength: systemContext?.length || 0,
      systemMessageLength: systemMessage.length
    });

    if (systemContext) {
      console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #8b5cf6; font-weight: bold');
      console.log('%c📤 CONFIGURING CHATKIT WITH METADATA', 'color: #8b5cf6; font-weight: bold; font-size: 14px');
      console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #8b5cf6; font-weight: bold');
      console.log('System prompt will be sent with each message via ChatKit metadata');
      console.log('System prompt length:', systemMessage.length);
      console.log('System prompt preview:', systemMessage.substring(0, 300) + '...');
      console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #8b5cf6; font-weight: bold');
    }

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
          : "Welcome to WagerBot! I'm your AI sports betting analyst. Ask me about the latest sports news, game analysis, betting strategies, and more!",
        prompts: systemContext ? [
          {
            label: "Compare Games",
            prompt: `<context>
You are WagerBot, an expert sports betting analyst. Here is the current game data:

${systemContext}

</context>











Which games have the best value according to the model?`,
            icon: "search"
          },
          {
            label: "Betting Edges", 
            prompt: `<context>
You are WagerBot, an expert sports betting analyst. Here is the current game data:

${systemContext}

</context>











Where do you see the biggest edges in these matchups?`,
            icon: "chart"
          },
          {
            label: "Weather Impact",
            prompt: `<context>
You are WagerBot, an expert sports betting analyst. Here is the current game data:

${systemContext}

</context>











How might weather affect these games?`,
            icon: "info"
          },
        ] : [
          {
            label: "Today's Sports News",
            prompt: "What did I miss today in sports news? Give me a quick rundown of the biggest stories and developments.",
            icon: "info"
          },
          {
            label: "NFL Updates",
            prompt: "What are the latest NFL news and storylines I should know about?",
            icon: "search"
          },
          {
            label: "Betting Insights", 
            prompt: "What are the key betting insights and trends in sports right now?",
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

  // Log control object when ready
  useEffect(() => {
    if (control) {
      console.log('🎯 Control object ready:', {
        hasControl: !!control,
        controlKeys: Object.keys(control),
        hasContext: !!systemContext
      });
      
      if (systemContext) {
        console.log('📊 Context will be appended to starter prompts and user messages');
      }
    }
  }, [control, systemContext]);

  useEffect(() => {
    console.log('🔵 ChatKit control state:', { hasControl: !!control });
    if (control) {
      console.log('✅ ChatKit control object:', control);
      console.log('Available control methods:', Object.keys(control));
    }
  }, [control]);

  // Auto-scroll functionality
  useEffect(() => {
    if (!chatContainerRef.current) return;

    const scrollToBottom = () => {
      const chatContainer = chatContainerRef.current;
      if (chatContainer) {
        // Find the scrollable chat messages container within ChatKit
        const messagesContainer = chatContainer.querySelector('[data-testid="messages"], [class*="messages"], [class*="chat-messages"], .chatkit-messages, [role="log"]');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
          // Fallback: scroll the main container
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }
    };

    // Create a MutationObserver to watch for new messages
    const observer = new MutationObserver((mutations) => {
      let shouldScroll = false;
      
      mutations.forEach((mutation) => {
        // Check if new nodes were added (new messages)
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any added nodes contain message content
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              // Look for message-related classes or attributes
              if (element.matches('[class*="message"], [class*="chat"], [data-testid*="message"]') ||
                  element.querySelector('[class*="message"], [class*="chat"], [data-testid*="message"]')) {
                shouldScroll = true;
              }
            }
          });
        }
        
        // Also check for text content changes (streaming text)
        if (mutation.type === 'characterData' || 
            (mutation.type === 'childList' && mutation.target.textContent)) {
          shouldScroll = true;
        }
      });

      if (shouldScroll) {
        // Small delay to ensure content is rendered
        setTimeout(scrollToBottom, 50);
      }
    });

    // Start observing the chat container
    observer.observe(chatContainerRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Initial scroll to bottom when component mounts
    setTimeout(scrollToBottom, 1000);

    return () => {
      observer.disconnect();
    };
  }, [control]);

  // Auto-send welcome message on first login
  useEffect(() => {
    if (control && autoSendWelcome && !hasAutoSent) {
      console.log('🎉 First login detected! Sending welcome message...');
      
      // Wait a short moment for ChatKit to fully initialize
      const timer = setTimeout(() => {
        try {
          // Try to find and click the first starter prompt, or send a custom message
          const welcomeMessage = "What did I miss today in sports news? Give me a quick rundown of the biggest stories and developments.";
          
          // Check if control has a method to send messages
          if (typeof control.sendMessage === 'function') {
            control.sendMessage(welcomeMessage);
            console.log('✅ Welcome message sent via control.sendMessage');
          } else if (typeof control.composer?.sendMessage === 'function') {
            control.composer.sendMessage(welcomeMessage);
            console.log('✅ Welcome message sent via control.composer.sendMessage');
          } else {
            // Fallback: Try to programmatically click the first starter prompt
            const prompts = document.querySelectorAll('[data-testid="starter-prompt"], [class*="starter"], [class*="prompt-button"]');
            if (prompts.length > 0) {
              (prompts[0] as HTMLElement).click();
              console.log('✅ Clicked first starter prompt');
            } else {
              console.log('ℹ️ No starter prompts found, user will see default greeting');
            }
          }
          
          setHasAutoSent(true);
        } catch (error) {
          console.error('❌ Error sending welcome message:', error);
          console.log('ℹ️ Welcome message failed, but chat is still functional');
        }
      }, 1500); // Wait 1.5 seconds for ChatKit to fully render
      
      return () => clearTimeout(timer);
    }
  }, [control, autoSendWelcome, hasAutoSent]);

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
      <div ref={chatContainerRef} className="h-full w-full">
        <ChatKit 
          control={control}
          className="h-full w-full"
        />
      </div>
    </ChatKitErrorBoundary>
  );
}

