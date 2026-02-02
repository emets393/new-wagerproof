import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { EditorPick, GameData } from '@/types/editorsPicks';
import { useThemeContext } from '@/contexts/ThemeContext';
import { TeamAvatar } from '@/components/TeamAvatar';
import { calculateUnits } from '@/utils/unitsCalculation';

interface CompactPickCardProps {
  pick: EditorPick;
  gameData: GameData;
  onPress: () => void;
}

// Get team abbreviation from full name
const getTeamAbbr = (teamName: string, sport: string): string => {
  if (!teamName) return 'TBD';
  // Common abbreviations
  const abbrevMap: Record<string, string> = {
    // NFL
    'Arizona': 'ARI', 'Atlanta': 'ATL', 'Baltimore': 'BAL', 'Buffalo': 'BUF',
    'Carolina': 'CAR', 'Chicago': 'CHI', 'Cincinnati': 'CIN', 'Cleveland': 'CLE',
    'Dallas': 'DAL', 'Denver': 'DEN', 'Detroit': 'DET', 'Green Bay': 'GB',
    'Houston': 'HOU', 'Indianapolis': 'IND', 'Jacksonville': 'JAX', 'Kansas City': 'KC',
    'Las Vegas': 'LV', 'LA Chargers': 'LAC', 'Los Angeles Chargers': 'LAC',
    'LA Rams': 'LAR', 'Los Angeles Rams': 'LAR', 'Miami': 'MIA', 'Minnesota': 'MIN',
    'New England': 'NE', 'New Orleans': 'NO', 'NY Giants': 'NYG', 'NY Jets': 'NYJ',
    'Philadelphia': 'PHI', 'Pittsburgh': 'PIT', 'San Francisco': 'SF',
    'Seattle': 'SEA', 'Tampa Bay': 'TB', 'Tennessee': 'TEN', 'Washington': 'WSH',
    // NBA
    'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN',
    'Charlotte Hornets': 'CHA', 'Chicago Bulls': 'CHI', 'Cleveland Cavaliers': 'CLE',
    'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN', 'Detroit Pistons': 'DET',
    'Golden State Warriors': 'GSW', 'Houston Rockets': 'HOU', 'Indiana Pacers': 'IND',
    'LA Clippers': 'LAC', 'Los Angeles Clippers': 'LAC', 'LA Lakers': 'LAL',
    'Los Angeles Lakers': 'LAL', 'Memphis Grizzlies': 'MEM', 'Miami Heat': 'MIA',
    'Milwaukee Bucks': 'MIL', 'Minnesota Timberwolves': 'MIN', 'New Orleans Pelicans': 'NOP',
    'New York Knicks': 'NYK', 'Oklahoma City Thunder': 'OKC', 'Orlando Magic': 'ORL',
    'Philadelphia 76ers': 'PHI', 'Phoenix Suns': 'PHX', 'Portland Trail Blazers': 'POR',
    'Sacramento Kings': 'SAC', 'San Antonio Spurs': 'SAS', 'Toronto Raptors': 'TOR',
    'Utah Jazz': 'UTA', 'Washington Wizards': 'WAS',
  };

  // Try exact match
  if (abbrevMap[teamName]) return abbrevMap[teamName];

  // Try partial match for NBA teams
  for (const [key, value] of Object.entries(abbrevMap)) {
    if (teamName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(teamName.toLowerCase())) {
      return value;
    }
  }

  // For college teams, use first 3-4 letters
  const words = teamName.split(' ');
  if (words.length === 1) {
    return teamName.substring(0, 3).toUpperCase();
  }
  // Use last word (usually the mascot/main name)
  return words[words.length - 1].substring(0, 4).toUpperCase();
};

// Get pick type icon
const getPickTypeIcon = (pickValue: string | null | undefined, betType: string): { name: string; color: string } => {
  const value = (pickValue || betType || '').toLowerCase();

  if (value.includes('spread')) {
    return { name: 'plus-minus-variant', color: '#3b82f6' };
  }
  if (value.includes('over') || value.includes('under') || value.includes('o/u') || value.includes('total')) {
    return { name: 'arrow-up-down', color: '#8b5cf6' };
  }
  if (value.includes('moneyline') || value.includes('ml')) {
    return { name: 'currency-usd', color: '#10b981' };
  }
  // Default
  return { name: 'basketball', color: '#f59e0b' };
};

// Get result badge config
const getResultBadge = (result: string | null | undefined): { icon: string; color: string; bgColor: string; text: string } | null => {
  switch (result) {
    case 'won':
      return { icon: 'check', color: '#ffffff', bgColor: '#22c55e', text: 'WIN' };
    case 'lost':
      return { icon: 'close', color: '#ffffff', bgColor: '#ef4444', text: 'LOSS' };
    case 'push':
      return { icon: 'minus', color: '#ffffff', bgColor: '#eab308', text: 'PUSH' };
    default:
      return null;
  }
};

// Format game time for display
const formatGameTime = (gameTime: string | undefined): string => {
  if (!gameTime) return '';
  // Remove EST/ET suffix for compact display
  return gameTime.replace(' EST', '').replace(' ET', '');
};

export function CompactPickCard({ pick, gameData, onPress }: CompactPickCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const awayAbbr = getTeamAbbr(gameData.away_team, pick.game_type);
  const homeAbbr = getTeamAbbr(gameData.home_team, pick.game_type);
  const pickIcon = getPickTypeIcon(pick.pick_value, pick.selected_bet_type);
  const resultBadge = getResultBadge(pick.result);
  const unitsCalc = calculateUnits(pick.result, pick.best_price, pick.units);

  // Determine border color based on result
  const getBorderColor = () => {
    if (pick.result === 'won') return 'rgba(34, 197, 94, 0.4)';
    if (pick.result === 'lost') return 'rgba(239, 68, 68, 0.4)';
    if (pick.result === 'push') return 'rgba(234, 179, 8, 0.4)';
    return isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
  };

  // Determine left accent color based on result
  const getAccentColor = () => {
    if (pick.result === 'won') return '#22c55e';
    if (pick.result === 'lost') return '#ef4444';
    if (pick.result === 'push') return '#eab308';
    return theme.colors.primary;
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isDark ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: getBorderColor(),
        }
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Left Accent Bar */}
      <View style={[styles.accentBar, { backgroundColor: getAccentColor() }]} />

      <View style={styles.content}>
        {/* Header Row: Teams + Time */}
        <View style={styles.headerRow}>
          <View style={styles.teamsContainer}>
            <TeamAvatar teamName={gameData.away_team} sport={pick.game_type} size={28} />
            <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]}>{awayAbbr}</Text>
            <Text style={[styles.atSymbol, { color: theme.colors.outline }]}>@</Text>
            <TeamAvatar teamName={gameData.home_team} sport={pick.game_type} size={28} />
            <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]}>{homeAbbr}</Text>
          </View>

          {gameData.game_time && (
            <View style={[styles.timeBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
                {formatGameTime(gameData.game_time)}
              </Text>
            </View>
          )}
        </View>

        {/* Pick Row: Pick Value + Units + Result */}
        <View style={styles.pickRow}>
          <View style={styles.pickInfo}>
            <MaterialCommunityIcons name={pickIcon.name as any} size={16} color={pickIcon.color} />
            <Text style={[styles.pickValue, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {pick.pick_value || pick.selected_bet_type}
            </Text>
            {pick.units && (
              <View style={styles.unitsContainer}>
                <MaterialCommunityIcons name="arrow-right" size={12} color={theme.colors.outline} />
                <Text style={[styles.unitsText, { color: theme.colors.onSurfaceVariant }]}>
                  {pick.units}u
                </Text>
              </View>
            )}
          </View>

          {/* Result Badge or Net Units */}
          {resultBadge ? (
            <View style={styles.resultContainer}>
              <Text style={[
                styles.netUnitsText,
                { color: unitsCalc.netUnits > 0 ? '#22c55e' : unitsCalc.netUnits < 0 ? '#ef4444' : theme.colors.onSurfaceVariant }
              ]}>
                {unitsCalc.netUnits > 0 ? '+' : ''}{unitsCalc.netUnits.toFixed(1)}u
              </Text>
              <View style={[styles.resultBadge, { backgroundColor: resultBadge.bgColor }]}>
                <MaterialCommunityIcons name={resultBadge.icon as any} size={10} color={resultBadge.color} />
                <Text style={styles.resultText}>{resultBadge.text}</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.pendingBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              <MaterialCommunityIcons name="clock-outline" size={12} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.pendingText, { color: theme.colors.onSurfaceVariant }]}>Pending</Text>
            </View>
          )}
        </View>

        {/* Badges Row */}
        <View style={styles.badgesRow}>
          {!pick.is_published && (
            <View style={[styles.draftBadge, { backgroundColor: 'rgba(234, 179, 8, 0.2)' }]}>
              <Text style={styles.draftText}>DRAFT</Text>
            </View>
          )}
          {pick.is_free_pick && (
            <View style={[styles.freeBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
              <Text style={styles.freeText}>FREE</Text>
            </View>
          )}
        </View>
      </View>

      {/* Chevron indicator */}
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={theme.colors.outline}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 4,
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamAbbr: {
    fontSize: 13,
    fontWeight: '700',
  },
  atSymbol: {
    fontSize: 12,
    fontWeight: '500',
    marginHorizontal: 2,
  },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  pickValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  unitsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  unitsText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  netUnitsText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  resultText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '500',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  draftBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  draftText: {
    color: '#eab308',
    fontSize: 9,
    fontWeight: '700',
  },
  freeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  freeText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '700',
  },
  chevron: {
    marginRight: 8,
  },
});
