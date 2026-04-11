// MessageBubble — Renders a single ChatMessage by iterating its ContentBlocks.
// User messages render as simple text bubbles. Assistant messages render blocks
// sequentially: thinking trace, tool calls, text, follow-ups, and action row.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ChatMessage, ContentBlock, ChatGameCardData, ChatWidgetData } from '../../types/chatTypes';
import { TOOL_DISPLAY_NAMES } from '../../types/chatTypes';
import StreamingText from './StreamingText';
import ToolCallsPill from './ToolCallsPill';
import FollowUpPills from './FollowUpPills';
import ThinkingBlockView from './ThinkingBlockView';
import AssistantActionRow from './AssistantActionRow';
import ChatGameCardList from './ChatGameCardList';
import ChatWidgetList from './widgets/ChatWidgetList';

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming: boolean;
  onFollowUpSelect: (question: string) => void;
  onRegenerate?: () => void;
  onGameCardPress?: (card: ChatGameCardData) => void;
  onWidgetPress?: (widget: ChatWidgetData) => void;
}

export default function MessageBubble({
  message,
  isStreaming,
  onFollowUpSelect,
  onRegenerate,
  onGameCardPress,
  onWidgetPress,
}: MessageBubbleProps) {
  if (message.role === 'user') {
    const text = message.blocks
      .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return (
      <View style={styles.userContainer}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{text}</Text>
        </View>
      </View>
    );
  }

  // Assistant message — render blocks in order
  const textBlocks = message.blocks.filter(
    (b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text',
  );
  const toolBlocks = message.blocks.filter(
    (b): b is Extract<ContentBlock, { type: 'tool_use' }> => b.type === 'tool_use',
  );
  const followUpBlocks = message.blocks.filter(
    (b): b is Extract<ContentBlock, { type: 'follow_ups' }> => b.type === 'follow_ups',
  );

  const thinkingBlocks = message.blocks.filter(
    (b): b is Extract<ContentBlock, { type: 'thinking' }> => b.type === 'thinking',
  );
  const gameCardBlocks = message.blocks.filter(
    (b): b is Extract<ContentBlock, { type: 'game_cards' }> => b.type === 'game_cards',
  );
  const widgetBlocks = message.blocks.filter(
    (b): b is Extract<ContentBlock, { type: 'chat_widgets' }> => b.type === 'chat_widgets',
  );

  const combinedText = textBlocks.map((b) => b.text).join('');
  const thinkingText = thinkingBlocks.map((b) => b.text).join('');
  const hasContent = combinedText.length > 0 || toolBlocks.length > 0
    || followUpBlocks.length > 0 || thinkingText.length > 0
    || widgetBlocks.length > 0;

  if (!hasContent) return null;

  // Tool names for thinking block summary (exclude suggest_follow_ups)
  const visibleToolNames = toolBlocks
    .filter((t) => t.name !== 'suggest_follow_ups')
    .map((t) => TOOL_DISPLAY_NAMES[t.name] || t.name);

  // Show thinking block when we have thinking text OR tools were used
  const showThinkingBlock = thinkingText.length > 0 || toolBlocks.length > 0;

  return (
    <View style={styles.assistantContainer}>
      {/* Text content + inline widgets — rendered together for seamless flow */}
      {(combinedText.length > 0 || widgetBlocks.length > 0) && (
        <View style={styles.assistantTextContainer}>
          {onWidgetPress && widgetBlocks.map((block, i) => (
            <ChatWidgetList
              key={`wl-${i}`}
              widgets={block.widgets}
              onWidgetPress={onWidgetPress}
            />
          ))}
          {combinedText.length > 0 && (
            <StreamingText
              text={combinedText}
              isStreaming={isStreaming}
            />
          )}
        </View>
      )}

      {/* Actions taken + action buttons — grouped at the bottom */}
      {showThinkingBlock && (
        <ThinkingBlockView
          isStreaming={isStreaming}
          thinkingText={thinkingText || undefined}
          toolCount={visibleToolNames.length}
          toolNames={visibleToolNames}
        />
      )}

      {toolBlocks.length > 0 && <ToolCallsPill toolBlocks={toolBlocks} />}

      {/* Action row — only after streaming completes */}
      {!isStreaming && combinedText.length > 0 && (
        <AssistantActionRow
          text={combinedText}
          onRegenerate={onRegenerate}
        />
      )}

      {/* Follow-up suggestions */}
      {followUpBlocks.map((block, i) => (
        <FollowUpPills
          key={i}
          questions={block.questions}
          onSelect={onFollowUpSelect}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  userContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  userBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  userText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 21,
  },
  assistantContainer: {
    paddingVertical: 4,
    gap: 8, // 8pt spacing between blocks, matching Ellie
  },
  assistantTextContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
});
