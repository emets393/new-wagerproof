import React, { useState } from 'react';
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
  /** Optional direct logo URL to bypass lookup */
  logoUrl?: string | null;
}

/**
 * Reusable team avatar component that shows team logo if available,
 * falls back to gradient circle with team initials.
 */
export function TeamAvatar({ teamName, sport, size = 48, teamAbbr, logoUrl }: TeamAvatarProps) {
  const [imageError, setImageError] = useState(false);
  // Safe team name - fallback to avoid crashes
  const safeTeamName = teamName || 'Unknown';

  // Get logo URL based on sport (use provided logoUrl if available)
  const getLogoUrl = (): string => {
    // If a direct logoUrl is provided, use it
    if (logoUrl) {
      return logoUrl;
    }
    switch (sport) {
      case 'nba':
        return getNBATeamLogo(safeTeamName);
      case 'ncaab':
        return getNCAABTeamLogo(safeTeamName);
      case 'cfb':
        return getCFBTeamLogo(safeTeamName);
      case 'nfl':
        return getNFLTeamLogo(safeTeamName);
      default:
        return '';
    }
  };

  // Get team colors based on sport
  const getColors = (): { primary: string; secondary: string } => {
    switch (sport) {
      case 'nba':
        return getNBATeamColors(safeTeamName);
      case 'ncaab':
      case 'cfb':
        return getCFBTeamColors(safeTeamName);
      case 'nfl':
        return getNFLTeamColors(safeTeamName);
      default:
        return { primary: '#333333', secondary: '#666666' };
    }
  };

  // Get team initials based on sport
  const getInitials = (): string => {
    if (teamAbbr) return teamAbbr;
    switch (sport) {
      case 'nba':
        return getNBATeamInitials(safeTeamName);
      case 'ncaab':
      case 'cfb':
        return getCFBTeamInitials(safeTeamName);
      case 'nfl':
        return getTeamInitials(safeTeamName);
      default:
        return safeTeamName.substring(0, 3).toUpperCase();
    }
  };

  const resolvedLogoUrl = getLogoUrl();
  const colors = getColors();
  const initials = getInitials();

  // Calculate font size based on avatar size
  const fontSize = Math.floor(size * 0.35);

  // Render the fallback gradient circle with initials
  const renderFallback = () => (
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

  // If logo is available and hasn't errored, show it
  if (resolvedLogoUrl && !imageError) {
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
          source={{ uri: resolvedLogoUrl }}
          style={[
            styles.logo,
            {
              width: size * 0.85,
              height: size * 0.85,
            },
          ]}
          resizeMode="contain"
          onError={() => setImageError(true)}
        />
      </View>
    );
  }

  // Fallback to gradient circle with initials
  return renderFallback();
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
