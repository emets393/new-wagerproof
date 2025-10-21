import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, useTheme, Badge } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getDisplayedProb } from '@/utils/formatting';
import { TeamCircle } from './TeamCircle';

interface PredictionCardProps {
  label: string;
  probability: number | null;
  homeTeam: string;
  awayTeam: string;
  predictionDetails?: {
    predictedWinner?: string;
    spread?: number;
    overUnder?: 'over' | 'under';
    total?: number;
  };
}

export const PredictionCard: React.FC<PredictionCardProps> = ({
  label,
  probability,
  homeTeam,
  awayTeam,
  predictionDetails
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  
  const displayProb = getDisplayedProb(probability);
  const confidenceLevel = displayProb 
    ? displayProb >= 0.65 
      ? 'High' 
      : displayProb >= 0.58 
        ? 'Moderate' 
        : 'Low'
    : 'Unknown';
  
  const confidenceColor = 
    confidenceLevel === 'High' 
      ? '#22c55e' 
      : confidenceLevel === 'Moderate' 
        ? '#f59e0b' 
        : '#ef4444';

  const getExplanation = () => {
    if (label.includes('Moneyline')) {
      return `Our model predicts ${predictionDetails?.predictedWinner} to win this game with ${(displayProb! * 100).toFixed(1)}% confidence. This is based on team statistics, recent performance, and matchup analysis.`;
    } else if (label.includes('Spread')) {
      return `The model favors ${predictionDetails?.predictedWinner} to cover the ${Math.abs(predictionDetails?.spread || 0)}-point spread with ${(displayProb! * 100).toFixed(1)}% confidence. Historical trends and current form support this prediction.`;
    } else if (label.includes('Over/Under')) {
      return `We project this game to go ${predictionDetails?.overUnder} the total of ${predictionDetails?.total} points with ${(displayProb! * 100).toFixed(1)}% confidence. Offensive/defensive matchups and pace of play are key factors.`;
    }
    return 'Prediction based on comprehensive statistical analysis and machine learning models.';
  };

  const getConfidenceBgColor = () => {
    if (confidenceLevel === 'High') return '#dcfce7'; // green-100
    if (confidenceLevel === 'Moderate') return '#fed7aa'; // orange-100
    return '#fecaca'; // red-100
  };

  const getConfidenceBorderColor = () => {
    if (confidenceLevel === 'High') return '#86efac'; // green-300
    if (confidenceLevel === 'Moderate') return '#fdba74'; // orange-300
    return '#fca5a5'; // red-300
  };

  if (displayProb === null) return null;

  return (
    <View style={styles.predictionContainer}>
      {/* Title */}
      <View style={styles.labelHeader}>
        <MaterialCommunityIcons 
          name={label.includes('Spread') ? 'target' : 'trending-up'} 
          size={16} 
          color={label.includes('Spread') ? '#16A34A' : '#2563EB'} 
        />
        <Text style={[styles.predictionLabel, { color: theme.colors.onSurface }]}>
          {label}
        </Text>
      </View>

      {/* Two Column Grid */}
      <View style={styles.gridContainer}>
        {/* Left Column - Team/Prediction Info */}
        <View style={[styles.leftColumn, { 
          backgroundColor: confidenceLevel === 'High' ? '#dcfce7' : '#f3f4f6',
          borderColor: confidenceLevel === 'High' ? '#86efac' : '#d1d5db'
        }]}>
          {predictionDetails?.predictedWinner && (
            <>
              <Text style={[styles.winnerTeam, { color: theme.colors.onSurface }]}>
                {predictionDetails.predictedWinner}
              </Text>
              {predictionDetails.spread !== undefined && (
                <Text style={[styles.spreadValue, { color: theme.colors.onSurfaceVariant }]}>
                  ({predictionDetails.spread > 0 ? '+' : ''}{predictionDetails.spread})
                </Text>
              )}
            </>
          )}
          {predictionDetails?.overUnder && (
            <>
              <Text style={[styles.ouArrow, { color: predictionDetails.overUnder === 'over' ? '#16A34A' : '#DC2626' }]}>
                {predictionDetails.overUnder === 'over' ? '▲' : '▼'}
              </Text>
              <Text style={[styles.ouLabel, { color: theme.colors.onSurface }]}>
                {predictionDetails.overUnder === 'over' ? 'Over' : 'Under'} {predictionDetails.total}
              </Text>
            </>
          )}
        </View>

        {/* Right Column - Confidence */}
        <View style={[styles.rightColumn, { 
          backgroundColor: getConfidenceBgColor(),
          borderColor: getConfidenceBorderColor()
        }]}>
          <Text style={[styles.confidencePercent, { color: confidenceColor }]}>
            {Math.round(displayProb * 100)}%
          </Text>
          <Text style={[styles.confidenceText, { color: theme.colors.onSurfaceVariant }]}>
            {confidenceLevel} Confidence
          </Text>
        </View>
      </View>

      {/* What This Means Section */}
      <TouchableOpacity onPress={() => setExpanded(!expanded)}>
        <View style={[styles.explanationHeader, { backgroundColor: theme.colors.surfaceVariant }]}>
          <MaterialCommunityIcons name="information" size={14} color="#2563EB" />
          <Text style={[styles.explanationTitle, { color: theme.colors.onSurface }]}>
            What This Means
          </Text>
          <MaterialCommunityIcons 
            name={expanded ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color={theme.colors.onSurfaceVariant} 
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.expandedContent, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={[styles.explanation, { color: theme.colors.onSurfaceVariant }]}>
            {getExplanation()}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  predictionContainer: {
    marginTop: 12,
    gap: 12,
  },
  labelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  predictionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  gridContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  leftColumn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  rightColumn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  winnerTeam: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  spreadValue: {
    fontSize: 12,
    textAlign: 'center',
  },
  ouArrow: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  ouLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  confidencePercent: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  confidenceText: {
    fontSize: 11,
    textAlign: 'center',
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  expandedContent: {
    padding: 12,
    borderRadius: 8,
  },
  explanation: {
    fontSize: 12,
    lineHeight: 18,
  },
});

