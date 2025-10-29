import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface CFBPredictionCardProps {
  awayTeam: string;
  homeTeam: string;
  predAwayScore?: number | null;
  predHomeScore?: number | null;
  predSpread?: number | null;
  homeSpreadDiff?: number | null;
  predOverLine?: number | null;
  overLineDiff?: number | null;
  actualSpread?: number | null;
  actualTotal?: number | null;
}

export const CFBPredictionCard: React.FC<CFBPredictionCardProps> = ({
  awayTeam,
  homeTeam,
  predAwayScore,
  predHomeScore,
  predSpread,
  homeSpreadDiff,
  predOverLine,
  overLineDiff,
  actualSpread,
  actualTotal,
}) => {
  const theme = useTheme();
  const [expandedSpread, setExpandedSpread] = useState(false);
  const [expandedOU, setExpandedOU] = useState(false);
  
  const formatSignedHalf = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    const rounded = Math.round(value * 2) / 2;
    return rounded > 0 ? `+${rounded}` : `${rounded}`;
  };

  const roundToHalf = (value: number): number => {
    return Math.round(value * 2) / 2;
  };

  // Calculate edge info for spread
  const getSpreadEdgeInfo = () => {
    if (homeSpreadDiff === null || homeSpreadDiff === undefined) return null;
    
    const edge = Math.abs(homeSpreadDiff);
    const isHomeEdge = homeSpreadDiff > 0;
    const teamName = isHomeEdge ? homeTeam : awayTeam;
    
    return {
      edge: roundToHalf(edge),
      teamName,
      isHomeEdge,
      displayEdge: `+${roundToHalf(edge)}`,
    };
  };

  // Calculate edge info for O/U
  const getOUEdgeInfo = () => {
    if (overLineDiff === null || overLineDiff === undefined) return null;
    
    const isOver = overLineDiff > 0;
    const magnitude = Math.abs(overLineDiff);
    
    return {
      isOver,
      magnitude: roundToHalf(magnitude),
      displayMagnitude: roundToHalf(magnitude).toString(),
    };
  };

  const spreadEdgeInfo = getSpreadEdgeInfo();
  const ouEdgeInfo = getOUEdgeInfo();

  // Check if we have any prediction data
  const hasAnyPredictionData = 
    (predAwayScore !== null && predAwayScore !== undefined) ||
    (predHomeScore !== null && predHomeScore !== undefined) ||
    spreadEdgeInfo !== null ||
    ouEdgeInfo !== null;

  const getSpreadExplanation = () => {
    if (!spreadEdgeInfo) return '';
    const edge = spreadEdgeInfo.edge;
    const team = spreadEdgeInfo.teamName;
    
    if (edge < 1.5) {
      return `Our model sees only a slight ${edge}-point edge for ${team}. This is a close matchup where the model's prediction differs minimally from the betting line.`;
    } else if (edge < 3) {
      return `Our model identifies a moderate ${edge}-point edge for ${team}. This suggests a meaningful difference between our projection and the current betting line.`;
    } else {
      return `Our model shows a significant ${edge}-point edge for ${team}. This is a substantial difference between our model's prediction and the market line, indicating strong value.`;
    }
  };

  const getOUExplanation = () => {
    if (!ouEdgeInfo) return '';
    const { isOver, magnitude } = ouEdgeInfo;
    const direction = isOver ? 'OVER' : 'UNDER';
    
    if (magnitude < 2) {
      return `Our model predicts the total will be ${magnitude} points ${direction} the line. This is a slight edge where the game is expected to narrowly ${isOver ? 'exceed' : 'stay under'} the betting total.`;
    } else if (magnitude < 4) {
      return `Our model projects a moderate ${magnitude}-point edge on the ${direction}. This suggests a meaningful difference between our prediction and the current total.`;
    } else {
      return `Our model shows a strong ${magnitude}-point edge on the ${direction}. This is a significant difference, indicating our model expects the game to ${isOver ? 'be higher-scoring' : 'have fewer points'} than the market anticipates.`;
    }
  };

  // If no prediction data, show a message
  if (!hasAnyPredictionData) {
    return (
      <View style={[styles.noPredictionContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
        <MaterialCommunityIcons name="information-outline" size={24} color={theme.colors.onSurfaceVariant} />
        <Text style={[styles.noPredictionText, { color: theme.colors.onSurfaceVariant }]}>
          Model predictions not available for this game yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Score Predictions */}
      {(predAwayScore !== null || predHomeScore !== null) && (
        <View style={[styles.scoreSection, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline }]}>
          <View style={styles.scoreSectionHeader}>
            <MaterialCommunityIcons name="scoreboard" size={18} color="#F97316" />
            <Text style={[styles.scoreSectionTitle, { color: theme.colors.onSurface }]}>
              Predicted Final Score
            </Text>
          </View>
          
          <View style={styles.scoresRow}>
            {/* Away Score */}
            <View style={styles.scoreColumn}>
              <Text style={[styles.scoreTeamName, { color: theme.colors.onSurface }]}>{awayTeam}</Text>
              <Text style={[styles.scoreValue, { color: theme.colors.onSurface }]}>
                {predAwayScore !== null && predAwayScore !== undefined 
                  ? Math.round(predAwayScore).toString() 
                  : '-'}
              </Text>
            </View>

            {/* VS */}
            <View style={styles.vsContainer}>
              <Text style={[styles.vsText, { color: theme.colors.onSurfaceVariant }]}>VS</Text>
            </View>

            {/* Home Score */}
            <View style={styles.scoreColumn}>
              <Text style={[styles.scoreTeamName, { color: theme.colors.onSurface }]}>{homeTeam}</Text>
              <Text style={[styles.scoreValue, { color: theme.colors.onSurface }]}>
                {predHomeScore !== null && predHomeScore !== undefined 
                  ? Math.round(predHomeScore).toString() 
                  : '-'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Spread Prediction */}
      {spreadEdgeInfo && (
        <View style={styles.predictionContainer}>
          <View style={[styles.predictionCard, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
            <View style={styles.predictionHeader}>
              <MaterialCommunityIcons name="target" size={18} color="#16A34A" />
              <Text style={[styles.predictionTitle, { color: theme.colors.onSurface }]}>Spread</Text>
            </View>

            <View style={styles.predictionContent}>
              <View style={styles.predictionValueContainer}>
                <Text style={[styles.predictionLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Edge to {spreadEdgeInfo.teamName}
                </Text>
                <Text style={[styles.predictionValue, { color: '#16A34A' }]}>
                  {spreadEdgeInfo.displayEdge}
                </Text>
              </View>

              <View style={styles.predictionValueContainer}>
                <Text style={[styles.predictionLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Model Spread
                </Text>
                <Text style={[styles.predictionValue, { color: theme.colors.onSurface }]}>
                  {formatSignedHalf(spreadEdgeInfo.isHomeEdge ? predSpread : (predSpread ? -predSpread : null))}
                </Text>
              </View>
            </View>

            {/* What This Means - Spread */}
            <TouchableOpacity onPress={() => setExpandedSpread(!expandedSpread)}>
              <View style={[styles.explanationHeader, { backgroundColor: '#f0fdf4' }]}>
                <MaterialCommunityIcons name="information" size={14} color="#16A34A" />
                <Text style={[styles.explanationTitle, { color: theme.colors.onSurface }]}>
                  What This Means
                </Text>
                <MaterialCommunityIcons 
                  name={expandedSpread ? 'chevron-up' : 'chevron-down'} 
                  size={16} 
                  color={theme.colors.onSurfaceVariant} 
                />
              </View>
            </TouchableOpacity>

            {expandedSpread && (
              <View style={[styles.expandedContent, { backgroundColor: '#f0fdf4' }]}>
                <Text style={[styles.explanation, { color: theme.colors.onSurfaceVariant }]}>
                  {getSpreadExplanation()}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Over/Under Prediction */}
      {ouEdgeInfo && (
        <View style={styles.predictionContainer}>
          <View style={[
            styles.predictionCard, 
            { 
              backgroundColor: ouEdgeInfo.isOver ? '#dcfce7' : '#fee2e2', 
              borderColor: ouEdgeInfo.isOver ? '#86efac' : '#fca5a5' 
            }
          ]}>
            <View style={styles.predictionHeader}>
              <MaterialCommunityIcons 
                name="chart-bar" 
                size={18} 
                color={ouEdgeInfo.isOver ? '#16A34A' : '#DC2626'} 
              />
              <Text style={[styles.predictionTitle, { color: theme.colors.onSurface }]}>Over/Under</Text>
            </View>

            <View style={styles.predictionContent}>
              <View style={styles.predictionValueContainer}>
                <Text style={[styles.predictionLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Model Predicts
                </Text>
                <Text style={[
                  styles.predictionValue, 
                  { color: ouEdgeInfo.isOver ? '#16A34A' : '#DC2626' }
                ]}>
                  {ouEdgeInfo.isOver ? '▲' : '▼'} {ouEdgeInfo.isOver ? 'OVER' : 'UNDER'}
                </Text>
              </View>

              <View style={styles.predictionValueContainer}>
                <Text style={[styles.predictionLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Edge
                </Text>
                <Text style={[styles.predictionValue, { color: theme.colors.onSurface }]}>
                  {ouEdgeInfo.displayMagnitude} pts
                </Text>
              </View>

              {predOverLine !== null && (
                <View style={styles.predictionValueContainer}>
                  <Text style={[styles.predictionLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Model Total
                  </Text>
                  <Text style={[styles.predictionValue, { color: theme.colors.onSurface }]}>
                    {roundToHalf(predOverLine).toFixed(1)}
                  </Text>
                </View>
              )}
            </View>

            {/* What This Means - O/U */}
            <TouchableOpacity onPress={() => setExpandedOU(!expandedOU)}>
              <View style={[
                styles.explanationHeader, 
                { backgroundColor: ouEdgeInfo.isOver ? '#f0fdf4' : '#fef2f2' }
              ]}>
                <MaterialCommunityIcons 
                  name="information" 
                  size={14} 
                  color={ouEdgeInfo.isOver ? '#16A34A' : '#DC2626'} 
                />
                <Text style={[styles.explanationTitle, { color: theme.colors.onSurface }]}>
                  What This Means
                </Text>
                <MaterialCommunityIcons 
                  name={expandedOU ? 'chevron-up' : 'chevron-down'} 
                  size={16} 
                  color={theme.colors.onSurfaceVariant} 
                />
              </View>
            </TouchableOpacity>

            {expandedOU && (
              <View style={[
                styles.expandedContent, 
                { backgroundColor: ouEdgeInfo.isOver ? '#f0fdf4' : '#fef2f2' }
              ]}>
                <Text style={[styles.explanation, { color: theme.colors.onSurfaceVariant }]}>
                  {getOUExplanation()}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  noPredictionContainer: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  noPredictionText: {
    fontSize: 14,
    textAlign: 'center',
  },
  scoreSection: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  scoreSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  scoreSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  scoresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  scoreColumn: {
    alignItems: 'center',
    flex: 1,
  },
  scoreTeamName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  vsContainer: {
    paddingHorizontal: 16,
  },
  vsText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  predictionContainer: {
    marginTop: 8,
  },
  predictionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  predictionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  predictionContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  predictionValueContainer: {
    alignItems: 'center',
    flex: 1,
  },
  predictionLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  predictionValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
    borderRadius: 8,
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  expandedContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  explanation: {
    fontSize: 12,
    lineHeight: 18,
  },
});

