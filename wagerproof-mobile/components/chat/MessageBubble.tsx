// MessageBubble — Renders a single ChatMessage by iterating its ContentBlocks.
// User messages render as simple text bubbles. Assistant messages render blocks
// sequentially: text, tool calls (as ToolCallsPill), and follow-ups.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ChatMessage, ContentBlock } from '../../types/chatTypes';
import StreamingText from './StreamingText';
import ToolCallsPill from './ToolCallsPill';
import FollowUpPills from './FollowUpPills';

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming: boolean;
  onFollowUpSelect: (question: string) => void;
}

export default function MessageBubble({ message, isStreaming, onFollowUpSelect }: MessageBubbleProps) {
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

  const combinedText = textBlocks.map((b) => b.text).join('');
  const hasContent = combinedText.length > 0 || toolBlocks.length > 0 || followUpBlocks.length > 0;

  if (!hasContent) return null;

  return (
    <View style={styles.assistantContainer}>
      {/* Tool calls pill (shown above text, like Ellie) */}
      {toolBlocks.length > 0 && <ToolCallsPill toolBlocks={toolBlocks} />}

      {/* Text content */}
      {combinedText.length > 0 && (
        <View style={styles.assistantTextContainer}>
          <StreamingText
            text={combinedText}
            isStreaming={isStreaming}
          />
        </View>
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
    borderRadius: 18,
    borderBottomRightRadius: 4,
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
  },
  assistantTextContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
});
