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
import { getContrastingTextColor } from '@/utils/teamColors';

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

  // Helper to check if URI is valid
  const isValidImageUri = (uri: string | undefined | null): boolean => {
    return typeof uri === 'string' && uri.length > 0 && (uri.startsWith('http://') || uri.startsWith('https://'));
  };

  // Helper to get team initials
  const getInitials = (teamName: string): string => {
    if (!teamName) return 'TBD';
    const words = teamName.split(' ');
    if (words.length >= 2) {
      return words.slice(-1)[0].substring(0, 3).toUpperCase();
    }
    return teamName.substring(0, 3).toUpperCase();
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
              {/* Away Team */}
              <View style={styles.teamInfo}>
                <View style={[styles.logoContainer, { borderColor: awayColors.primary }]}>
                  {isValidImageUri(selectedGameData.away_logo) ? (
                    <Image
                      source={{ uri: selectedGameData.away_logo! }}
                      style={styles.teamLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <LinearGradient
                      colors={[awayColors.primary, awayColors.secondary]}
                      style={styles.initialsFallback}
                    >
                      <Text style={[styles.initialsText, { color: getContrastingTextColor(awayColors.primary, awayColors.secondary) }]}>
                        {getInitials(selectedGameData.away_team)}
                      </Text>
                    </LinearGradient>
                  )}
                </View>
                <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                  {selectedGameData.away_team}
                </Text>
                <View style={[styles.teamLabel, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                  <MaterialCommunityIcons name="airplane-takeoff" size={12} color={theme.colors.onSurfaceVariant} />
                </View>
              </View>

              <View style={styles.vsContainer}>
                <View style={[styles.atBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                  <MaterialCommunityIcons name="at" size={20} color={theme.colors.onSurfaceVariant} />
                </View>
                {/* Over/Under Badge */}
                {selectedGameData.over_line && (
                  <View style={[styles.ouBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
                    <Text style={[styles.ouText, { color: theme.colors.onSurfaceVariant }]}>
                      O/U: {selectedGameData.over_line}
                    </Text>
                  </View>
                )}
              </View>

              {/* Home Team */}
              <View style={styles.teamInfo}>
                <View style={[styles.logoContainer, { borderColor: homeColors.primary }]}>
                  {isValidImageUri(selectedGameData.home_logo) ? (
                    <Image
                      source={{ uri: selectedGameData.home_logo! }}
                      style={styles.teamLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <LinearGradient
                      colors={[homeColors.primary, homeColors.secondary]}
                      style={styles.initialsFallback}
                    >
                      <Text style={[styles.initialsText, { color: getContrastingTextColor(homeColors.primary, homeColors.secondary) }]}>
                        {getInitials(selectedGameData.home_team)}
                      </Text>
                    </LinearGradient>
                  )}
                </View>
                <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                  {selectedGameData.home_team}
                </Text>
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
    flex: 1,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  teamLogo: {
    width: 56,
    height: 56,
  },
  initialsFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 100,
  },
  teamLabel: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  vsContainer: {
    alignItems: 'center',
    gap: 8,
  },
  atBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ouBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ouText: {
    fontSize: 12,
    fontWeight: '600',
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
