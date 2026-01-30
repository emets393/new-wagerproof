import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getNBATeamColors,
  getNBATeamInitials,
  getNBATeamLogo,
  getCFBTeamColors,
  getCFBTeamInitials,
  getCFBTeamLogo,
  getNCAABTeamLogo,
  getNFLTeamColors,
  getTeamInitials,
  getNFLTeamLogo,
  getContrastingTextColor,
} from '@/utils/teamColors';

export type SportType = 'nba' | 'ncaab' | 'cfb' | 'nfl';

interface TeamAvatarProps {
  teamName: string;
  sport: SportType;
  size?: number;
  /** Optional team abbreviation to use instead of computed initials */
  teamAbbr?: string;
}

/**
 * Reusable team avatar component that shows team logo if available,
 * falls back to gradient circle with team initials.
 */
export function TeamAvatar({ teamName, sport, size = 48, teamAbbr }: TeamAvatarProps) {
  // Get logo URL based on sport
  const getLogoUrl = (): string => {
    switch (sport) {
      case 'nba':
        return getNBATeamLogo(teamName);
      case 'ncaab':
        return getNCAABTeamLogo(teamName);
      case 'cfb':
        return getCFBTeamLogo(teamName);
      case 'nfl':
        return getNFLTeamLogo(teamName);
      default:
        return '';
    }
  };

  // Get team colors based on sport
  const getColors = (): { primary: string; secondary: string } => {
    switch (sport) {
      case 'nba':
        return getNBATeamColors(teamName);
      case 'ncaab':
      case 'cfb':
        return getCFBTeamColors(teamName);
      case 'nfl':
        return getNFLTeamColors(teamName);
      default:
        return { primary: '#333333', secondary: '#666666' };
    }
  };

  // Get team initials based on sport
  const getInitials = (): string => {
    if (teamAbbr) return teamAbbr;
    switch (sport) {
      case 'nba':
        return getNBATeamInitials(teamName);
      case 'ncaab':
      case 'cfb':
        return getCFBTeamInitials(teamName);
      case 'nfl':
        return getTeamInitials(teamName);
      default:
        return teamName.substring(0, 3).toUpperCase();
    }
  };

  const logoUrl = getLogoUrl();
  const colors = getColors();
  const initials = getInitials();

  // Calculate font size based on avatar size
  const fontSize = Math.floor(size * 0.35);

  // If logo is available, show it
  if (logoUrl) {
    return (
      <View
        style={[
          styles.logoContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        <Image
          source={{ uri: logoUrl }}
          style={[
            styles.logo,
            {
              width: size * 0.85,
              height: size * 0.85,
            },
          ]}
          resizeMode="contain"
        />
      </View>
    );
  }

  // Fallback to gradient circle with initials
  return (
    <LinearGradient
      colors={[colors.primary, colors.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.gradientCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text
        style={[
          styles.initials,
          {
            fontSize,
            color: getContrastingTextColor(colors.primary, colors.secondary),
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {initials}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logo: {
    // Image styles handled by inline
  },
  gradientCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
