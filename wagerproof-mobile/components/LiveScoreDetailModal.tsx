import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LiveGame } from '@/types/liveScores';

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

  const renderMoneylinePrediction = (prediction?: {
    predicted: string;
    isHitting: boolean;
    probability: number;
    currentDifferential: number;
  }) => {
    if (!prediction) return null;

    const predictedTeam = prediction.predicted === 'Home' ? game.home_team : game.away_team;
    const currentLeader = game.home_score > game.away_score ? game.home_team : 
                         game.away_score > game.home_score ? game.away_team : 'Tied';
    const scoreDiff = Math.abs(prediction.currentDifferential);

    return (
      <View style={[styles.predictionCard, { backgroundColor: prediction.isHitting ? 'rgba(34, 211, 95, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
        <View style={styles.predictionHeader}>
          <Text style={[styles.predictionType, { color: theme.colors.onSurface }]}>Moneyline</Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: prediction.isHitting ? '#22D35F' : '#EF4444' }
          ]}>
            <MaterialCommunityIcons 
              name={prediction.isHitting ? 'check' : 'close'} 
              size={14} 
              color="#FFFFFF" 
            />
            <Text style={styles.statusText}>
              {prediction.isHitting ? 'Hitting' : 'Missing'}
            </Text>
          </View>
        </View>
        
        <View style={styles.comparisonRow}>
          <Text style={[styles.comparisonLabel, { color: theme.colors.onSurfaceVariant }]}>Predicted:</Text>
          <Text style={[styles.comparisonValue, { color: theme.colors.onSurface }]}>{predictedTeam} wins</Text>
        </View>
        
        <View style={styles.comparisonRow}>
          <Text style={[styles.comparisonLabel, { color: theme.colors.onSurfaceVariant }]}>Current:</Text>
          <Text style={[styles.comparisonValue, { color: theme.colors.onSurface }]}>
            {currentLeader === 'Tied' ? 'Game is tied' : `${currentLeader} leading by ${scoreDiff}`}
          </Text>
        </View>
        
        <Text style={[styles.confidence, { color: theme.colors.onSurfaceVariant }]}>
          {(prediction.probability * 100).toFixed(0)}% confidence
        </Text>
      </View>
    );
  };

  const renderSpreadPrediction = (prediction?: {
    predicted: string;
    isHitting: boolean;
    probability: number;
    line?: number;
    currentDifferential: number;
  }) => {
    if (!prediction || prediction.line === undefined) return null;

    const predictedTeam = prediction.predicted === 'Home' ? game.home_team : game.away_team;
    const spreadLine = prediction.predicted === 'Home' ? prediction.line : -prediction.line;
    const currentDiff = prediction.currentDifferential;
    const pointsNeeded = prediction.isHitting ? 0 : Math.abs(currentDiff) + 0.5;

    return (
      <View style={[styles.predictionCard, { backgroundColor: prediction.isHitting ? 'rgba(34, 211, 95, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
        <View style={styles.predictionHeader}>
          <Text style={[styles.predictionType, { color: theme.colors.onSurface }]}>Spread</Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: prediction.isHitting ? '#22D35F' : '#EF4444' }
          ]}>
            <MaterialCommunityIcons 
              name={prediction.isHitting ? 'check' : 'close'} 
              size={14} 
              color="#FFFFFF" 
            />
            <Text style={styles.statusText}>
              {prediction.isHitting ? 'Hitting' : 'Missing'}
            </Text>
          </View>
        </View>
        
        <View style={styles.comparisonRow}>
          <Text style={[styles.comparisonLabel, { color: theme.colors.onSurfaceVariant }]}>Predicted:</Text>
          <Text style={[styles.comparisonValue, { color: theme.colors.onSurface }]}>
            {predictedTeam} covers {spreadLine > 0 ? '+' : ''}{spreadLine.toFixed(1)}
          </Text>
        </View>
        
        <View style={styles.comparisonRow}>
          <Text style={[styles.comparisonLabel, { color: theme.colors.onSurfaceVariant }]}>Current diff:</Text>
          <Text style={[styles.comparisonValue, { color: theme.colors.onSurface }]}>
            {currentDiff > 0 ? '+' : ''}{currentDiff.toFixed(1)}
          </Text>
        </View>
        
        {!prediction.isHitting && (
          <View style={styles.comparisonRow}>
            <Text style={[styles.comparisonLabel, { color: theme.colors.onSurfaceVariant }]}>Needs:</Text>
            <Text style={[styles.comparisonValue, { color: '#EF4444' }]}>
              {pointsNeeded.toFixed(1)} more points
            </Text>
          </View>
        )}
        
        <Text style={[styles.confidence, { color: theme.colors.onSurfaceVariant }]}>
          {(prediction.probability * 100).toFixed(0)}% confidence
        </Text>
      </View>
    );
  };

  const renderOverUnderPrediction = (prediction?: {
    predicted: string;
    isHitting: boolean;
    probability: number;
    line?: number;
    currentDifferential: number;
  }) => {
    if (!prediction || prediction.line === undefined) return null;

    const totalScore = game.home_score + game.away_score;
    const pointsNeeded = prediction.isHitting ? 0 : Math.abs(prediction.currentDifferential) + 0.5;

    return (
      <View style={[styles.predictionCard, { backgroundColor: prediction.isHitting ? 'rgba(34, 211, 95, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
        <View style={styles.predictionHeader}>
          <Text style={[styles.predictionType, { color: theme.colors.onSurface }]}>Over/Under</Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: prediction.isHitting ? '#22D35F' : '#EF4444' }
          ]}>
            <MaterialCommunityIcons 
              name={prediction.isHitting ? 'check' : 'close'} 
              size={14} 
              color="#FFFFFF" 
            />
            <Text style={styles.statusText}>
              {prediction.isHitting ? 'Hitting' : 'Missing'}
            </Text>
          </View>
        </View>
        
        <View style={styles.comparisonRow}>
          <Text style={[styles.comparisonLabel, { color: theme.colors.onSurfaceVariant }]}>Predicted:</Text>
          <Text style={[styles.comparisonValue, { color: theme.colors.onSurface }]}>
            {prediction.predicted} {prediction.line.toFixed(1)}
          </Text>
        </View>
        
        <View style={styles.comparisonRow}>
          <Text style={[styles.comparisonLabel, { color: theme.colors.onSurfaceVariant }]}>Current total:</Text>
          <Text style={[styles.comparisonValue, { color: theme.colors.onSurface }]}>
            {totalScore}
          </Text>
        </View>
        
        {!prediction.isHitting && (
          <View style={styles.comparisonRow}>
            <Text style={[styles.comparisonLabel, { color: theme.colors.onSurfaceVariant }]}>Needs:</Text>
            <Text style={[styles.comparisonValue, { color: '#EF4444' }]}>
              {pointsNeeded.toFixed(1)} more points
            </Text>
          </View>
        )}
        
        <Text style={[styles.confidence, { color: theme.colors.onSurfaceVariant }]}>
          {(prediction.probability * 100).toFixed(0)}% confidence
        </Text>
      </View>
    );
  };

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
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.outline }]}>
            <View style={styles.modalTitleContainer}>
              <View style={[styles.leagueBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                <Text style={[styles.leagueBadgeText, { color: theme.colors.onPrimaryContainer }]}>
                  {game.league}
                </Text>
              </View>
              <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
                Live Game Details
              </Text>
            </View>
            <IconButton
              icon="close"
              size={24}
              onPress={onClose}
            />
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* Game Score */}
            <View style={styles.scoreSection}>
              <View style={styles.teamScoreRow}>
                <Text style={[styles.teamName, { color: theme.colors.onSurface }]}>
                  {game.away_team}
                </Text>
                <Text style={[styles.bigScore, { color: theme.colors.onSurface }]}>
                  {game.away_score}
                </Text>
              </View>
              
              <View style={styles.teamScoreRow}>
                <Text style={[styles.teamName, { color: theme.colors.onSurface }]}>
                  {game.home_team}
                </Text>
                <Text style={[styles.bigScore, { color: theme.colors.onSurface }]}>
                  {game.home_score}
                </Text>
              </View>

              <View style={styles.gameStatus}>
                <Text style={[styles.statusText, { color: theme.colors.onSurfaceVariant }]}>
                  {game.quarter} {game.time_remaining && `• ${game.time_remaining}`}
                </Text>
              </View>
            </View>

            {/* Predictions */}
            {game.predictions && (
              <View style={styles.predictionsSection}>
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                  Model Predictions vs. Actual
                </Text>
                
                {renderMoneylinePrediction(game.predictions.moneyline)}
                {renderSpreadPrediction(game.predictions.spread)}
                {renderOverUnderPrediction(game.predictions.overUnder)}
              </View>
            )}
          </ScrollView>

          {/* Footer Button */}
          <View style={[styles.footer, { borderTopColor: theme.colors.outline }]}>
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
    maxHeight: '75%',
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
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    paddingHorizontal: 16,
  },
  scoreSection: {
    paddingVertical: 20,
  },
  teamScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamName: {
    fontSize: 18,
    fontWeight: '600',
  },
  bigScore: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  gameStatus: {
    marginTop: 8,
    alignItems: 'center',
  },
  predictionsSection: {
    paddingVertical: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  predictionCard: {
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  predictionType: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  comparisonLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  comparisonValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  confidence: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
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

