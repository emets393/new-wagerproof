import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import type { PitcherMatchupSummary } from '@/types/mlbPitcherMatchups';
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';
import { useMLBPlayerPropsL10 } from '@/hooks/useMLBPlayerPropsL10';
import { groupPropsByPlayer } from '@/utils/mlbPlayerProps';
import { StarterPropCard } from './StarterPropCard';
import { PlayerPropCard } from './PlayerPropCard';

interface PropMatchupCardProps {
  summary: PitcherMatchupSummary;
  isDark: boolean;
}

function formatGameTime(time: string | null): string {
  if (!time) return 'TBD';
  try {
    const d = new Date(time);
    if (!Number.isNaN(d.getTime())) {
      return (
        d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/New_York',
        }) + ' ET'
      );
    }
  } catch {
    /* ignore */
  }
  return time;
}

export function PropMatchupCard({ summary, isDark }: PropMatchupCardProps) {
  const theme = useTheme();
  const { game, awayLineup, homeLineup, awayPitcher, homePitcher } = summary;
  const { data: playerProps = [], isLoading } = useMLBPlayerPropsL10(game.game_pk, true);
  const gameIsDay = playerProps[0]?.game_is_day ?? false;
  const lineupIds = new Set([...awayLineup, ...homeLineup].map(row => row.player_id));
  const extraBatterGroups = [...groupPropsByPlayer(playerProps, false).entries()].filter(
    ([playerId]) => !lineupIds.has(playerId),
  );

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#181818' : '#fff', borderColor: isDark ? '#333' : '#e5e5e5' }]}>
      <View style={styles.header}>
        <Text style={[styles.matchupTitle, { color: theme.colors.onSurface }]}>
          {game.away_team_name} @ {game.home_team_name}
        </Text>
        <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
          {formatGameTime(game.game_time_et)} · {gameIsDay ? '☀️ Day' : '🌙 Night'}
        </Text>
      </View>

      <View style={styles.starters}>
        <StarterPropCard
          pitcherId={game.away_sp_id}
          pitcherName={game.away_sp_name}
          teamLabel={game.away_team_name}
          pitchHand={game.away_sp_hand ?? 'R'}
          archetype={awayPitcher.archetype}
          playerProps={playerProps}
          opposingStarterName={game.home_sp_name}
          opposingStarterHand={game.home_sp_hand ?? 'R'}
          isDark={isDark}
        />
        <StarterPropCard
          pitcherId={game.home_sp_id}
          pitcherName={game.home_sp_name}
          teamLabel={game.home_team_name}
          pitchHand={game.home_sp_hand ?? 'R'}
          archetype={homePitcher.archetype}
          playerProps={playerProps}
          opposingStarterName={game.away_sp_name}
          opposingStarterHand={game.away_sp_hand ?? 'R'}
          isDark={isDark}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator color="#22c55e" style={{ marginVertical: 16 }} />
      ) : playerProps.length === 0 ? (
        <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
          Props not posted yet — check back closer to first pitch
        </Text>
      ) : (
        <>
          <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
            {game.away_team_name} lineup
          </Text>
          {awayLineup.map(row => (
            <PlayerPropCard
              key={row.player_id}
              lineup={row}
              playerProps={playerProps.filter(p => p.player_id === row.player_id && !p.is_pitcher)}
              opposingStarterName={game.home_sp_name}
              opposingStarterHand={game.home_sp_hand ?? 'R'}
              opposingArchetype={homePitcher.archetype}
              isDark={isDark}
            />
          ))}
          <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant, marginTop: 8 }]}>
            {game.home_team_name} lineup
          </Text>
          {homeLineup.map(row => (
            <PlayerPropCard
              key={row.player_id}
              lineup={row}
              playerProps={playerProps.filter(p => p.player_id === row.player_id && !p.is_pitcher)}
              opposingStarterName={game.away_sp_name}
              opposingStarterHand={game.away_sp_hand ?? 'R'}
              opposingArchetype={awayPitcher.archetype}
              isDark={isDark}
            />
          ))}
          {extraBatterGroups.length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant, marginTop: 8 }]}>
                Posted batter props
              </Text>
              {extraBatterGroups.map(([playerId, props]) => (
                <PlayerPropCard
                  key={playerId}
                  playerId={playerId}
                  playerName={props[0]?.player_name ?? 'Player'}
                  playerProps={props}
                  opposingStarterName="opposing starter"
                  opposingStarterHand="R"
                  opposingArchetype={null}
                  isDark={isDark}
                />
              ))}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  header: { marginBottom: 12 },
  matchupTitle: { fontSize: 17, fontWeight: '700' },
  starters: { gap: 0 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  empty: { textAlign: 'center', fontSize: 13, fontStyle: 'italic', paddingVertical: 16 },
});
