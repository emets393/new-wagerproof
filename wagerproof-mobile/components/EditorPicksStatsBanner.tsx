import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useTheme, Portal, Dialog, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HORIZONTAL_PADDING = 16;
const CARD_GAP = 12;
const CARD_WIDTH = SCREEN_WIDTH - (HORIZONTAL_PADDING * 2);

export function EditorPicksStatsBanner() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleEditorPicksPress = () => {
    router.push('/editor-picks-stats');
  };

  const handleModelHistoryPress = () => {
    setShowComingSoon(true);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + CARD_GAP));
    setActiveIndex(index);
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="center"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Editor's Picks Card */}
        <TouchableOpacity onPress={handleEditorPicksPress} activeOpacity={0.8}>
          <LinearGradient
            colors={isDark
              ? ['rgba(30, 64, 175, 0.25)', 'rgba(6, 95, 70, 0.2)']
              : ['rgba(239, 246, 255, 1)', 'rgba(236, 253, 245, 1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.container,
              { borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(191, 219, 254, 1)' }
            ]}
          >
            <View style={styles.leftSection}>
              <View style={[styles.avatarContainer, { borderColor: isDark ? '#3b82f6' : '#2563eb' }]}>
                <Image
                  source={require('@/assets/editor-avatar.png')}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.labelContainer}>
                <Text style={[styles.editorLabel, { color: isDark ? '#93c5fd' : '#1e40af' }]}>
                  Editor's Picks
                </Text>
                <Text style={[styles.viewStats, { color: theme.colors.onSurfaceVariant }]}>
                  View Stats
                </Text>
              </View>
            </View>

            <View style={styles.rightSection}>
              <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
                Follow the creator's{'\n'}personal picks
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={theme.colors.onSurfaceVariant}
                style={styles.chevron}
              />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Model History Card */}
        <TouchableOpacity onPress={handleModelHistoryPress} activeOpacity={0.8}>
          <LinearGradient
            colors={isDark
              ? ['rgba(124, 58, 237, 0.25)', 'rgba(219, 39, 119, 0.2)']
              : ['rgba(245, 243, 255, 1)', 'rgba(253, 242, 248, 1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.container,
              { borderColor: isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(221, 214, 254, 1)' }
            ]}
          >
            <View style={styles.leftSection}>
              <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)', borderColor: isDark ? '#8b5cf6' : '#7c3aed' }]}>
                <MaterialCommunityIcons
                  name="chart-line"
                  size={28}
                  color={isDark ? '#a78bfa' : '#7c3aed'}
                />
              </View>
              <View style={styles.labelContainer}>
                <Text style={[styles.editorLabel, { color: isDark ? '#c4b5fd' : '#5b21b6' }]}>
                  Model History
                </Text>
                <Text style={[styles.viewStats, { color: theme.colors.onSurfaceVariant }]}>
                  View Stats
                </Text>
              </View>
            </View>

            <View style={styles.rightSection}>
              <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
                Statistical performance{'\n'}of the underlying ML model
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={theme.colors.onSurfaceVariant}
                style={styles.chevron}
              />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Pagination Dots */}
      <View style={styles.pagination}>
        <View style={[styles.dot, activeIndex === 0 && styles.activeDot, { backgroundColor: activeIndex === 0 ? (isDark ? '#3b82f6' : '#2563eb') : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)') }]} />
        <View style={[styles.dot, activeIndex === 1 && styles.activeDot, { backgroundColor: activeIndex === 1 ? (isDark ? '#8b5cf6' : '#7c3aed') : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)') }]} />
      </View>

      {/* Coming Soon Dialog */}
      <Portal>
        <Dialog visible={showComingSoon} onDismiss={() => setShowComingSoon(false)} style={{ backgroundColor: theme.colors.surface }}>
          <Dialog.Icon icon="chart-line" />
          <Dialog.Title style={{ textAlign: 'center' }}>Coming Soon</Dialog.Title>
          <Dialog.Content>
            <Text style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant }}>
              Model History statistics are currently in development. Check back soon to see the performance of our ML predictions!
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowComingSoon(false)}>Got it</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 20,
    marginBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    gap: CARD_GAP,
  },
  container: {
    width: CARD_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  labelContainer: {
    gap: 2,
  },
  editorLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  viewStats: {
    fontSize: 12,
    fontWeight: '500',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  description: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
    lineHeight: 16,
  },
  chevron: {
    marginLeft: 4,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
