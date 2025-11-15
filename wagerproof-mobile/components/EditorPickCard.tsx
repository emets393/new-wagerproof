import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { EditorPick, GameData } from '@/types/editorsPicks';
import { useThemeContext } from '@/contexts/ThemeContext';
import { getBettingColors } from '@/constants/theme';
import { getTeamInitials, getCFBTeamInitials, getNBATeamInitials, getNCAABTeamInitials, getContrastingTextColor } from '@/utils/teamColors';

interface EditorPickCardProps {
  pick: EditorPick;
  gameData: GameData;
}

export function EditorPickCard({ pick, gameData }: EditorPickCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const bettingColors = getBettingColors(isDark);
  
  // Get team initials based on game type
  const getInitials = (teamName: string) => {
    switch (pick.game_type) {
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

  const formatSpread = (spread: number | null | undefined): string => {
    if (spread === null || spread === undefined) return '-';
    if (spread > 0) return `+${spread}`;
    return spread.toString();
  };

  const formatMoneyline = (ml: number | null | undefined): string => {
    if (ml === null || ml === undefined) return '-';
    if (ml > 0) return `+${ml}`;
    return ml.toString();
  };

  const getBetDisplay = (type: string) => {
    switch(type) {
      case 'spread_away':
        return `Spread: ${gameData.away_team} ${formatSpread(gameData.away_spread)}`;
      case 'spread_home':
        return `Spread: ${gameData.home_team} ${formatSpread(gameData.home_spread)}`;
      case 'ml_away':
        return `Moneyline: ${gameData.away_team} ${formatMoneyline(gameData.away_ml)}`;
      case 'ml_home':
        return `Moneyline: ${gameData.home_team} ${formatMoneyline(gameData.home_ml)}`;
      case 'over':
        return `Over ${gameData.over_line || 'N/A'}`;
      case 'under':
        return `Under ${gameData.over_line || 'N/A'}`;
      // Legacy support
      case 'spread':
        return `Spread: ${gameData.home_team} ${formatSpread(gameData.home_spread)}`;
      case 'moneyline':
        return `Moneyline: ${gameData.home_team} ${formatMoneyline(gameData.home_ml)}`;
      case 'over_under':
        return `Over ${gameData.over_line || 'N/A'}`;
      default:
        return type;
    }
  };

  // Parse bet types
  const parseBetTypes = (betTypeString: string): string[] => {
    if (!betTypeString) return ['spread_home'];
    
    const types = betTypeString.includes(',') 
      ? betTypeString.split(',').map(t => t.trim())
      : [betTypeString];
    
    return types.map(betType => {
      if (betType === 'spread') return 'spread_home';
      if (betType === 'moneyline') return 'ml_home';
      if (betType === 'over_under') return 'over';
      return betType;
    });
  };

  const selectedBetTypes = parseBetTypes(pick.selected_bet_type);

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      {/* Thin Gradient Border at Top */}
      <LinearGradient
        colors={[gameData.away_team_colors.primary, gameData.away_team_colors.secondary, gameData.home_team_colors.primary, gameData.home_team_colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientBorder}
      />

      <Card.Content style={styles.content}>
        {/* Game Date and Time */}
        {(gameData.game_date || gameData.game_time) && (
          <View style={styles.dateContainer}>
            {gameData.game_date && (
              <Text style={[styles.dateText, { color: theme.colors.onSurface }]}>
                {typeof gameData.game_date === 'string' 
                  ? new Date(gameData.game_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  : String(gameData.game_date)
                }
              </Text>
            )}
            {gameData.game_time && (
              <View style={[styles.timeBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
                  {typeof gameData.game_time === 'string' ? gameData.game_time : String(gameData.game_time)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Teams with Color Circles */}
        <View style={styles.teamsRow}>
          {/* Away Team */}
          <View style={styles.teamColumn}>
            {/* Team Circle with Initials */}
            <LinearGradient
              colors={[gameData.away_team_colors.primary, gameData.away_team_colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.teamCircle, { borderColor: gameData.away_team_colors.primary }]}
            >
              <Text style={[styles.teamInitials, { color: getContrastingTextColor(gameData.away_team_colors.primary, gameData.away_team_colors.secondary) }]}>
                {getInitials(gameData.away_team)}
              </Text>
            </LinearGradient>
            <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2}>
              {gameData.away_team}
            </Text>
            <Text style={[styles.spreadText, { color: theme.colors.onSurfaceVariant }]}>
              {formatSpread(gameData.away_spread)}
            </Text>
            <Text style={[styles.mlText, { color: bettingColors.awayMoneyline }]}>
              {formatMoneyline(gameData.away_ml)}
            </Text>
          </View>

          {/* Center */}
          <View style={styles.centerColumn}>
            <Text style={[styles.atSymbol, { color: theme.colors.outlineVariant }]}>@</Text>
            <View style={[styles.totalBadge, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline }]}>
              <Text style={[styles.totalText, { color: theme.colors.onSurfaceVariant }]}>
                Total: {gameData.over_line || '-'}
              </Text>
            </View>
          </View>

          {/* Home Team */}
          <View style={styles.teamColumn}>
            {/* Team Circle with Initials */}
            <LinearGradient
              colors={[gameData.home_team_colors.primary, gameData.home_team_colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.teamCircle, { borderColor: gameData.home_team_colors.primary }]}
            >
              <Text style={[styles.teamInitials, { color: getContrastingTextColor(gameData.home_team_colors.primary, gameData.home_team_colors.secondary) }]}>
                {getInitials(gameData.home_team)}
              </Text>
            </LinearGradient>
            <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2}>
              {gameData.home_team}
            </Text>
            <Text style={[styles.spreadText, { color: theme.colors.onSurfaceVariant }]}>
              {formatSpread(gameData.home_spread)}
            </Text>
            <Text style={[styles.mlText, { color: bettingColors.homeMoneyline }]}>
              {formatMoneyline(gameData.home_ml)}
            </Text>
          </View>
        </View>

        {/* Editor's Picks Section */}
        <View style={[styles.picksSection, { backgroundColor: theme.colors.primaryContainer }]}>
          <Text style={[styles.picksTitle, { color: theme.colors.onPrimaryContainer }]}>
            Editor's Picks
          </Text>
          <View style={styles.picksList}>
            {selectedBetTypes.map((betType, index) => (
              <View key={index} style={styles.pickItem}>
                <Text style={[styles.pickBullet, { color: theme.colors.primary }]}>•</Text>
                <Text style={[styles.pickText, { color: theme.colors.onPrimaryContainer }]}>
                  {getBetDisplay(betType)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Editor's Notes */}
        {pick.editors_notes && (
          <View style={[styles.notesSection, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.notesTitle, { color: theme.colors.onSurfaceVariant }]}>
              Analysis
            </Text>
            <Text style={[styles.notesText, { color: theme.colors.onSurfaceVariant }]}>
              {pick.editors_notes}
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  gradientBorder: {
    height: 4,
  },
  content: {
    paddingVertical: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
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
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  teamColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  teamCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  teamInitials: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    minHeight: 32,
  },
  spreadText: {
    fontSize: 12,
    fontWeight: '500',
  },
  mlText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  centerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  atSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  totalText: {
    fontSize: 11,
    fontWeight: '600',
  },
  picksSection: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  picksTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  picksList: {
    gap: 6,
  },
  pickItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  pickBullet: {
    fontSize: 16,
    lineHeight: 20,
  },
  pickText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  notesSection: {
    padding: 12,
    borderRadius: 8,
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  notesText: {
    fontSize: 13,
    lineHeight: 20,
  },
});

