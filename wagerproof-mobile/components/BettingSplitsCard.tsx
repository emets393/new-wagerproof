import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, useTheme, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface BettingSplitsCardProps {
  spreadSplits?: string;
  totalSplits?: string;
  mlSplits?: string;
  expanded?: boolean;
}

export const BettingSplitsCard: React.FC<BettingSplitsCardProps> = ({
  spreadSplits,
  totalSplits,
  mlSplits,
  expanded = false
}) => {
  const theme = useTheme();

  const parseSplits = (splitString: string | undefined) => {
    if (!splitString) return null;
    
    // Example format: "72% (Public) 28% CHI (Sharp)"
    const match = splitString.match(/(\d+)%.*?(\d+)%\s+(\w+)/);
    if (!match) return null;
    
    return {
      public: parseInt(match[1]),
      sharp: parseInt(match[2]),
      team: match[3]
    };
  };

  const spreadData = parseSplits(spreadSplits);
  const totalData = parseSplits(totalSplits);
  const mlData = parseSplits(mlSplits);

  const hasData = spreadSplits || totalSplits || mlSplits;

  if (!hasData) return null;

  const getSharpIndicator = (publicPct: number, sharpPct: number) => {
    const diff = Math.abs(publicPct - sharpPct);
    if (diff >= 20) return { label: 'Sharp Money', color: '#22c55e' };
    if (diff >= 10) return { label: 'Slight Edge', color: '#f59e0b' };
    return { label: 'Public Consensus', color: '#6b7280' };
  };

  return (
    <View>
      {!expanded ? (
            <View style={styles.collapsedView}>
              <View style={styles.chipRow}>
                {spreadData && (
                  <Chip 
                    icon="chart-line" 
                    style={[styles.chip, { backgroundColor: theme.colors.primaryContainer }]}
                    textStyle={{ fontSize: 11 }}
                  >
                    Spread: {spreadData.public}% Public
                  </Chip>
                )}
                {totalData && (
                  <Chip 
                    icon="numeric" 
                    style={[styles.chip, { backgroundColor: theme.colors.primaryContainer }]}
                    textStyle={{ fontSize: 11 }}
                  >
                    O/U: {totalData.public}% Public
                  </Chip>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.expandedView}>
              {spreadData && (
                <View style={styles.splitSection}>
                  <Text style={[styles.splitTitle, { color: theme.colors.onSurface }]}>
                    Spread Betting
                  </Text>
                  <View style={styles.splitBar}>
                    <View 
                      style={[
                        styles.publicBar, 
                        { 
                          width: `${spreadData.public}%`,
                          backgroundColor: '#60a5fa'
                        }
                      ]}
                    >
                      <Text style={styles.barLabel}>{spreadData.public}% Public</Text>
                    </View>
                  </View>
                  <View style={styles.splitBar}>
                    <View 
                      style={[
                        styles.sharpBar, 
                        { 
                          width: `${spreadData.sharp}%`,
                          backgroundColor: '#fbbf24'
                        }
                      ]}
                    >
                      <Text style={styles.barLabel}>{spreadData.sharp}% Sharp ({spreadData.team})</Text>
                    </View>
                  </View>
                  {(() => {
                    const indicator = getSharpIndicator(spreadData.public, spreadData.sharp);
                    return (
                      <Chip 
                        style={[styles.indicatorChip, { backgroundColor: indicator.color }]}
                        textStyle={{ color: '#fff', fontSize: 12 }}
                      >
                        {indicator.label}
                      </Chip>
                    );
                  })()}
                </View>
              )}

              {totalData && (
                <View style={styles.splitSection}>
                  <Text style={[styles.splitTitle, { color: theme.colors.onSurface }]}>
                    Over/Under Betting
                  </Text>
                  <View style={styles.splitBar}>
                    <View 
                      style={[
                        styles.publicBar, 
                        { 
                          width: `${totalData.public}%`,
                          backgroundColor: '#60a5fa'
                        }
                      ]}
                    >
                      <Text style={styles.barLabel}>{totalData.public}% Public</Text>
                    </View>
                  </View>
                  <View style={styles.splitBar}>
                    <View 
                      style={[
                        styles.sharpBar, 
                        { 
                          width: `${totalData.sharp}%`,
                          backgroundColor: '#fbbf24'
                        }
                      ]}
                    >
                      <Text style={styles.barLabel}>{totalData.sharp}% Sharp</Text>
                    </View>
                  </View>
                  {(() => {
                    const indicator = getSharpIndicator(totalData.public, totalData.sharp);
                    return (
                      <Chip 
                        style={[styles.indicatorChip, { backgroundColor: indicator.color }]}
                        textStyle={{ color: '#fff', fontSize: 12 }}
                      >
                        {indicator.label}
                      </Chip>
                    );
                  })()}
                </View>
              )}

              {mlData && (
                <View style={styles.splitSection}>
                  <Text style={[styles.splitTitle, { color: theme.colors.onSurface }]}>
                    Moneyline Betting
                  </Text>
                  <View style={styles.splitBar}>
                    <View 
                      style={[
                        styles.publicBar, 
                        { 
                          width: `${mlData.public}%`,
                          backgroundColor: '#60a5fa'
                        }
                      ]}
                    >
                      <Text style={styles.barLabel}>{mlData.public}% Public</Text>
                    </View>
                  </View>
                  <View style={styles.splitBar}>
                    <View 
                      style={[
                        styles.sharpBar, 
                        { 
                          width: `${mlData.sharp}%`,
                          backgroundColor: '#fbbf24'
                        }
                      ]}
                    >
                      <Text style={styles.barLabel}>{mlData.sharp}% Sharp ({mlData.team})</Text>
                    </View>
                  </View>
                  {(() => {
                    const indicator = getSharpIndicator(mlData.public, mlData.sharp);
                    return (
                      <Chip 
                        style={[styles.indicatorChip, { backgroundColor: indicator.color }]}
                        textStyle={{ color: '#fff', fontSize: 12 }}
                      >
                        {indicator.label}
                      </Chip>
                    );
                  })()}
                </View>
              )}

              <View style={styles.legend}>
                <Text style={[styles.legendTitle, { color: theme.colors.onSurface }]}>
                  Understanding the Splits:
                </Text>
                <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                  <Text style={{ fontWeight: 'bold' }}>Public Money:</Text> Recreational bettors
                </Text>
                <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                  <Text style={{ fontWeight: 'bold' }}>Sharp Money:</Text> Professional bettors
                </Text>
                <Text style={[styles.legendNote, { color: theme.colors.onSurfaceVariant }]}>
                  When sharp money significantly differs from public money, it often indicates value.
                </Text>
              </View>
            </View>
          )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
    borderRadius: 12,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  collapsedView: {
    marginTop: 5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginRight: 5,
    marginBottom: 5,
  },
  expandedView: {
    marginTop: 10,
  },
  splitSection: {
    marginBottom: 20,
  },
  splitTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  splitBar: {
    height: 32,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    marginBottom: 8,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  publicBar: {
    height: '100%',
    justifyContent: 'center',
    paddingLeft: 10,
  },
  sharpBar: {
    height: '100%',
    justifyContent: 'center',
    paddingLeft: 10,
  },
  barLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  indicatorChip: {
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  legend: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  legendTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  legendText: {
    fontSize: 12,
    marginBottom: 4,
  },
  legendNote: {
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
});

