import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useTheme } from 'react-native-paper';
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';
import type { PitcherArchetypeProfile } from '@/types/mlbPitcherMatchups';
import {
  BRAND_GREEN,
  buildVerdict,
  computePropAtLine,
  defaultLine,
  formatPropLine,
  formatPropOdds,
  marketLabel,
  mlbHeadshotUrl,
  splitFractionLabel,
  splitPctLabel,
  lowConfidence,
} from '@/utils/mlbPlayerProps';
import { RecentPropBarChart } from './RecentPropBarChart';
import { ARCHETYPE_META, isDisplayArchetype } from '@/utils/mlbPitcherArchetypes';

interface PlayerPropDetailProps {
  playerProps: MlbPlayerPropRow[];
  playerId: number;
  playerName: string;
  position?: string | null;
  batSide?: string | null;
  opposingStarterName: string;
  opposingStarterHand: string;
  opposingArchetype: PitcherArchetypeProfile | null;
  isPitcher?: boolean;
  isDark: boolean;
}

export function PlayerPropDetail({
  playerProps,
  playerId,
  playerName,
  position,
  batSide,
  opposingStarterName,
  opposingStarterHand,
  opposingArchetype,
  isPitcher = false,
  isDark,
}: PlayerPropDetailProps) {
  const theme = useTheme();
  const markets = useMemo(() => playerProps.filter(p => p.player_id === playerId), [playerProps, playerId]);
  const [selectedMarket, setSelectedMarket] = useState(markets[0]?.market ?? '');
  const activeRow = markets.find(m => m.market === selectedMarket) ?? markets[0];
  const [selectedLine, setSelectedLine] = useState<number | null>(activeRow ? defaultLine(activeRow.lines) : null);

  useEffect(() => {
    if (!activeRow) return;
    setSelectedLine(defaultLine(activeRow.lines));
  }, [activeRow?.market, playerId]);

  const computed = useMemo(() => {
    if (!activeRow || selectedLine == null) return null;
    return computePropAtLine(activeRow, selectedLine);
  }, [activeRow, selectedLine]);

  if (!activeRow || !computed || selectedLine == null) {
    return <Text style={{ color: theme.colors.onSurfaceVariant, fontStyle: 'italic' }}>No prop markets</Text>;
  }

  const verdict = buildVerdict(activeRow, computed);
  const archMeta =
    opposingArchetype && isDisplayArchetype(opposingArchetype.archetype)
      ? ARCHETYPE_META[opposingArchetype.archetype]
      : null;

  const subtitleParts = [
    position,
    batSide,
    !isPitcher ? `vs ${opposingStarterName} (${opposingStarterHand}HP)` : null,
    activeRow.game_is_day ? '☀️ Day' : '🌙 Night',
  ].filter(Boolean);

  return (
    <View style={styles.detail}>
      {markets.length > 1 ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Switch market
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.marketScroll}>
            {markets.map(p => {
              const active = p.market === selectedMarket;
              return (
                <Pressable
                  key={p.market}
                  onPress={() => setSelectedMarket(p.market)}
                  style={[
                    styles.marketChip,
                    {
                      backgroundColor: active ? BRAND_GREEN : isDark ? '#2a2a2a' : '#f0f0f0',
                      borderColor: active ? BRAND_GREEN : isDark ? '#444' : '#ddd',
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={{ color: active ? '#fff' : theme.colors.onSurface, fontSize: 12, fontWeight: active ? '700' : '600' }}>
                    {marketLabel(p.market)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ gap: 6 }}>
        <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {marketLabel(activeRow.market)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <Text style={{ color: BRAND_GREEN, fontSize: 32, fontWeight: '800' }}>
            {computed.l10.pct ?? '—'}
            {computed.l10.pct != null ? <Text style={{ fontSize: 18 }}>%</Text> : null}
          </Text>
          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
            Hit Rate · {computed.l10.over}/{computed.l10.games} last 10
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: `${BRAND_GREEN}66`, backgroundColor: `${BRAND_GREEN}1a` }}>
            <Text style={{ color: theme.colors.onSurface, fontSize: 11 }}>
              Over {formatPropLine(selectedLine)} {marketLabel(activeRow.market).toLowerCase()}{' '}
              <Text style={{ color: BRAND_GREEN, fontWeight: '800' }}>{formatPropOdds(computed.overOdds)}</Text>
            </Text>
          </View>
          <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: isDark ? '#444' : '#ddd', backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }}>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
              Under {formatPropLine(selectedLine)} {marketLabel(activeRow.market).toLowerCase()}{' '}
              <Text style={{ color: theme.colors.onSurface, fontWeight: '800' }}>{formatPropOdds(computed.underOdds)}</Text>
            </Text>
          </View>
        </View>
        <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
          {subtitleParts.join(' · ')}
        </Text>
        {archMeta ? (
          <Text style={{ color: BRAND_GREEN, fontSize: 11, marginTop: 2 }}>
            {archMeta.icon} {archMeta.label}
          </Text>
        ) : null}
      </View>

      <Text style={[styles.verdict, { color: theme.colors.onSurface }]}>{verdict}</Text>

      <RecentPropBarChart bars={computed.chartGames} line={selectedLine} isDark={isDark} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.lineScroll}>
        {activeRow.lines.map(entry => {
          const active = entry.line === selectedLine;
          return (
            <Pressable
              key={entry.line}
              onPress={() => setSelectedLine(entry.line)}
              style={[
                styles.lineChip,
                {
                  backgroundColor: active ? BRAND_GREEN : isDark ? '#2a2a2a' : '#f0f0f0',
                  borderColor: active ? BRAND_GREEN : isDark ? '#444' : '#ddd',
                },
              ]}
            >
              <Text style={{ color: active ? '#fff' : theme.colors.onSurface, fontWeight: '700', fontSize: 13 }}>
                {entry.line}
              </Text>
              {entry.over != null ? (
                <Text style={{ color: active ? '#fff' : theme.colors.onSurfaceVariant, fontSize: 10 }}>
                  O {formatPropOdds(entry.over)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.tiles}>
        <View style={[styles.tile, lowConfidence(computed.l10) && styles.tileMuted]}>
          <Text style={styles.tileLabel}>L10</Text>
          <Text style={[styles.tileBig, { color: BRAND_GREEN }]}>{splitFractionLabel(computed.l10)}</Text>
          <Text style={styles.tileSub}>Over · {splitPctLabel(computed.l10)}</Text>
        </View>
        {computed.contextualDayNight ? (
          <View style={[styles.tile, lowConfidence(computed.contextualDayNight) && styles.tileMuted]}>
            <Text style={styles.tileLabel}>{activeRow.game_is_day ? '☀️ Day' : '🌙 Night'}</Text>
            <Text style={[styles.tileBig, { color: BRAND_GREEN }]}>
              {splitFractionLabel(computed.contextualDayNight)}
            </Text>
            <Text style={styles.tileSub}>Over · {splitPctLabel(computed.contextualDayNight)}</Text>
          </View>
        ) : null}
        {computed.contextualArchetype && activeRow.opp_archetype_today ? (
          <View style={[styles.tile, lowConfidence(computed.contextualArchetype) && styles.tileMuted]}>
            <Text style={styles.tileLabel}>vs {activeRow.opp_archetype_today} SP</Text>
            <Text style={[styles.tileBig, { color: BRAND_GREEN }]}>
              {splitFractionLabel(computed.contextualArchetype)}
            </Text>
            <Text style={styles.tileSub}>
              starting pitchers · {splitPctLabel(computed.contextualArchetype)}
            </Text>
          </View>
        ) : null}
      </View>

      {!isPitcher && computed.contextualArchetype ? (
        <Text style={{ fontSize: 10, color: theme.colors.onSurfaceVariant, fontStyle: 'italic' }}>
          Archetype split is based on the opposing starting pitcher only — relievers are not counted.
        </Text>
      ) : null}

      <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
        {marketLabel(activeRow.market)} · O {formatPropLine(selectedLine)} · {formatPropOdds(computed.overOdds)} /{' '}
        {formatPropOdds(computed.underOdds)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { gap: 12, paddingTop: 8 },
  identity: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  headshot: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#333' },
  identityText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  verdict: { fontSize: 14, lineHeight: 20 },
  lineScroll: { flexGrow: 0 },
  lineChip: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flex: 1,
    minWidth: '30%',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#33333355',
    backgroundColor: '#18181888',
  },
  tileMuted: { opacity: 0.75 },
  tileLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: '#888' },
  tileBig: { fontSize: 22, fontWeight: '800', marginVertical: 2 },
  tileSub: { fontSize: 10, color: '#888' },
  marketScroll: { flexGrow: 0 },
  marketChip: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 6,
    justifyContent: 'center',
  },
});
