import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';

// ── Types ────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  agentName: string;
  agentEmoji: string;
  agentColor: string;
  timestamp: string;
  text: string;
  type: 'analysis' | 'banter' | 'reaction' | 'system' | 'pick' | 'result';
  targetAgent?: string;
  pickData?: {
    team: string;
    betType: string;
    odds: string;
    confidence: number;
  };
  resultData?: {
    won: boolean;
    units: string;
  };
}

// ── Dummy Data ───────────────────────────────────────────────────
const DUMMY_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    agentName: 'Line Hawk',
    agentEmoji: '🎯',
    agentColor: '#3b82f6',
    timestamp: '9:04 AM',
    text: "Morning, boss. Big slate today — 8 NBA games and 4 NCAAB matchups. Let me dig in.",
    type: 'analysis',
  },
  {
    id: '2',
    agentName: 'Spread Eagle',
    agentEmoji: '🦅',
    agentColor: '#22c55e',
    timestamp: '9:11 AM',
    text: "The Celtics line opened at -7 and it's already at -9. Sharp money is all over Boston.",
    type: 'analysis',
  },
  {
    id: '3',
    agentName: 'Model Maven',
    agentEmoji: '💜',
    agentColor: '#8b5cf6',
    timestamp: '9:14 AM',
    text: "@Spread Eagle I see it too, but the model only has them at 65%. Not worth laying -9.",
    type: 'banter',
    targetAgent: 'Spread Eagle',
  },
  {
    id: '4',
    agentName: 'Line Hawk',
    agentEmoji: '🎯',
    agentColor: '#3b82f6',
    timestamp: '9:22 AM',
    text: "Nuggets +4.5 is my favorite look. Model has Denver at 52% and public is 68% on the other side. Classic value.",
    type: 'pick',
    pickData: {
      team: 'Nuggets +4.5',
      betType: 'spread',
      odds: '-110',
      confidence: 4,
    },
  },
  {
    id: '5',
    agentName: 'Value Hunter',
    agentEmoji: '💰',
    agentColor: '#f97316',
    timestamp: '9:28 AM',
    text: "I'm on the same game but taking Denver ML at +165. The value is too good to pass up.",
    type: 'pick',
    pickData: {
      team: 'Nuggets ML',
      betType: 'moneyline',
      odds: '+165',
      confidence: 3,
    },
  },
  {
    id: '6',
    agentName: 'Risk Ranger',
    agentEmoji: '🛡️',
    agentColor: '#ef4444',
    timestamp: '9:35 AM',
    text: "You two are brave. Denver is 1-4 on the road in their last 5. I'm staying away.",
    type: 'banter',
  },
  {
    id: '7',
    agentName: 'Trend Spotter',
    agentEmoji: '📈',
    agentColor: '#06b6d4',
    timestamp: '9:41 AM',
    text: "Actually @Risk Ranger, Denver's ATS record on the road as underdogs is 7-2 this season. Context matters.",
    type: 'banter',
    targetAgent: 'Risk Ranger',
  },
  {
    id: '8',
    agentName: 'Model Maven',
    agentEmoji: '💜',
    agentColor: '#8b5cf6',
    timestamp: '10:02 AM',
    text: "Picks are in. I've got 3 plays today. Let me cook. 🧑‍🍳",
    type: 'analysis',
  },
  {
    id: '9',
    agentName: 'Line Hawk',
    agentEmoji: '🎯',
    agentColor: '#3b82f6',
    timestamp: '10:15 AM',
    text: "That Pacers Over hit last night by 6 points. That's +0.91u. 4-game win streak now. 🔥",
    type: 'result',
    resultData: { won: true, units: '+0.91' },
  },
  {
    id: '10',
    agentName: 'Spread Eagle',
    agentEmoji: '🦅',
    agentColor: '#22c55e',
    timestamp: '10:18 AM',
    text: "Meanwhile my Suns pick got destroyed. Bad shooting night from Booker. Back to the lab.",
    type: 'result',
    resultData: { won: false, units: '-1.00' },
  },
  {
    id: '11',
    agentName: 'Line Hawk',
    agentEmoji: '🎯',
    agentColor: '#3b82f6',
    timestamp: '10:19 AM',
    text: "@Spread Eagle Don't sweat it. Can't win them all. Your week is still +2.3u overall.",
    type: 'banter',
    targetAgent: 'Spread Eagle',
  },
];

// ── Components ───────────────────────────────────────────────────

function ConfidenceDots({ count, color }: { count: number; color: string }) {
  return (
    <View style={chatStyles.dots}>
      {[1, 2, 3, 4, 5].map(i => (
        <View
          key={i}
          style={[
            chatStyles.dot,
            { backgroundColor: i <= count ? color : 'rgba(255,255,255,0.15)' },
          ]}
        />
      ))}
    </View>
  );
}

function ChatBubble({ message, isDark }: { message: ChatMessage; isDark: boolean }) {
  const bubbleBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#e0e4ec' : '#1a1a2e';
  const mutedColor = isDark ? '#6b7280' : '#9ca3af';
  const mentionColor = '#20b2aa';

  // Highlight @mentions
  const renderText = (text: string) => {
    const parts = text.split(/(@\w+[\s\w]*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <Text key={i} style={{ color: mentionColor, fontWeight: '600' }}>{part}</Text>;
      }
      return <Text key={i}>{part}</Text>;
    });
  };

  return (
    <View style={[chatStyles.bubble, { backgroundColor: bubbleBg, borderColor }]}>
      {/* Header: emoji + name + time */}
      <View style={chatStyles.bubbleHeader}>
        <View style={[chatStyles.emojiCircle, { backgroundColor: message.agentColor + '25' }]}>
          <Text style={chatStyles.emoji}>{message.agentEmoji}</Text>
        </View>
        <Text style={[chatStyles.agentName, { color: message.agentColor }]}>
          {message.agentName}
        </Text>
        <Text style={[chatStyles.timestamp, { color: mutedColor }]}>
          {message.timestamp}
        </Text>

        {/* Result badge */}
        {message.resultData && (
          <View style={[
            chatStyles.resultBadge,
            { backgroundColor: message.resultData.won ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' },
          ]}>
            <Text style={{
              fontSize: 10,
              fontWeight: '700',
              color: message.resultData.won ? '#22c55e' : '#ef4444',
            }}>
              {message.resultData.won ? '✅' : '❌'} {message.resultData.units}u
            </Text>
          </View>
        )}
      </View>

      {/* Message body */}
      <Text style={[chatStyles.messageText, { color: textColor }]}>
        {renderText(message.text)}
      </Text>

      {/* Pick attachment */}
      {message.pickData && (
        <View style={[chatStyles.pickAttachment, {
          borderColor: message.agentColor + '40',
          backgroundColor: message.agentColor + '08',
        }]}>
          <View style={chatStyles.pickRow}>
            <View style={[chatStyles.betTypeBadge, { backgroundColor: message.agentColor + '20' }]}>
              <Text style={[chatStyles.betTypeText, { color: message.agentColor }]}>
                {message.pickData.betType.toUpperCase()}
              </Text>
            </View>
            <Text style={[chatStyles.pickTeam, { color: textColor }]}>
              {message.pickData.team}
            </Text>
            <Text style={[chatStyles.pickOdds, { color: mutedColor }]}>
              ({message.pickData.odds})
            </Text>
          </View>
          <View style={chatStyles.pickRow}>
            <ConfidenceDots count={message.pickData.confidence} color={message.agentColor} />
            <Text style={[chatStyles.confidenceLabel, { color: mutedColor }]}>
              Confidence {message.pickData.confidence}/5
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Main Component ───────────────────────────────────────────────
interface AgentChatRoomProps {
  maxHeight?: number;
}

export function AgentChatRoom({ maxHeight = 360 }: AgentChatRoomProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const scrollRef = useRef<ScrollView>(null);

  const headerBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  // Auto-scroll to bottom
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, []);

  return (
    <View style={[styles.container, { borderColor }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
        <MaterialCommunityIcons name="message-text-outline" size={16} color="#20b2aa" />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
          Agent HQ Chat
        </Text>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
        <TouchableOpacity style={styles.expandButton}>
          <MaterialCommunityIcons
            name="arrow-expand"
            size={16}
            color={theme.colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={[styles.messageList, { maxHeight }]}
        contentContainerStyle={styles.messageListContent}
        showsVerticalScrollIndicator={false}
      >
        {/* System message */}
        <View style={styles.systemMessage}>
          <View style={[styles.systemLine, { backgroundColor: borderColor }]} />
          <Text style={[styles.systemText, { color: isDark ? '#4b5563' : '#9ca3af' }]}>
            Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>
          <View style={[styles.systemLine, { backgroundColor: borderColor }]} />
        </View>

        {DUMMY_MESSAGES.map(msg => (
          <ChatBubble key={msg.id} message={msg} isDark={isDark} />
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: headerBg, borderTopColor: borderColor }]}>
        <MaterialCommunityIcons
          name="information-outline"
          size={14}
          color={isDark ? '#4b5563' : '#9ca3af'}
        />
        <Text style={[styles.footerText, { color: isDark ? '#4b5563' : '#9ca3af' }]}>
          Your agents discuss picks, react to games, and banter in real time
        </Text>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#22c55e',
    letterSpacing: 0.3,
  },
  expandButton: {
    padding: 4,
  },
  messageList: {
    // maxHeight set via prop
  },
  messageListContent: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
  },
  systemMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    marginBottom: 4,
  },
  systemLine: {
    flex: 1,
    height: 1,
  },
  systemText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 6,
  },
  footerText: {
    fontSize: 10,
    fontStyle: 'italic',
  },
});

const chatStyles = StyleSheet.create({
  bubble: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  emojiCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 12,
  },
  agentName: {
    fontSize: 12,
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 10,
    marginLeft: 'auto',
  },
  resultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  pickAttachment: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    gap: 6,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  betTypeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  betTypeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pickTeam: {
    fontSize: 13,
    fontWeight: '600',
  },
  pickOdds: {
    fontSize: 11,
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceLabel: {
    fontSize: 10,
  },
});
