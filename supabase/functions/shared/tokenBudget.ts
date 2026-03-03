import { Tiktoken } from 'npm:js-tiktoken/lite';
import o200kBase from 'npm:js-tiktoken/ranks/o200k_base';

export const MODEL_CONTEXT_LIMIT = 400_000;
// Empirical guardrail: OpenAI rejected a generate-avatar-picks request at ~319k total
// tokens for gpt-5-mini on 2026-02-28, so keep a wider safety margin.
export const SOFT_SEND_LIMIT = 300_000;
export const OUTPUT_RESERVE = 15_000;

export type PayloadBudgetMode = 'full' | 'no_trends' | 'no_trends_trimmed';

export interface PromptTokenCount {
  system_tokens: number;
  user_tokens: number;
  reserved_output_tokens: number;
  total_tokens: number;
}

export interface PayloadBudget {
  system_tokens: number;
  user_tokens: number;
  reserved_output_tokens: number;
  total_tokens: number;
  mode_used: PayloadBudgetMode;
  removed_game_ids: string[];
  removed_games_count: number;
}

interface TrimGamesByLatestTipoffArgs {
  games: Record<string, unknown>[];
  systemPrompt: string;
  softLimit: number;
  outputReserve?: number;
  buildUserPrompt: (
    gamesData: Record<string, unknown>[],
    sport: string,
    targetDate: string
  ) => string;
  targetDate: string;
  sport?: string;
}

interface TrimGamesByLatestTipoffResult {
  trimmedGames: Record<string, unknown>[];
  removedGameIds: string[];
  finalTokenCount: PromptTokenCount;
}

let tokenizer: Tiktoken | null = null;

function getTokenizer(): Tiktoken {
  if (!tokenizer) {
    tokenizer = new Tiktoken(o200kBase);
  }
  return tokenizer;
}

function countTokens(text: string): number {
  return getTokenizer().encode(text).length;
}

export function countPromptTokens(
  systemPrompt: string,
  userPrompt: string,
  outputReserve: number = OUTPUT_RESERVE
): PromptTokenCount {
  const systemTokens = countTokens(systemPrompt);
  const userTokens = countTokens(userPrompt);

  return {
    system_tokens: systemTokens,
    user_tokens: userTokens,
    reserved_output_tokens: outputReserve,
    total_tokens: systemTokens + userTokens + outputReserve,
  };
}

export function removeSituationalTrendsFromGames(
  games: Record<string, unknown>[]
): Record<string, unknown>[] {
  return games.map((game) => {
    const { situational_trends: _situationalTrends, ...rest } = game;
    return rest;
  });
}

export function trimGamesByLatestTipoff({
  games,
  systemPrompt,
  softLimit,
  outputReserve = OUTPUT_RESERVE,
  buildUserPrompt,
  targetDate,
  sport = 'MULTI',
}: TrimGamesByLatestTipoffArgs): TrimGamesByLatestTipoffResult {
  const workingGames = [...games].sort(compareGamesByLatestTipoffDesc);
  const removedGameIds: string[] = [];

  let trimmedGames = [...workingGames];
  let finalTokenCount = countPromptTokens(
    systemPrompt,
    buildUserPrompt(trimmedGames, sport, targetDate),
    outputReserve
  );

  while (trimmedGames.length > 0 && finalTokenCount.total_tokens > softLimit) {
    const removedGame = trimmedGames.shift();
    if (removedGame) {
      removedGameIds.push(getGameIdentifier(removedGame));
    }

    finalTokenCount = countPromptTokens(
      systemPrompt,
      buildUserPrompt(trimmedGames, sport, targetDate),
      outputReserve
    );
  }

  return {
    trimmedGames,
    removedGameIds,
    finalTokenCount,
  };
}

export function buildPayloadBudget(
  tokenCount: PromptTokenCount,
  modeUsed: PayloadBudgetMode,
  removedGameIds: string[]
): PayloadBudget {
  return {
    ...tokenCount,
    mode_used: modeUsed,
    removed_game_ids: removedGameIds,
    removed_games_count: removedGameIds.length,
  };
}

function compareGamesByLatestTipoffDesc(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): number {
  const timeDiff = getSortableGameTimestamp(b) - getSortableGameTimestamp(a);
  if (timeDiff !== 0) return timeDiff;

  const matchupA = String(a.matchup || '');
  const matchupB = String(b.matchup || '');
  const matchupDiff = matchupB.localeCompare(matchupA);
  if (matchupDiff !== 0) return matchupDiff;

  const gameIdA = String(a.game_id || '');
  const gameIdB = String(b.game_id || '');
  return gameIdB.localeCompare(gameIdA);
}

function getSortableGameTimestamp(game: Record<string, unknown>): number {
  const rawGameTime = String(game.game_time || '').trim();
  const directTime = Date.parse(rawGameTime);
  if (!Number.isNaN(directTime)) return directTime;

  const rawGameDate = String(game.game_date || '').trim();
  const normalizedTime = normalizeTimeValue(rawGameTime);

  if (rawGameDate && normalizedTime) {
    const combined = Date.parse(`${rawGameDate}T${normalizedTime}`);
    if (!Number.isNaN(combined)) return combined;
  }

  const dateOnly = Date.parse(rawGameDate);
  if (!Number.isNaN(dateOnly)) return dateOnly;

  return 0;
}

function normalizeTimeValue(value: string): string | null {
  if (!value) return null;

  if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  if (/^\d{2}:\d{2}:\d{2}Z$/.test(value)) return value;

  return null;
}

function getGameIdentifier(game: Record<string, unknown>): string {
  return String(
    game.game_id ||
    game.matchup ||
    `${String(game.away_team || 'away')}@${String(game.home_team || 'home')}`
  );
}
