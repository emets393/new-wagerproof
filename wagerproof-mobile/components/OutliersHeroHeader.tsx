import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';

/**
 * Full-width glassmorphic hero banner for the Outliers tab.
 * Breaks out of parent paddingHorizontal to sit edge-to-edge.
 */
export function OutliersHeroHeader() {
  const { isDark } = useThemeContext();

  const textColor = isDark ? '#ffffff' : '#111111';
  const mutedColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const borderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.6)';
  // Android fallback when blur isn't supported
  const fallbackBg = isDark ? 'rgba(20, 20, 30, 0.85)' : 'rgba(255, 255, 255, 0.75)';

  const content = (
    <>
      {/* Subtle gradient glow behind the glass */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(0, 230, 118, 0.08)', 'rgba(0, 176, 255, 0.06)', 'rgba(124, 77, 255, 0.08)']
            : ['rgba(0, 230, 118, 0.12)', 'rgba(0, 176, 255, 0.08)', 'rgba(124, 77, 255, 0.10)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top accent stripe */}
      <LinearGradient
        colors={['#00E676', '#00B0FF', '#7C4DFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accentBar}
      />

      <View style={styles.innerContent}>
        <Text style={[styles.headline, { color: textColor }]}>
          Spot the setup before the outcome.
        </Text>
        <Text style={[styles.subheadline, { color: mutedColor }]}>
          We scan every game across every sport for statistical outliers — the rare conditions that historically lead to profitable betting opportunities. When the data lines up like this, you want to know about it.
        </Text>

        {/* Visual: 3-step flow */}
        <View style={[styles.flowContainer, { borderTopColor: dividerColor }]}>
          <View style={styles.flowStep}>
            <View style={[styles.flowIconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
              <MaterialCommunityIcons name="radar" size={20} color="#22c55e" />
            </View>
            <Text style={[styles.flowStepTitle, { color: textColor }]}>We Scan</Text>
            <Text style={[styles.flowStepDesc, { color: mutedColor }]}>
              Every line, trend, and model signal across 5 sports
            </Text>
          </View>

          <View style={styles.flowArrow}>
            <MaterialCommunityIcons name="chevron-right" size={16} color={mutedColor} />
          </View>

          <View style={styles.flowStep}>
            <View style={[styles.flowIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <MaterialCommunityIcons name="chart-bell-curve-cumulative" size={20} color="#f59e0b" />
            </View>
            <Text style={[styles.flowStepTitle, { color: textColor }]}>We Flag</Text>
            <Text style={[styles.flowStepDesc, { color: mutedColor }]}>
              Rare setups where history says the edge is real
            </Text>
          </View>

          <View style={styles.flowArrow}>
            <MaterialCommunityIcons name="chevron-right" size={16} color={mutedColor} />
          </View>

          <View style={styles.flowStep}>
            <View style={[styles.flowIconCircle, { backgroundColor: 'rgba(124, 77, 255, 0.15)' }]}>
              <MaterialCommunityIcons name="target" size={20} color="#7C4DFF" />
            </View>
            <Text style={[styles.flowStepTitle, { color: textColor }]}>You Act</Text>
            <Text style={[styles.flowStepDesc, { color: mutedColor }]}>
              Get the alert before the line moves
            </Text>
          </View>
        </View>
      </View>
    </>
  );

  return (
    <View style={[styles.wrapper, { borderColor }]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={40}
          tint={isDark ? 'dark' : 'light'}
          style={styles.blurFill}
        >
          {content}
        </BlurView>
      ) : (
        // Android fallback — semi-transparent bg instead of blur
        <View style={[styles.blurFill, { backgroundColor: fallbackBg }]}>
          {content}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // Break out of parent's 16px paddingHorizontal to sit nearly edge-to-edge
    marginHorizontal: -12,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  blurFill: {
    overflow: 'hidden',
  },
  accentBar: {
    height: 3,
  },
  innerContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 18,
  },
  headline: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  flowContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    paddingTop: 16,
  },
  flowStep: {
    flex: 1,
    alignItems: 'center',
  },
  flowIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  flowStepTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  flowStepDesc: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  flowArrow: {
    paddingTop: 10,
    paddingHorizontal: 2,
  },
});
