import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';


// ============================================================================
// Legacy emojis that were removed from the picker but may exist on saved agents.
// These are still valid — the agent card and detail pages render any emoji via
// PixelEmojiInline (which falls back to text for non-pixelated emojis).
// If a user edits an agent with one of these, it stays selected; they just
// can't pick a new one from this set.
export const LEGACY_EMOJIS = [
  '\uD83D\uDCAF', '\uD83D\uDCC8', '\uD83E\uDD21', '\uD83D\uDE08', '\uD83E\uDD78',
  '\uD83C\uDFAD', '\u270A', '\uD83E\uDD1C', '\uD83D\uDC4A', '\u270C\uFE0F',
  '\uD83E\uDD18', '\uD83D\uDC40', '\uD83C\uDFA8', '\uD83C\uDFB5', '\uD83D\uDD2C',
  '\uD83E\uDDEA', '\uD83E\uDDF2', '\uD83E\uDDE8', '\uD83E\uDDDE', '\uD83C\uDF97\uFE0F',
];

// AGENT EMOJI SET (60 emojis = 6 pages of 10)
// ============================================================================

export const AGENT_EMOJIS = [
  // Page 1 - Classic & Power
  '\uD83E\uDD16', '\uD83E\uDDE0', '\uD83C\uDFAF', '\uD83D\uDD25', '\uD83D\uDC8E', '\uD83E\uDD85', '\uD83D\uDC3A', '\uD83E\uDD81', '\u26A1', '\uD83D\uDE80',
  // Page 2 - Animals
  '\uD83D\uDC32', '\uD83E\uDD88', '\uD83D\uDC0D', '\uD83E\uDD89', '\uD83D\uDC3B', '\uD83E\uDD8D', '\uD83E\uDD8A', '\uD83D\uDC1D', '\uD83E\uDD9C', '\uD83E\uDDA2',
  // Page 3 - More Animals
  '\uD83D\uDC0E', '\uD83E\uDD84', '\uD83E\uDDAD', '\uD83D\uDC22', '\uD83E\uDD8E', '\uD83E\uDD9E', '\uD83D\uDC7B', '\uD83D\uDC80', '\uD83D\uDC7D', '\uD83E\uDDB9',
  // Page 4 - Power & Sports
  '\uD83D\uDCA5', '\uD83C\uDFC6', '\uD83D\uDC51', '\uD83C\uDF1F', '\uD83D\uDD2E', '\uD83C\uDFB0', '\uD83C\uDFB2', '\u265F\uFE0F', '\uD83C\uDFC0', '\uD83C\uDFC8',
  // Page 5 - Sports & Objects
  '\u26BD', '\u26BE', '\uD83C\uDFBE', '\uD83D\uDCA1', '\uD83D\uDCB0', '\uD83D\uDCB8', '\uD83D\uDEE1\uFE0F', '\uD83D\uDD11', '\uD83C\uDFF9', '\uD83D\uDCAA',
  // Page 6 - Nature & Misc
  '\uD83C\uDF0A', '\uD83C\uDF0B', '\uD83C\uDF29\uFE0F', '\u2744\uFE0F', '\u2604\uFE0F', '\uD83C\uDF1E', '\uD83C\uDF19', '\uD83C\uDF0C', '\uD83E\uDDCA', '\uD83C\uDF86',
];

// ============================================================================
// TYPES
// ============================================================================

interface SwipeableEmojiPickerProps {
  selectedEmoji: string;
  selectedColor: string;
  onEmojiSelect: (emoji: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const EMOJIS_PER_PAGE = 10; // 2 rows x 5 columns
const PAGE_COUNT = Math.ceil(AGENT_EMOJIS.length / EMOJIS_PER_PAGE);

export function SwipeableEmojiPicker({
  selectedEmoji,
  selectedColor,
  onEmojiSelect,
}: SwipeableEmojiPickerProps) {
  const { isDark } = useThemeContext();
  const scrollRef = useRef<ScrollView>(null);
  const [activePage, setActivePage] = React.useState(() => {
    const idx = AGENT_EMOJIS.indexOf(selectedEmoji);
    return idx >= 0 ? Math.floor(idx / EMOJIS_PER_PAGE) : 0;
  });

  const containerWidth = Dimensions.get('window').width - 72; // account for padding

  const handleScroll = useCallback(
    (event: any) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const page = Math.round(offsetX / containerWidth);
      if (page !== activePage && page >= 0 && page < PAGE_COUNT) {
        setActivePage(page);
      }
    },
    [activePage, containerWidth]
  );

  const handleEmojiPress = useCallback(
    (emoji: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onEmojiSelect(emoji);
    },
    [onEmojiSelect]
  );

  const pages = [];
  for (let i = 0; i < PAGE_COUNT; i++) {
    const pageEmojis = AGENT_EMOJIS.slice(
      i * EMOJIS_PER_PAGE,
      (i + 1) * EMOJIS_PER_PAGE
    );
    const row1 = pageEmojis.slice(0, 5);
    const row2 = pageEmojis.slice(5, 10);
    pages.push({ row1, row2 });
  }

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        contentContainerStyle={{ width: containerWidth * PAGE_COUNT }}
      >
        {pages.map((page, pageIndex) => (
          <View key={pageIndex} style={[styles.page, { width: containerWidth }]}>
            <View style={styles.emojiRow}>
              {page.row1.map((emoji, idx) => {
                const isSelected = selectedEmoji === emoji;
                return (
                  <TouchableOpacity
                    key={`${pageIndex}-r1-${idx}`}
                    style={[
                      styles.emojiButton,
                      {
                        backgroundColor: isSelected
                          ? `${selectedColor}30`
                          : isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(0, 0, 0, 0.03)',
                        borderColor: isSelected
                          ? selectedColor
                          : isDark
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(0, 0, 0, 0.05)',
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                    onPress={() => handleEmojiPress(emoji)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.emojiRow}>
              {page.row2.map((emoji, idx) => {
                const isSelected = selectedEmoji === emoji;
                return (
                  <TouchableOpacity
                    key={`${pageIndex}-r2-${idx}`}
                    style={[
                      styles.emojiButton,
                      {
                        backgroundColor: isSelected
                          ? `${selectedColor}30`
                          : isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(0, 0, 0, 0.03)',
                        borderColor: isSelected
                          ? selectedColor
                          : isDark
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(0, 0, 0, 0.05)',
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                    onPress={() => handleEmojiPress(emoji)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Page dots */}
      <View style={styles.dotsContainer}>
        {Array.from({ length: PAGE_COUNT }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i === activePage
                    ? selectedColor
                    : isDark
                    ? 'rgba(255, 255, 255, 0.2)'
                    : 'rgba(0, 0, 0, 0.15)',
              },
              i === activePage && styles.dotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  page: {
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 4,
  },
  emojiButton: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 22,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
