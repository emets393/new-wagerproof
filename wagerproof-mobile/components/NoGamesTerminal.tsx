import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';

export type NoGamesTerminalContext =
  | 'feed_nfl'
  | 'feed_cfb'
  | 'feed_nba'
  | 'feed_ncaab'
  | 'feed_mlb'
  | 'scoreboard'
  | 'nba_trends'
  | 'ncaab_trends';

type NoGamesLineKind = 'status' | 'headline' | 'quip' | 'thought' | 'note';

interface NoGamesTerminalLine {
  kind: NoGamesLineKind;
  text: string;
}

interface NoGamesTerminalProps {
  context: NoGamesTerminalContext;
}

const TERMINAL_LINES: Record<NoGamesTerminalContext, NoGamesTerminalLine[]> = {
  feed_nfl: [
    { kind: 'status', text: 'NFL board check: no games today.' },
    { kind: 'headline', text: 'News cycle still active: monitor injury reports and practice notes.' },
    { kind: 'quip', text: 'Cheeky edge: the best bad bet is the one you skip.' },
    { kind: 'thought', text: 'Robot thought: empty slates are bankroll-preservation mode.' },
    { kind: 'note', text: 'Refresh later for schedule and line updates.' },
  ],
  feed_cfb: [
    { kind: 'status', text: 'CFB board check: no games today.' },
    { kind: 'headline', text: 'Conference chatter is live, but no kickoff windows right now.' },
    { kind: 'quip', text: 'Cheeky edge: no trap games if there are no games.' },
    { kind: 'thought', text: 'Robot thought: variance hates a patient bettor.' },
    { kind: 'note', text: 'Check back as game-day markets open up.' },
  ],
  feed_nba: [
    { kind: 'status', text: 'NBA slate is quiet right now.' },
    { kind: 'headline', text: 'Watch lineup news and rest tags before the next card drops.' },
    { kind: 'quip', text: 'Cheeky edge: no back-to-back fatigue for your wallet.' },
    { kind: 'thought', text: 'Robot thought: efficiency improves when volume is zero.' },
    { kind: 'note', text: 'Refresh later for new matchups and prices.' },
  ],
  feed_ncaab: [
    { kind: 'status', text: 'NCAAB slate is empty at the moment.' },
    { kind: 'headline', text: 'Bracket noise is loud, but there are no active games now.' },
    { kind: 'quip', text: 'Cheeky edge: no coin flips means no bad beats.' },
    { kind: 'thought', text: 'Robot thought: confidence threshold currently set to: wait.' },
    { kind: 'note', text: 'Return later for fresh lines and tip-off times.' },
  ],
  feed_mlb: [
    { kind: 'status', text: 'MLB board check: no games today.' },
    { kind: 'headline', text: 'Keep an eye on probable pitchers and weather edges.' },
    { kind: 'quip', text: 'Cheeky edge: your ROI is undefeated on days off.' },
    { kind: 'thought', text: 'Robot thought: no first innings, no first-inning stress.' },
    { kind: 'note', text: 'Refresh later when the next slate posts.' },
  ],
  scoreboard: [
    { kind: 'status', text: 'Live scoreboard is currently empty.' },
    { kind: 'headline', text: 'No games in progress across tracked leagues.' },
    { kind: 'quip', text: 'Cheeky edge: zero live sweat, maximum peace.' },
    { kind: 'thought', text: 'Robot thought: this is what low-volatility feels like.' },
    { kind: 'note', text: 'Check back once games are underway.' },
  ],
  nba_trends: [
    { kind: 'status', text: 'No NBA trend matchups available today.' },
    { kind: 'headline', text: 'Situational trend engine is standing by for the next slate.' },
    { kind: 'quip', text: 'Cheeky edge: trends can only trend when teams play.' },
    { kind: 'thought', text: 'Robot thought: sample size currently equal to zero.' },
    { kind: 'note', text: 'Refresh later for ATS and O/U trend cards.' },
  ],
  ncaab_trends: [
    { kind: 'status', text: 'No NCAAB trend matchups available today.' },
    { kind: 'headline', text: 'Trend cards will populate when games are on the board.' },
    { kind: 'quip', text: 'Cheeky edge: no games, no variance tax.' },
    { kind: 'thought', text: 'Robot thought: confidence model requests more data.' },
    { kind: 'note', text: 'Check back later for updated trend insights.' },
  ],
};

export function NoGamesTerminal({ context }: NoGamesTerminalProps) {
  const { isDark } = useThemeContext();
  const lines = useMemo(() => TERMINAL_LINES[context] ?? TERMINAL_LINES.scoreboard, [context]);
  const header = `terminal://no-games-${context}`;

  const terminalBackground = isDark ? '#070a0a' : '#101617';
  const terminalBorder = isDark ? 'rgba(0, 230, 118, 0.25)' : 'rgba(0, 186, 98, 0.28)';
  const terminalHeader = isDark ? '#9fb3ad' : '#b5c3bf';

  const getLineColor = (kind: NoGamesLineKind) => {
    if (kind === 'headline') return isDark ? '#00E676' : '#33F08A';
    if (kind === 'quip') return isDark ? '#8ca89b' : '#a8bbb5';
    if (kind === 'thought') return isDark ? '#7ebfda' : '#79c9e6';
    if (kind === 'note') return isDark ? '#b8c8c2' : '#d2dfdb';
    return isDark ? '#9adcae' : '#84dca7';
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: terminalBackground,
          borderColor: terminalBorder,
        },
      ]}
    >
      <Text style={[styles.headerText, { color: terminalHeader }]}>{header}</Text>
      {lines.map((line, index) => (
        <View key={`${line.kind}-${index}`} style={styles.lineRow}>
          <Text style={[styles.prefix, { color: isDark ? '#00E676' : '#00BA62' }]}>›</Text>
          <Text style={[styles.lineText, { color: getLineColor(line.kind) }]}>{line.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  headerText: {
    fontSize: 11,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  prefix: {
    marginRight: 8,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  lineText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
