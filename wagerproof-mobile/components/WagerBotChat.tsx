import React, { useState, useEffect, useRef } from 'react';
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

export default function WagerBotChat({
  userId,
  userEmail,
  gameContext = '',
  onRefresh,
  onBack,
}: WagerBotChatProps) {
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

      const response = await fetch(chatEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ BuildShip error response:', errorText);
        console.error('❌ Request that failed:', JSON.stringify({
          message: requestBody.message,
          hasSystemPrompt: !!requestBody.SystemPrompt,
          systemPromptLength: requestBody.SystemPrompt?.length || 0,
          hasConversationId: !!requestBody.conversationId,
          conversationId: requestBody.conversationId || 'none'
        }));
        throw new Error(`API request failed: ${response.status}. ${errorText.substring(0, 100)}`);
      }

      console.log('📥 Response received, status:', response.status);
      console.log('📋 Content-Type:', response.headers.get('content-type'));
      
      // ✅ EXTRACT THREAD ID FROM HEADER FIRST
      const headerThreadId = response.headers.get('x-thread-id');
      if (headerThreadId) {
        setValidatedThreadId(headerThreadId);
        console.log('✅ Thread ID from header:', headerThreadId);
      } else {
        console.log('⚠️ No x-thread-id header found');
      }

      const assistantMessageId = `msg_${Date.now()}_assistant`;

      // Add empty assistant message that we'll update in real-time
      const emptyAssistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, emptyAssistantMessage]);

      // React Native doesn't support response.body.getReader()
      // Instead, read the entire response as text and parse SSE format
      // Then simulate streaming word-by-word for better UX
      console.log('📥 Reading response text...');
      const responseText = await response.text();
      console.log('📦 Response length:', responseText.length, 'chars');
      console.log('📦 First 200 chars:', responseText.substring(0, 200));

      // Parse SSE format to extract all text chunks
      let fullContent = '';
      const lines = responseText.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.substring(6).trim();
            if (!jsonStr) continue;
            
            const eventData = JSON.parse(jsonStr);
            
            // Extract thread ID from first event
            if (eventData.threadId && !threadId) {
              setValidatedThreadId(eventData.threadId);
              console.log('✅ Thread ID from SSE:', eventData.threadId);
            }
            
            // Extract text from SSE delta
            if (eventData.delta?.content?.[0]?.text?.value) {
              const textChunk = eventData.delta.content[0].text.value;
              fullContent += textChunk;
            }
          } catch (parseError) {
            console.error('❌ Error parsing SSE line:', parseError);
          }
        }
      }

      console.log('✅ Parsed SSE complete');
      console.log('💬 Full message length:', fullContent.length);

      // Simulate word-by-word streaming for better UX
      // Split by characters for faster, smoother streaming effect
      const chars = fullContent.split('');
      let currentIndex = 0;
      
      console.log('🎬 Starting simulated streaming animation...');
      setIsStreaming(true);

      const streamChars = () => {
        if (currentIndex < chars.length) {
          const charsToShow = chars.slice(0, currentIndex + 1).join('');
          
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: charsToShow }
                : msg
            )
          );
          
          currentIndex++;
          
          // Fast streaming: 20-40ms per character (feels like real-time)
          // Slightly slower for punctuation to feel more natural
          const currentChar = chars[currentIndex - 1];
          const isPunctuation = ['.', '!', '?', ',', '\n'].includes(currentChar);
          const delay = isPunctuation ? 50 : 20;
          
          setTimeout(streamChars, delay);
        } else {
          console.log('✅ Simulated streaming complete');
          setIsStreaming(false);
        }
      };

      // Start the animation
      streamChars();

      console.log('✅ Message parsing and streaming initiated');
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

              return (
                <View
                  key={message.id || index}
                  style={[
                    styles.messageBubble,
                    message.role === 'user'
                      ? [styles.userMessage, { backgroundColor: theme.colors.primary }]
                      : [styles.assistantMessage, { backgroundColor: theme.colors.surfaceVariant }],
                  ]}
                >
                  {message.role === 'assistant' && (
                    <MaterialCommunityIcons
                      name="robot"
                      size={20}
                      color={theme.colors.primary}
                      style={styles.botIcon}
                    />
                  )}
                  
                  {/* Show content or thinking indicator for empty streaming message */}
                  {isEmptyAndStreaming ? (
                    <View style={styles.thinkingContainer}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text style={[styles.messageText, { color: theme.colors.onSurfaceVariant, marginLeft: 8 }]}>
                        Thinking...
                      </Text>
                    </View>
                  ) : message.role === 'assistant' ? (
                    <View style={{ flex: 1, flexShrink: 1, flexDirection: 'row' }}>
                      <Markdown
                        style={{
                          body: {
                            color: theme.colors.onSurface,
                            fontSize: 15,
                            lineHeight: 22,
                            flexShrink: 1,
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
                        },
                        code_block: {
                          backgroundColor: '#1e1e1e',
                          padding: 12,
                          borderRadius: 8,
                          marginVertical: 8,
                          fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                        },
                        fence: {
                          backgroundColor: '#1e1e1e',
                          padding: 12,
                          borderRadius: 8,
                          marginVertical: 8,
                          color: '#d4d4d4',
                          fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                        },
                        link: { color: theme.colors.primary, textDecorationLine: 'underline' },
                        blockquote: {
                          backgroundColor: theme.colors.surfaceVariant,
                          borderLeftWidth: 4,
                          borderLeftColor: theme.colors.primary,
                          paddingLeft: 12,
                          paddingVertical: 8,
                          marginVertical: 8,
                        },
                        bullet_list: { marginBottom: 8 },
                        ordered_list: { marginBottom: 8 },
                        list_item: { marginBottom: 4 },
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
                      {message.content}
                    </Markdown>
                    {isStreamingThis && (
                      <Text style={{ 
                        color: theme.colors.primary, 
                        fontSize: 15,
                        fontWeight: 'bold',
                        marginLeft: 2,
                      }}>
                        ▊
                      </Text>
                    )}
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
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
  messageBubble: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 18,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  botIcon: {
    marginRight: 8,
    marginTop: 2,
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

