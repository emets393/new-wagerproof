import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Portal, Dialog, Button, useTheme, ActivityIndicator, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import { TeamCircle } from './TeamCircle';

interface LineMovementModalProps {
  visible: boolean;
  uniqueId: string;
  homeTeam: string;
  awayTeam: string;
  onDismiss: () => void;
}

interface LineData {
  timestamp: string;
  home_spread: number;
  away_spread: number;
  over_line: number;
  home_ml: number;
  away_ml: number;
}

export const LineMovementModal: React.FC<LineMovementModalProps> = ({
  visible,
  uniqueId,
  homeTeam,
  awayTeam,
  onDismiss
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [lineData, setLineData] = useState<LineData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<'spread' | 'total' | 'ml'>('spread');

  useEffect(() => {
    if (visible && uniqueId) {
      fetchLineMovement();
    }
  }, [visible, uniqueId]);

  const fetchLineMovement = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await collegeFootballSupabase
        .from('nfl_line_movement')
        .select('*')
        .eq('unique_id', uniqueId)
        .order('timestamp', { ascending: true });

      if (fetchError) throw fetchError;
      setLineData(data || []);
    } catch (err) {
      console.error('Error fetching line movement:', err);
      setError('Failed to load line movement data');
      setLineData([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return timestamp;
    }
  };

  const renderLineDataRows = () => {
    if (lineData.length === 0) return null;

    return lineData.map((line, index) => (
      <View key={index} style={[styles.dataRow, { borderBottomColor: theme.colors.outlineVariant }]}>
        <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
          {formatTime(line.timestamp)}
        </Text>
        {selectedView === 'spread' && (
          <Text style={[styles.valueText, { color: theme.colors.onSurface }]}>
            {line.home_spread > 0 ? `+${line.home_spread}` : line.home_spread}
          </Text>
        )}
        {selectedView === 'total' && (
          <Text style={[styles.valueText, { color: theme.colors.onSurface }]}>
            {line.over_line}
          </Text>
        )}
        {selectedView === 'ml' && (
          <View style={styles.mlRow}>
            <Text style={[styles.mlText, { color: theme.colors.onSurface }]}>
              {line.away_ml > 0 ? `+${line.away_ml}` : line.away_ml}
            </Text>
            <Text style={[styles.mlSeparator, { color: theme.colors.onSurfaceVariant }]}>/</Text>
            <Text style={[styles.mlText, { color: theme.colors.onSurface }]}>
              {line.home_ml > 0 ? `+${line.home_ml}` : line.home_ml}
            </Text>
          </View>
        )}
      </View>
    ));
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title style={styles.title}>
          <MaterialCommunityIcons name="chart-line" size={24} color={theme.colors.primary} />
          <Text style={{ marginLeft: 10 }}>Line Movement</Text>
        </Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            <View style={styles.teamsRow}>
              <View style={styles.teamColumn}>
                <TeamCircle teamCity={awayTeam} size="small" />
                <Text style={[styles.teamName, { color: theme.colors.onSurface }]}>
                  {awayTeam}
                </Text>
              </View>
              <Text style={[styles.vs, { color: theme.colors.onSurfaceVariant }]}>@</Text>
              <View style={styles.teamColumn}>
                <TeamCircle teamCity={homeTeam} size="small" />
                <Text style={[styles.teamName, { color: theme.colors.onSurface }]}>
                  {homeTeam}
                </Text>
              </View>
            </View>

            <View style={styles.chipContainer}>
              <Chip 
                selected={selectedView === 'spread'}
                onPress={() => setSelectedView('spread')}
                style={styles.chip}
              >
                Spread
              </Chip>
              <Chip 
                selected={selectedView === 'total'}
                onPress={() => setSelectedView('total')}
                style={styles.chip}
              >
                Total
              </Chip>
              <Chip 
                selected={selectedView === 'ml'}
                onPress={() => setSelectedView('ml')}
                style={styles.chip}
              >
                Moneyline
              </Chip>
            </View>

            {loading && (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
                  Loading line movement...
                </Text>
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle" size={40} color={theme.colors.error} />
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
              </View>
            )}

            {!loading && !error && lineData.length === 0 && (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="information-outline" size={40} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                  No line movement data available
                </Text>
              </View>
            )}

            {!loading && !error && lineData.length > 0 && (
              <View style={styles.dataContainer}>
                <View style={[styles.headerRow, { borderBottomColor: theme.colors.primary }]}>
                  <Text style={[styles.headerText, { color: theme.colors.primary }]}>
                    Time
                  </Text>
                  <Text style={[styles.headerText, { color: theme.colors.primary }]}>
                    {selectedView === 'spread' && 'Spread'}
                    {selectedView === 'total' && 'Total'}
                    {selectedView === 'ml' && 'Moneyline (A/H)'}
                  </Text>
                </View>
                {renderLineDataRows()}
              </View>
            )}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollArea: {
    maxHeight: 450,
    paddingHorizontal: 0,
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 15,
  },
  teamColumn: {
    alignItems: 'center',
    gap: 5,
  },
  teamName: {
    fontSize: 12,
    fontWeight: '600',
  },
  vs: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  chipContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  chip: {
    marginHorizontal: 5,
  },
  centerContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
  },
  dataContainer: {
    marginTop: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 2,
  },
  headerText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
  },
  timeText: {
    fontSize: 12,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  mlRow: {
    flexDirection: 'row',
    gap: 5,
  },
  mlText: {
    fontSize: 14,
    fontWeight: '600',
  },
  mlSeparator: {
    fontSize: 14,
  },
});

