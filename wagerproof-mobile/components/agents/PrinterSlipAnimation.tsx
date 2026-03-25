import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { AgentPick } from '@/types/agent';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SLIP_WIDTH = SCREEN_WIDTH * 0.88;
const SLIP_HEIGHT = SCREEN_HEIGHT * 0.55;
const SLOT_HEIGHT = 14;
const SLOT_Y = SCREEN_HEIGHT * 0.82;
const PRINT_DURATION = 5000;
const HAPTIC_INTERVAL = 80;

// ============================================================================
// PIXEL WORLD MAP — pre-baked as a single image-like layer using fewer dots
// ============================================================================

const WORLD_MAP_ROWS: { y: number; segments: [number, number][] }[] = [
  { y: 8, segments: [[35, 42], [55, 70]] },
  { y: 12, segments: [[20, 28], [34, 45], [55, 72], [85, 92]] },
  { y: 16, segments: [[18, 30], [33, 48], [54, 75], [84, 94]] },
  { y: 20, segments: [[15, 32], [33, 50], [53, 78], [83, 95]] },
  { y: 24, segments: [[12, 34], [35, 52], [55, 80], [82, 96]] },
  { y: 28, segments: [[10, 35], [36, 52], [56, 82]] },
  { y: 32, segments: [[8, 36], [38, 50], [58, 80]] },
  { y: 36, segments: [[6, 22], [24, 36], [40, 48], [60, 78]] },
  { y: 40, segments: [[5, 20], [25, 35], [42, 46], [62, 75]] },
  { y: 44, segments: [[4, 18], [27, 34], [64, 72]] },
  { y: 48, segments: [[3, 16], [28, 33], [65, 70]] },
  { y: 52, segments: [[5, 14], [30, 36], [66, 68]] },
  { y: 56, segments: [[7, 12], [32, 40]] },
  { y: 60, segments: [[8, 11], [34, 42]] },
  { y: 64, segments: [[35, 44]] },
  { y: 68, segments: [[36, 42]] },
  { y: 72, segments: [[38, 40]] },
];

// Pre-compute once at module load — bigger gap = fewer views = smoother
function buildDotPositions(width: number, height: number) {
  const gap = 8; // wider gap = fewer dots = better perf
  const positions: { x: number; y: number }[] = [];
  WORLD_MAP_ROWS.forEach((row) => {
    const y = (row.y / 100) * height;
    row.segments.forEach(([startPct, endPct]) => {
      const startX = (startPct / 100) * width;
      const endX = (endPct / 100) * width;
      for (let x = startX; x <= endX; x += gap) {
        positions.push({ x, y });
      }
    });
  });
  return positions;
}

const MAP_DOT: any = {
  position: 'absolute', width: 2.5, height: 2.5, borderRadius: 1.25,
  backgroundColor: 'rgba(255, 255, 255, 0.10)',
};

const PixelWorldMap = React.memo(function PixelWorldMap({ width, height }: { width: number; height: number }) {
  const dots = useMemo(() => {
    return buildDotPositions(width, height).map((pos, i) => (
      <View key={i} style={[MAP_DOT, { left: pos.x, top: pos.y }]} />
    ));
  }, [width, height]);
  return <View style={{ position: 'absolute', top: 0, left: 0, width, height }} removeClippedSubviews>{dots}</View>;
});

// ============================================================================
// CRIMP
// ============================================================================

const NOTCH_RADIUS = 10;
const CRIMP_TOP_Y = 0.06;
const CRIMP_BOTTOM_Y = 0.88;
const PERF_DOT_RADIUS = 1.5;
const PERF_DOT_GAP = 6;

const perfInnerWidth = SLIP_WIDTH - (NOTCH_RADIUS * 2) - 12;
const perfDotCount = Math.floor(perfInnerWidth / PERF_DOT_GAP);
const PERF_DOT: any = {
  width: PERF_DOT_RADIUS * 2, height: PERF_DOT_RADIUS * 2,
  borderRadius: PERF_DOT_RADIUS, backgroundColor: 'rgba(0, 0, 0, 0.65)',
};
const perfDots = Array.from({ length: perfDotCount }).map((_, i) => (
  <View key={i} style={PERF_DOT} />
));

const CRIMP_CIRCLE: any = {
  width: NOTCH_RADIUS * 2, height: NOTCH_RADIUS * 2,
  borderRadius: NOTCH_RADIUS, backgroundColor: 'rgba(0, 0, 0, 0.9)',
};
const CRIMP_DOTS_ROW: any = {
  flex: 1, flexDirection: 'row', alignItems: 'center',
  justifyContent: 'center', gap: PERF_DOT_GAP - PERF_DOT_RADIUS * 2,
};

const CrimpLine = React.memo(function CrimpLine({ topOffset }: { topOffset: number }) {
  return (
    <View style={{
      position: 'absolute', top: topOffset, left: -NOTCH_RADIUS, right: -NOTCH_RADIUS,
      height: NOTCH_RADIUS * 2, flexDirection: 'row', alignItems: 'center', zIndex: 10,
    }} pointerEvents="none">
      <View style={CRIMP_CIRCLE} />
      <View style={CRIMP_DOTS_ROW}>{perfDots}</View>
      <View style={CRIMP_CIRCLE} />
    </View>
  );
});

// ============================================================================
// FRONT FACE
// ============================================================================

interface FrontFaceProps {
  pickCount: number;
  agentName: string;
  agentEmoji: string;
  agentColor: string;
  sports: string[];
}

const FrontFace = React.memo(function FrontFace({
  pickCount, agentName, agentEmoji, agentColor, sports,
}: FrontFaceProps) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
  const sportsStr = sports.map(s => s.toUpperCase()).join(' · ');
  const topCrimpBottom = SLIP_HEIGHT * CRIMP_TOP_Y + NOTCH_RADIUS;
  const bottomCrimpTop = SLIP_HEIGHT * CRIMP_BOTTOM_Y;
  const contentHeight = bottomCrimpTop - topCrimpBottom;

  return (
    <View style={[cardBase, { backfaceVisibility: 'hidden' }]}>
      <LinearGradient colors={['#1a1e23', '#12161b', '#0d1015']} style={gradientFill}>
        <View style={{ flex: 1, position: 'relative' }}>
          <View style={[faceStyles.contentArea, { top: topCrimpBottom - 12, height: contentHeight - 16 }]}>
            <PixelWorldMap width={SLIP_WIDTH - 42} height={contentHeight - 16} />
            <View style={faceStyles.identityBlock}>
              <Text style={faceStyles.bigEmoji}>{agentEmoji}</Text>
              <Text style={faceStyles.bigName}>{agentName}</Text>
              <Text style={faceStyles.subtitle}>AI PICKS PACK</Text>
            </View>
            <View style={faceStyles.infoGrid}>
              <View style={faceStyles.infoCell}>
                <Text style={faceStyles.infoLabel}>Picks</Text>
                <Text style={[faceStyles.infoValue, { color: agentColor }]}>{pickCount}</Text>
              </View>
              <View style={faceStyles.infoCell}>
                <Text style={faceStyles.infoLabel}>Sports</Text>
                <Text style={faceStyles.infoValue}>{sportsStr}</Text>
              </View>
              <View style={[faceStyles.infoCell, { alignItems: 'flex-end' }]}>
                <Text style={faceStyles.infoLabel}>Date</Text>
                <Text style={faceStyles.infoValue}>{dateStr}</Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
      <CrimpLine topOffset={SLIP_HEIGHT * CRIMP_TOP_Y} />
      <CrimpLine topOffset={SLIP_HEIGHT * CRIMP_BOTTOM_Y} />
    </View>
  );
});

// ============================================================================
// BACK FACE — pre-flipped so it reads correctly when parent rotates 180°
// ============================================================================

function getBetTypeLabel(t: string) {
  return t === 'spread' ? 'SPREAD' : t === 'moneyline' ? 'ML' : t === 'total' ? 'TOTAL' : t.toUpperCase();
}

const BackFace = React.memo(function BackFace({
  picks, agentEmoji, agentName,
}: { picks: AgentPick[]; agentEmoji: string; agentName: string }) {
  return (
    <View style={[cardBase, backFaceBase]}>
      <LinearGradient colors={['#0d1015', '#12161b', '#1a1e23']} style={gradientFill}>
        <View style={backStyles.header}>
          <Text style={backStyles.emoji}>{agentEmoji}</Text>
          <Text style={backStyles.title}>{agentName}'s Picks</Text>
        </View>
        <View style={backStyles.divider} />
        <View style={backStyles.picksList}>
          {picks.slice(0, 5).map((pick) => (
            <View key={pick.id} style={backStyles.pickRow}>
              <View style={backStyles.pickLeft}>
                <Text style={backStyles.pickSport}>{pick.sport.toUpperCase()}</Text>
                <Text style={backStyles.pickMatchup} numberOfLines={1}>{pick.matchup}</Text>
              </View>
              <View style={backStyles.pickRight}>
                <Text style={backStyles.pickType}>{getBetTypeLabel(pick.bet_type)}</Text>
                <Text style={backStyles.pickSelection} numberOfLines={1}>{pick.pick_selection}</Text>
                {pick.odds && <Text style={backStyles.pickOdds}>{pick.odds}</Text>}
              </View>
            </View>
          ))}
        </View>
        {picks.length > 5 && (
          <Text style={backStyles.moreText}>+{picks.length - 5} more picks</Text>
        )}
      </LinearGradient>
    </View>
  );
});

// Shared card styles as plain objects (no StyleSheet.create overhead in hot path)
const cardBase: any = {
  width: SLIP_WIDTH, height: SLIP_HEIGHT, borderRadius: 14,
  overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
  ...Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16 },
    android: { elevation: 12 },
  }),
};
const backFaceBase: any = {
  position: 'absolute', top: 0, left: 0,
  backfaceVisibility: 'hidden',
  transform: [{ rotateY: '180deg' }], // pre-flipped so it reads right
};
const gradientFill: any = { flex: 1, padding: 20 };

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface PrinterSlipAnimationProps {
  visible: boolean;
  picks: AgentPick[];
  agentName: string;
  agentEmoji: string;
  agentColor: string;
  sports: string[];
  onComplete: () => void;
}

export function PrinterSlipAnimation({
  visible, picks, agentName, agentEmoji, agentColor, sports, onComplete,
}: PrinterSlipAnimationProps) {
  const overlayOpacity = useSharedValue(0);
  const slotOpacity = useSharedValue(0);
  const printProgress = useSharedValue(0); // 0→1 during print
  const flipRotation = useSharedValue(0); // 0→180
  const dismissY = useSharedValue(0);
  const dismissScale = useSharedValue(1);
  const hapticIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAnimatingRef = useRef(false);
  // Once print is done, remove overflow:hidden so 3D flip isn't clipped
  const [printDone, setPrintDone] = useState(false);

  const startHaptics = useCallback(() => {
    hapticIntervalRef.current = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, HAPTIC_INTERVAL);
  }, []);

  const stopHaptics = useCallback(() => {
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
  }, []);

  const handleDismiss = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const handlePrintDone = useCallback(() => {
    stopHaptics();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    isAnimatingRef.current = false;
    setPrintDone(true);
  }, [stopHaptics]);

  // Chain: print done → flip → pause → fly off → dismiss
  const startFlipSequence = useCallback(() => {
    // Flip to back
    flipRotation.value = withTiming(180, {
      duration: 800, easing: Easing.inOut(Easing.cubic),
    });

    // After flip (800ms) + view time (2s) → fly off
    const exitDelay = 800 + 2000;
    dismissScale.value = withDelay(exitDelay, withTiming(0.85, { duration: 200 }));
    dismissY.value = withDelay(exitDelay + 100, withTiming(-SCREEN_HEIGHT, {
      duration: 500, easing: Easing.in(Easing.cubic),
    }));
    overlayOpacity.value = withDelay(exitDelay + 300, withTiming(0, { duration: 300 }));
    slotOpacity.value = withDelay(exitDelay + 300, withTiming(0, { duration: 300 }));

    // Dismiss after everything is off screen
    setTimeout(handleDismiss, exitDelay + 700);
  }, [handleDismiss]);

  useEffect(() => {
    if (visible && picks.length > 0 && !isAnimatingRef.current) {
      isAnimatingRef.current = true;
      setPrintDone(false);

      overlayOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
      slotOpacity.value = withDelay(200, withTiming(1, { duration: 200 }));
      printProgress.value = withDelay(500, withTiming(1, {
        duration: PRINT_DURATION, easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }));

      setTimeout(startHaptics, 500);
      setTimeout(() => {
        handlePrintDone();
        // Small gap then start flip
        setTimeout(startFlipSequence, 600);
      }, 500 + PRINT_DURATION);
    }

    if (!visible && !isAnimatingRef.current) {
      overlayOpacity.value = 0;
      slotOpacity.value = 0;
      printProgress.value = 0;
      flipRotation.value = 0;
      dismissY.value = 0;
      dismissScale.value = 1;
      setPrintDone(false);
      stopHaptics();
    }

    return () => stopHaptics();
  }, [visible, picks]);

  // --- Animated styles (minimal, all on UI thread) ---

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value * 0.7,
  }));

  const slotStyle = useAnimatedStyle(() => ({
    opacity: slotOpacity.value,
  }));

  // Print reveal: height grows, slight perspective warp
  const printStyle = useAnimatedStyle(() => {
    const h = interpolate(printProgress.value, [0, 1], [0, SLIP_HEIGHT + 20], Extrapolation.CLAMP);
    const rx = interpolate(printProgress.value, [0, 0.3, 1], [12, 5, 0], Extrapolation.CLAMP);
    const sy = interpolate(printProgress.value, [0, 0.5, 1], [0.96, 0.98, 1], Extrapolation.CLAMP);
    return {
      height: h,
      transform: [{ perspective: 800 }, { rotateX: `${rx}deg` }, { scaleY: sy }],
    };
  });

  // Card: flips on Y, then translates off screen
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { translateY: dismissY.value },
      { scale: dismissScale.value },
      { rotateY: `${flipRotation.value}deg` },
    ],
  }));

  if (!visible) return null;

  return (
    <View style={styles.fullscreen} pointerEvents="box-none">
      <Animated.View style={[styles.overlay, overlayStyle]} />

      <View style={styles.touchLayer}>
        {/* Printer slot */}
        <Animated.View style={[styles.slotContainer, { top: SLOT_Y }, slotStyle]}>
          <LinearGradient
            colors={['#1a1a1a', '#3a3a3a', '#4a4a4a', '#3a3a3a', '#1a1a1a']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={styles.slot}
          >
            <View style={styles.slotOpening} />
          </LinearGradient>
          <View style={styles.slotShadow} />
        </Animated.View>

        {/* Slip container — overflow:hidden only during print for the reveal mask */}
        <View style={[
          styles.slipMaskContainer,
          { top: SLOT_Y - SLIP_HEIGHT - 10 },
          printDone && styles.slipMaskOpen, // remove clip after print
        ]}>
          <Animated.View style={[styles.slipAnimatedContainer, { height: SLIP_HEIGHT + 20 }, printStyle]}>
            {/* Flippable card */}
            <Animated.View style={[{ width: SLIP_WIDTH, height: SLIP_HEIGHT }, cardStyle]}>
              <FrontFace
                pickCount={picks.length}
                agentName={agentName}
                agentEmoji={agentEmoji}
                agentColor={agentColor}
                sports={sports}
              />
              <BackFace picks={picks} agentEmoji={agentEmoji} agentName={agentName} />
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  fullscreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999, elevation: 9999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  touchLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  slotContainer: {
    position: 'absolute',
    left: (SCREEN_WIDTH - SLIP_WIDTH - 20) / 2,
    width: SLIP_WIDTH + 20, height: SLOT_HEIGHT, zIndex: 10,
  },
  slot: {
    width: '100%', height: SLOT_HEIGHT, borderRadius: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  slotOpening: {
    width: SLIP_WIDTH - 8, height: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', borderRadius: 1,
  },
  slotShadow: {
    width: '90%', height: 8, alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20, marginTop: -1,
  },
  slipMaskContainer: {
    position: 'absolute',
    left: (SCREEN_WIDTH - SLIP_WIDTH) / 2,
    width: SLIP_WIDTH,
    height: SLIP_HEIGHT + 20,
    overflow: 'hidden', // clips during print reveal
    justifyContent: 'flex-end',
  },
  slipMaskOpen: {
    overflow: 'visible', // allow 3D flip to render outside bounds
  },
  slipAnimatedContainer: {
    width: SLIP_WIDTH,
    alignSelf: 'flex-end',
    transformOrigin: 'bottom center',
  },
});

const faceStyles = StyleSheet.create({
  contentArea: {
    position: 'absolute', left: 0, right: 0,
    justifyContent: 'center', zIndex: 1,
  },
  identityBlock: { alignItems: 'center', marginBottom: 28, zIndex: 2 },
  bigEmoji: { fontSize: 52, marginBottom: 8 },
  bigName: {
    fontSize: 32, fontWeight: '900', color: '#fff',
    letterSpacing: 1, textAlign: 'center',
  },
  subtitle: {
    fontSize: 10, fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.35)', letterSpacing: 4, marginTop: 6,
  },
  infoGrid: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 8, zIndex: 2,
  },
  infoCell: { flex: 1 },
  infoLabel: {
    fontSize: 11, fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.4)', marginBottom: 3,
  },
  infoValue: {
    fontSize: 16, fontWeight: '800', color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

const backStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  emoji: { fontSize: 24, marginRight: 8 },
  title: { fontSize: 18, fontWeight: '800', color: '#fff', flex: 1 },
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.12)', marginBottom: 12 },
  picksList: { gap: 8 },
  pickRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pickLeft: { flex: 1, marginRight: 8 },
  pickSport: {
    fontSize: 9, fontWeight: '700', color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 1.5, marginBottom: 2,
  },
  pickMatchup: { fontSize: 13, fontWeight: '600', color: '#fff' },
  pickRight: { alignItems: 'flex-end' },
  pickType: {
    fontSize: 9, fontWeight: '700', color: '#00E676',
    letterSpacing: 1, marginBottom: 2,
  },
  pickSelection: { fontSize: 13, fontWeight: '700', color: '#fff' },
  pickOdds: {
    fontSize: 11, color: 'rgba(255, 255, 255, 0.6)', marginTop: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  moreText: {
    fontSize: 12, color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center', marginTop: 10,
  },
});
