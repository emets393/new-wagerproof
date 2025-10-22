import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Vibration,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { chatSessionManager, ChatMessage } from '../utils/chatSessionManager';

interface WagerBotChatProps {
  userId: string;
  userEmail: string;
  gameContext?: string;
  onRefresh?: () => void;
  onBack?: () => void;
}

const WagerBotChat = forwardRef<any, WagerBotChatProps>(({
  userId,
  userEmail,
  gameContext = '',
  onRefresh,
  onBack,
}, ref) => {
  const theme = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [chatHistories, setChatHistories] = useState<Array<{ id: string; title: string; timestamp: string; threadId: string | null }>>([]);
  
  // Animation values for message appearance
  const messageAnimations = useRef<{ [key: string]: Animated.Value }>({});
  const drawerAnimation = useRef(new Animated.Value(300)).current; // Positive for right side
  
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

  // Animate drawer open/close (right side)
  useEffect(() => {
    Animated.spring(drawerAnimation, {
      toValue: showHistoryDrawer ? 0 : 300,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [showHistoryDrawer]);

  // Initialize chat session and get client secret
  useEffect(() => {
    initializeChat();
  }, [userId, gameContext]);

  const initializeChat = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🔄 Initializing WagerBot chat...');

      // Create or get existing session
      const session = await chatSessionManager.createNewSession(userId, 'mobile-chat');
      setSessionId(session.id);
      setMessages(session.messages || []);

      console.log(`📝 Session created: ${session.id}`);

      // Get client secret from BuildShip with game context
      const { clientSecret: secret } = await chatSessionManager.getClientSecret(
        userId,
        userEmail,
        gameContext
      );

      setClientSecret(secret);
      console.log('✅ Chat initialized successfully');

      // Check if there are existing messages
      if (session.messages && session.messages.length > 0) {
        setMessages(session.messages);
        setShowWelcome(false);
      }
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
      const sessions = await chatSessionManager.getUserSessions(userId);
      const histories = sessions.map((session: any) => ({
        id: session.id,
        title: session.messages[0]?.content.substring(0, 50) || 'New Chat',
        timestamp: session.createdAt,
        threadId: session.threadId || null,
      }));
      setChatHistories(histories);
    } catch (err) {
      console.error('Error loading chat histories:', err);
    }
  };

  const clearChat = async () => {
    try {
      // Create a new session
      await initializeChat();
      setMessages([]);
      setThreadId(null);
      setShowWelcome(true);
      console.log('✅ Chat cleared');
    } catch (err) {
      console.error('Error clearing chat:', err);
    }
  };

  const switchToChat = async (historyId: string, historyThreadId: string | null) => {
    try {
      const sessions = await chatSessionManager.getUserSessions(userId);
      const session = sessions.find((s: any) => s.id === historyId);
      if (session) {
        setMessages(session.messages || []);
        setThreadId(historyThreadId);
        setSessionId(historyId);
        setShowWelcome(session.messages.length === 0);
        setShowHistoryDrawer(false);
        console.log('✅ Switched to chat:', historyId);
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

  // Expose functions to parent via ref
  useImperativeHandle(ref, () => ({
    toggleHistoryDrawer,
    clearChat,
  }));

  const sendMessage = async () => {
    if (!inputText.trim() || isSending) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date().toISOString(),
    };

    console.log('🎬 Starting sendMessage function');
    console.log('  - Input text:', inputText.trim());
    console.log('  - Message content:', userMessage.content);
    console.log('  - Message content length:', userMessage.content.length);

    // Hide welcome screen and add user message to UI
    setShowWelcome(false);
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
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
      console.log('📤 Sending message to BuildShip...');

      // BuildShip REST API expects: message, conversationId (optional), and SystemPrompt
      const requestBody: any = {
        message: userMessage.content,
      };

      // Always include SystemPrompt if available (game context)
      if (gameContext && gameContext.length > 0) {
        requestBody.SystemPrompt = gameContext;
        console.log(`📊 Including game context (${gameContext.length} chars)`);
      }

      // Only send conversationId if it's a valid OpenAI thread ID (starts with "thread_")
      if (threadId && threadId.startsWith('thread_')) {
        requestBody.conversationId = threadId;
        console.log('🔗 Including existing thread ID:', threadId);
      } else {
        console.log('ℹ️ No thread ID - BuildShip will create a new thread');
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📦 REQUEST PAYLOAD TO BUILDSHIP');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Full payload:', JSON.stringify(requestBody, null, 2));
      console.log('');
      console.log('Payload structure:');
      console.log('  - message:', requestBody.message ? `"${requestBody.message}"` : 'UNDEFINED');
      console.log('  - message type:', typeof requestBody.message);
      console.log('  - conversationId:', requestBody.conversationId || 'NOT_PRESENT');
      console.log('  - SystemPrompt:', requestBody.SystemPrompt ? `(${requestBody.SystemPrompt.length} chars)` : 'NOT_PRESENT');
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
        let threadIdSet = false;
        
        // Real-time streaming as chunks arrive!
        xhr.onprogress = () => {
          const newText = xhr.responseText.substring(parsedLength);
          parsedLength = xhr.responseText.length;
          
          if (!newText) return;
          
          // Parse SSE events as they arrive
          const lines = newText.split('\n');
          let contentUpdated = false;
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.substring(6).trim();
                if (!jsonStr) continue;
                
                const eventData = JSON.parse(jsonStr);
                
                // Extract thread ID from first event
                if (eventData.threadId && !threadIdSet) {
                  setValidatedThreadId(eventData.threadId);
                  console.log('✅ Thread ID from SSE (real-time):', eventData.threadId);
                  threadIdSet = true;
                }
                
                // Extract text and UPDATE IMMEDIATELY
                if (eventData.delta?.content?.[0]?.text?.value) {
                  const textChunk = eventData.delta.content[0].text.value;
                  currentContent += textChunk;
                  contentUpdated = true;
                  
                  console.log('📝 Received chunk:', textChunk.substring(0, 50));
                }
              } catch (parseError) {
                // Skip invalid JSON lines
              }
            }
          }
          
          // Update UI immediately with new content!
          if (contentUpdated) {
            const currentTime = Date.now();
            
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: currentContent }
                  : msg
              )
            );
            
            // Haptic feedback every 100ms max (smooth but not overwhelming)
            if (currentTime - lastUpdateTime > 100) {
              Vibration.vibrate(1);
              lastUpdateTime = currentTime;
            }
            
            setIsStreaming(true);
            console.log('✅ UI updated in real-time, total length:', currentContent.length);
          }
        };
        
        xhr.onload = () => {
          console.log('✅ Stream complete!');
          setIsStreaming(false);
          
          if (xhr.status !== 200) {
            console.error('❌ BuildShip error response:', xhr.responseText);
            reject(new Error(`API request failed: ${xhr.status}. ${xhr.responseText.substring(0, 100)}`));
            return;
          }
          
          // Extract thread ID from header if available
          const headerThreadId = xhr.getResponseHeader('x-thread-id');
          if (headerThreadId && !threadIdSet) {
            setValidatedThreadId(headerThreadId);
            console.log('✅ Thread ID from header:', headerThreadId);
          }
          
          if (!currentContent) {
            reject(new Error('No content received from BuildShip'));
            return;
          }
          
          console.log('✅ Final message length:', currentContent.length);
          resolve();
        };
        
        xhr.onerror = () => {
          console.error('❌ XHR error');
          setIsStreaming(false);
          reject(new Error('Network request failed'));
        };
        
        xhr.ontimeout = () => {
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

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>
          Initializing WagerBot...
        </Text>
      </View>
    );
  }

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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* History Drawer */}
      <Animated.View 
        style={[
          styles.historyDrawer,
          {
            backgroundColor: theme.colors.surface,
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
              <TouchableOpacity
                key={history.id}
                style={[
                  styles.historyItem,
                  sessionId === history.id && { backgroundColor: theme.colors.primaryContainer },
                ]}
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
        keyboardVerticalOffset={100}
      >
        {/* Welcome Screen (shows when no messages) */}
        {showWelcome && (
          <ScrollView
            contentContainerStyle={styles.welcomeContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
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
          </ScrollView>
        )}

        {/* Messages View (shows when there are messages) */}
        {!showWelcome && (
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
              />
            }
            onContentSizeChange={() => {
              // Auto-scroll when content changes
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }}
          >
            {messages.map((message, index) => {
              const isLastMessage = index === messages.length - 1;
              const isEmptyAndStreaming = !message.content && isSending && isLastMessage;
              const isStreamingThis = isStreaming && isLastMessage && message.role === 'assistant';
              
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
                    animatedStyle,
                  ]}
                >
                  {/* Robot icon OUTSIDE bubble for assistant messages */}
                  {message.role === 'assistant' && (
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
                      styles.messageBubble,
                      message.role === 'user'
                        ? [styles.userMessage, { backgroundColor: theme.colors.primary }]
                        : [styles.assistantMessage, { backgroundColor: theme.colors.surfaceVariant }],
                    ]}
                  >
                    {/* Show content or thinking indicator for empty streaming message */}
                    {isEmptyAndStreaming ? (
                      <View style={styles.thinkingContainer}>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                        <Text style={[styles.messageText, { color: theme.colors.onSurfaceVariant, marginLeft: 8 }]}>
                          Thinking...
                        </Text>
                      </View>
                    ) : message.role === 'assistant' ? (
                    <View style={{ flexShrink: 1, flexWrap: 'wrap', width: '100%' }}>
                      <Markdown
                        style={{
                          body: {
                            color: theme.colors.onSurface,
                            fontSize: 15,
                            lineHeight: 20,
                            flexShrink: 1,
                            flexWrap: 'wrap',
                          },
                          paragraph: {
                            marginTop: 0,
                            marginBottom: 8,
                            flexWrap: 'wrap',
                          },
                          text: {
                            flexWrap: 'wrap',
                          },
                        heading1: { fontSize: 22, fontWeight: 'bold', marginBottom: 8, color: theme.colors.onSurface },
                        heading2: { fontSize: 20, fontWeight: 'bold', marginBottom: 6, color: theme.colors.onSurface },
                        heading3: { fontSize: 18, fontWeight: 'bold', marginBottom: 4, color: theme.colors.onSurface },
                        strong: { fontWeight: 'bold', color: theme.colors.onSurface },
                        em: { fontStyle: 'italic' },
                        code_inline: {
                          backgroundColor: theme.colors.surfaceVariant,
                          color: theme.colors.primary,
                          paddingHorizontal: 4,
                          paddingVertical: 2,
                          borderRadius: 4,
                          fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                          fontSize: 14,
                        },
                        code_block: {
                          backgroundColor: '#1e1e1e',
                          padding: 8,
                          borderRadius: 6,
                          marginVertical: 6,
                          fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                          fontSize: 13,
                        },
                        fence: {
                          backgroundColor: '#1e1e1e',
                          padding: 8,
                          borderRadius: 6,
                          marginVertical: 6,
                          color: '#d4d4d4',
                          fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                          fontSize: 13,
                        },
                        link: { color: theme.colors.primary, textDecorationLine: 'underline' },
                        blockquote: {
                          backgroundColor: theme.colors.surfaceVariant,
                          borderLeftWidth: 3,
                          borderLeftColor: theme.colors.primary,
                          paddingLeft: 10,
                          paddingVertical: 6,
                          marginVertical: 6,
                        },
                        bullet_list: { marginBottom: 4, marginTop: 0 },
                        ordered_list: { marginBottom: 4, marginTop: 0 },
                        list_item: { marginBottom: 2, lineHeight: 18 },
                        table: {
                          borderWidth: 1,
                          borderColor: theme.colors.outline,
                          borderRadius: 8,
                          marginVertical: 8,
                        },
                        th: {
                          backgroundColor: theme.colors.surfaceVariant,
                          padding: 8,
                          fontWeight: 'bold',
                        },
                        td: {
                          padding: 8,
                          borderWidth: 1,
                          borderColor: theme.colors.outline,
                        },
                      }}
                    >
                      {message.content + (isStreamingThis ? ' ▊' : '')}
                    </Markdown>
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.messageText,
                        { color: '#ffffff' },
                      ]}
                    >
                      {message.content}
                    </Text>
                  )}
                  </View>
                </Animated.View>
              );
            })}
          </ScrollView>
        )}

        {/* Input Area - Always visible at bottom */}
        <View style={[styles.inputWrapper, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
            <TouchableOpacity
              style={styles.attachButton}
              onPress={() => {
                // TODO: Implement attachment functionality
                console.log('Attach button pressed');
              }}
            >
              <MaterialCommunityIcons name="plus" size={24} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
            
            <TextInput
              style={[styles.input, { color: theme.colors.onSurface }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Chat with WagerBot"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              multiline
              maxLength={500}
              editable={!isSending}
            />
            
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isSending) && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={theme.colors.onSurfaceVariant} />
              ) : (
                <MaterialCommunityIcons 
                  name="arrow-up" 
                  size={24} 
                  color={inputText.trim() ? theme.colors.primary : theme.colors.onSurfaceVariant} 
                />
              )}
            </TouchableOpacity>
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
  },
  keyboardView: {
    flex: 1,
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
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  historyIcon: {
    marginRight: 12,
  },
  historyTextContainer: {
    flex: 1,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    minHeight: '70%',
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
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 16,
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
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 48,
  },
  attachButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

