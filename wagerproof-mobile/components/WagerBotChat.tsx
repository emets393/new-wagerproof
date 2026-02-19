import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Alert,
  Keyboard,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useThemeContext } from '../contexts/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import LottieView from 'lottie-react-native';
import ReanimatedAnimated, { 
  useSharedValue, 
  useAnimatedStyle,
  FadeIn,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Markdown from 'react-native-markdown-display';
import { chatSessionManager, ChatMessage } from '../utils/chatSessionManager';
import { chatThreadService } from '../services/chatThreadService';

// Animated word component for streaming text fade-in effect (optimized from per-character)
const AnimatedWord = React.memo(({
  word,
  shouldAnimate,
  animationDelay,
  color
}: {
  word: string;
  shouldAnimate: boolean;
  animationDelay: number;
  color: string;
}) => {
  const opacity = useSharedValue(shouldAnimate ? 0 : 1);

  useEffect(() => {
    if (shouldAnimate) {
      opacity.value = withDelay(
        animationDelay,
        withTiming(1, {
          duration: 150,
          easing: Easing.out(Easing.ease),
        })
      );
    }
  }, [shouldAnimate, animationDelay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value
  }));

  return (
    <ReanimatedAnimated.Text style={[{ color }, animatedStyle]}>
      {word}
    </ReanimatedAnimated.Text>
  );
}, (prev, next) =>
  prev.word === next.word &&
  prev.shouldAnimate === next.shouldAnimate &&
  prev.color === next.color
);

// Streaming text component with word-by-word fade-in animation (optimized from per-character)
interface AnimatedStreamingTextProps {
  text: string;
  color: string;
  isStreaming: boolean;
}

const AnimatedStreamingText: React.FC<AnimatedStreamingTextProps> = React.memo(({
  text,
  color,
  isStreaming
}) => {
  // Track how many words were rendered in previous renders
  const prevWordCountRef = useRef(0);
  // Track which word indices have started animating (to prevent re-animation on re-render)
  const animatingIndicesRef = useRef<Set<number>>(new Set());

  // Split by whitespace but preserve the whitespace in tokens
  // This creates tokens like ["Hello", " ", "world", " ", "!"]
  const tokens = text.split(/(\s+)/);
  const prevWordCount = prevWordCountRef.current;

  // After render, update tracking refs
  useEffect(() => {
    for (let i = prevWordCount; i < tokens.length; i++) {
      animatingIndicesRef.current.add(i);
    }
    prevWordCountRef.current = tokens.length;
  }, [tokens.length, prevWordCount]);

  return (
    <Text
      style={{
        fontSize: 16,
        lineHeight: 24,
        flexWrap: 'wrap',
        flexShrink: 1,
        width: '100%',
        color
      }}
    >
      {tokens.map((token, index) => {
        // Only animate if this is a new token that hasn't been animated yet
        const isNewToken = index >= prevWordCount;
        const alreadyAnimated = animatingIndicesRef.current.has(index);
        const shouldAnimate = isNewToken && !alreadyAnimated;

        // Stagger delay: 20ms per word, capped at 200ms total for smooth feel
        const delay = shouldAnimate
          ? Math.min((index - prevWordCount) * 20, 200)
          : 0;

        return (
          <AnimatedWord
            key={index}
            word={token}
            shouldAnimate={shouldAnimate}
            animationDelay={delay}
            color={color}
          />
        );
      })}
    </Text>
  );
});

interface WagerBotChatProps {
  userId: string;
  userEmail: string;
  gameContext?: string;
  onRefresh?: () => void;
  onBack?: () => void;
  scrollY?: Animated.Value;
  headerHeight?: number;
}

const WagerBotChat = forwardRef<any, WagerBotChatProps>(({
  userId,
  userEmail,
  gameContext = '',
  onRefresh,
  onBack,
  scrollY,
  headerHeight = 0,
}, ref) => {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const welcomeScrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Track if user is at the bottom of the scroll view (for conditional auto-scroll)
  const isAtBottomRef = useRef(true);
  const contentHeightRef = useRef(0);
  const scrollViewHeightRef = useRef(0);

  // Handle scroll event - track position and optionally animate header
  const handleScrollEvent = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    contentHeightRef.current = contentSize.height;
    scrollViewHeightRef.current = layoutMeasurement.height;

    // Consider "at bottom" if within 100px of the bottom
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    isAtBottomRef.current = distanceFromBottom < 100;
  }, []);

  // Handle scroll event for header animation
  const handleScroll = scrollY
    ? Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        {
          useNativeDriver: true,
          listener: handleScrollEvent, // Also track scroll position
        }
      )
    : handleScrollEvent;

  // Build scroll props conditionally
  const scrollProps = {
    onScroll: handleScroll,
    scrollEventThrottle: 16,
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Note: threadId no longer used with Responses API (kept for backward compatibility)
  const [threadId, setThreadId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [chatHistories, setChatHistories] = useState<Array<{ id: string; title: string; timestamp: string; threadId: string | null }>>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  // Animation values for message appearance
  const messageAnimations = useRef<{ [key: string]: Animated.Value }>({});
  const drawerAnimation = useRef(new Animated.Value(300)).current; // Positive for right side

  // Memoized markdown styles to prevent recreation on every render
  const markdownStyles = useMemo(() => ({
    body: { color: theme.colors.onSurface, fontSize: 16, lineHeight: 24, flexShrink: 1, flexWrap: 'wrap' as const },
    paragraph: { marginTop: 0, marginBottom: 12, flexWrap: 'wrap' as const },
    text: { flexWrap: 'wrap' as const },
    heading1: { fontSize: 24, fontWeight: 'bold' as const, marginBottom: 12, marginTop: 8, color: theme.colors.onSurface },
    heading2: { fontSize: 20, fontWeight: 'bold' as const, marginBottom: 10, marginTop: 6, color: theme.colors.onSurface },
    heading3: { fontSize: 18, fontWeight: 'bold' as const, marginBottom: 8, marginTop: 4, color: theme.colors.onSurface },
    strong: { fontWeight: 'bold' as const, color: theme.colors.onSurface },
    em: { fontStyle: 'italic' as const },
    code_inline: { backgroundColor: theme.colors.surfaceVariant, color: theme.colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 14 },
    code_block: { backgroundColor: '#1e1e1e', padding: 12, borderRadius: 8, marginVertical: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 13 },
    fence: { backgroundColor: '#1e1e1e', padding: 12, borderRadius: 8, marginVertical: 12, color: '#d4d4d4', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 13 },
    link: { color: theme.colors.primary, textDecorationLine: 'underline' as const },
    blockquote: { backgroundColor: theme.colors.surfaceVariant, borderLeftWidth: 4, borderLeftColor: theme.colors.primary, paddingLeft: 12, paddingVertical: 8, marginVertical: 8, fontStyle: 'italic' as const },
    bullet_list: { marginBottom: 8, marginTop: 0 },
    ordered_list: { marginBottom: 8, marginTop: 0 },
    list_item: { marginBottom: 4, lineHeight: 24 },
    table: { borderWidth: 1, borderColor: theme.colors.outline, borderRadius: 8, marginVertical: 12 },
    th: { backgroundColor: theme.colors.surfaceVariant, padding: 10, fontWeight: 'bold' as const },
    td: { padding: 10, borderWidth: 1, borderColor: theme.colors.outline },
    hr: { backgroundColor: theme.colors.outline, height: 1, marginVertical: 16 },
  }), [theme.colors]);

  // Suggested messages
  const suggestedMessages = [
    { label: '📰 Check News', message: 'What are the latest news and updates affecting today\'s games?' },
    { label: '🎯 Model Predictions', message: 'Show me the model predictions and confidence levels for today\'s games' },
    { label: '🌤️ Weather Impact', message: 'How is the weather affecting today\'s games and what should I consider?' },
    { label: '💰 Best Bets', message: 'What are your best betting recommendations for today based on all available data?' },
    { label: '📊 Stats Breakdown', message: 'Give me a detailed statistical breakdown of the key matchups today' },
    { label: '🔥 Hot Takes', message: 'What are some contrarian or undervalued betting opportunities today?' },
  ];
  
  const getMessageAnimation = (messageId: string) => {
    if (!messageAnimations.current[messageId]) {
      messageAnimations.current[messageId] = new Animated.Value(0);
    }
    return messageAnimations.current[messageId];
  };

  // Validate and clean threadId whenever it's set
  const setValidatedThreadId = (newThreadId: string | null) => {
    if (newThreadId && newThreadId.startsWith('thread_')) {
      console.log('✅ Setting valid thread ID:', newThreadId);
      setThreadId(newThreadId);
    } else if (newThreadId) {
      console.warn('⚠️ Rejecting invalid thread ID:', newThreadId);
      setThreadId(null);
    } else {
      setThreadId(null);
    }
  };

  // Debug: Log threadId changes to track where invalid IDs come from
  useEffect(() => {
    console.log('🔍 Thread ID state changed:', threadId || 'NULL');
    if (threadId && !threadId.startsWith('thread_')) {
      console.error('❌ INVALID THREAD ID IN STATE:', threadId);
      console.error('   This should never happen - thread ID validation failed!');
    }
  }, [threadId]);

  // Debug: Log sessionId changes to track thread creation
  useEffect(() => {
    console.log('📝 Session ID changed:', sessionId || 'NULL');
    if (sessionId) {
      console.log('   ✅ Session ID set - will update existing thread');
    } else {
      console.log('   🆕 Session ID null - will create new thread on next message');
    }
  }, [sessionId]);

  // Animate existing messages when loaded from history
  useEffect(() => {
    messages.forEach((message, index) => {
      const animation = getMessageAnimation(message.id || `msg_${index}`);
      const currentValue = (animation as any)._value;
      
      if (currentValue === 0) {
        // Stagger animations for existing messages
        setTimeout(() => {
          Animated.spring(animation, {
            toValue: 1,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        }, index * 50);
      }
    });
  }, [messages.length]);

  const loadChatHistories = async () => {
    try {
      const threads = await chatThreadService.getThreads(userId);
      const histories = threads.map(thread => ({
        id: thread.id,
        title: thread.title || 'New Chat',
        timestamp: thread.updated_at,
        threadId: thread.openai_thread_id,
      }));
      setChatHistories(histories);
      console.log('✅ Loaded', histories.length, 'chat histories');
    } catch (err) {
      console.error('Error loading chat histories:', err);
    }
  };

  // Load chat histories on mount
  useEffect(() => {
    loadChatHistories();
  }, []);

  // Animate drawer open/close (right side)
  useEffect(() => {
    Animated.spring(drawerAnimation, {
      toValue: showHistoryDrawer ? 0 : 300,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [showHistoryDrawer]);

  // Sync showWelcome with messages - show welcome only when there are no messages
  // This ensures showWelcome stays false once messages are sent, even if initializeChat is called again
  useEffect(() => {
    setShowWelcome(messages.length === 0);
  }, [messages.length]);

  // Handle keyboard show/hide - track height and scroll to input
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Small delay to ensure layout is updated
        setTimeout(() => {
          if (showWelcome) {
            welcomeScrollViewRef.current?.scrollToEnd({ animated: true });
          } else {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }
        }, 100);
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [showWelcome]);

  // Initialize chat session and get client secret
  useEffect(() => {
    initializeChat();
  }, [userId, gameContext]);

  const initializeChat = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🔄 Initializing WagerBot chat...');

      // Don't create thread yet - wait for first message
      // Just get client secret for BuildShip
      const { clientSecret: secret } = await chatSessionManager.getClientSecret(
        userId,
        userEmail,
        gameContext
      );

      setClientSecret(secret);
      console.log('✅ Chat initialized successfully (no thread created yet)');
      
      // Don't set showWelcome here - let it be controlled by messages.length via useEffect
      // This prevents resetting to welcome screen when gameContext updates after first message
    } catch (err) {
      console.error('❌ Error initializing chat:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize chat');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (onRefresh) {
      await onRefresh();
    }
    await initializeChat();
    setRefreshing(false);
  };

  const clearChat = async () => {
    try {
      console.log('🧹 Clearing chat...');
      console.log('  - Old sessionId:', sessionId);
      console.log('  - Old threadId:', threadId);
      
      // Reset all state
      setMessages([]);
      setSessionId(null);
      setThreadId(null);
      setShowWelcome(true);
      
      // Re-initialize to get fresh client secret
      await initializeChat();
      
      console.log('✅ Chat cleared - ready for new conversation');
    } catch (err) {
      console.error('Error clearing chat:', err);
    }
  };

  const switchToChat = async (historyId: string, openaiThreadId: string | null) => {
    try {
      const thread = await chatThreadService.getThread(historyId);
      if (thread) {
        // Convert thread messages to component format
        const loadedMessages = thread.messages?.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.created_at,
        })) || [];
        
        setMessages(loadedMessages);
        setThreadId(openaiThreadId);
        setSessionId(historyId);
        setShowWelcome(loadedMessages.length === 0);
        setShowHistoryDrawer(false);
        console.log('✅ Switched to chat:', historyId, 'with', loadedMessages.length, 'messages');
      }
    } catch (err) {
      console.error('Error switching chat:', err);
    }
  };

  const toggleHistoryDrawer = useCallback(() => {
    setShowHistoryDrawer(prev => {
      if (!prev) {
        loadChatHistories();
      }
      return !prev;
    });
  }, []);

  const deleteThread = async (threadId: string, threadTitle: string) => {
    Alert.alert(
      'Delete Chat',
      `Are you sure you want to delete "${threadTitle}"? This cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatThreadService.deleteThread(threadId);
              console.log('✅ Deleted thread:', threadId);
              
              // If we're currently viewing this thread, clear the chat
              if (sessionId === threadId) {
                setMessages([]);
                setSessionId(null);
                setThreadId(null);
                setShowWelcome(true);
              }
              
              // Reload history
              await loadChatHistories();
            } catch (error) {
              console.error('❌ Error deleting thread:', error);
              Alert.alert('Error', 'Failed to delete chat. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Expose functions to parent via ref
  useImperativeHandle(ref, () => ({
    toggleHistoryDrawer,
    clearChat,
  }));

  const handleSuggestedMessage = useCallback((message: string) => {
    if (isLoading || isSending) return;
    setInputText(message);
    // Small delay to show the text before sending
    setTimeout(() => {
      sendMessageWithText(message);
    }, 100);
  }, [isLoading, isSending]);

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading || isSending) return;
    await sendMessageWithText(inputText.trim());
  };

  const sendMessageWithText = async (messageText: string) => {
    if (!messageText || isLoading || isSending) return;
    
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    console.log('🎬 Starting sendMessage function');
    console.log('  - Input text:', messageText);
    console.log('  - Message content:', userMessage.content);
    console.log('  - Message content length:', userMessage.content.length);

    // Clear input immediately and update UI
    setInputText('');
    setShowWelcome(false);
    setMessages(prev => [...prev, userMessage]);
    setIsSending(true);

    // Animate user message appearance
    const userAnimation = getMessageAnimation(userMessage.id);
    Animated.spring(userAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();

    // Add empty assistant message after a short delay (for fluid feel)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const assistantMessageId = `msg_${Date.now()}_assistant`;
    const emptyAssistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, emptyAssistantMessage]);
    
    // Animate assistant thinking bubble appearance
    const assistantAnimation = getMessageAnimation(assistantMessageId);
    Animated.spring(assistantAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();

    try {
      console.log('📤 Sending message to BuildShip (Responses API)...');

      // BuildShip Responses API expects: message, conversationHistory, and SystemPrompt
      const requestBody: any = {
        message: messageText,
      };

      // Always include SystemPrompt if available (game context)
      if (gameContext && gameContext.length > 0) {
        requestBody.SystemPrompt = gameContext;
        console.log(`📊 Including game context (${gameContext.length} chars)`);
      }

      // Include conversation history (last 20 messages = 10 exchanges)
      // Responses API is stateless, so we send history with each request
      const conversationHistory = messages
        .slice(-20)  // Last 20 messages to stay within context limits
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      if (conversationHistory.length > 0) {
        requestBody.conversationHistory = conversationHistory;
        console.log(`📝 Including conversation history (${conversationHistory.length} messages)`);
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📦 REQUEST PAYLOAD TO BUILDSHIP (RESPONSES API)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Full payload:', JSON.stringify(requestBody, null, 2));
      console.log('');
      console.log('Payload structure:');
      console.log('  - message:', requestBody.message ? `"${requestBody.message}"` : 'UNDEFINED');
      console.log('  - message type:', typeof requestBody.message);
      console.log('  - conversationHistory:', requestBody.conversationHistory ? `${requestBody.conversationHistory.length} messages` : 'EMPTY');
      console.log('  - SystemPrompt:', requestBody.SystemPrompt ? `(${requestBody.SystemPrompt.length} chars)` : 'NOT_PRESENT');
      
      // Enhanced debugging for SystemPrompt
      if (requestBody.SystemPrompt) {
        console.log('');
        console.log('📊 SYSTEM PROMPT CONTENT PREVIEW:');
        console.log('First 500 chars:', requestBody.SystemPrompt.substring(0, 500));
        console.log('...');
        console.log('Last 200 chars:', requestBody.SystemPrompt.substring(requestBody.SystemPrompt.length - 200));
      } else {
        console.log('');
        console.log('⚠️ WARNING: NO SYSTEM PROMPT INCLUDED!');
        console.log('   gameContext prop value:', gameContext ? `${gameContext.length} chars` : 'EMPTY/NULL');
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // BuildShip mobile chat endpoint
      const chatEndpoint = 'https://xna68l.buildship.run/wager-bot-mobile-900a291b0aae';

      console.log('🌐 Sending to:', chatEndpoint);

      // ✅ REAL STREAMING using XMLHttpRequest with progress events
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.open('POST', chatEndpoint, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        let parsedLength = 0;
        let currentContent = '';
        let lastUpdateTime = 0;
        let lastUIUpdateTime = 0;
        let progressEventCount = 0;
        const startTime = Date.now();
        let pollingInterval: ReturnType<typeof setInterval> | null = null;
        let pendingUIUpdate: ReturnType<typeof setTimeout> | null = null;

        // Batched UI update function - reduces re-renders during streaming
        const flushUIUpdate = () => {
          if (pendingUIUpdate) {
            clearTimeout(pendingUIUpdate);
            pendingUIUpdate = null;
          }

          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: currentContent }
                : msg
            )
          );
          lastUIUpdateTime = Date.now();
          setIsStreaming(true);
        };

        // Schedule a batched UI update (debounced)
        const scheduleUIUpdate = () => {
          const now = Date.now();
          const timeSinceLastUpdate = now - lastUIUpdateTime;

          // If it's been more than 100ms since last update, update immediately
          if (timeSinceLastUpdate >= 100) {
            flushUIUpdate();
          } else if (!pendingUIUpdate) {
            // Otherwise schedule an update for when 100ms has passed
            pendingUIUpdate = setTimeout(flushUIUpdate, 100 - timeSinceLastUpdate);
          }
        };

        // Helper function to process new text chunks
        const processNewText = (newText: string, source: string) => {
          if (!newText || newText.length === 0) {
            return;
          }

          progressEventCount++;
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

          console.log(`🔄 ${source} #${progressEventCount} at ${elapsed}s - New bytes: ${newText.length}, Total: ${parsedLength + newText.length}`);

          // With Responses API, we get plain text chunks directly
          // No need to parse SSE format or extract thread IDs
          currentContent += newText;

          console.log('📝 Received chunk:', newText.substring(0, 50));
          console.log(`   Content so far: ${currentContent.length} chars`);

          // Schedule batched UI update (reduces re-renders from every chunk to max 10/sec)
          scheduleUIUpdate();

          // Haptic feedback every 100ms max (smooth but not overwhelming)
          const currentTime = Date.now();
          if (currentTime - lastUpdateTime > 100) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            lastUpdateTime = currentTime;
          }

          console.log('✅ UI update scheduled, total length:', currentContent.length);
        };
        
        // iOS: onprogress fires reliably
        // Android: onprogress often doesn't fire, so we also use polling as fallback
        xhr.onprogress = () => {
          const newText = xhr.responseText.substring(parsedLength);
          parsedLength = xhr.responseText.length;
          
          if (newText) {
            processNewText(newText, Platform.OS === 'ios' ? 'iOS Progress' : 'Android Progress');
          }
        };
        
        // Android fallback: Poll responseText since onprogress doesn't fire reliably
        if (Platform.OS === 'android') {
          console.log('🤖 Android detected - enabling polling fallback for streaming');
          
          // Start polling after headers are received
          pollingInterval = setInterval(() => {
            try {
              // Check if request is still in progress
              if (xhr.readyState >= 2 && xhr.readyState < 4 && xhr.responseText) {
                const currentResponseLength = xhr.responseText.length;
                if (currentResponseLength > parsedLength) {
                  const newText = xhr.responseText.substring(parsedLength);
                  parsedLength = currentResponseLength;
                  processNewText(newText, 'Android Polling');
                }
              }
              
              // Stop polling when complete
              if (xhr.readyState === 4) {
                if (pollingInterval) {
                  clearInterval(pollingInterval);
                  pollingInterval = null;
                }
              }
            } catch (e) {
              // Ignore errors during polling
            }
          }, 150); // Poll every 150ms (reduced from 50ms for better Android performance)
        }
        
        xhr.onload = async () => {
          // Clear Android polling interval
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }

          // Clear any pending UI update timeout
          if (pendingUIUpdate) {
            clearTimeout(pendingUIUpdate);
            pendingUIUpdate = null;
          }

          // Process any remaining text that wasn't caught by streaming
          const remainingText = xhr.responseText.substring(parsedLength);
          if (remainingText && remainingText.length > 0) {
            console.log('📝 Processing final chunk:', remainingText.length, 'bytes');
            currentContent += remainingText; // Add directly instead of calling processNewText
          }

          // Final UI flush to ensure all content is displayed
          flushUIUpdate();
          
          const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('✅ Stream complete!');
          console.log(`📊 STREAMING STATS:`);
          console.log(`   - Platform: ${Platform.OS}`);
          console.log(`   - Total time: ${totalTime}s`);
          console.log(`   - Progress events: ${progressEventCount}`);
          console.log(`   - Final content length: ${currentContent.length} chars`);
          console.log(`   - Average chars per event: ${(currentContent.length / Math.max(1, progressEventCount)).toFixed(0)}`);
          if (progressEventCount === 0) {
            console.log('⚠️ WARNING: No streaming events! Full response arrived at once.');
          } else {
            console.log(`✅ ${progressEventCount} streaming events detected - streaming worked!`);
          }
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          setIsStreaming(false);
          
          if (xhr.status !== 200) {
            console.error('❌ BuildShip error response:', xhr.responseText);
            reject(new Error(`API request failed: ${xhr.status}. ${xhr.responseText.substring(0, 100)}`));
            return;
          }
          
          // FALLBACK: If streaming didn't fire at all (rare), use responseText directly
          if (!currentContent && xhr.responseText) {
            console.log('⚠️ Streaming did not work - using responseText fallback');
            currentContent = xhr.responseText;
            
            // Update UI with the complete response
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: currentContent }
                  : msg
              )
            );
          }
          
          if (!currentContent) {
            reject(new Error('No content received from BuildShip'));
            return;
          }
          
          console.log('✅ Final message length:', currentContent.length);
          
          // Save to Supabase (Responses API doesn't use OpenAI thread IDs)
          try {
            console.log('💾 Starting Supabase save...');
            console.log('  - Current sessionId:', sessionId);
            console.log('  - User ID:', userId);
            console.log('  - Message text length:', messageText.length);
            console.log('  - Assistant content length:', currentContent.length);
            
            // If this is the first message, create a new thread in Supabase
            if (!sessionId) {
              console.log('🆕 Creating new thread in Supabase...');
              const thread = await chatThreadService.createThread(
                userId,
                messageText,
                undefined  // No OpenAI thread ID with Responses API
              );
              setSessionId(thread.id);
              console.log('✅ Created new Supabase thread:', thread.id);
              
              // Save both messages to the thread
              console.log('💾 Saving user message...');
              await chatThreadService.saveMessage(thread.id, 'user', messageText);
              console.log('✅ User message saved');
              
              // Save assistant message
              console.log('💾 Saving assistant message...');
              await chatThreadService.saveMessage(thread.id, 'assistant', currentContent);
              console.log('✅ Assistant message saved');
              
            } else {
              console.log('📝 Updating existing thread:', sessionId);
              
              // Save new messages to existing thread
              console.log('💾 Saving user message to existing thread...');
              await chatThreadService.saveMessage(sessionId, 'user', messageText);
              console.log('✅ User message saved');
              
              console.log('💾 Saving assistant message to existing thread...');
              await chatThreadService.saveMessage(sessionId, 'assistant', currentContent);
              console.log('✅ Assistant message saved');
            }
            
            console.log('✅ All messages saved to Supabase successfully!');
          } catch (error: any) {
            console.error('❌❌❌ FAILED TO SAVE TO SUPABASE ❌❌❌');
            console.error('Error type:', error?.constructor?.name);
            console.error('Error message:', error?.message);
            console.error('Full error:', JSON.stringify(error, null, 2));
            console.error('Stack:', error?.stack);
            // Non-critical, don't reject the whole operation
          }
          
          resolve();
        };
        
        xhr.onerror = () => {
          // Clear Android polling interval and pending UI updates
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
          if (pendingUIUpdate) {
            clearTimeout(pendingUIUpdate);
            pendingUIUpdate = null;
          }
          console.error('❌ XHR error');
          setIsStreaming(false);
          reject(new Error('Network request failed'));
        };

        xhr.ontimeout = () => {
          // Clear Android polling interval and pending UI updates
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
          if (pendingUIUpdate) {
            clearTimeout(pendingUIUpdate);
            pendingUIUpdate = null;
          }
          console.error('❌ XHR timeout');
          setIsStreaming(false);
          reject(new Error('Request timeout'));
        };
        
        xhr.timeout = 30000; // 30 second timeout
        
        // Send the request
        console.log('📤 Sending XHR request...');
        xhr.send(JSON.stringify(requestBody));
      });

      console.log('✅ Real-time streaming complete!');
    } catch (err) {
      console.error('❌ Error sending message:', err);
      
      // Remove the empty assistant message if it exists and replace with error
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.content !== '');
        return [
          ...filtered,
          {
            id: `msg_${Date.now()}_error`,
            role: 'assistant',
            content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
            timestamp: new Date().toISOString(),
          }
        ];
      });
    } finally {
      setIsSending(false);
    }
  };

  // Removed auto-scroll useEffect - now handled by onContentSizeChange in ScrollView

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <MaterialCommunityIcons name="alert-circle" size={60} color={theme.colors.error} />
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          onPress={initializeChat}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
      <LinearGradient
        colors={['#141414', '#0d0d0d', '#080808']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* History Drawer */}
      <Animated.View 
        style={[
          styles.historyDrawer,
          {
            paddingTop: insets.top,
            transform: [{ translateX: drawerAnimation }],
          }
        ]}
      >
        <View pointerEvents="none" style={styles.historyDrawerFx}>
          <BlurView intensity={34} tint="dark" style={StyleSheet.absoluteFillObject} />
          <LinearGradient
            colors={['rgba(20,20,20,0.92)', 'rgba(14,14,14,0.85)', 'rgba(10,10,10,0.8)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>Chat History</Text>
          <TouchableOpacity onPress={toggleHistoryDrawer}>
            <MaterialCommunityIcons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.drawerContent}>
          {chatHistories.length === 0 ? (
            <Text style={styles.emptyHistoryText}>
              No chat history yet
            </Text>
          ) : (
            chatHistories.map((history) => (
              <View
                key={history.id}
                style={[
                  styles.historyItem,
                  sessionId === history.id && styles.historyItemActive,
                ]}
              >
                <TouchableOpacity
                  style={styles.historyItemContent}
                  onPress={() => switchToChat(history.id, history.threadId)}
                >
                  <MaterialCommunityIcons 
                    name="message-text-outline" 
                    size={20} 
                    color="rgba(255,255,255,0.82)" 
                    style={styles.historyIcon}
                  />
                  <View style={styles.historyTextContainer}>
                    <Text 
                      style={styles.historyTitle}
                      numberOfLines={1}
                    >
                      {history.title}
                    </Text>
                    <Text style={styles.historyTimestamp}>
                      {new Date(history.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteThread(history.id, history.title)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons 
                    name="trash-can-outline" 
                    size={20} 
                    color="rgba(255,255,255,0.6)" 
                  />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </Animated.View>

      {/* Drawer backdrop */}
      {showHistoryDrawer && (
        <TouchableOpacity 
          style={styles.drawerBackdrop}
          activeOpacity={1}
          onPress={toggleHistoryDrawer}
        />
      )}

      {/* Main Content */}
      <View style={styles.mainContent}>
          <View style={styles.scrollableContent}>
            {/* Welcome Screen (shows when no messages) */}
            {showWelcome && (
              <Animated.ScrollView
                ref={welcomeScrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={[styles.welcomeContainer, { paddingTop: headerHeight }]}
                {...scrollProps}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    colors={[theme.colors.primary]}
                    tintColor={theme.colors.primary}
                  />
                }
              >
                <View style={styles.welcomeContent}>
                  <View style={[styles.iconContainer, styles.welcomeGlyph]}>
                    <LottieView
                      source={require('../assets/ChattingRobot.json')}
                      autoPlay
                      loop
                      style={styles.welcomeLottie}
                    />
                  </View>
                  {isLoading ? (
                    <>
                      <Text style={[styles.welcomeTitle, { color: theme.colors.onSurface }]}>
                        Loading fresh data into AI....
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.welcomeTitle, { color: theme.colors.onSurface }]}>
                        {gameContext ? 'How can I help you analyze today\'s games?' : 'How can I help you with sports betting today?'}
                      </Text>
                      {gameContext && (
                        <Text style={[styles.welcomeSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                          I have access to all game data, predictions, betting lines, and more.
                        </Text>
                      )}
                    </>
                  )}
                </View>
              </Animated.ScrollView>
            )}

            {/* Messages View (shows when there are messages) */}
            {!showWelcome && (
              <Animated.ScrollView
                ref={scrollViewRef}
                style={[styles.messagesContainer, styles.scrollView]}
                contentContainerStyle={[
                  styles.messagesContent,
                  {
                    paddingTop: headerHeight,
                    paddingBottom: keyboardHeight > 0 ? keyboardHeight + 120 : insets.bottom + 150,
                  }
                ]}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
                {...scrollProps}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    colors={[theme.colors.primary]}
                    tintColor={theme.colors.primary}
                  />
                }
                onContentSizeChange={() => {
                  // Only auto-scroll if user is at or near the bottom
                  if (isAtBottomRef.current) {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }
                }}
              >
              {messages.map((message, index) => {
                const isLastMessage = index === messages.length - 1;
                const isFirstMessage = index === 0;
                const isEmptyAndStreaming = !message.content && isSending && isLastMessage;
                const isStreamingThis = isStreaming && isLastMessage && message.role === 'assistant';
                
                // Determine if we should show the full-width chatGPT style
                const isAssistantContent = message.role === 'assistant' && !isEmptyAndStreaming;
                
                const animation = getMessageAnimation(message.id || `msg_${index}`);
                const animatedStyle = {
                  opacity: animation,
                  transform: [
                    {
                      translateY: animation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                    {
                      scale: animation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.95, 1],
                      }),
                    },
                  ],
                };

                return (
                  <Animated.View
                    key={message.id || index}
                    style={[
                      styles.messageRow,
                      message.role === 'user' ? styles.userRow : styles.assistantRow,
                      isAssistantContent && { marginBottom: 24, width: '100%', paddingHorizontal: 0 },
                      isFirstMessage && { marginTop: 16 },
                      animatedStyle,
                    ]}
                  >
                    {message.role === 'assistant' && !isAssistantContent && (
                      <View style={styles.botIconContainer}>
                        <MaterialCommunityIcons
                          name="robot"
                          size={24}
                          color={theme.colors.primary}
                        />
                      </View>
                    )}
                    
                    <View
                      style={[
                        !isAssistantContent && styles.messageBubble,
                        message.role === 'user'
                          ? styles.userMessage
                          : (message.role === 'assistant' && !isAssistantContent)
                            ? [styles.assistantMessage, { backgroundColor: theme.colors.surfaceVariant }]
                            : [],
                        isAssistantContent && {
                          width: '100%',
                          marginHorizontal: -8,
                          backgroundColor: 'transparent',
                        }
                      ]}
                    >
                      {isEmptyAndStreaming ? (
                        <View style={styles.thinkingContainer}>
                          <ActivityIndicator size="small" color={theme.colors.primary} />
                          <Text style={[styles.messageText, { color: theme.colors.onSurfaceVariant, marginLeft: 8 }]}>
                            Thinking...
                          </Text>
                        </View>
                      ) : message.role === 'user' ? (
                        <Text style={[styles.messageText, { color: '#ffffff' }]}>
                          {message.content}
                        </Text>
                      ) : message.role === 'assistant' ? (
                        isStreamingThis ? (
                          // During streaming: use animated plain text for smooth character fade-in
                          <View style={{ 
                            flexShrink: 1, 
                            flexWrap: 'wrap', 
                            width: '100%',
                            paddingHorizontal: 16,
                            maxWidth: '100%',
                          }}>
                            <AnimatedStreamingText
                              text={message.content}
                              color={theme.colors.onSurface}
                              isStreaming={true}
                            />
                          </View>
                        ) : (
                          // After streaming: render full Markdown
                          <ReanimatedAnimated.View 
                            entering={FadeIn.duration(400)}
                            style={{ 
                                flexShrink: 1, 
                                flexWrap: 'wrap', 
                                width: '100%' 
                            }}
                          >
                            <Markdown style={markdownStyles}>
                              {message.content}
                            </Markdown>
                          </ReanimatedAnimated.View>
                        )
                    ) : (
                      <Text style={[styles.messageText, { color: '#ffffff' }]}>{message.content}</Text>
                    )}
                    </View>
                  </Animated.View>
                );
              })}
              </Animated.ScrollView>
            )}
          </View>

          {/* Input Area - Hide when loading during initialization - Fixed at bottom */}
          {!isLoading && (
            <View style={[
              styles.inputWrapper,
              {
                bottom: keyboardHeight > 0 ? keyboardHeight : 0,
                paddingBottom: Platform.OS === 'ios' ? insets.bottom : 16,
              }
            ]}>
            {/* Suggested Messages - Show when welcome or no messages - Part of input component */}
            {(showWelcome || messages.length === 0) && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.suggestedMessagesScrollView}
                contentContainerStyle={styles.suggestedMessagesContent}
              >
                {suggestedMessages.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestedMessageBubble}
                    onPress={() => handleSuggestedMessage(item.message)}
                    disabled={isLoading || isSending}
                    activeOpacity={0.7}
                  >
                    <BlurView
                      intensity={24}
                      tint="dark"
                      style={styles.suggestedMessageBlur}
                    />
                    <Text style={[styles.suggestedMessageText, { color: theme.colors.onSurface }]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.inputContainer}>
              <BlurView
                intensity={30}
                tint="dark"
                style={styles.inputBlur}
              />
              <TextInput
                ref={inputRef}
                style={[styles.input, { color: theme.colors.onSurface }]}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Chat with WagerBot"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                multiline={true}
                maxLength={500}
                editable={!isSending}
                textAlignVertical="top"
                onFocus={() => {
                  // Scroll to bottom when input is focused
                  setTimeout(() => {
                    if (showWelcome) {
                      welcomeScrollViewRef.current?.scrollToEnd({ animated: true });
                    } else {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }
                  }, 100);
                }}
              />
              
              {/* Bottom row with icons */}
              <View style={styles.inputBottomRow}>
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    inputText.trim() && styles.sendButtonActive,
                  ]}
                  onPress={sendMessage}
                  disabled={!inputText.trim() || isSending}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <MaterialCommunityIcons 
                      name="arrow-up" 
                      size={18} 
                      color={inputText.trim() ? '#101010' : '#f0f0f0'}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
});

export default WagerBotChat;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    position: 'relative',
  },
  scrollableContent: {
    flex: 1,
    minHeight: 0, // Important for flex children
  },
  scrollView: {
    flex: 1,
  },
  historyDrawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 280,
    zIndex: 1000,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  historyDrawerFx: {
    ...StyleSheet.absoluteFillObject,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  drawerContent: {
    flex: 1,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  historyItemActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  historyItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  historyIcon: {
    marginRight: 12,
  },
  historyTextContainer: {
    flex: 1,
  },
  deleteButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    color: '#ffffff',
  },
  historyTimestamp: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  emptyHistoryText: {
    textAlign: 'center',
    padding: 32,
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
  },
  drawerBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Welcome Screen Styles
  welcomeContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 56,
  },
  welcomeContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeGlyph: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(0,0,0,0)',
  },
  welcomeLottie: {
    width: 92,
    height: 92,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 28,
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined,
  },
  welcomeSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Messages Styles
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  botIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  messageBubble: {
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userMessage: {
    backgroundColor: '#2e7d32',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    flexShrink: 1,
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  // Input Area Styles (Claude-like)
  inputWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'transparent', // Will be set by inline style
    // bottom is set dynamically based on keyboard height
  },
  inputContainer: {
    overflow: 'hidden',
    borderRadius: 30,
    paddingTop: 14,
    paddingBottom: 8,
    paddingHorizontal: 14,
    minHeight: 72,
    backgroundColor: 'rgba(26, 26, 26, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  input: {
    zIndex: 1,
    fontSize: 16,
    lineHeight: 20,
    minHeight: 20,
    maxHeight: 80,
    paddingTop: 2,
    paddingBottom: 6,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  inputBottomRow: {
    zIndex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  sendButtonActive: {
    backgroundColor: '#ffffff',
  },
  // Suggested Messages Styles (User Scrollable)
  suggestedMessagesScrollView: {
    maxHeight: 52,
    marginBottom: 8,
    marginHorizontal: -16, // Extend to screen edges (counter inputWrapper padding)
  },
  suggestedMessagesContent: {
    flexDirection: 'row',
    paddingHorizontal: 16, // Add padding back so first/last items have margin from edge
    alignItems: 'center',
    gap: 8,
  },
  suggestedMessageBubble: {
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  suggestedMessageBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  inputBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  suggestedMessageText: {
    fontSize: 14,
    fontWeight: '500',
  },
  marqueeGradientLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 40,
    zIndex: 10,
  },
  marqueeGradientRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    zIndex: 10,
  },
});
