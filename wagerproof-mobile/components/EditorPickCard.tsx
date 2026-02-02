import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Platform, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { EditorPick, GameData } from '@/types/editorsPicks';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { supabase } from '@/services/supabase';
import { getTeamInitials, getCFBTeamInitials, getNBATeamInitials, getNCAABTeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { calculateUnits } from '@/utils/unitsCalculation';
import { SportsbookButtons } from '@/components/SportsbookButtons';

interface EditorPickCardProps {
  pick: EditorPick;
  gameData: GameData;
  onUpdate?: () => void;  // Callback to refresh the list after updates
  onEdit?: () => void;    // Callback to open edit sheet
}

export function EditorPickCard({ pick, gameData, onUpdate, onEdit }: EditorPickCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { adminModeEnabled } = useAdminMode();
  const [isUpdatingResult, setIsUpdatingResult] = useState(false);

  // Check if the game date has passed (for showing result buttons)
  const isGamePast = (): boolean => {
    const rawDate = gameData.raw_game_date;
    if (!rawDate) return false;

    try {
      const gameDate = new Date(rawDate);
      const now = new Date();
      // Add a buffer of 4 hours after game start to account for game duration
      const gameEndApprox = new Date(gameDate.getTime() + 4 * 60 * 60 * 1000);
      return now > gameEndApprox;
    } catch {
      return false;
    }
  };

  // Handle result update
  const handleResultUpdate = async (result: 'won' | 'lost' | 'push') => {
    if (isUpdatingResult) return;

    try {
      setIsUpdatingResult(true);
      const { error } = await supabase
        .from('editors_picks')
        .update({ result })
        .eq('id', pick.id);

      if (error) throw error;

      Alert.alert('Success', `Pick marked as ${result.toUpperCase()}`);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating result:', error);
      Alert.alert('Error', 'Failed to update result. Please try again.');
    } finally {
      setIsUpdatingResult(false);
    }
  };

  // Handle clear result
  const handleClearResult = async () => {
    if (isUpdatingResult) return;

    Alert.alert(
      'Clear Result',
      'Are you sure you want to clear the result for this pick?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsUpdatingResult(true);
              const { error } = await supabase
                .from('editors_picks')
                .update({ result: null })
                .eq('id', pick.id);

              if (error) throw error;

              Alert.alert('Success', 'Result cleared');
              onUpdate?.();
            } catch (error) {
              console.error('Error clearing result:', error);
              Alert.alert('Error', 'Failed to clear result. Please try again.');
            } finally {
              setIsUpdatingResult(false);
            }
          },
        },
      ]
    );
  };
  
  // Validate image URI - Android requires valid non-empty URLs
  const isValidImageUri = (uri: string | null | undefined): boolean => {
    if (!uri || typeof uri !== 'string') return false;
    const trimmed = uri.trim();
    if (trimmed === '') return false;
    // Basic URL validation - must start with http:// or https://
    return trimmed.startsWith('http://') || trimmed.startsWith('https://');
  };
  
  // Get team initials based on game type
  const getInitials = (teamName: string) => {
    if (!teamName) return 'TBD';
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
    if (spread === 0) return 'PK';
    return spread.toString();
  };

  const formatMoneyline = (ml: number | null | undefined): string => {
    if (ml === null || ml === undefined) return '-';
    if (ml > 0) return `+${ml}`;
    if (ml === 0) return 'Even';
    return ml.toString();
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
  
  // Calculate units
  const unitsCalc = calculateUnits(pick.result, pick.best_price, pick.units);

  // Determine gradient colors based on bet
  const getGradientColors = (): readonly [string, string, string] => {
    const firstBet = selectedBetTypes[0];
    const alpha = isDark ? 0.15 : 0.1;

    const hexToRgba = (hex: string, a: number) => {
      // Validate hex color format
      if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
        return `rgba(128, 128, 128, ${a})`; // Fallback gray
      }
      
      try {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        
        // Check if parsing was successful
        if (isNaN(r) || isNaN(g) || isNaN(b)) {
          return `rgba(128, 128, 128, ${a})`; // Fallback gray
        }
        
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      } catch (error) {
        return `rgba(128, 128, 128, ${a})`; // Fallback gray
      }
    };

    try {
      if (firstBet?.includes('home') && gameData.home_team_colors) {
        return [
          hexToRgba(gameData.home_team_colors.primary, alpha),
          hexToRgba(gameData.home_team_colors.secondary, alpha * 0.5),
          hexToRgba(gameData.home_team_colors.primary, 0)
        ];
      }
      if (firstBet?.includes('away') && gameData.away_team_colors) {
        return [
          hexToRgba(gameData.away_team_colors.primary, alpha),
          hexToRgba(gameData.away_team_colors.secondary, alpha * 0.5),
          hexToRgba(gameData.away_team_colors.primary, 0)
        ];
      }
      
      // Default fallback
      return [
        hexToRgba(theme.colors.primary, alpha),
        hexToRgba(theme.colors.primary, alpha * 0.5),
        'transparent'
      ];
    } catch (error) {
      console.error('Error calculating gradient colors:', error);
      // Safe fallback colors for Android
      return [
        `rgba(128, 128, 128, ${alpha})`,
        `rgba(128, 128, 128, ${alpha * 0.5})`,
        'transparent'
      ];
    }
  };

  const gradientColors = getGradientColors();

  return (
    <View style={[
      styles.cardContainer, 
      { 
        backgroundColor: isDark ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      }
    ]}>
      {/* Background Gradient */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Badges Row */}
      <View style={styles.badgesRow}>
        {pick.result && pick.result !== 'pending' && (
          <View style={[
            styles.badge, 
            { backgroundColor: pick.result === 'won' ? '#10b981' : pick.result === 'lost' ? '#ef4444' : '#6b7280' }
          ]}>
            <Text style={styles.badgeText}>{pick.result.toUpperCase()}</Text>
          </View>
        )}
        {pick.is_free_pick && (
          <View style={[styles.badge, { backgroundColor: '#10b981' }]}>
            <Text style={styles.badgeText}>FREE PICK</Text>
          </View>
        )}
        {!pick.is_published && (
          <View style={[styles.badge, { backgroundColor: '#eab308' }]}>
            <Text style={styles.badgeText}>DRAFT</Text>
          </View>
        )}
      </View>

      {/* Header: Date & Time */}
      <View style={styles.header}>
        {gameData.game_date && (
          <Text style={[styles.dateText, { color: theme.colors.onSurface }]}>
            {gameData.game_date}
          </Text>
        )}
        {gameData.game_time && (
          <View style={[styles.timeBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
            <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
              {gameData.game_time}
            </Text>
          </View>
        )}
      </View>

      {/* Matchup Section */}
      <View style={styles.matchupContainer}>
        {/* Away Team */}
        <View style={styles.teamColumn}>
          <View style={[styles.logoContainer, { borderColor: gameData.away_team_colors.primary }]}>
            {isValidImageUri(gameData.away_logo) ? (
              <Image 
                source={{ uri: gameData.away_logo! }} 
                style={styles.teamLogo} 
                resizeMode="contain"
                onError={(e) => {
                  if (__DEV__) {
                    console.log('Failed to load away team logo:', gameData.away_logo, e.nativeEvent.error);
                  }
                }}
              />
            ) : (
              <View style={[styles.initialsFallback, { backgroundColor: gameData.away_team_colors.primary }]}>
                <Text style={[styles.initialsText, { color: getContrastingTextColor(gameData.away_team_colors.primary, gameData.away_team_colors.secondary) }]}>
                  {getInitials(gameData.away_team)}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
            {gameData.away_team}
          </Text>
        </View>

        {/* VS / Lines */}
        <View style={styles.centerColumn}>
          <Text style={[styles.atSymbol, { color: theme.colors.outline }]}>@</Text>
          
          {/* Betting Lines Grid */}
          <View style={styles.bettingLinesGrid}>
            <View style={styles.bettingLineCol}>
              <Text 
                style={[styles.oddsText, { color: theme.colors.primary }]} 
                numberOfLines={1} 
                adjustsFontSizeToFit 
                minimumFontScale={0.8}
              >
                {formatMoneyline(gameData.away_ml)}
              </Text>
              <Text 
                style={[styles.spreadText, { color: theme.colors.onSurface }]} 
                numberOfLines={1} 
                adjustsFontSizeToFit 
                minimumFontScale={0.8}
              >
                {formatSpread(gameData.away_spread)}
              </Text>
            </View>
            
            <View style={styles.totalContainer}>
              <View style={[styles.totalBadge, { borderColor: theme.colors.outline, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }]}>
                <Text style={[styles.totalText, { color: theme.colors.onSurfaceVariant }]}>
                  {gameData.over_line || '-'}
                </Text>
              </View>
            </View>

            <View style={styles.bettingLineCol}>
              <Text 
                style={[styles.oddsText, { color: theme.colors.primary }]} 
                numberOfLines={1} 
                adjustsFontSizeToFit 
                minimumFontScale={0.8}
              >
                {formatMoneyline(gameData.home_ml)}
              </Text>
              <Text 
                style={[styles.spreadText, { color: theme.colors.onSurface }]} 
                numberOfLines={1} 
                adjustsFontSizeToFit 
                minimumFontScale={0.8}
              >
                {formatSpread(gameData.home_spread)}
              </Text>
            </View>
          </View>
        </View>

        {/* Home Team */}
        <View style={styles.teamColumn}>
          <View style={[styles.logoContainer, { borderColor: gameData.home_team_colors.primary }]}>
            {isValidImageUri(gameData.home_logo) ? (
              <Image 
                source={{ uri: gameData.home_logo! }} 
                style={styles.teamLogo} 
                resizeMode="contain"
                onError={(e) => {
                  if (__DEV__) {
                    console.log('Failed to load home team logo:', gameData.home_logo, e.nativeEvent.error);
                  }
                }}
              />
            ) : (
              <View style={[styles.initialsFallback, { backgroundColor: gameData.home_team_colors.primary }]}>
                <Text style={[styles.initialsText, { color: getContrastingTextColor(gameData.home_team_colors.primary, gameData.home_team_colors.secondary) }]}>
                  {getInitials(gameData.home_team)}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
            {gameData.home_team}
          </Text>
        </View>
      </View>

      {/* Editor's Pick Section */}
      <View style={[
        styles.pickSection, 
        { 
          backgroundColor: isDark ? 'rgba(30, 58, 138, 0.2)' : 'rgba(239, 246, 255, 0.8)',
          borderColor: isDark ? 'rgba(30, 64, 175, 0.3)' : 'rgba(191, 219, 254, 1)'
        }
      ]}>
        <Text style={[styles.sectionLabel, { color: isDark ? '#93c5fd' : '#1e40af' }]}>EDITOR'S PICK</Text>
        
        {pick.pick_value ? (
          <View>
            <Text style={[styles.pickValueText, { color: theme.colors.onSurface }]}>
              {pick.pick_value}
            </Text>
            
            <View style={styles.pickMetaRow}>
              {pick.best_price && (
                <View style={[styles.metaBadge, { backgroundColor: isDark ? 'rgba(6, 95, 70, 0.3)' : '#dcfce7', borderColor: isDark ? '#065f46' : '#bbf7d0' }]}>
                  <Text style={[styles.metaText, { color: isDark ? '#a7f3d0' : '#166534' }]}>
                    {pick.best_price}
                  </Text>
                </View>
              )}
              {pick.sportsbook && (
                <View style={[styles.metaBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#e5e7eb' }]}>
                  <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                    @ {pick.sportsbook}
                  </Text>
                </View>
              )}
              {pick.units && (
                <Text style={[styles.unitsText, { color: theme.colors.onSurfaceVariant }]}>
                  <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>{pick.units}</Text> unit{pick.units !== 1 ? 's' : ''}
                </Text>
              )}
            </View>

            {/* Result Display */}
            {pick.result && pick.result !== 'pending' && (
              <Text style={[
                styles.resultText, 
                { 
                  color: unitsCalc.netUnits > 0 ? '#10b981' : unitsCalc.netUnits < 0 ? '#ef4444' : theme.colors.onSurfaceVariant 
                }
              ]}>
                {unitsCalc.netUnits > 0 ? '+' : ''}{unitsCalc.netUnits.toFixed(2)} units
              </Text>
            )}
          </View>
        ) : (
          /* Fallback for old picks */
          <View style={styles.legacyPickContainer}>
            {selectedBetTypes.map((betType, index) => {
              const getBetDisplay = (type: string) => {
                switch(type) {
                  case 'spread_away': return `Spread: ${gameData.away_team} ${formatSpread(gameData.away_spread)}`;
                  case 'spread_home': return `Spread: ${gameData.home_team} ${formatSpread(gameData.home_spread)}`;
                  case 'ml_away': return `Moneyline: ${gameData.away_team} ${formatMoneyline(gameData.away_ml)}`;
                  case 'ml_home': return `Moneyline: ${gameData.home_team} ${formatMoneyline(gameData.home_ml)}`;
                  case 'over': return `Over ${gameData.over_line || 'N/A'}`;
                  case 'under': return `Under ${gameData.over_line || 'N/A'}`;
                  default: return type;
                }
              };
              return (
                <View key={index} style={styles.legacyPickRow}>
                  <Text style={[styles.legacyPickBullet, { color: theme.colors.primary }]}>•</Text>
                  <Text style={[styles.legacyPickText, { color: theme.colors.onSurface }]}>{getBetDisplay(betType)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Analysis / Notes - only show if more than 5 characters */}
      {pick.editors_notes && pick.editors_notes.length > 5 && (
        <View style={[
          styles.notesSection,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
          }
        ]}>
          <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant, opacity: 0.7 }]}>ANALYSIS</Text>
          <Text style={[styles.notesText, { color: theme.colors.onSurface }]}>
            {pick.editors_notes}
          </Text>
        </View>
      )}

      {/* Sportsbook Buttons */}
      {pick.is_published && pick.betslip_links && Object.keys(pick.betslip_links).length > 0 && (
        <View style={styles.sportsbookSection}>
           <SportsbookButtons betslipLinks={pick.betslip_links} />
        </View>
      )}

      {/* Admin Controls - Only visible when admin mode is enabled */}
      {adminModeEnabled && (
        <View style={[styles.adminSection, { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
          <View style={styles.adminHeader}>
            <MaterialCommunityIcons name="shield-account" size={14} color="#22c55e" />
            <Text style={styles.adminLabel}>ADMIN CONTROLS</Text>
          </View>

          <View style={styles.adminButtonsRow}>
            {/* Edit Button */}
            <TouchableOpacity
              style={[styles.adminButton, styles.editButton]}
              onPress={onEdit}
            >
              <MaterialCommunityIcons name="pencil" size={16} color="#3b82f6" />
              <Text style={[styles.adminButtonText, { color: '#3b82f6' }]}>Edit</Text>
            </TouchableOpacity>

            {/* Result Buttons - Only show after game has passed */}
            {isGamePast() && (
              <>
                {isUpdatingResult ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 12 }} />
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.adminButton, styles.wonButton]}
                      onPress={() => handleResultUpdate('won')}
                    >
                      <MaterialCommunityIcons name="check-circle" size={16} color="#10b981" />
                      <Text style={[styles.adminButtonText, { color: '#10b981' }]}>Won</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.adminButton, styles.lostButton]}
                      onPress={() => handleResultUpdate('lost')}
                    >
                      <MaterialCommunityIcons name="close-circle" size={16} color="#ef4444" />
                      <Text style={[styles.adminButtonText, { color: '#ef4444' }]}>Lost</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.adminButton, styles.pushButton]}
                      onPress={() => handleResultUpdate('push')}
                    >
                      <MaterialCommunityIcons name="minus-circle" size={16} color="#6b7280" />
                      <Text style={[styles.adminButtonText, { color: '#6b7280' }]}>Push</Text>
                    </TouchableOpacity>

                    {/* Clear Result - Only show if result is set */}
                    {pick.result && pick.result !== 'pending' && (
                      <TouchableOpacity
                        style={[styles.adminButton, styles.clearButton]}
                        onPress={handleClearResult}
                      >
                        <MaterialCommunityIcons name="refresh" size={16} color="#f59e0b" />
                        <Text style={[styles.adminButtonText, { color: '#f59e0b' }]}>Clear</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 16,
    marginVertical: 8,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
  },
  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    marginBottom: 8,
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  matchupContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  teamColumn: {
    flex: 1,
    alignItems: 'center',
    maxWidth: '35%',
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  teamLogo: {
    width: 40,
    height: 40,
  },
  initialsFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
  centerColumn: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 12,
  },
  atSymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    opacity: 0.3,
    marginBottom: 8,
  },
  bettingLinesGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-between',
  },
  bettingLineCol: {
    alignItems: 'center',
    flex: 1,
  },
  oddsText: {
    fontSize: 13,
    fontWeight: '700',
  },
  spreadText: {
    fontSize: 11,
    fontWeight: '500',
  },
  totalContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  totalBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  totalText: {
    fontSize: 10,
    fontWeight: '600',
  },
  pickSection: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  pickValueText: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  pickMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  metaBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  unitsText: {
    fontSize: 12,
  },
  resultText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  legacyPickContainer: {
    gap: 4,
  },
  legacyPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legacyPickBullet: {
    fontSize: 14,
  },
  legacyPickText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notesSection: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  notesText: {
    fontSize: 13,
    lineHeight: 20,
  },
  sportsbookSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  adminSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  adminLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#22c55e',
    letterSpacing: 0.5,
  },
  adminButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  editButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  wonButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  lostButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  pushButton: {
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
  },
  clearButton: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  adminButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
