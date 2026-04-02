import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';
import { getNFLTeamColors, getNBATeamColors, getCFBTeamColors } from '@/utils/teamColors';
import { getMLBTeamColors } from '@/constants/mlbTeams';
import { TeamAvatar, SportType } from '@/components/TeamAvatar';

const CARD_SIZE = 160;
const LOGO_SIZE = 64;
const VS_CIRCLE_SIZE = 34;
// Logo bg includes padding around the TeamAvatar
const LOGO_BG_SIZE = LOGO_SIZE + 10;

interface OutlierMatchupCardProps {
  awayTeam: string;
  homeTeam: string;
  sport: SportType;
  awayTeamLogo?: string | null;
  homeTeamLogo?: string | null;
  /** Override gradient colors when name-based lookup doesn't match (e.g. MLB with short names) */
  awayColor?: string;
  homeColor?: string;
  /** Icon name from MaterialCommunityIcons shown next to the pick label */
  pickIcon?: string;
  /** Primary pick label (e.g. "Over 220.5", "Lakers ML") */
  pickLabel: string;
  /** Secondary value (e.g. "67%", "FADE") */
  pickValue?: string;
  /** Accent color for the pick value text */
  accentColor?: string;
  onPress?: () => void;
}

function getTeamColors(teamName: string, sport: SportType): { primary: string; secondary: string } {
  switch (sport) {
    case 'nfl': return getNFLTeamColors(teamName);
    case 'nba': return getNBATeamColors(teamName);
    case 'cfb':
    case 'ncaab': return getCFBTeamColors(teamName);
    case 'mlb': return getMLBTeamColors(teamName);
    default: return { primary: '#6B7280', secondary: '#9CA3AF' };
  }
}

export function OutlierMatchupCard({
  awayTeam,
  homeTeam,
  sport,
  awayTeamLogo,
  homeTeamLogo,
  awayColor,
  homeColor,
  pickIcon,
  pickLabel,
  pickValue,
  accentColor = '#00E676',
  onPress,
}: OutlierMatchupCardProps) {
  const { isDark } = useThemeContext();
  const awayColorsLookup = getTeamColors(awayTeam, sport);
  const homeColorsLookup = getTeamColors(homeTeam, sport);
  // Use explicit overrides when provided (for MLB where DB names may not match color lookup)
  const awayColors = { ...awayColorsLookup, primary: awayColor || awayColorsLookup.primary };
  const homeColors = { ...homeColorsLookup, primary: homeColor || homeColorsLookup.primary };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.cardWrapper}
    >
      {/* Square gradient card */}
      <View style={styles.card}>
        <LinearGradient
          // Diagonal gradient: away team color top-left → home team color bottom-right
          colors={[awayColors.primary, homeColors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Away team logo — top-left */}
          <View style={[styles.logoContainer, styles.awayLogo]}>
            <View style={[styles.logoBg, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <TeamAvatar
                teamName={awayTeam}
                sport={sport}
                size={LOGO_SIZE}
                logoUrl={awayTeamLogo}
              />
            </View>
          </View>

          {/* Home team logo — bottom-right */}
          <View style={[styles.logoContainer, styles.homeLogo]}>
            <View style={[styles.logoBg, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <TeamAvatar
                teamName={homeTeam}
                sport={sport}
                size={LOGO_SIZE}
                logoUrl={homeTeamLogo}
              />
            </View>
          </View>

          {/* VS circle — centered, on top of both logos */}
          <View style={styles.vsContainer}>
            <View style={[styles.vsCircle, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
              <Text style={[styles.vsText, { color: isDark ? '#ffffff' : '#000000' }]}>VS</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Subtext: pick icon + label + value */}
      <View style={styles.subtextRow}>
        {pickIcon && (
          <MaterialCommunityIcons
            name={pickIcon as any}
            size={14}
            color={accentColor}
            style={styles.pickIconStyle}
          />
        )}
        <Text
          style={[styles.pickLabel, { color: isDark ? '#e0e0e0' : '#333' }]}
          numberOfLines={1}
        >
          {pickLabel}
        </Text>
      </View>
      {pickValue && (
        <Text style={[styles.pickValueText, { color: accentColor }]} numberOfLines={1}>
          {pickValue}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    width: CARD_SIZE,
    marginRight: 12,
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    position: 'relative',
  },
  logoContainer: {
    position: 'absolute',
  },
  awayLogo: {
    // Positioned so the logo circle nestles behind the VS circle
    top: (CARD_SIZE / 2) - LOGO_BG_SIZE + 6,
    left: (CARD_SIZE / 2) - LOGO_BG_SIZE + 6,
  },
  homeLogo: {
    bottom: (CARD_SIZE / 2) - LOGO_BG_SIZE + 6,
    right: (CARD_SIZE / 2) - LOGO_BG_SIZE + 6,
  },
  logoBg: {
    width: LOGO_BG_SIZE,
    height: LOGO_BG_SIZE,
    borderRadius: LOGO_BG_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    // Ensure VS is above both logos
    zIndex: 10,
  },
  vsCircle: {
    width: VS_CIRCLE_SIZE,
    height: VS_CIRCLE_SIZE,
    borderRadius: VS_CIRCLE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  vsText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingRight: 4,
  },
  pickIconStyle: {
    marginRight: 4,
  },
  pickLabel: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  pickValueText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
});
