import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { LiveGame, PredictionStatus } from '@/types/liveScores';
import { 
  getNFLTeamColors, 
  getCFBTeamColors, 
  getNBATeamColors,
  getTeamInitials, 
  getCFBTeamInitials, 
  getNBATeamInitials,
  getNCAABTeamInitials,
  getContrastingTextColor 
} from '@/utils/teamColors';

interface LiveScoreDetailModalProps {
  game: LiveGame | null;
  visible: boolean;
  onClose: () => void;
  onViewFullScoreboard: () => void;
}

export function LiveScoreDetailModal({ 
  game, 
  visible, 
  onClose, 
  onViewFullScoreboard 
}: LiveScoreDetailModalProps) {
  const theme = useTheme();

  if (!game) return null;

  const { predictions } = game;

  // Helper to get team colors based on league
  const getTeamColors = (teamName: string) => {
    switch (game.league) {
      case 'NFL': return getNFLTeamColors(teamName);
      case 'CFB': return getCFBTeamColors(teamName);
      case 'NCAAF': return getCFBTeamColors(teamName);
      case 'NBA': return getNBATeamColors(teamName);
      case 'NCAAB': return getCFBTeamColors(teamName);
      default: return { primary: '#6B7280', secondary: '#9CA3AF' };
    }
  };

  // Helper to get initials based on league
  const getInitials = (teamName: string, abbr?: string) => {
    if (abbr) return abbr;
    switch (game.league) {
      case 'NFL': return getTeamInitials(teamName);
      case 'CFB': return getCFBTeamInitials(teamName);
      case 'NCAAF': return getCFBTeamInitials(teamName);
      case 'NBA': return getNBATeamInitials(teamName);
      case 'NCAAB': return getNCAABTeamInitials(teamName);
      default: return teamName.substring(0, 3).toUpperCase();
    }
  };

  const renderTeamCircle = (isHome: boolean) => {
    const teamName = isHome ? game.home_team : game.away_team;
    const abbr = isHome ? game.home_abbr : game.away_abbr;
    const colors = getTeamColors(teamName);
    const initials = getInitials(teamName, abbr);
    const textColor = getContrastingTextColor(colors.primary, colors.secondary);

    return (
      <View style={styles.teamCircleContainer}>
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.teamCircle}
        >
          <Text style={[styles.teamInitials, { color: textColor }]}>
            {initials}
          </Text>
        </LinearGradient>
        <Text style={[styles.teamName, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
          {teamName}
        </Text>
      </View>
    );
  };

  const formatLine = (line?: number) => {
    if (line === undefined || line === null) return '';
    return line > 0 ? `+${line}` : `${line}`;
  };

  const renderPredictionRow = (
    label: string, 
    prediction?: PredictionStatus, 
    detail?: string
  ) => {
    if (!prediction) return null;

    const isHitting = prediction.isHitting;
    const hitColor = '#22D35F';
    const missColor = '#EF4444';
    const statusColor = isHitting ? hitColor : missColor;
    const bgColor = isHitting ? 'rgba(34, 211, 95, 0.1)' : 'rgba(239, 68, 68, 0.1)';

    return (
      <View style={[styles.predictionRow, { backgroundColor: bgColor, borderColor: isHitting ? 'rgba(34, 211, 95, 0.3)' : 'rgba(239, 68, 68, 0.3)' }]}>
        <View style={styles.predictionHeader}>
          <MaterialCommunityIcons 
            name={isHitting ? "check-circle" : "close-circle"} 
            size={18} 
            color={statusColor} 
          />
          <View style={styles.predictionInfo}>
            <Text style={[styles.predictionType, { color: theme.colors.onSurface }]}>{label}</Text>
            <Text style={[styles.predictionValue, { color: theme.colors.onSurfaceVariant }]}>
              {detail}
            </Text>
          </View>
        </View>
        <View style={styles.predictionStatus}>
          <View style={styles.statusBadge}>
            <MaterialCommunityIcons 
              name={isHitting ? "trending-up" : "trending-down"} 
              size={14} 
              color={statusColor} 
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {isHitting ? "Hitting" : "Not Hitting"}
            </Text>
          </View>
          <Text style={[styles.probabilityText, { color: theme.colors.onSurfaceVariant }]}>
            {(prediction.probability * 100).toFixed(0)}% Conf.
          </Text>
        </View>
      </View>
    );
  };

  const hasPredictions = predictions && (predictions.moneyline || predictions.spread || predictions.overUnder);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.outlineVariant }]}>
            <View style={styles.modalTitleContainer}>
              <View style={[styles.leagueBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                <Text style={[styles.leagueBadgeText, { color: theme.colors.onPrimaryContainer }]}>
                  {game.league}
                </Text>
              </View>
              <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
                Live Game
              </Text>
            </View>
            <IconButton
              icon="close"
              size={24}
              onPress={onClose}
            />
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Score Header - Matches expanded card */}
            <View style={[styles.scoreHeader, { backgroundColor: theme.dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]}>
              <View style={styles.teamsRow}>
                {renderTeamCircle(false)}
                
                <View style={styles.scoreContainer}>
                  <View style={styles.scoreRow}>
                    <Text style={[styles.score, { color: theme.colors.onSurface }]}>{game.away_score}</Text>
                    <Text style={[styles.scoreDivider, { color: theme.colors.onSurfaceVariant }]}>-</Text>
                    <Text style={[styles.score, { color: theme.colors.onSurface }]}>{game.home_score}</Text>
                  </View>
                  <View style={styles.gameStatus}>
                    <Text style={[styles.quarter, { color: theme.colors.onSurfaceVariant }]}>
                      {game.quarter || game.period}
                    </Text>
                    {game.time_remaining && (
                      <Text style={[styles.time, { color: theme.colors.onSurfaceVariant }]}>
                        {game.time_remaining}
                      </Text>
                    )}
                  </View>
                </View>

                {renderTeamCircle(true)}
              </View>
            </View>

            {/* Predictions Section */}
            {hasPredictions ? (
              <View style={styles.predictionsSection}>
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                  AI MODEL PREDICTIONS
                </Text>
                
                <View style={styles.predictionsList}>
                  {predictions?.moneyline && renderPredictionRow(
                    "Moneyline",
                    predictions.moneyline,
                    `${predictions.moneyline.predicted} to win`
                  )}
                  
                  {predictions?.spread && renderPredictionRow(
                    "Spread",
                    predictions.spread,
                    `${predictions.spread.predicted} ${formatLine(predictions.spread.line)}`
                  )}
                  
                  {predictions?.overUnder && renderPredictionRow(
                    "Over/Under",
                    predictions.overUnder,
                    `${predictions.overUnder.predicted} ${predictions.overUnder.line}`
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.noPredictionsContainer}>
                <MaterialCommunityIcons 
                  name="chart-line-variant" 
                  size={48} 
                  color={theme.colors.onSurfaceVariant} 
                />
                <Text style={[styles.noPredictionsText, { color: theme.colors.onSurfaceVariant }]}>
                  No predictions available for this game
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer Button */}
          <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
            <TouchableOpacity 
              style={[styles.fullScoreboardButton, { backgroundColor: theme.colors.primary }]}
              onPress={onViewFullScoreboard}
            >
              <MaterialCommunityIcons name="scoreboard" size={20} color="#FFFFFF" />
              <Text style={styles.fullScoreboardText}>View Full Scoreboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leagueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  leagueBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  scoreHeader: {
    padding: 20,
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamCircleContainer: {
    alignItems: 'center',
    width: 90,
  },
  teamCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  teamInitials: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 12,
    textAlign: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  score: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  scoreDivider: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  gameStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quarter: {
    fontSize: 14,
    fontWeight: '600',
  },
  time: {
    fontSize: 14,
  },
  predictionsSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  predictionsList: {
    gap: 10,
  },
  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  predictionInfo: {
    gap: 2,
  },
  predictionType: {
    fontSize: 14,
    fontWeight: '600',
  },
  predictionValue: {
    fontSize: 12,
  },
  predictionStatus: {
    alignItems: 'flex-end',
    gap: 3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  probabilityText: {
    fontSize: 11,
  },
  noPredictionsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  noPredictionsText: {
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  fullScoreboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  fullScoreboardText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

