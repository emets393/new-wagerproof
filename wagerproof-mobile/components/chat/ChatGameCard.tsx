// ChatGameCard — Compact inline game card for WagerBot chat.
// Shows team logos, matchup, odds, and model picks. Tappable to
// open the full game detail bottom sheet.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ChatGameCardData } from '../../types/chatTypes';
import { TeamAvatar } from '../TeamAvatar';

interface ChatGameCardProps {
  card: ChatGameCardData;
  onPress: (card: ChatGameCardData) => void;
}

const SPORT_LABELS: Record<string, string> = {
  nba: 'NBA',
  nfl: 'NFL',
  cfb: 'CFB',
  ncaab: 'NCAAB',
  mlb: 'MLB',
};

function getEdgeColor(edge: number | null): string {
  if (edge == null) return 'rgba(255,255,255,0.4)';
  if (edge >= 5) return '#22c55e';
  if (edge >= 3) return '#84cc16';
  if (edge >= 2) return '#eab308';
  return '#f97316';
}

function formatOdds(n: number | null): string {
  if (n == null) return '';
  return n > 0 ? `+${n}` : String(n);
}

function formatTime(time: string): string {
  if (!time) return '';
  // Handle ISO timestamps (e.g., "2026-04-10T23:10:00+00")
  if (time.includes('T')) {
    try {
      const d = new Date(time);
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
    } catch { return time; }
  }
  // Strip seconds if present, keep AM/PM or ET
  return time.replace(/:\d{2}(?=\s|$)/, '');
}

export default function ChatGameCard({ card, onPress }: ChatGameCardProps) {
  const hasPicks = card.ml_pick_team || card.ou_pick;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => onPress(card)}
    >
      {/* Matchup header */}
      <View style={styles.headerRow}>
        <View style={styles.teamSide}>
          <TeamAvatar
            teamName={card.away_team}
            sport={card.sport as any}
            size={24}
          />
          <Text style={styles.teamAbbr}>{card.away_abbr}</Text>
        </View>

        <View style={styles.centerInfo}>
          <Text style={styles.atSymbol}>@</Text>
          {card.over_under != null && (
            <View style={styles.ouBadge}>
              <Text style={styles.ouBadgeText}>O/U: {card.over_under}</Text>
            </View>
          )}
        </View>

        <View style={[styles.teamSide, styles.teamSideRight]}>
          <Text style={styles.teamAbbr}>{card.home_abbr}</Text>
          <TeamAvatar
            teamName={card.home_team}
            sport={card.sport as any}
            size={24}
          />
        </View>

        {card.game_time ? (
          <View style={styles.timeBadge}>
            <Text style={styles.timeText}>{formatTime(card.game_time)}</Text>
          </View>
        ) : null}
      </View>

      {/* Odds row */}
      <View style={styles.oddsRow}>
        <Text style={styles.oddsText}>
          {formatOdds(card.away_spread)} {formatOdds(card.away_ml)}
        </Text>
        <Text style={styles.oddsDivider}>•</Text>
        <Text style={styles.oddsText}>
          {formatOdds(card.home_spread)} {formatOdds(card.home_ml)}
        </Text>
      </View>

      {/* Model picks */}
      {hasPicks && (
        <>
          <View style={styles.divider} />
          <View style={styles.picksRow}>
            {card.ml_pick_team && (
              <View style={styles.pickPill}>
                <TeamAvatar
                  teamName={card.ml_pick_team === card.home_abbr ? card.home_team : card.away_team}
                  sport={card.sport as any}
                  size={16}
                />
                <Text style={styles.pickLabel}>ML: {card.ml_pick_team}</Text>
                {card.ml_prob != null && (
                  <Text style={[styles.pickValue, { color: getEdgeColor(card.ml_prob > 55 ? card.ml_prob - 50 : 0) }]}>
                    {card.ml_prob}%
                  </Text>
                )}
              </View>
            )}
            {card.ou_pick && (
              <View style={styles.pickPill}>
                <MaterialCommunityIcons
                  name={card.ou_pick === 'over' ? 'arrow-up-bold' : 'arrow-down-bold'}
                  size={14}
                  color={card.ou_pick === 'over' ? '#22c55e' : '#ef4444'}
                />
                <Text style={styles.pickLabel}>
                  O/U: {card.ou_pick === 'over' ? 'Over' : 'Under'}
                </Text>
                {card.ou_edge != null && (
                  <Text style={[styles.pickValue, { color: getEdgeColor(card.ou_edge) }]}>
                    {card.ou_pick === 'over' ? '+' : '-'}{card.ou_edge}
                  </Text>
                )}
              </View>
            )}
          </View>
        </>
      )}

      {/* AI analysis — injected by present_analysis tool */}
      {card.analysis ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.analysisText}>{card.analysis}</Text>
        </>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamSideRight: {
    flexDirection: 'row-reverse',
    gap: 6,
  },
  teamAbbr: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  centerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  atSymbol: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 12,
    fontWeight: '600',
  },
  ouBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ouBadgeText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '600',
  },
  timeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  timeText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontWeight: '600',
  },
  oddsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  oddsText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
  },
  oddsDivider: {
    color: 'rgba(255, 255, 255, 0.15)',
    fontSize: 11,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 8,
  },
  picksRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pickLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  pickValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  analysisText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    lineHeight: 19,
  },
});
