import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, TouchableOpacity, Platform } from 'react-native';
import { useTheme, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Circle, Rect } from 'react-native-svg';
import { useAuth } from '@/contexts/AuthContext';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ONBOARDING_SCREENS = [
  {
    type: 'video',
    title: 'Access Pro-Level Sports Data',
    subtitle: 'We take the data that the pros use and make it accessible to you.',
    media: require('@/assets/login-background.mp4'),
  },
  {
    type: 'image',
    title: 'Live Public Betting Data',
    subtitle: 'Track where the public is leaning and make your own decisions.',
    media: null, // Placeholder
    color: '#00BFA5', // Teal
    visual: 'screen-1', 
  },
  {
    type: 'image',
    title: 'Advanced AI Models',
    subtitle: 'We run thousands of historical games through advanced models and give you the results.',
    media: null, // Placeholder
    color: '#00BFA5', // Teal
    visual: 'screen-2',
  },
  {
    type: 'image',
    title: 'Editors Analysis',
    subtitle: 'Our editors share top model finds and analysis, daily in-app.',
    media: null, // Placeholder
    color: '#00BFA5', // Teal
    visual: 'screen-3',
  },
  {
    type: 'image',
    title: 'Exclusive Discord Community',
    subtitle: 'Gain access to a private chat with other data driven bettors.',
    media: null, // Placeholder
    color: '#00BFA5', // Teal
    visual: 'screen-4',
  },
  {
    type: 'video',
    title: 'Get Started',
    subtitle: 'Join today. Money-back guarantee. Cancel at any time.',
    media: require('@/assets/login-background.mp4'),
  },
];

const SCREEN_DURATION = 5000;

// --- Widget Components ---

const LineMoveCard = () => (
  <View style={styles.widgetCardContainer}>
    <View style={styles.widgetHeaderRow}>
      <Text style={styles.widgetTitle}>Line movement and public bet %</Text>
    </View>
    
    <View style={styles.widgetStatsRow}>
      <View style={styles.widgetStatItem}>
        <Text style={styles.widgetStatLabel}>+1.5 CIN</Text>
        <Text style={styles.widgetStatSub}>Line</Text>
      </View>
      <View style={styles.widgetStatItem}>
        <Text style={[styles.widgetStatLabel, { color: '#448AFF' }]}>69% CIN</Text>
        <Text style={styles.widgetStatSub}>Public Bet %</Text>
      </View>
      <View style={styles.widgetStatItem}>
        <Text style={[styles.widgetStatLabel, { color: '#00BFA5' }]}>49% CIN</Text>
        <Text style={styles.widgetStatSub}>Public Money %</Text>
      </View>
    </View>
    
    <View style={styles.widgetGraphContainer}>
       <View style={styles.gridLines}>
          {[1,2,3,4,5].map(i => <View key={i} style={styles.gridLine} />)}
       </View>
       <View style={{ position: 'absolute', top: '40%', left: 0, right: 0, height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} />

       {/* Svg Chart Area */}
       <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#7C4DFF" stopOpacity="0.4" />
              <Stop offset="1" stopColor="#7C4DFF" stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>

          {/* Purple Line (Area Fill) */}
          <Path
            d="M0,80 L30,80 L30,50 L60,55 L80,40 L120,45 L150,30 L180,35 L220,35 L250,50 L280,50 L280,150 L0,150 Z"
            fill="url(#purpleGradient)"
            stroke="none"
          />
          <Path
            d="M0,80 L30,80 L30,50 L60,55 L80,40 L120,45 L150,30 L180,35 L220,35 L250,50 L280,50"
            fill="none"
            stroke="#7C4DFF"
            strokeWidth="2"
            strokeOpacity="0.8"
          />

          {/* Cyan Line (Stepped) */}
          <Path
            d="M10,100 L40,100 L40,120 L80,120 L80,80 L130,80 L130,100 L170,100 L170,60 L230,60 L230,100 L280,100"
            fill="none"
            stroke="#00E5FF"
            strokeWidth="2"
          />
       </Svg>
       
       <View style={styles.axisLabelsX}>
          <Text style={styles.axisText}>Jan 23</Text>
          <Text style={styles.axisText}>Jan 25</Text>
          <Text style={styles.axisText}>Jan 27</Text>
          <Text style={styles.axisText}>Jan 28</Text>
       </View>
    </View>
  </View>
);

const StatsCard = () => (
  <View style={[styles.widgetCardContainer, { height: 260, width: 220, backgroundColor: '#000' }]}>
     <View style={styles.widgetHeaderRow}>
      <Text style={[styles.widgetTitle, { fontSize: 16 }]}>% Statistics</Text>
    </View>
    
    <View style={styles.barChartContainer}>
       <View style={styles.barGroup}>
          <Text style={styles.barLabelTop}>13</Text>
          <View style={[styles.bar, { height: 60, backgroundColor: '#FF4081' }]} />
          <Text style={styles.barLabelBottom}>12/19</Text>
       </View>
       <View style={styles.barGroup}>
          <Text style={styles.barLabelTop}>15</Text>
          <View style={[styles.bar, { height: 80, backgroundColor: '#00BFA5' }]} />
           <Text style={styles.barLabelBottom}>12/21</Text>
       </View>
       <View style={styles.barGroup}>
          <Text style={styles.barLabelTop}>26</Text>
          <View style={[styles.bar, { height: 120, backgroundColor: '#00E5FF' }]} />
           <Text style={styles.barLabelBottom}>12/23</Text>
       </View>
    </View>
  </View>
);

// --- New Widgets for Screen 2: AI Models ---
const AIModelCard = () => (
  <View style={[styles.widgetCardContainer, { width: 280, height: 220 }]}>
    <View style={styles.widgetHeaderRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <MaterialCommunityIcons name="robot" size={20} color="#00BFA5" />
        <Text style={styles.widgetTitle}>NFL Predictor v2.1</Text>
      </View>
      <View style={styles.liveBadge}>
        <Text style={styles.liveBadgeText}>LIVE</Text>
      </View>
    </View>

    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
      <View>
        <Text style={styles.widgetStatLabel}>Win Rate</Text>
        <Text style={[styles.widgetBigNumber, { color: '#00BFA5' }]}>68.4%</Text>
        <Text style={styles.widgetStatSub}>Last 50 games</Text>
      </View>
      <View>
        <Text style={styles.widgetStatLabel}>ROI</Text>
        <Text style={[styles.widgetBigNumber, { color: '#00E5FF' }]}>+12.8%</Text>
        <Text style={styles.widgetStatSub}>All time</Text>
      </View>
    </View>

    <View style={{ marginTop: 20, height: 60 }}>
      <Svg height="100%" width="100%">
        <Path
          d="M0,50 Q70,50 140,20 T280,10"
          fill="none"
          stroke="#00BFA5"
          strokeWidth="3"
        />
        <Path
          d="M0,50 Q70,50 140,20 T280,10 L280,60 L0,60 Z"
          fill="rgba(0,191,165,0.2)"
        />
      </Svg>
    </View>
  </View>
);

// --- New Widgets for Screen 3: Editors Analysis ---
const EditorPickCard = () => (
  <View style={[styles.widgetCardContainer, { width: 290, height: 180 }]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="account" size={24} color="#fff" />
      </View>
      <View style={{ marginLeft: 12 }}>
        <Text style={styles.widgetTitle}>Alex's Lock</Text>
        <Text style={styles.widgetStatSub}>Senior Analyst • 2h ago</Text>
      </View>
    </View>

    <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>KC Chiefs vs BAL Ravens</Text>
        <Text style={{ color: '#00BFA5', fontWeight: '700' }}>KC -3.5</Text>
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18 }}>
        Strong line movement on KC despite public money on BAL. Our model shows a 4-point edge.
      </Text>
    </View>
  </View>
);

// --- New Widgets for Screen 4: Discord Community ---
const DiscordCard = () => (
  <View style={styles.discordCard}>
    <View style={styles.discordHeader}>
      <MaterialCommunityIcons name="pound" size={20} color="#fff" />
      <Text style={styles.discordChannelName}>sharp-plays</Text>
    </View>

    <View style={styles.discordMessagesContainer}>
      <View style={styles.discordMessageRow}>
        <View style={[styles.discordAvatar, { backgroundColor: '#FF4081' }]} />
        <View style={styles.discordMessageContent}>
          <Text style={styles.discordUsername}>SharpShooter</Text>
          <Text style={styles.discordMessageText}>Hitting the over on LeBron props tonight</Text>
        </View>
      </View>

      <View style={styles.discordMessageRow}>
        <View style={[styles.discordAvatar, { backgroundColor: '#00E5FF' }]} />
        <View style={styles.discordMessageContent}>
          <Text style={styles.discordUsername}>DataDave</Text>
          <Text style={styles.discordMessageText}>Model agrees. 5 star value.</Text>
        </View>
      </View>

      <View style={[styles.discordMessageRow, { opacity: 0.5 }]}>
        <View style={[styles.discordAvatar, { backgroundColor: '#00BFA5' }]} />
        <View style={styles.discordMessageContent}>
          <Text style={styles.discordUsername}>WinBot</Text>
          <Text style={styles.discordMessageText}>New alert: Line movement detected...</Text>
        </View>
      </View>
    </View>
  </View>
);


// --- Visual Containers ---

const isAndroid = Platform.OS === 'android';

const ScreenVisuals = ({ isActive, type }: { isActive: boolean, type: string }) => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      animValue.setValue(0);
      Animated.timing(animValue, {
        toValue: 1,
        duration: SCREEN_DURATION + 500,
        useNativeDriver: true,
      }).start();
    } else {
      animValue.setValue(0);
    }
  }, [isActive, type]);

  const STATS_CARD_WIDTH = 220;
  const LINE_MOVE_CARD_WIDTH = 300;
  const statsLeft = (screenWidth - STATS_CARD_WIDTH) / 2;
  const lineLeft = (screenWidth - LINE_MOVE_CARD_WIDTH) / 2;

  if (type === 'screen-1') {
    const card1Transform = {
      transform: [
        { rotate: '-10deg' },
        { translateX: animValue.interpolate({ inputRange: [0, 1], outputRange: [-40, -70] }) },
        { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
        { scale: 0.9 }
      ]
    };
    const card2Transform = {
      transform: [
        { rotate: '5deg' },
        { translateX: animValue.interpolate({ inputRange: [0, 1], outputRange: [20, 50] }) },
        { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [10, 30] }) },
      ]
    };

    return (
      <View style={styles.visualsWrapper}>
        <Animated.View style={[styles.floatingWidgetWrapper, card2Transform, { zIndex: 2, position: 'absolute', left: lineLeft, top: 60 }]}>
           <LineMoveCard />
        </Animated.View>
        <Animated.View style={[styles.floatingWidgetWrapper, card1Transform, { zIndex: 1, position: 'absolute', left: statsLeft, top: 40 }]}>
           <StatsCard />
        </Animated.View>
      </View>
    );
  }

  if (type === 'screen-2') {
    const mainCardTransform: any = {
      transform: [
        { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [0, -15] }) },
        { scale: animValue.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }
      ],
    };
    // Only add opacity animation on iOS
    if (!isAndroid) {
      mainCardTransform.opacity = animValue.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 1] });
    }
    return (
      <View style={styles.visualsWrapper}>
        <Animated.View style={[styles.floatingWidgetWrapper, mainCardTransform]}>
          <AIModelCard />
        </Animated.View>
      </View>
    );
  }

  if (type === 'screen-3') {
    const cardTransform: any = {
      transform: [
        { rotate: animValue.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-2deg', '2deg', '-1deg'] }) },
        { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [0, -15] }) }
      ],
    };
    // Only add opacity animation on iOS
    if (!isAndroid) {
      cardTransform.opacity = animValue.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 1] });
    }
    return (
      <View style={styles.visualsWrapper}>
        <Animated.View style={[styles.floatingWidgetWrapper, cardTransform]}>
          <EditorPickCard />
        </Animated.View>
      </View>
    );
  }

  if (type === 'screen-4') {
    const cardTransform: any = {
      transform: [
        { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [30, -10] }) },
        { scale: animValue.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }
      ],
    };
    // Only add opacity animation on iOS
    if (!isAndroid) {
      cardTransform.opacity = animValue.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] });
    }
    return (
      <View style={styles.visualsWrapper}>
        <Animated.View style={[styles.floatingWidgetWrapper, cardTransform]}>
          <DiscordCard />
        </Animated.View>
      </View>
    );
  }

  // Fallback for safety
  return null;
};


interface SegmentedProgressBarProps {
  total: number;
  current: number;
  duration: number;
  onPressSegment: (index: number) => void;
  paused: boolean;
}

interface ProgressBarFillProps {
  isActive: boolean;
  isPast: boolean;
  duration: number;
  paused: boolean;
}

const SegmentedProgressBar = ({ total, current, duration, onPressSegment, paused }: SegmentedProgressBarProps) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.progressContainer, { top: insets.top + 10 }]}>
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index === current;
        const isPast = index < current;
        
        return (
          <TouchableOpacity 
            key={index} 
            style={styles.progressSegmentBackground}
            onPress={() => onPressSegment(index)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
          >
             <ProgressBarFill 
               isActive={isActive} 
               isPast={isPast} 
               duration={duration} 
               paused={paused}
               key={`progress-${index}-${isActive}`} 
             />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const ProgressBarFill = ({ isActive, isPast, duration, paused }: ProgressBarFillProps) => {
  const widthAnim = useRef(new Animated.Value(isPast ? 100 : 0)).current;

  // Handle pause/resume by stopping/starting animation
  useEffect(() => {
    if (isActive) {
      if (paused) {
        widthAnim.stopAnimation();
      } else {
        Animated.timing(widthAnim, {
          toValue: 100,
          duration: duration, 
          useNativeDriver: false,
        }).start();
      }
    } else if (isPast) {
      widthAnim.setValue(100);
    } else {
      widthAnim.setValue(0);
    }
  }, [isActive, isPast, duration, paused]);

  const widthInterpolated = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.progressSegmentFill,
        { width: widthInterpolated }
      ]}
    />
  );
};

// Animated slide content wrapper for smooth page transitions
const AnimatedSlideContent = ({
  children,
  currentIndex,
}: {
  children: React.ReactNode;
  currentIndex: number;
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const prevIndexRef = useRef(currentIndex);

  useEffect(() => {
    if (prevIndexRef.current !== currentIndex) {
      const goingForward = currentIndex > prevIndexRef.current ||
        (prevIndexRef.current === ONBOARDING_SCREENS.length - 1 && currentIndex === 0);

      // Start from off-screen in the direction we're coming from
      slideAnim.setValue(goingForward ? screenWidth * 0.3 : -screenWidth * 0.3);

      // Spring animate to center
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 12,
      }).start();

      prevIndexRef.current = currentIndex;
    }
  }, [currentIndex]);

  return (
    <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
      {children}
    </Animated.View>
  );
};

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signInWithProvider } = useAuth();
  const insets = useSafeAreaInsets();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  
  // Auto-advance with Pause support
  useEffect(() => {
    let timer: any; 

    if (!isPaused) {
      timer = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % ONBOARDING_SCREENS.length);
      }, SCREEN_DURATION);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPaused]); 

  const handleSegmentPress = (index: number) => {
    setCurrentIndex(index);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setSnackbarVisible(true);
  };

  // #region agent log
  const debugLog = (location: string, message: string, data: any = {}, hypothesisId: string = 'general') => {
    fetch('http://127.0.0.1:7243/ingest/d951aa23-37db-46ab-80d8-615d2da9aa8b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location,message,data:{...data,platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',hypothesisId})}).catch(()=>{});
  };
  // #endregion

  const handleGoogleSignIn = async () => {
    // #region agent log
    debugLog('login.tsx:handleGoogleSignIn', 'Google Sign-In button TAPPED', { loading }, 'H1');
    // #endregion
    console.log('🔐 Google Sign-In button pressed');
    try {
      setLoading(true);
      const { error } = await signInWithProvider('google');
      if (error) {
        console.error('Google sign in error:', error);
        const message = error.message || 'Google sign-in failed. Please try again.';
        showError(message);
      } else {
        console.log('Google sign in successful');
        // Navigation will be handled automatically by auth state change listener
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      const message = err?.message || 'An unexpected error occurred. Please try again.';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    console.log('🔐 Apple Sign-In button pressed');
    try {
      setLoading(true);
      const { error } = await signInWithProvider('apple');
      if (error) {
        console.error('Apple sign in error:', error);
        const message = error.message || 'Apple sign-in failed. Please try again.';
        showError(message);
      }
    } catch (err: any) {
      console.error('Apple sign in error:', err);
      const message = err?.message || 'An unexpected error occurred. Please try again.';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = () => {
    // #region agent log
    debugLog('login.tsx:handleEmailSignIn', 'Email Sign-In button TAPPED', {}, 'H1');
    // #endregion
    router.push('/(auth)/email-login');
  };

  const isIOS = Platform.OS === 'ios';

  const currentScreen = ONBOARDING_SCREENS[currentIndex];
  const isVideo = currentScreen.type === 'video';
  const isScreen1 = currentIndex === 1;

  return (
    <View 
      style={styles.container}
      onTouchStart={(e) => {
        // #region agent log
        debugLog('login.tsx:rootView', 'Root View onTouchStart (FIX: using View instead of Pressable)', { locationX: e.nativeEvent.locationX, locationY: e.nativeEvent.locationY }, 'H1');
        // #endregion
        setIsPaused(true);
      }}
      onTouchEnd={() => setIsPaused(false)}
      onTouchCancel={() => setIsPaused(false)}
    >
      <StatusBar style="light" />
      
      {/* Background Layer */}
      <View style={styles.backgroundContainer}>
        {isVideo ? (
          <Video
            source={currentScreen.media}
            style={styles.backgroundVideo}
            resizeMode={ResizeMode.COVER}
            shouldPlay={!isPaused} 
            isLooping
            isMuted
          />
        ) : (
          <View style={[styles.backgroundImagePlaceholder, { backgroundColor: currentScreen.color || '#333' }]}>
             {!currentScreen.visual && <MaterialCommunityIcons name="chart-timeline-variant" size={120} color="rgba(255,255,255,0.1)" />}
          </View>
        )}
        
        <LinearGradient
          colors={['rgba(0,191,165,0.6)', 'rgba(0,191,165,0.85)', '#00BFA5']} 
          locations={[0, 0.5, 1]}
          style={styles.gradientOverlay}
        />
        
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)', '#000000']}
          locations={[0, 0.7, 1]}
          style={styles.bottomGradient}
        />
      </View>

      {/* Progress Bar */}
      <SegmentedProgressBar 
        total={ONBOARDING_SCREENS.length} 
        current={currentIndex} 
        duration={SCREEN_DURATION} 
        onPressSegment={handleSegmentPress}
        paused={isPaused}
      />

      {/* Content Layer */}
      <View style={[styles.contentContainer, { paddingBottom: insets.bottom + 20 }]} pointerEvents="box-none">

        {/* Visuals Container */}
        <View style={styles.floatingVisualsContainer} pointerEvents="none">
          <AnimatedSlideContent currentIndex={currentIndex}>
            {/* Render custom visual if defined for the screen */}
            {currentScreen.visual ? (
               <ScreenVisuals key={`visual-${currentIndex}`} isActive={true} type={currentScreen.visual} />
            ) : (
               // Fallback for non-video screens without specific visual
               !isVideo && (
                <Animated.View style={styles.floatingCard}>
                   <View style={styles.cardHeader}>
                     <View style={styles.cardBadge}><Text style={styles.cardBadgeText}>+1.5 CIN</Text></View>
                     <Text style={styles.cardText}>69% CIN</Text>
                   </View>
                   <View style={styles.cardGraph} />
                </Animated.View>
               )
            )}
          </AnimatedSlideContent>
        </View>

        {/* Text Content */}
        <AnimatedSlideContent currentIndex={currentIndex}>
          <View style={styles.textContainer} pointerEvents="none">
            <Text style={styles.title}>{currentScreen.title}</Text>
            <Text style={styles.subtitle}>{currentScreen.subtitle}</Text>
          </View>
        </AnimatedSlideContent>

        {/* Auth Buttons - Using View instead of Pressable to not intercept child touches on Android */}
        <View style={styles.authContainer}>
          {isIOS ? (
            // iOS Layout: Apple main, Google secondary, Email icon
            <>
              {/* Main Button - Apple on iOS */}
              <TouchableOpacity 
                style={styles.mainButton}
                onPress={handleAppleSignIn}
                activeOpacity={0.8}
                disabled={loading}
              >
                <MaterialCommunityIcons 
                  name="apple" 
                  size={20} 
                  color="white" 
                  style={{ marginRight: 8 }} 
                />
                <Text style={styles.mainButtonText}>
                  Continue with Apple
                </Text>
              </TouchableOpacity>

              {/* Secondary Buttons Row */}
              <View style={styles.secondaryButtonsRow}>
                <TouchableOpacity 
                  style={styles.iconButton} 
                  onPress={handleEmailSignIn}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="email-outline" size={24} color="white" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.iconButton}
                  onPress={handleGoogleSignIn}
                  activeOpacity={0.8}
                  disabled={loading}
                >
                  <MaterialCommunityIcons 
                    name="google" 
                    size={24} 
                    color="white" 
                  />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            // Android Layout: Google main, Email button below
            <>
              {/* Main Button - Google on Android */}
              <TouchableOpacity 
                style={styles.mainButton}
                onPress={handleGoogleSignIn}
                onPressIn={() => {
                  // #region agent log
                  debugLog('login.tsx:googleButton', 'Google button onPressIn (Android)', {}, 'H1');
                  // #endregion
                }}
                activeOpacity={0.8}
                disabled={loading}
              >
                <MaterialCommunityIcons 
                  name="google" 
                  size={20} 
                  color="white" 
                  style={{ marginRight: 8 }} 
                />
                <Text style={styles.mainButtonText}>
                  Continue with Google
                </Text>
              </TouchableOpacity>

              {/* Email Button - Below Google on Android */}
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={handleEmailSignIn}
                onPressIn={() => {
                  // #region agent log
                  debugLog('login.tsx:emailButton', 'Email button onPressIn (Android)', {}, 'H1');
                  // #endregion
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons 
                  name="email-outline" 
                  size={20} 
                  color="white" 
                  style={{ marginRight: 8 }} 
                />
                <Text style={styles.secondaryButtonText}>
                  Continue with Email
                </Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.termsText}>
            By continuing, you agree to our{'\n'}
            <Text style={styles.termsLink}>Privacy Policy</Text> • <Text style={styles.termsLink}>Terms of Use</Text>
          </Text>
        </View>
      </View>

      {/* Error Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={5000}
        style={styles.snackbar}
        action={{
          label: 'Dismiss',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {errorMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundImagePlaceholder: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1, 
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%', 
    zIndex: 2,
  },
  progressContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    height: 4,
    gap: 6,
    zIndex: 10,
  },
  progressSegmentBackground: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    height: '100%',
  },
  progressSegmentFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    zIndex: 3, 
  },
  floatingVisualsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 0,
  },
  visualsWrapper: {
    width: screenWidth,
    height: 350,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingWidgetWrapper: {
    position: 'absolute',
  },
  widgetCardContainer: {
    width: 300,
    height: 220,
    backgroundColor: '#1E1E1E', // Slightly lighter than black
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  widgetHeaderRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  widgetTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.9,
  },
  widgetStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  widgetStatItem: {
    gap: 4,
  },
  widgetStatLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  widgetStatSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
  },
  widgetGraphContainer: {
    flex: 1,
    position: 'relative',
    marginTop: 8,
  },
  gridLines: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridLine: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  mockLineSegment: {
    position: 'absolute',
  },
  axisLabelsX: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    bottom: -20,
    left: 0,
    right: 0,
  },
  axisText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
  },
  barChartContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingBottom: 10,
  },
  barGroup: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 6,
  },
  bar: {
    width: 28,
    borderRadius: 6,
  },
  barLabelTop: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  barLabelBottom: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginTop: 4,
  },
  
  // New Styles for Widgets
  liveBadge: {
    backgroundColor: 'rgba(0,191,165,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  liveBadgeText: {
    color: '#00BFA5',
    fontSize: 10,
    fontWeight: 'bold',
  },
  widgetBigNumber: {
    fontSize: 24,
    fontWeight: '800',
    marginVertical: 4,
  },
  
  // Legacy Styles (Keep for other screens if needed)
  floatingCard: {
    width: screenWidth * 0.7,
    height: screenWidth * 0.7 * 0.8,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 16,
    transform: [{ rotate: '-5deg' }, { translateY: -50 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  cardBadge: {
    backgroundColor: '#00BFA5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  cardBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  cardText: {
    color: '#fff',
    fontSize: 12,
  },
  cardGraph: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  textContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    lineHeight: 48,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 32,
  },
  authContainer: {
    gap: 16,
  },
  mainButton: {
    backgroundColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  iconButton: {
    width: 80,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 24,
  },
  secondaryButton: {
    backgroundColor: '#2C2C2E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  termsText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  termsLink: {
    color: '#fff',
    fontWeight: '600',
  },

  // Discord Card Styles - Cross-platform compatible
  discordCard: {
    width: 280,
    height: 240,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  discordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5865F2',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  discordChannelName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  discordMessagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  discordMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  discordAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  discordMessageContent: {
    flex: 1,
  },
  discordUsername: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 2,
  },
  discordMessageText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    lineHeight: 16,
  },
  snackbar: {
    backgroundColor: '#ff4444',
    marginBottom: 80,
  },
});
