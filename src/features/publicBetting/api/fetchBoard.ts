import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type { PublicGame } from '../types';
import { groupBoardRows, parseBoardRow } from './groupBoard';
import { installBoardTeamAssets, teamRef } from './teams';

/** The board view is not in the database yet. The page stops here instead of reading the change log. */
export class BoardUnavailableError extends Error {
  readonly missingView = true;

  constructor() {
    super('The public betting board is not available yet.');
    this.name = 'BoardUnavailableError';
  }
}

function isMissingView(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? '';
  const message = error.message ?? '';
  return code === '42P01' || code === 'PGRST205' || /does not exist/i.test(message) || /schema cache/i.test(message);
}

/**
 * One read of `action_public_splits_board`. Sport and market filtering happens
 * after this returns. The view is already the newest row per game and market.
 */
export async function fetchPublicBoard(): Promise<PublicGame[]> {
  const [board] = await Promise.all([
    collegeFootballSupabase.from('action_public_splits_board').select('*').order('start_time', { ascending: true }),
    installBoardTeamAssets(),
  ]);

  if (board.error) {
    if (isMissingView(board.error)) throw new BoardUnavailableError();
    throw new Error(board.error.message || 'Could not load the public board');
  }

  const rows = (board.data ?? [])
    .map((row) => parseBoardRow(row as Record<string, unknown>))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return groupBoardRows(rows, teamRef);
}
