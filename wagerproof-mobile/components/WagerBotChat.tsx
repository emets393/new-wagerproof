import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
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
import ReanimatedAnimated, { FadeIn } from 'react-native-reanimated';
import { sendMessage as sendChatMessage, loadThread } from '../services/wagerBotChatService';
import { chatThreadService } from '../services/chatThreadService';
import type { ChatMessage, ContentBlock, WagerBotSSEEvent } from '../types/chatTypes';
import MessageBubble from './chat/MessageBubble';
import ThinkingIndicator from './chat/ThinkingIndicator';

const SUGGESTED_MESSAGES = [
  { label: '🎯 Best bets today', message: "What are the best value bets across all sports today?" },
  { label: '🏀 NBA picks', message: "Show me today's NBA predictions and where the model sees value" },
  { label: '⚾ MLB analysis', message: "What MLB games have the strongest model signals today?" },
  { label: '🏈 NFL breakdown', message: "Break down this week's NFL games with model predictions" },
  { label: '📊 Polymarket odds', message: "How do Polymarket odds compare to model predictions today?" },
  { label: '⭐ Editor picks', message: "What are the current editor picks?" },
];

interface WagerBotChatProps {
  userId: string;
  userEmail: string;
  onBack?: () => void;
  scrollY?: Animated.Value;
  headerHeight?: number;
}

const WagerBotChat = forwardRef<any, WagerBotChatProps>(({
  userId,
  userEmail,
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
  const abortRef = useRef<{ abort: () => void } | null>(null);

  // Track if user is at the bottom for conditional auto-scroll
  const isAtBottomRef = useRef(true);

  const handleScrollEvent = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    isAtBottomRef.current = distanceFromBottom < 100;
  }, []);

  const handleScroll = scrollY
    ? Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true, listener: handleScrollEvent },
      )
    : handleScrollEvent;

  const scrollProps = { onScroll: handleScroll, scrollEventThrottle: 16 };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [chatHistories, setChatHistories] = useState<Array<{
    id: string;
    title: string;
    timestamp: string;
  }>>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [threadTitle, setThreadTitle] = useState<string | null>(null);

  const drawerAnimation = useRef(new Animated.Value(300)).current;

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    handleNewChat,
    toggleHistoryDrawer,
  }));

  // Keyboard listeners
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Show welcome only when no messages
  useEffect(() => {
    setShowWelcome(messages.length === 0);
  }, [messages.length]);

  // Load chat histories on mount
  useEffect(() => {
    loadChatHistories();
  }, [userId]);

  // Drawer animation
  useEffect(() => {
    Animated.spring(drawerAnimation, {
      toValue: showHistoryDrawer ? 0 : 300,
      useNativeDriver: true,
      friction: 10,
    }).start();
  }, [showHistoryDrawer]);

  const loadChatHistories = async () => {
    try {
      const threads = await chatThreadService.getThreads(userId);
      setChatHistories(
        threads.map((t: any) => ({
          id: t.id,
          title: t.title || 'New chat',
          timestamp: t.updated_at || t.created_at,
        })),
      );
    } catch (e) {
      console.warn('[WagerBotChat] Failed to load histories:', e);
    }
  };

  const handleNewChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setThreadId(null);
    setThreadTitle(null);
    setIsStreaming(false);
    setIsSending(false);
    setShowHistoryDrawer(false);
  };

  const toggleHistoryDrawer = () => {
    setShowHistoryDrawer((prev) => !prev);
    if (!showHistoryDrawer) loadChatHistories();
  };

  const switchToChat = async (historyThreadId: string) => {
    try {
      abortRef.current?.abort();
      setShowHistoryDrawer(false);
      setIsStreaming(false);
      setIsSending(false);

      const loadedMessages = await loadThread(historyThreadId);
      setMessages(loadedMessages);
      setThreadId(historyThreadId);

      // Get title from history
      const history = chatHistories.find((h) => h.id === historyThreadId);
      setThreadTitle(history?.title || null);
    } catch (e) {
      console.warn('[WagerBotChat] Failed to load thread:', e);
    }
  };

  const deleteThread = async (id: string, title: string) => {
    Alert.alert(
      'Delete Chat',
      `Delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await chatThreadService.deleteThread(id);
            if (threadId === id) handleNewChat();
            loadChatHistories();
          },
        },
      ],
    );
  };

  // ---- Send Message --------------------------------------------------------

  const handleSendMessage = useCallback(async (text?: string) => {
    const messageText = (text || inputText).trim();
    if (!messageText || isSending) return;

    setInputText('');
    setIsSending(true);
    setIsStreaming(true);
    Keyboard.dismiss();

    // Add user message optimistically
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      blocks: [{ type: 'text', text: messageText }],
      timestamp: new Date().toISOString(),
    };

    // Create placeholder assistant message
    const assistantMsg: ChatMessage = {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      blocks: [],
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    // Scroll to bottom
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const result = await sendChatMessage({
        userMessage: messageText,
        threadId,
        onEvent: (event: WagerBotSSEEvent) => {
          switch (event.type) {
            case 'thread': {
              setThreadId(event.data.thread_id);
              break;
            }
            case 'content_delta': {
              // Append text to the assistant message
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role !== 'assistant') return prev;

                const textBlock = last.blocks.find((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text');
                if (textBlock) {
                  textBlock.text += event.data.text;
                } else {
                  last.blocks.push({ type: 'text', text: event.data.text });
                }
                return [...updated];
              });

              // Haptic on content
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

              // Auto-scroll
              if (isAtBottomRef.current) {
                scrollViewRef.current?.scrollToEnd({ animated: false });
              }
              break;
            }
            case 'tool_start': {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role !== 'assistant') return prev;

                last.blocks.push({
                  type: 'tool_use',
                  id: event.data.id,
                  name: event.data.name,
                  arguments: JSON.stringify(event.data.arguments),
                  status: { state: 'running' },
                });
                return [...updated];
              });
              break;
            }
            case 'tool_end': {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role !== 'assistant') return prev;

                const toolBlock = last.blocks.find(
                  (b): b is Extract<ContentBlock, { type: 'tool_use' }> =>
                    b.type === 'tool_use' && b.id === event.data.id,
                );
                if (toolBlock) {
                  toolBlock.status = {
                    state: 'done',
                    ms: event.data.ms,
                    ok: event.data.ok,
                    summary: event.data.result_summary,
                  };
                }
                return [...updated];
              });
              break;
            }
            case 'thinking_delta': {
              // Append thinking text to the assistant message (from reasoning models)
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role !== 'assistant') return prev;

                const thinkingBlock = last.blocks.find(
                  (b): b is Extract<ContentBlock, { type: 'thinking' }> => b.type === 'thinking',
                );
                if (thinkingBlock) {
                  thinkingBlock.text += event.data.text;
                } else {
                  last.blocks.push({ type: 'thinking', text: event.data.text });
                }
                return [...updated];
              });
              break;
            }
            case 'thinking_done': {
              // Thinking complete — no UI action needed, the block is already populated
              break;
            }
            case 'follow_ups': {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role !== 'assistant') return prev;

                last.blocks.push({
                  type: 'follow_ups',
                  questions: event.data.questions,
                });
                return [...updated];
              });
              break;
            }
            case 'thread_titled': {
              setThreadTitle(event.data.title);
              break;
            }
            case 'error': {
              console.error('[WagerBotChat] Stream error:', event.data);
              break;
            }
          }
        },
        onError: (error: Error) => {
          console.error('[WagerBotChat] Send failed:', error);
          // Always append error text, even if tool blocks already exist
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              last.blocks.push({
                type: 'text',
                text: `Sorry, I encountered an error: ${error.message}. Please try again.`,
              });
            }
            return [...updated];
          });
          // Must clear streaming state on error, otherwise UI freezes
          setIsStreaming(false);
          setIsSending(false);
        },
        onComplete: () => {
          setIsStreaming(false);
          setIsSending(false);
          loadChatHistories();
        },
      });

      abortRef.current = result;
    } catch (error: any) {
      console.error('[WagerBotChat] Send error:', error);
      setIsStreaming(false);
      setIsSending(false);
    }
  }, [inputText, isSending, threadId]);

  const handleSuggestedMessage = (message: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleSendMessage(message);
  };

  const handleFollowUpSelect = (question: string) => {
    handleSendMessage(question);
  };

  // Regenerate: re-send the last user message
  const handleRegenerate = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;
    const text = lastUserMsg.blocks
      .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('');
    if (text) {
      // Remove the last assistant message before regenerating
      setMessages((prev) => {
        const lastIdx = prev.length - 1;
        if (prev[lastIdx]?.role === 'assistant') {
          return prev.slice(0, lastIdx);
        }
        return prev;
      });
      handleSendMessage(text);
    }
  }, [messages, handleSendMessage]);

  // Check if assistant is still "thinking" (streaming but no blocks yet)
  const lastMessage = messages[messages.length - 1];
  const showThinking = isStreaming && lastMessage?.role === 'assistant' && lastMessage.blocks.length === 0;

  return (
    <View style={styles.container}>
      {/* History Drawer */}
      <Animated.View
        style={[
          styles.historyDrawer,
          { paddingTop: insets.top, transform: [{ translateX: drawerAnimation }] },
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
        {chatHistories.length > 0 && (
          <TouchableOpacity
            style={styles.clearAllButton}
            onPress={() => {
              Alert.alert(
                'Clear All Chats',
                `Delete all ${chatHistories.length} conversations?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                      await chatThreadService.deleteAllThreads(userId);
                      handleNewChat();
                      loadChatHistories();
                    },
                  },
                ],
              );
            }}
          >
            <MaterialCommunityIcons name="delete-sweep-outline" size={16} color="rgba(255,100,100,0.8)" />
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        )}
        <ScrollView style={styles.drawerContent}>
          {chatHistories.length === 0 ? (
            <Text style={styles.emptyHistoryText}>No chat history yet</Text>
          ) : (
            chatHistories.map((history) => (
              <View
                key={history.id}
                style={[styles.historyItem, threadId === history.id && styles.historyItemActive]}
              >
                <TouchableOpacity
                  style={styles.historyItemContent}
                  onPress={() => switchToChat(history.id)}
                >
                  <MaterialCommunityIcons
                    name="message-text-outline"
                    size={20}
                    color="rgba(255,255,255,0.82)"
                    style={styles.historyIcon}
                  />
                  <View style={styles.historyTextContainer}>
                    <Text style={styles.historyTitle} numberOfLines={1}>
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
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color="rgba(255,255,255,0.6)" />
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
          {/* Welcome Screen */}
          {showWelcome && (
            <Animated.ScrollView
              ref={welcomeScrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={[styles.welcomeContainer, { paddingTop: headerHeight }]}
              {...scrollProps}
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
                <Text style={[styles.welcomeTitle, { color: theme.colors.onSurface }]}>
                  How can I help you analyze today's games?
                </Text>
                <Text style={[styles.welcomeSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  I can pull live predictions, odds, and analytics across all sports.
                </Text>
              </View>
            </Animated.ScrollView>
          )}

          {/* Messages View */}
          {!showWelcome && (
            <Animated.ScrollView
              ref={scrollViewRef}
              style={[styles.messagesContainer, styles.scrollView]}
              contentContainerStyle={[
                styles.messagesContent,
                {
                  paddingTop: headerHeight,
                  paddingBottom: keyboardHeight > 0 ? keyboardHeight + 120 : insets.bottom + 150,
                },
              ]}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              {...scrollProps}
              onContentSizeChange={() => {
                if (isAtBottomRef.current) {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }
              }}
            >
              {messages.map((message, index) => {
                const isLast = index === messages.length - 1;
                const isStreamingThis = isStreaming && isLast && message.role === 'assistant';

                return (
                  <ReanimatedAnimated.View
                    key={message.id}
                    entering={FadeIn.duration(200)}
                    style={[
                      styles.messageRow,
                      index === 0 && { marginTop: 16 },
                    ]}
                  >
                    <MessageBubble
                      message={message}
                      isStreaming={isStreamingThis}
                      onFollowUpSelect={handleFollowUpSelect}
                      onRegenerate={isLast && !isStreaming ? handleRegenerate : undefined}
                    />
                  </ReanimatedAnimated.View>
                );
              })}

              {/* Thinking indicator */}
              {showThinking && <ThinkingIndicator />}
            </Animated.ScrollView>
          )}
        </View>

        {/* Input Area */}
        <View
          style={[
            styles.inputWrapper,
            {
              bottom: keyboardHeight > 0 ? keyboardHeight : 0,
              paddingBottom: Platform.OS === 'ios' ? insets.bottom : 16,
            },
          ]}
        >
          {/* Suggested messages on welcome */}
          {(showWelcome || messages.length === 0) && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.suggestedMessagesScrollView}
              contentContainerStyle={styles.suggestedMessagesContent}
            >
              {SUGGESTED_MESSAGES.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestedMessageBubble}
                  onPress={() => handleSuggestedMessage(item.message)}
                  disabled={isSending}
                  activeOpacity={0.7}
                >
                  <BlurView intensity={24} tint="dark" style={styles.suggestedMessageBlur} />
                  <Text style={[styles.suggestedMessageText, { color: theme.colors.onSurface }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.inputContainer}>
            <BlurView intensity={30} tint="dark" style={styles.inputBlur} />
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
                setTimeout(() => {
                  if (showWelcome) {
                    welcomeScrollViewRef.current?.scrollToEnd({ animated: true });
                  } else {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }
                }, 100);
              }}
            />
            <View style={styles.inputBottomRow}>
              <TouchableOpacity
                style={[styles.sendButton, inputText.trim() && styles.sendButtonActive]}
                onPress={() => handleSendMessage()}
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
    minHeight: 0,
  },
  scrollView: {
    flex: 1,
  },
  // History drawer
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
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 100, 100, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 100, 100, 0.15)',
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 100, 100, 0.8)',
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
  // Welcome
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
  // Messages
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
    flexGrow: 1,
  },
  messageRow: {
    marginBottom: 4,
  },
  // Input
  inputWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
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
  inputBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  // Suggested messages
  suggestedMessagesScrollView: {
    maxHeight: 52,
    marginBottom: 8,
    marginHorizontal: -16,
  },
  suggestedMessagesContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
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
  suggestedMessageText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
