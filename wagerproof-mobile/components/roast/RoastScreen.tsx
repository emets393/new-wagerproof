import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { RoastMicButton } from './RoastMicButton';
import { RoastIntensitySelector } from './RoastIntensitySelector';
import { useRoastSession } from '@/hooks/useRoastSession';

const STATUS_TEXT: Record<string, string> = {
  idle: 'Tap the mic to talk',
  recording: 'Listening...',
  processing: 'Thinking...',
  responding: 'Roasting...',
};

export function RoastScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const {
    state,
    intensity,
    messages,
    liveTranscript,
    aiTranscript,
    error,
    isConnected,
    isConnecting,
    toggleRecording,
    setIntensity,
    clearConversation,
  } = useRoastSession();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages.length, liveTranscript, aiTranscript, state]);

  return (
    <LinearGradient
      colors={['#0a0a0a', '#111827', '#0a0a0a']}
      style={styles.container}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Roast Mode</Text>
        <TouchableOpacity onPress={clearConversation} style={styles.headerButton}>
          <MaterialCommunityIcons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Intensity Selector */}
      <RoastIntensitySelector value={intensity} onChange={setIntensity} />

      {/* Connection status */}
      {isConnecting && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusBannerText}>Connecting...</Text>
        </View>
      )}
      {error && (
        <View style={[styles.statusBanner, styles.errorBanner]}>
          <Text style={styles.statusBannerText}>{error}</Text>
        </View>
      )}

      {/* Conversation area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.conversationContainer}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && !liveTranscript && !aiTranscript && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎤</Text>
              <Text style={styles.emptyTitle}>Ready to get roasted?</Text>
              <Text style={styles.emptySubtitle}>
                Tell The Bookie about your worst bets and prepare to get destroyed.
              </Text>
            </View>
          )}

          {messages.map((msg, index) => (
            <Animated.View
              key={msg.id}
              entering={FadeInDown.delay(index === messages.length - 1 ? 0 : 0).duration(300)}
              style={[
                styles.messageBubble,
                msg.role === 'user' ? styles.userBubble : styles.aiBubble,
              ]}
            >
              {msg.role === 'assistant' && (
                <Text style={styles.aiLabel}>The Bookie</Text>
              )}
              <Text
                style={[
                  styles.messageText,
                  msg.role === 'user' ? styles.userText : styles.aiText,
                ]}
              >
                {msg.text}
              </Text>
            </Animated.View>
          ))}

          {/* Live user transcript */}
          {liveTranscript ? (
            <View style={[styles.messageBubble, styles.userBubble, styles.liveTranscript]}>
              <Text style={[styles.messageText, styles.userText, { opacity: 0.7 }]}>
                {liveTranscript}
              </Text>
            </View>
          ) : null}

          {/* Live AI transcript */}
          {aiTranscript ? (
            <View style={[styles.messageBubble, styles.aiBubble]}>
              <Text style={styles.aiLabel}>The Bookie</Text>
              <Text style={[styles.messageText, styles.aiText, { opacity: 0.8 }]}>
                {aiTranscript}
              </Text>
            </View>
          ) : null}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom section: Lottie + status + mic */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        {/* Lottie animation */}
        <LottieView
          source={require('@/assets/ChattingRobot.json')}
          autoPlay
          loop
          style={styles.lottie}
        />

        {/* Status text */}
        <Text style={[
          styles.statusText,
          state === 'recording' && styles.statusRecording,
          state === 'responding' && styles.statusResponding,
        ]}>
          {isConnecting ? 'Connecting to The Bookie...' : STATUS_TEXT[state]}
        </Text>

        {/* Mic button */}
        <RoastMicButton state={state} onPress={toggleRecording} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  statusBanner: {
    marginHorizontal: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  statusBannerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  conversationContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 4,
  },
  liveTranscript: {
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  aiLabel: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: 'rgba(255,255,255,0.9)',
  },
  bottomSection: {
    alignItems: 'center',
    paddingTop: 4,
  },
  lottie: {
    width: 80,
    height: 80,
  },
  statusText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  statusRecording: {
    color: '#22c55e',
  },
  statusResponding: {
    color: '#f59e0b',
  },
});
