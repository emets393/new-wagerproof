import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';
import type { PitcherArchetypeProfile } from '@/types/mlbPitcherMatchups';
import type { LineupRow } from '@/types/mlbPitcherMatchups';
import {
  BRAND_GREEN,
  formatPropLine,
  formatPropOdds,
  marketLabel,
  mlbHeadshotUrl,
  pickHeadlineProp,
} from '@/utils/mlbPlayerProps';
import { PlayerPropDetail } from './PlayerPropDetail';

interface PlayerPropCardProps {
  lineup?: LineupRow;
  playerId?: number;
  playerName?: string;
  playerProps: MlbPlayerPropRow[];
  opposingStarterName: string;
  opposingStarterHand: string;
  opposingArchetype: PitcherArchetypeProfile | null;
  isDark: boolean;
}

export function PlayerPropCard({
  lineup,
  playerId,
  playerName,
  playerProps,
  opposingStarterName,
  opposingStarterHand,
  opposingArchetype,
  isDark,
}: PlayerPropCardProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const resolvedPlayerId = lineup?.player_id ?? playerId ?? playerProps[0]?.player_id ?? 0;
  const resolvedPlayerName = lineup?.player_name ?? playerName ?? playerProps[0]?.player_name ?? 'Player';
  const myProps = playerProps.filter(p => p.player_id === resolvedPlayerId && !p.is_pitcher);
  const headline = pickHeadlineProp(myProps);
  if (!headline) return null;

  const { row, computed } = headline;

  return (
    <View style={[styles.card, { borderColor: isDark ? '#333' : '#e0e0e0', backgroundColor: isDark ? '#1a1a1a' : '#fafafa' }]}>
      <Pressable
        onPress={() => setExpanded(e => !e)}
        style={styles.header}
        accessibilityRole="button"
      >
        <Image source={{ uri: mlbHeadshotUrl(resolvedPlayerId) }} style={styles.headshot} />
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {lineup?.batting_order != null ? `${lineup.batting_order}. ` : ''}
            {resolvedPlayerName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
              {marketLabel(row.market)}
            </Text>
            <View style={{ backgroundColor: `${BRAND_GREEN}26`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
              <Text style={{ color: BRAND_GREEN, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                🔥 Best L10
              </Text>
            </View>
          </View>
          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
            O {formatPropLine(computed.line)} · {formatPropOdds(computed.overOdds)}
          </Text>
          <Text style={{ color: BRAND_GREEN, fontSize: 12, fontWeight: '700' }}>
            {computed.l10.over}/{computed.l10.games} Over
          </Text>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={theme.colors.onSurfaceVariant}
        />
      </Pressable>
      {expanded ? (
        <PlayerPropDetail
          playerProps={myProps}
          playerId={resolvedPlayerId}
          playerName={resolvedPlayerName}
          position={lineup?.position}
          batSide={lineup?.bat_side}
          opposingStarterName={opposingStarterName}
          opposingStarterHand={opposingStarterHand}
          opposingArchetype={opposingArchetype}
          isDark={isDark}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, marginBottom: 8, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    minHeight: 44,
    gap: 8,
  },
  headshot: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333' },
  headerText: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600' },
});
