import React, { useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useTheme } from 'react-native-paper';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeContext } from '@/contexts/ThemeContext';
import { usePickDetailSheet } from '@/contexts/PickDetailSheetContext';
import { EditorPickCard } from '@/components/EditorPickCard';
import { TeamAvatar } from '@/components/TeamAvatar';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export function PickDetailBottomSheet() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { isOpen, selectedPick, selectedGameData, closePickDetail, bottomSheetRef } = usePickDetailSheet();

  const snapPoints = useMemo(() => ['90%', '95%'], []);

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

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      closePickDetail();
    }
  }, [closePickDetail]);

  // Open sheet when pick is selected
  useEffect(() => {
    if (isOpen && selectedPick && selectedGameData) {
      bottomSheetRef.current?.expand();
    }
  }, [isOpen, selectedPick, selectedGameData, bottomSheetRef]);

  // Get team colors for gradient header (with safe defaults)
  const awayColors = selectedGameData?.away_team_colors || { primary: '#6B7280', secondary: '#9CA3AF' };
  const homeColors = selectedGameData?.home_team_colors || { primary: '#6B7280', secondary: '#9CA3AF' };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      backgroundStyle={{
        backgroundColor: isDark ? '#121212' : '#ffffff',
      }}
      handleIndicatorStyle={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
        width: 40,
      }}
    >
      {selectedPick && selectedGameData ? (
        <BottomSheetScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 20 }
          ]}
        >
          {/* Team Gradient Header */}
          <View style={styles.headerContainer}>
          <LinearGradient
            colors={[
              `${awayColors.primary}40`,
              'transparent',
              `${homeColors.primary}40`,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerGradient}
          >
            <View style={styles.teamsRow}>
              <View style={styles.teamInfo}>
                <TeamAvatar
                  teamName={selectedGameData.away_team}
                  sport={selectedPick.game_type}
                  size={48}
                />
                <View style={[styles.teamLabel, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                  <MaterialCommunityIcons name="airplane-takeoff" size={12} color={theme.colors.onSurfaceVariant} />
                </View>
              </View>

              <View style={styles.vsContainer}>
                <View style={[styles.atBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                  <MaterialCommunityIcons name="at" size={20} color={theme.colors.onSurfaceVariant} />
                </View>
              </View>

              <View style={styles.teamInfo}>
                <TeamAvatar
                  teamName={selectedGameData.home_team}
                  sport={selectedPick.game_type}
                  size={48}
                />
                <View style={[styles.teamLabel, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                  <MaterialCommunityIcons name="home" size={12} color={theme.colors.onSurfaceVariant} />
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Close Button */}
        <Pressable
          style={[styles.closeButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
          onPress={closePickDetail}
        >
          <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
        </Pressable>

          {/* Full Editor Pick Card */}
          <View style={styles.cardContainer}>
            <EditorPickCard
              pick={selectedPick}
              gameData={selectedGameData}
            />
          </View>
        </BottomSheetScrollView>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
  },
  headerContainer: {
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  teamInfo: {
    alignItems: 'center',
  },
  teamLabel: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  vsContainer: {
    alignItems: 'center',
  },
  atBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 24,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cardContainer: {
    marginTop: 8,
  },
});
