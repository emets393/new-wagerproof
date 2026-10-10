import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { CheatRow } from '@/features/nflTools/propMatchups/cheatsheet';
import { NflCheatSheet } from './NflCheatSheet';

function row(partial: Pick<CheatRow, 'family' | 'tableKey' | 'side' | 'positionFilter' | 'alignmentFilter' | 'player'>): CheatRow {
  return {
    team: 'CHI',
    opponent: 'DET',
    kickoff: null,
    headline: 'success_rate',
    metrics: { success_rate: { actual: 0.5, league: 0.4, lift: 0.25, rank: 8, of: 31 } },
    ...partial,
  };
}

describe('cheat sheet filters', () => {
  const html = renderToStaticMarkup(
    <TooltipProvider>
    <NflCheatSheet
      isLoading={false}
      games={[]}
      onClose={() => undefined}
      onTeam={() => undefined}
      onPlayer={() => undefined}
      rows={[
        row({ family: 'rushing', side: 'defense', tableKey: 'rush_def_RB', positionFilter: 'RB', alignmentFilter: null, player: { name: 'MarShawn Lloyd', player_id: '1', position: 'RB', share: 0.4, share_label: 'lead back' } }),
        row({ family: 'rushing', side: 'defense', tableKey: 'rush_def_QB', positionFilter: 'QB', alignmentFilter: null, player: { name: 'Jayden Daniels', player_id: '2', position: 'QB', share: 0.2, share_label: 'starting QB' } }),
        row({ family: 'receiving', side: 'defense', tableKey: 'recv_def_WR', positionFilter: 'WR', alignmentFilter: null, player: { name: 'Romeo Doubs', player_id: '3', position: 'WR', share: 0.3, share_label: 'WR1 by target share' } }),
        row({ family: 'receiving', side: 'defense', tableKey: 'recv_def_slot', positionFilter: null, alignmentFilter: 'slot', player: { name: 'Amon-Ra St. Brown', player_id: '4', position: 'WR', share: 0.5, share_label: 'most slot routes' } }),
      ]}
    />
    </TooltipProvider>,
  );

  it('shows one table, one team logo, and the description for that filter', () => {
    expect(html).toContain('fixed inset-0');
    expect(html).toContain('aria-label="Close cheat sheet"');
    expect(html).toContain('>Trenches<');
    expect(html).not.toContain('aria-label="Alignment"');
    expect(html.match(/<table/g)).toHaveLength(1);
    expect(html).toContain('>Passing<');
    expect(html).toContain('Run defense against running backs');
    expect(html).toContain('Green favors the team in the row');
    expect(html).toContain('sticky top-0');
    expect(html).toContain('>Opponent<');
    expect(html).toContain('a.espncdn.com/i/teamlogos/nfl/500/chi.png');
    expect(html).not.toContain('a.espncdn.com/i/teamlogos/nfl/500/det.png');
    expect(html).toContain('vs DET');
    expect(html).toContain('MarShawn Lloyd');
    expect(html).not.toContain('Jayden Daniels');
    expect(html).not.toContain('Romeo Doubs');
  });
});
