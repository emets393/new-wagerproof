import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { StyleSheet, Dimensions, FlatList, View, Text, TouchableOpacity, Platform } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useLearnWagerProof, TOTAL_SLIDES } from '@/contexts/LearnWagerProofContext';
import { LearnSlide } from './LearnSlide';
import {
  Slide1_GameCards,
  Slide2_GameDetails,
  Slide3_WagerBot,
  Slide4_EditorPicks,
  Slide5_Outliers,
  Slide6_MoreFeatures,
} from './slides';

const WAGERPROOF_GREEN = '#00E676';
const isIOS = Platform.OS === 'ios';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Custom blur background for iOS only
const BlurredBackground = ({ style, isDark }: BottomSheetBackgroundProps & { isDark: boolean }) => {
  if (!isIOS) {
    return (
      <View
        style={[
          style,
          {
            backgroundColor: isDark ? '#121212' : '#ffffff',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          },
        ]}
      />
    );
  }

  return (
    <BlurView
      intensity={isDark ? 80 : 90}
      tint={isDark ? 'dark' : 'light'}
      style={[
        style,
        {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          overflow: 'hidden',
        },
      ]}
    />
  );
};

// Slide configuration
const SLIDES = [
  {
    icon: 'cards',
    title: 'Game Predictions',
    description: 'Our AI model analyzes thousands of data points. Green confidence = strong pick.',
    valueProposition: 'Stop guessing. Our models process historical data, player stats, and situational factors to give you an edge over the average bettor. Higher confidence means higher historical accuracy.',
    Component: Slide1_GameCards,
  },
  {
    icon: 'chart-box',
    title: 'Game Details',
    description: 'Tap any game card to reveal full betting analysis and public betting sentiment.',
    valueProposition: 'See where the smart money is going. When our model disagrees with Vegas, that\'s where value lives. Public betting percentages help you fade the crowd when they\'re wrong.',
    Component: Slide2_GameDetails,
  },
  {
    icon: 'robot',
    title: 'WagerBot Assistant',
    description: 'WagerBot automatically surfaces insights as you browse.',
    valueProposition: 'Never miss a key insight. WagerBot watches for trends, streaks, and situational edges so you don\'t have to dig through stats yourself. It\'s like having a research assistant in your pocket.',
    Component: Slide3_WagerBot,
  },
  {
    icon: 'star',
    title: 'Editor Picks',
    description: "Follow our editor's expert picks with full transparency on results.",
    valueProposition: 'Follow proven track records, not empty promises. Every pick is recorded with full transparency—wins, losses, and units. You\'ll always know exactly how our editors are performing.',
    Component: Slide4_EditorPicks,
  },
  {
    icon: 'trending-up',
    title: 'Outliers & Alerts',
    description: 'Find value where prediction markets disagree with Vegas, or when model overconfidence signals a fade.',
    valueProposition: 'Exploit market inefficiencies. When Polymarket odds differ significantly from Vegas, or when our model shows extreme confidence, these are historically profitable opportunities.',
    Component: Slide5_Outliers,
  },
  {
    icon: 'apps',
    title: 'More Features',
    description: 'Explore all these features to maximize your betting edge.',
    Component: Slide6_MoreFeatures,
  },
];

export function LearnWagerProofBottomSheet() {
  const { isDark } = useThemeContext();
  const flatListRef = useRef<FlatList>(null);

  const {
    isOpen,
    currentSlide,
    closeLearnSheet,
    goToSlide,
    markAsSeen,
    bottomSheetRef,
  } = useLearnWagerProof();

  const snapPoints = useMemo(() => ['90%'], []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    []
  );

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        closeLearnSheet();
      }
    },
    [closeLearnSheet]
  );

  // Open sheet when isOpen becomes true
  useEffect(() => {
    if (isOpen) {
      bottomSheetRef.current?.snapToIndex(0);
    }
  }, [isOpen, bottomSheetRef]);

  const handleMomentumScrollEnd = useCallback(
    (event: any) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const newIndex = Math.round(offsetX / SCREEN_WIDTH);
      if (newIndex !== currentSlide && newIndex >= 0 && newIndex < SLIDES.length) {
        goToSlide(newIndex);
      }
    },
    [currentSlide, goToSlide]
  );

  const handleNext = useCallback(async () => {
    const isLastSlide = currentSlide === TOTAL_SLIDES - 1;
    if (isLastSlide) {
      await markAsSeen();
      closeLearnSheet();
    } else {
      const nextIndex = currentSlide + 1;
      goToSlide(nextIndex);
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }
  }, [currentSlide, goToSlide, markAsSeen, closeLearnSheet]);

  const handleClose = useCallback(async () => {
    await markAsSeen();
    closeLearnSheet();
  }, [markAsSeen, closeLearnSheet]);

  const handleDotPress = useCallback(
    (index: number) => {
      goToSlide(index);
      flatListRef.current?.scrollToIndex({ index, animated: true });
    },
    [goToSlide]
  );

  const isLastSlide = currentSlide === TOTAL_SLIDES - 1;

  const renderSlide = useCallback(
    ({ item }: { item: typeof SLIDES[number] }) => {
      const { icon, title, description, valueProposition, Component } = item;
      return (
        <LearnSlide
          icon={icon}
          title={title}
          description={description}
          valueProposition={valueProposition}
        >
          <Component />
        </LearnSlide>
      );
    },
    []
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    []
  );

  const renderBackground = useCallback(
    (props: BottomSheetBackgroundProps) => <BlurredBackground {...props} isDark={isDark} />,
    [isDark]
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      backgroundComponent={renderBackground}
      enablePanDownToClose
      keyboardBehavior="interactive"
      bottomInset={0}
      handleIndicatorStyle={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
        width: 40,
      }}
    >
      <BottomSheetView style={styles.container}>
        {/* Fixed Header */}
        <View style={styles.header}>
          {/* Close Button */}
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons
              name="close"
              size={20}
              color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'}
            />
          </TouchableOpacity>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            {Array.from({ length: TOTAL_SLIDES }).map((_, index) => {
              const isActive = index === currentSlide;
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleDotPress(index)}
                  hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                >
                  <View
                    style={[
                      styles.dot,
                      {
                        width: isActive ? 8 : 6,
                        height: isActive ? 8 : 6,
                        backgroundColor: isActive
                          ? WAGERPROOF_GREEN
                          : isDark
                            ? 'rgba(255, 255, 255, 0.3)'
                            : 'rgba(0, 0, 0, 0.2)',
                      },
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Next Button */}
          <TouchableOpacity
            onPress={handleNext}
            style={styles.nextButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.nextButtonText, { color: WAGERPROOF_GREEN }]}>
              {isLastSlide ? 'Done' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={flatListRef}
          data={SLIDES}
          renderItem={renderSlide}
          keyExtractor={(_, index) => `slide-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          getItemLayout={getItemLayout}
          initialScrollIndex={0}
          scrollEventThrottle={16}
          style={styles.flatList}
          contentContainerStyle={styles.flatListContent}
        />
      </BottomSheetView>
    </BottomSheet>
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
    paddingVertical: 6,
  },
  closeButton: {
    width: 40,
    alignItems: 'flex-start',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dot: {
    borderRadius: 4,
  },
  nextButton: {
    width: 40,
    alignItems: 'flex-end',
  },
  nextButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  flatList: {
    flex: 1,
  },
  flatListContent: {
    flexGrow: 1,
  },
});
