import React, { useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, Pressable, Image, Text } from 'react-native';
import { useTheme } from 'react-native-paper';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeContext } from '@/contexts/ThemeContext';
import { usePickDetailSheet } from '@/contexts/PickDetailSheetContext';
import { EditorPickCard } from '@/components/EditorPickCard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getContrastingTextColor, getTeamInitials, getCFBTeamInitials, getNBATeamInitials, getNCAABTeamInitials } from '@/utils/teamColors';

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

  // Helper to validate image URI
  const isValidImageUri = (uri: string | null | undefined): boolean => {
    if (!uri || typeof uri !== 'string') return false;
    const trimmed = uri.trim();
    if (trimmed === '') return false;
    return trimmed.startsWith('http://') || trimmed.startsWith('https://');
  };

  // Get team initials based on game type
  const getInitials = (teamName: string, gameType: string) => {
    switch (gameType) {
      case 'nfl':
        return getTeamInitials(teamName);
      case 'cfb':
        return getCFBTeamInitials(teamName);
      case 'nba':
        return getNBATeamInitials(teamName);
      case 'ncaab':
        return getNCAABTeamInitials(teamName);
      default:
        return getTeamInitials(teamName);
    }
  };

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
                <View style={[styles.logoContainer, { borderColor: awayColors.primary }]}>
                  {isValidImageUri(selectedGameData.away_logo) ? (
                    <Image
                      source={{ uri: selectedGameData.away_logo! }}
                      style={styles.teamLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={[styles.initialsFallback, { backgroundColor: awayColors.primary }]}>
                      <Text style={[styles.initialsText, { color: getContrastingTextColor(awayColors.primary, awayColors.secondary) }]}>
                        {getInitials(selectedGameData.away_team, selectedPick.game_type)}
                      </Text>
                    </View>
                  )}
                </View>
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
                <View style={[styles.logoContainer, { borderColor: homeColors.primary }]}>
                  {isValidImageUri(selectedGameData.home_logo) ? (
                    <Image
                      source={{ uri: selectedGameData.home_logo! }}
                      style={styles.teamLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={[styles.initialsFallback, { backgroundColor: homeColors.primary }]}>
                      <Text style={[styles.initialsText, { color: getContrastingTextColor(homeColors.primary, homeColors.secondary) }]}>
                        {getInitials(selectedGameData.home_team, selectedPick.game_type)}
                      </Text>
                    </View>
                  )}
                </View>
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
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  teamLogo: {
    width: 38,
    height: 38,
  },
  initialsFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 16,
    fontWeight: 'bold',
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
