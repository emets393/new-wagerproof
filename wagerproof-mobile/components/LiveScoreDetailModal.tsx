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

  const renderPredictionRow = (
    type: string,
    prediction?: {
      predicted: string;
      isHitting: boolean;
      probability: number;
      line?: number;
      currentDifferential: number;
    }
  ) => {
    if (!prediction) return null;

    return (
      <View style={[styles.predictionRow, { borderBottomColor: theme.colors.outline }]}>
        <View style={styles.predictionLeft}>
          <Text style={[styles.predictionType, { color: theme.colors.onSurface }]}>
            {type}
          </Text>
          <Text style={[styles.predictionDetail, { color: theme.colors.onSurfaceVariant }]}>
            {prediction.line !== undefined && `Line: ${prediction.line > 0 ? '+' : ''}${prediction.line}`}
          </Text>
        </View>
        
        <View style={styles.predictionRight}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: prediction.isHitting ? '#16A34A' : '#DC2626' }
          ]}>
            <MaterialCommunityIcons 
              name={prediction.isHitting ? 'check' : 'close'} 
              size={16} 
              color="#FFFFFF" 
            />
            <Text style={styles.statusText}>
              {prediction.isHitting ? 'Hitting' : 'Not Hitting'}
            </Text>
          </View>
          <Text style={[styles.probability, { color: theme.colors.onSurfaceVariant }]}>
            {(prediction.probability * 100).toFixed(0)}% confidence
          </Text>
        </View>
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
                  Model Predictions
                </Text>
                
                {renderPredictionRow('Moneyline', game.predictions.moneyline)}
                {renderPredictionRow('Spread', game.predictions.spread)}
                {renderPredictionRow('Over/Under', game.predictions.overUnder)}
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
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  predictionLeft: {
    flex: 1,
  },
  predictionType: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  predictionDetail: {
    fontSize: 13,
  },
  predictionRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginBottom: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  probability: {
    fontSize: 12,
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

