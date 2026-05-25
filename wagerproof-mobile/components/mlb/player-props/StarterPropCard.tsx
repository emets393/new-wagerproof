import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';
import type { PitcherArchetypeProfile } from '@/types/mlbPitcherMatchups';
import {
  BRAND_GREEN,
  formatPropLine,
  formatPropOdds,
  marketLabel,
  mlbHeadshotUrl,
  pickHeadlineProp,
} from '@/utils/mlbPlayerProps';
import { PlayerPropDetail } from './PlayerPropDetail';
import { ARCHETYPE_META, isDisplayArchetype } from '@/utils/mlbPitcherArchetypes';

interface StarterPropCardProps {
  pitcherId: number;
  pitcherName: string;
  teamLabel: string;
  pitchHand: string;
  archetype: PitcherArchetypeProfile | null;
  playerProps: MlbPlayerPropRow[];
  opposingStarterName: string;
  opposingStarterHand: string;
  isDark: boolean;
}

export function StarterPropCard({
  pitcherId,
  pitcherName,
  teamLabel,
  pitchHand,
  archetype,
  playerProps,
  opposingStarterName,
  opposingStarterHand,
  isDark,
}: StarterPropCardProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const myProps = playerProps.filter(p => p.player_id === pitcherId && p.is_pitcher);
  const kProps = myProps.filter(p => p.market === 'pitcher_strikeouts');
  const headline = pickHeadlineProp(kProps.length > 0 ? kProps : myProps);
  const archMeta = archetype && isDisplayArchetype(archetype.archetype) ? ARCHETYPE_META[archetype.archetype] : null;

  return (
    <View style={[styles.card, { borderColor: isDark ? '#333' : '#e0e0e0', backgroundColor: isDark ? '#202020' : '#f5f5f5' }]}>
      <View style={styles.top}>
        <Image source={{ uri: mlbHeadshotUrl(pitcherId) }} style={styles.headshot} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.colors.onSurface }]}>{pitcherName}</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
            {teamLabel} · {pitchHand}HP
          </Text>
          {archMeta ? (
            <Text style={{ color: BRAND_GREEN, fontSize: 11, marginTop: 2 }}>
              {archMeta.icon} {archMeta.label}
            </Text>
          ) : null}
        </View>
      </View>
      {headline ? (
        <Pressable onPress={() => setExpanded(e => !e)} style={styles.propBtn}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ color: theme.colors.onSurface, fontSize: 12, fontWeight: '600' }}>
                {marketLabel(headline.row.market)}
              </Text>
              <View style={{ backgroundColor: `${BRAND_GREEN}26`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
                <Text style={{ color: BRAND_GREEN, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  🔥 {headline.row.market === 'pitcher_strikeouts' ? 'K Anchor' : 'Best L10'}
                </Text>
              </View>
            </View>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
              O {formatPropLine(headline.computed.line)} · {formatPropOdds(headline.computed.overOdds)} ·{' '}
              <Text style={{ color: BRAND_GREEN, fontWeight: '700' }}>
                {headline.computed.l10.over}/{headline.computed.l10.games}
              </Text>{' '}
              <Text style={{ color: theme.colors.onSurfaceVariant }}>last 10</Text>
            </Text>
          </View>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
        </Pressable>
      ) : (
        <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11, fontStyle: 'italic', padding: 8 }}>
          Strikeout prop not posted
        </Text>
      )}
      {expanded && headline ? (
        <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
          <PlayerPropDetail
            playerProps={myProps}
            playerId={pitcherId}
            playerName={pitcherName}
            opposingStarterName={opposingStarterName}
            opposingStarterHand={opposingStarterHand}
            opposingArchetype={null}
            isPitcher
            isDark={isDark}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 8 },
  top: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  headshot: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#333' },
  name: { fontSize: 14, fontWeight: '700' },
  propBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#00000022',
  },
});
