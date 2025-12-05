import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Alert,
  Image,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import ReanimatedAnimated, { 
  useSharedValue, 
  useAnimatedStyle,
  useFrameCallback,
  FadeIn,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Markdown from 'react-native-markdown-display';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { chatSessionManager, ChatMessage } from '../utils/chatSessionManager';
import { chatThreadService } from '../services/chatThreadService';

// Animated character component for streaming text fade-in effect
const AnimatedChar = React.memo(({ 
  char, 
  shouldAnimate,
  animationDelay,
  color 
}: { 
  char: string; 
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
          duration: 120,
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
      {char}
    </ReanimatedAnimated.Text>
  );
}, (prev, next) => 
  prev.char === next.char && 
  prev.shouldAnimate === next.shouldAnimate && 
  prev.color === next.color
);

// Streaming text component with per-character fade-in animation
interface AnimatedStreamingTextProps {
  text: string;
  color: string;
  isStreaming: boolean;
}

const Shimmer = ({ width, height, style, theme }: { width: number | string, height: number, style?: any, theme: any }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          opacity,
          backgroundColor: theme.colors.onSurface,
          borderRadius: 8,
        },
        style,
      ]}
    />
  );
};

const AnimatedStreamingText: React.FC<AnimatedStreamingTextProps> = React.memo(({ 
  text, 
  color,
  isStreaming 
}) => {
  // Track how many characters were rendered in previous renders
  const prevLengthRef = useRef(0);
  // Track which indices have started animating (to prevent re-animation on re-render)
  const animatingIndicesRef = useRef<Set<number>>(new Set());
  
  const characters = text.split('');
  const prevLength = prevLengthRef.current;
  
  // After render, update tracking refs
  useEffect(() => {
    for (let i = prevLength; i < text.length; i++) {
      animatingIndicesRef.current.add(i);
    }
    prevLengthRef.current = text.length;
  }, [text.length, prevLength]);
  
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
      {characters.map((char, index) => {
        // Only animate if this is a new character that hasn't been animated yet
        const isNewChar = index >= prevLength;
        const alreadyAnimated = animatingIndicesRef.current.has(index);
        const shouldAnimate = isNewChar && !alreadyAnimated;
        
        // Stagger delay: 8ms per character, capped at 150ms total for smooth feel
        const delay = shouldAnimate 
          ? Math.min((index - prevLength) * 8, 150) 
          : 0;
        
        return (
          <AnimatedChar
            key={index}
            char={char}
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
  isInBottomSheet?: boolean; // Disable KeyboardAvoidingView when in bottom sheet
}

const WagerBotChat = forwardRef<any, WagerBotChatProps>(({
  userId,
  userEmail,
  gameContext = '',
  onRefresh,
  onBack,
  scrollY,
  isInBottomSheet = false,
  headerHeight = 0,
}, ref) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const flatListRef = useRef<FlatList>(null);
  const prevMessageCountRef = useRef(0);
  const lastScrollTimeRef = useRef(0);
  const lastLayoutScrollTimeRef = useRef(0); // Separate throttle for layout/content size scrolls
  const scrollThrottleMs = 16; // ~60fps throttle for smooth real-time scrolling during streaming
  const contentHeightRef = useRef(0);
  const shouldAutoScrollRef = useRef(true); // Track if we should auto-scroll
  const streamingMessageIdRef = useRef<string | null>(null); // Track which message is streaming

  // Handle scroll event for header animation
  const handleScroll = scrollY 
    ? Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true }
      )
    : null;

  // Build scroll props conditionally
  const scrollProps = handleScroll 
    ? { 
        onScroll: handleScroll,
        scrollEventThrottle: 16 
      }
    : {};

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
  
  // Image attachment state
  const [selectedImages, setSelectedImages] = useState<Array<{ uri: string; base64: string; name: string }>>([]);
  const [isPickingImage, setIsPickingImage] = useState(false);
  
  // Animation values for message appearance
  const messageAnimations = useRef<{ [key: string]: Animated.Value }>({});
  const drawerAnimation = useRef(new Animated.Value(300)).current; // Positive for right side
  
  // Marquee animation state for suggested messages
  const [marqueeParentWidth, setMarqueeParentWidth] = useState(0);
  const [marqueeChildrenWidth, setMarqueeChildrenWidth] = useState(0);
  const marqueeOffset = useSharedValue(0);
  const marqueeDuration = 40000; // 40 seconds for one full scroll (slower)
  
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

  // Load chat histories on mount
  useEffect(() => {
    loadChatHistories();
  }, []);

  // Scroll to bottom helper function with smooth scrolling during streaming
  const scrollToBottom = useCallback((force = false, isStreaming = false) => {
    if (!isInBottomSheet || !shouldAutoScrollRef.current) return;
    
    // Throttle scroll calls to prevent excessive updates
    const now = Date.now();
    if (!force && now - lastScrollTimeRef.current < 50) {
      return; // Throttle to ~20fps for smooth scrolling
    }
    lastScrollTimeRef.current = now;
    
    // Use smooth animated scrolling for both streaming and non-streaming
    if (flatListRef.current) {
      try {
        // Use animated: true for smooth scrolling, even during streaming
        flatListRef.current.scrollToEnd({ animated: true });
      } catch (e) {
        // If scrollToEnd fails, use scrollToOffset with a large offset
        try {
          flatListRef.current.scrollToOffset({ offset: contentHeightRef.current || 999999, animated: true });
        } catch (err) {
          // Fallback: try again on next frame
          requestAnimationFrame(() => {
            if (flatListRef.current) {
              try {
                flatListRef.current.scrollToEnd({ animated: true });
              } catch (e) {
                // Last resort: scroll to offset
                flatListRef.current.scrollToOffset({ offset: 999999, animated: true });
              }
            }
          });
        }
      }
    }
  }, [isInBottomSheet]);

  // Scroll to bottom when new messages are added (for bottom sheet)
  useEffect(() => {
    if (isInBottomSheet && messages.length > prevMessageCountRef.current) {
      setTimeout(() => {
        scrollToBottom(true, false); // Force scroll when new message added
      }, 150);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, isInBottomSheet, scrollToBottom]);

  // Watch for content changes in streaming message and scroll in real-time
  useEffect(() => {
    if (isInBottomSheet && isStreaming && streamingMessageIdRef.current && shouldAutoScrollRef.current) {
      const streamingMessage = messages.find(msg => msg.id === streamingMessageIdRef.current);
      if (streamingMessage && streamingMessage.content) {
        // Content is updating, scroll to bottom immediately
        scrollToBottom(false, true);
      }
    }
  }, [messages, isStreaming, isInBottomSheet, scrollToBottom]);

  // Animate drawer open/close (right side)
  useEffect(() => {
    Animated.spring(drawerAnimation, {
      toValue: showHistoryDrawer ? 0 : 300,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [showHistoryDrawer]);

  // Marquee animation for suggested messages
  useFrameCallback((frameInfo) => {
    if (marqueeChildrenWidth > 0) {
      const timeDelta = frameInfo.timeSincePreviousFrame ?? 0;
      marqueeOffset.value -= (timeDelta * marqueeChildrenWidth) / marqueeDuration;
      marqueeOffset.value = marqueeOffset.value % -marqueeChildrenWidth;
    }
  }, true);

  // Calculate clones needed for seamless looping
  const marqueeCloneCount = marqueeChildrenWidth > 0 ? Math.round(marqueeParentWidth / marqueeChildrenWidth) + 2 : 0;

  const marqueeAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: marqueeOffset.value }],
    };
  });

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
      
      // Show welcome screen - no messages yet
      setShowWelcome(true);
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

  const loadChatHistories = async () => {
    try {
      const threads = await chatThreadService.getThreads(userId);
      const histories = threads.map(thread => ({
        id: thread.id,
        title: thread.title || thread.openai_thread_id || 'New Chat',
        timestamp: thread.updated_at,
        threadId: thread.openai_thread_id,
      }));
      setChatHistories(histories);
      console.log('✅ Loaded', histories.length, 'chat histories');
    } catch (err) {
      console.error('Error loading chat histories:', err);
    }
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

  const toggleHistoryDrawer = () => {
    setShowHistoryDrawer(!showHistoryDrawer);
    if (!showHistoryDrawer) {
      loadChatHistories();
    }
  };

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

  const handleSuggestedMessage = (message: string) => {
    if (isLoading || isSending) return;
    setInputText(message);
    // Small delay to show the text before sending
    setTimeout(() => {
      sendMessageWithText(message);
    }, 100);
  };

  const handlePickImage = async () => {
    try {
      setIsPickingImage(true);
      
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'Please allow access to your photo library to upload images.');
        setIsPickingImage(false);
        return;
      }
      
      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = asset.fileName || `image_${Date.now()}.jpg`;
        
        if (asset.base64) {
          setSelectedImages([...selectedImages, {
            uri: asset.uri,
            base64: asset.base64,
            name: fileName,
          }]);
          
          // Give haptic feedback
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    } finally {
      setIsPickingImage(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    if ((!inputText.trim() && selectedImages.length === 0) || isLoading || isSending) return;
    await sendMessageWithText(inputText.trim());
  };

  const sendMessageWithText = async (messageText: string) => {
    if (!messageText && selectedImages.length === 0 || isLoading || isSending) return;
    
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
    console.log(`📸 Attached images: ${selectedImages.length}`);

    // Clear input immediately and update UI
    setInputText('');
    setShowWelcome(false);
    setMessages(prev => [...prev, userMessage]);
    const imagesToSend = selectedImages;
    setSelectedImages([]); // Clear selected images after sending
    setIsSending(true);
    
    // Scroll to bottom when user sends a message
    setTimeout(() => {
      scrollToBottom(true);
    }, 100);

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
    streamingMessageIdRef.current = assistantMessageId;
    const emptyAssistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, emptyAssistantMessage]);
    
    // Scroll to bottom immediately when assistant message is added (start of streaming)
    // Use setTimeout to ensure the message is rendered first
    setTimeout(() => {
      scrollToBottom(true, true);
    }, 50); // Reduced delay for faster response
    
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

      // Add images if present
      if (imagesToSend.length > 0) {
        requestBody.images = imagesToSend.map(img => ({
          base64: img.base64,
          name: img.name,
        }));
        console.log(`📸 Including ${imagesToSend.length} image(s)`);
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
      console.log('  - images:', requestBody.images ? `${requestBody.images.length} images` : 'EMPTY');
      
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
        let progressEventCount = 0;
        const startTime = Date.now();
        
        // Real-time streaming as chunks arrive!
        // Responses API streams plain text directly (no thread IDs needed)
        xhr.onprogress = () => {
          progressEventCount++;
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          
          const newText = xhr.responseText.substring(parsedLength);
          parsedLength = xhr.responseText.length;
          
          console.log(`🔄 Progress event #${progressEventCount} at ${elapsed}s - Total bytes: ${parsedLength}, New bytes: ${newText.length}`);
          
          if (!newText) {
            console.log('⚠️ No new text in this progress event');
            return;
          }
          
          // With Responses API, we get plain text chunks directly
          // No need to parse SSE format or extract thread IDs
          currentContent += newText;
          
          console.log('📝 Received chunk:', newText.substring(0, 50));
          console.log(`   Content so far: ${currentContent.length} chars`);
          
          // Update UI immediately with new content!
          const currentTime = Date.now();
          
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: currentContent }
                : msg
            )
          );
          
          // Scroll to bottom immediately as content streams in (no delay, no throttling)
          scrollToBottom(false, true); // Pass isStreaming=true for immediate scrolling
          
          // Haptic feedback every 100ms max (smooth but not overwhelming)
          if (currentTime - lastUpdateTime > 100) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            lastUpdateTime = currentTime;
          }
          
          setIsStreaming(true);
          console.log('✅ UI updated in real-time, total length:', currentContent.length);
        };
        
        xhr.onload = async () => {
          const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('✅ Stream complete!');
          console.log(`📊 STREAMING STATS:`);
          console.log(`   - Total time: ${totalTime}s`);
          console.log(`   - Progress events: ${progressEventCount}`);
          console.log(`   - Final content length: ${currentContent.length} chars`);
          console.log(`   - Average chars per event: ${(currentContent.length / Math.max(1, progressEventCount)).toFixed(0)}`);
          if (progressEventCount === 1) {
            console.log('⚠️ WARNING: Only 1 progress event! Streaming may not be working.');
            console.log('   This means the entire response arrived at once.');
          } else {
            console.log(`✅ Multiple progress events detected - streaming is working!`);
          }
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          setIsStreaming(false);
          streamingMessageIdRef.current = null;
          
          // Final scroll to bottom when streaming completes
          setTimeout(() => {
            scrollToBottom(true, false);
          }, 100);
          
          if (xhr.status !== 200) {
            console.error('❌ BuildShip error response:', xhr.responseText);
            reject(new Error(`API request failed: ${xhr.status}. ${xhr.responseText.substring(0, 100)}`));
            return;
          }
          
          // FALLBACK: If onprogress didn't fire (common in React Native), use responseText directly
          if (!currentContent && xhr.responseText) {
            console.log('⚠️ onprogress did not fire - using responseText fallback');
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
              
              console.log('💾 Saving assistant message...');
              await chatThreadService.saveMessage(thread.id, 'assistant', currentContent);
              console.log('✅ Assistant message saved');
              
              // Generate AI title asynchronously (don't wait)
              console.log('🤖 Triggering AI title generation...');
              chatThreadService.generateThreadTitle(
                thread.id,
                messageText,
                currentContent
              ).catch(err => console.error('❌ Failed to generate title:', err));
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
          console.error('❌ XHR error');
          setIsStreaming(false);
          streamingMessageIdRef.current = null;
          reject(new Error('Network request failed'));
        };
        
        xhr.ontimeout = () => {
          console.error('❌ XHR timeout');
          setIsStreaming(false);
          streamingMessageIdRef.current = null;
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
      <View style={[styles.centerContainer, { backgroundColor: isInBottomSheet ? 'transparent' : theme.colors.background }]}>
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
    <View style={[styles.container, { backgroundColor: isInBottomSheet ? 'transparent' : theme.colors.background }]}>
      {/* History Drawer */}
      <Animated.View 
        style={[
          styles.historyDrawer,
          {
            backgroundColor: theme.colors.surface,
            paddingTop: insets.top,
            transform: [{ translateX: drawerAnimation }],
          }
        ]}
      >
        <View style={[styles.drawerHeader, { borderBottomColor: theme.colors.outline }]}>
          <Text style={[styles.drawerTitle, { color: theme.colors.onSurface }]}>Chat History</Text>
          <TouchableOpacity onPress={toggleHistoryDrawer}>
            <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurface} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.drawerContent}>
          {chatHistories.length === 0 ? (
            <Text style={[styles.emptyHistoryText, { color: theme.colors.onSurfaceVariant }]}>
              No chat history yet
            </Text>
          ) : (
            chatHistories.map((history) => (
              <View
                key={history.id}
                style={[
                  styles.historyItem,
                  sessionId === history.id && { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <TouchableOpacity
                  style={styles.historyItemContent}
                  onPress={() => switchToChat(history.id, history.threadId)}
                >
                  <MaterialCommunityIcons 
                    name="message-text-outline" 
                    size={20} 
                    color={theme.colors.primary} 
                    style={styles.historyIcon}
                  />
                  <View style={styles.historyTextContainer}>
                    <Text 
                      style={[styles.historyTitle, { color: theme.colors.onSurface }]}
                      numberOfLines={1}
                    >
                      {history.title}
                    </Text>
                    <Text style={[styles.historyTimestamp, { color: theme.colors.onSurfaceVariant }]}>
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
                    color={theme.colors.error} 
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

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        enabled={!isInBottomSheet}
      >
        {/* Welcome Screen (shows when no messages) */}
        {showWelcome && (
          isInBottomSheet ? (
            <View style={styles.welcomeContainerBottomSheet}>
              <View style={styles.welcomeContent}>
                <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                  <MaterialCommunityIcons
                    name="robot"
                    size={64}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={[styles.welcomeTitle, { color: theme.colors.onSurface }]}>
                  {gameContext ? 'How can I help you analyze today\'s games?' : 'How can I help you with sports betting today?'}
                </Text>
                {gameContext && (
                  <Text style={[styles.welcomeSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    I have access to all game data, predictions, betting lines, and more.
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <Animated.ScrollView
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
                <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                  <MaterialCommunityIcons
                    name="robot"
                    size={64}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={[styles.welcomeTitle, { color: theme.colors.onSurface }]}>
                  {gameContext ? 'How can I help you analyze today\'s games?' : 'How can I help you with sports betting today?'}
                </Text>
                {gameContext && (
                  <Text style={[styles.welcomeSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    I have access to all game data, predictions, betting lines, and more.
                  </Text>
                )}
              </View>
            </Animated.ScrollView>
          )
        )}

        {/* Messages View (shows when there are messages) */}
        {!showWelcome && (
          isInBottomSheet ? (
            // Use BottomSheetFlatList for proper scrolling in bottom sheet
            <BottomSheetFlatList<ChatMessage>
              ref={flatListRef as any}
              data={messages}
              keyExtractor={(item: ChatMessage, index: number) => item.id || `msg_${index}`}
              style={styles.messagesContainer}
              contentContainerStyle={[styles.messagesContent, { paddingTop: headerHeight }]}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              inverted={false}
              onContentSizeChange={(width: number, height: number) => {
                contentHeightRef.current = height;
                // Throttle layout-based scrolling to prevent excessive calls
                const now = Date.now();
                if (isStreaming && streamingMessageIdRef.current && shouldAutoScrollRef.current) {
                  if (now - lastLayoutScrollTimeRef.current > 100) {
                    lastLayoutScrollTimeRef.current = now;
                    scrollToBottom(false, true);
                  }
                }
              }}
              onLayout={() => {
                // Throttle layout-based scrolling to prevent excessive calls
                const now = Date.now();
                if (isStreaming && streamingMessageIdRef.current && shouldAutoScrollRef.current) {
                  if (now - lastLayoutScrollTimeRef.current > 100) {
                    lastLayoutScrollTimeRef.current = now;
                    scrollToBottom(false, true);
                  }
                }
              }}
              onScrollBeginDrag={() => {
                // User is manually scrolling, pause auto-scroll
                shouldAutoScrollRef.current = false;
              }}
              onScrollEndDrag={() => {
                // Check if user scrolled to bottom, if so resume auto-scroll
                setTimeout(() => {
                  shouldAutoScrollRef.current = true;
                }, 500);
              }}
              renderItem={({ item: message, index }: { item: ChatMessage; index: number }) => {
                const isLastMessage = index === messages.length - 1;
                const isEmptyAndStreaming = !message.content && isSending && isLastMessage;
                const isStreamingThis = isStreaming && isLastMessage && message.role === 'assistant';
                
                // Determine if we should show the full-width chatGPT style
                const isAssistantContent = message.role === 'assistant' && !isEmptyAndStreaming;

                return (
                  <View
                    style={[
                      styles.messageRow,
                      message.role === 'user' ? styles.userRow : styles.assistantRow,
                      isAssistantContent && { marginBottom: 24, width: '100%', paddingHorizontal: 0 }
                    ]}
                  >
                    {/* Show icon ONLY if it's NOT the main content view (i.e. show for Thinking state) */}
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
                        // Base bubble style - remove if assistant content
                        !isAssistantContent && styles.messageBubble,
                        // User style
                        message.role === 'user' && [styles.userMessage, { backgroundColor: theme.colors.primary }],
                        // Assistant thinking style
                        (message.role === 'assistant' && !isAssistantContent) && [styles.assistantMessage, { backgroundColor: theme.colors.surfaceVariant }],
                        // Assistant content style (ChatGPT like)
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
                                              width: '100%',
                                            }}
                                          >
                                            <Markdown
                                              style={{
                                                body: { color: theme.colors.onSurface, fontSize: 16, lineHeight: 24 },
                                                paragraph: { marginTop: 0, marginBottom: 12 },
                                                heading1: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, marginTop: 8, color: theme.colors.onSurface },
                                                heading2: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, marginTop: 6, color: theme.colors.onSurface },
                                                heading3: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, marginTop: 4, color: theme.colors.onSurface },
                                                strong: { fontWeight: 'bold', color: theme.colors.onSurface },
                                                em: { fontStyle: 'italic' },
                                                code_inline: { backgroundColor: theme.colors.surfaceVariant, color: theme.colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 14 },
                                                code_block: { backgroundColor: '#1e1e1e', padding: 12, borderRadius: 8, marginVertical: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 13 },
                                                fence: { backgroundColor: '#1e1e1e', padding: 12, borderRadius: 8, marginVertical: 12, color: '#d4d4d4', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 13 },
                                                link: { color: theme.colors.primary, textDecorationLine: 'underline' },
                                                blockquote: { backgroundColor: theme.colors.surfaceVariant, borderLeftWidth: 4, borderLeftColor: theme.colors.primary, paddingLeft: 12, paddingVertical: 8, marginVertical: 8, fontStyle: 'italic' },
                                                bullet_list: { marginBottom: 8, marginTop: 0 },
                                                ordered_list: { marginBottom: 8, marginTop: 0 },
                                                list_item: { marginBottom: 4, lineHeight: 24 },
                                                table: { borderWidth: 1, borderColor: theme.colors.outline, borderRadius: 8, marginVertical: 12 },
                                                th: { backgroundColor: theme.colors.surfaceVariant, padding: 10, fontWeight: 'bold' },
                                                td: { padding: 10, borderWidth: 1, borderColor: theme.colors.outline },
                                                hr: { backgroundColor: theme.colors.outline, height: 1, marginVertical: 16 },
                                              }}
                                            >
                                              {message.content}
                                            </Markdown>
                                          </ReanimatedAnimated.View>
                                        )
                                      ) : (
                        <Text style={[styles.messageText, { color: theme.colors.onPrimary }]}>
                          {message.content}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          ) : (
            // Use regular ScrollView for non-bottom-sheet contexts
            <Animated.ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={[styles.messagesContent, { paddingTop: headerHeight }]}
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
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }}
            >
              {messages.map((message, index) => {
                const isLastMessage = index === messages.length - 1;
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
                          ? [styles.userMessage, { backgroundColor: theme.colors.primary }]
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
                            <Markdown
                              style={{
                                body: { color: theme.colors.onSurface, fontSize: 16, lineHeight: 24, flexShrink: 1, flexWrap: 'wrap' },
                                paragraph: { marginTop: 0, marginBottom: 12, flexWrap: 'wrap' },
                                text: { flexWrap: 'wrap' },
                                heading1: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, marginTop: 8, color: theme.colors.onSurface },
                                heading2: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, marginTop: 6, color: theme.colors.onSurface },
                                heading3: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, marginTop: 4, color: theme.colors.onSurface },
                                strong: { fontWeight: 'bold', color: theme.colors.onSurface },
                                em: { fontStyle: 'italic' },
                                code_inline: { backgroundColor: theme.colors.surfaceVariant, color: theme.colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 14 },
                                code_block: { backgroundColor: '#1e1e1e', padding: 12, borderRadius: 8, marginVertical: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 13 },
                                fence: { backgroundColor: '#1e1e1e', padding: 12, borderRadius: 8, marginVertical: 12, color: '#d4d4d4', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 13 },
                                link: { color: theme.colors.primary, textDecorationLine: 'underline' },
                                blockquote: { backgroundColor: theme.colors.surfaceVariant, borderLeftWidth: 4, borderLeftColor: theme.colors.primary, paddingLeft: 12, paddingVertical: 8, marginVertical: 8, fontStyle: 'italic' },
                                bullet_list: { marginBottom: 8, marginTop: 0 },
                                ordered_list: { marginBottom: 8, marginTop: 0 },
                                list_item: { marginBottom: 4, lineHeight: 24 },
                                table: { borderWidth: 1, borderColor: theme.colors.outline, borderRadius: 8, marginVertical: 12 },
                                th: { backgroundColor: theme.colors.surfaceVariant, padding: 10, fontWeight: 'bold' },
                                td: { padding: 10, borderWidth: 1, borderColor: theme.colors.outline },
                                hr: { backgroundColor: theme.colors.outline, height: 1, marginVertical: 16 },
                              }}
                            >
                              {message.content}
                            </Markdown>
                          </ReanimatedAnimated.View>
                        )
                    ) : (
                      <Text style={[styles.messageText, { color: '#ffffff' }]}>
                        {message.content}
                      </Text>
                    )}
                    </View>
                  </Animated.View>
                );
              })}
            </Animated.ScrollView>
          )
        )}

        {/* Suggested Messages - Show when welcome or no messages */}
        {(showWelcome || messages.length === 0) && (
          <View 
            style={styles.suggestedMessagesWrapper}
            onLayout={(event) => {
              setMarqueeParentWidth(event.nativeEvent.layout.width);
            }}
          >
            {isLoading ? (
              <View style={styles.suggestedMessagesContent}>
                {[1, 2, 3].map((_, index) => (
                  <Shimmer
                    key={index}
                    width={140}
                    height={36}
                    style={{ marginRight: 8, borderRadius: 18, opacity: 0.1 }}
                    theme={theme}
                  />
                ))}
              </View>
            ) : (
              <>
            {/* Hidden measure element to get children width */}
            <View 
              style={styles.marqueeMeasureContainer}
              onLayout={(event) => {
                setMarqueeChildrenWidth(event.nativeEvent.layout.width);
              }}
            >
              <View style={styles.suggestedMessagesContent}>
                {suggestedMessages.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.suggestedMessageBubble,
                      { 
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        borderColor: 'rgba(255, 255, 255, 0.25)',
                      }
                    ]}
                    onPress={() => handleSuggestedMessage(item.message)}
                    disabled={isLoading || isSending}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.suggestedMessageText, { color: theme.colors.onSurface }]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Visible scrolling content - render clones */}
            {marqueeChildrenWidth > 0 && marqueeParentWidth > 0 && (
              <View style={styles.marqueeScrollContainer}>
                {Array.from({ length: marqueeCloneCount }).map((_, index) => (
                  <ReanimatedAnimated.View
                    key={`clone-${index}`}
                    style={[
                      styles.suggestedMessagesContent,
                      marqueeAnimatedStyle,
                      {
                        position: 'absolute',
                        left: index * marqueeChildrenWidth,
                      }
                    ]}
                  >
                    {suggestedMessages.map((item, msgIndex) => (
                      <TouchableOpacity
                        key={msgIndex}
                        style={[
                          styles.suggestedMessageBubble,
                          { 
                            backgroundColor: 'rgba(255, 255, 255, 0.15)',
                            borderColor: 'rgba(255, 255, 255, 0.25)',
                          }
                        ]}
                        onPress={() => handleSuggestedMessage(item.message)}
                        disabled={isSending}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.suggestedMessageText, { color: theme.colors.onSurface }]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ReanimatedAnimated.View>
                ))}
              </View>
            )}
            </>
            )}

          </View>
        )}

        {/* Input Area - Always visible at bottom */}
        <View style={[
          styles.inputWrapper, 
          { backgroundColor: isInBottomSheet ? 'transparent' : theme.colors.background },
          isInBottomSheet && { paddingBottom: insets.bottom + 8 }
        ]}>
          {/* Selected Images Preview */}
          {selectedImages.length > 0 && (
            <View style={styles.imagePreviewContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.imagePreviewScroll}
              >
                {selectedImages.map((image, index) => (
                  <View key={`image_${index}`} style={styles.imagePreviewItem}>
                    <Image
                      source={{ uri: image.uri }}
                      style={styles.imagePreview}
                    />
                    <TouchableOpacity
                      style={styles.imageRemoveButton}
                      onPress={() => handleRemoveImage(index)}
                    >
                      <MaterialCommunityIcons name="close" size={14} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
            {isLoading ? (
              <View style={{ paddingHorizontal: 4 }}>
                <Shimmer width="100%" height={20} style={{ marginBottom: 12, opacity: 0.1 }} theme={theme} />
                <View style={styles.inputBottomRow}>
                  <Shimmer width={32} height={32} style={{ borderRadius: 16, opacity: 0.1 }} theme={theme} />
                  <Shimmer width={32} height={32} style={{ borderRadius: 16, opacity: 0.1 }} theme={theme} />
                </View>
              </View>
            ) : (
              <>
            <TextInput
              style={[styles.input, { color: theme.colors.onSurface }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={selectedImages.length > 0 ? 'Add a message with your image...' : 'Chat with WagerBot'}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              multiline={true}
              maxLength={500}
              editable={!isLoading && !isSending}
              textAlignVertical="top"
            />
            
            {/* Bottom row with icons */}
            <View style={styles.inputBottomRow}>
              <TouchableOpacity
                style={[styles.attachButton, isPickingImage && styles.attachButtonDisabled]}
                onPress={handlePickImage}
                disabled={isLoading || isPickingImage || isSending}
              >
                {isPickingImage ? (
                  <ActivityIndicator size="small" color={theme.colors.onSurfaceVariant} />
                ) : (
                  <MaterialCommunityIcons name="image-plus" size={20} color={theme.colors.onSurfaceVariant} />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (inputText.trim() || selectedImages.length > 0) && styles.sendButtonActive,
                ]}
                onPress={sendMessage}
                disabled={isLoading || (!inputText.trim() && selectedImages.length === 0) || isSending}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <MaterialCommunityIcons 
                    name="arrow-up" 
                    size={18} 
                    color="#ffffff"
                  />
                )}
              </TouchableOpacity>
            </View>
            </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
});

export default WagerBotChat;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
  keyboardView: {
    flex: 1,
    minHeight: 0,
  },
  historyDrawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 280,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  drawerContent: {
    flex: 1,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
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
  },
  historyTimestamp: {
    fontSize: 12,
  },
  emptyHistoryText: {
    textAlign: 'center',
    padding: 32,
    fontSize: 14,
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
    paddingVertical: 48,
  },
  welcomeContainerBottomSheet: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  welcomeContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 32,
  },
  welcomeSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Messages Styles
  messagesContainer: {
    flex: 1,
    minHeight: 0, // Important for ScrollView to work properly in nested views
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 120, // Extra padding at bottom to account for input area when in bottom sheet
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: 'transparent',
  },
  inputContainer: {
    borderRadius: 24,
    paddingTop: 14,
    paddingBottom: 8,
    paddingHorizontal: 12,
    minHeight: 72,
  },
  input: {
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  attachButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -4,
  },
  attachButtonDisabled: {
    opacity: 0.7,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(128,128,128,0.3)',
    marginRight: -4,
  },
  sendButtonActive: {
    backgroundColor: '#2e7d32',
  },
  // Suggested Messages Styles (with Marquee)
  suggestedMessagesWrapper: {
    paddingVertical: 8,
    overflow: 'hidden',
    height: 52,
    position: 'relative',
  },
  marqueeMeasureContainer: {
    position: 'absolute',
    opacity: 0,
    zIndex: -1,
  },
  marqueeScrollContainer: {
    flexDirection: 'row',
    height: 52,
  },
  suggestedMessagesContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 4,
  },
  suggestedMessageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 0.5,
    marginRight: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
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
  // Image Preview Styles
  imagePreviewContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
  },
  imagePreviewScroll: {
    flexDirection: 'row',
  },
  imagePreviewItem: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 8,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  imageRemoveButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

