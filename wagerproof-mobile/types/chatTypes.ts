// ContentBlock-based message model for agentic WagerBot chat.
// Modeled after Ellie's ContentBlock enum — each message contains
// an array of typed blocks that the UI renders per-block.

export type ToolStatus =
  | { state: 'running' }
  | { state: 'done'; ms: number; ok: boolean; summary: string };

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_use'; id: string; name: string; arguments: string; status: ToolStatus }
  | { type: 'follow_ups'; questions: string[] };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  blocks: ContentBlock[];
  timestamp: string;
}

// SSE event types emitted by the wagerbot-chat edge function
export interface WagerBotThreadEvent {
  thread_id: string;
  created: boolean;
}

export interface WagerBotToolStartEvent {
  id: string;
  name: string;
  arguments: unknown;
}

export interface WagerBotToolEndEvent {
  id: string;
  name: string;
  ms: number;
  ok: boolean;
  result_summary: string;
}

export interface WagerBotFollowUpsEvent {
  questions: string[];
}

export interface WagerBotErrorEvent {
  code: string;
  message: string;
}

export interface WagerBotThreadTitledEvent {
  thread_id: string;
  title: string;
}

// Union of all SSE events the client handles
export type WagerBotSSEEvent =
  | { type: 'thread'; data: WagerBotThreadEvent }
  | { type: 'tool_start'; data: WagerBotToolStartEvent }
  | { type: 'tool_end'; data: WagerBotToolEndEvent }
  | { type: 'follow_ups'; data: WagerBotFollowUpsEvent }
  | { type: 'message_persisted'; data: { role: string } }
  | { type: 'thread_titled'; data: WagerBotThreadTitledEvent }
  | { type: 'error'; data: WagerBotErrorEvent }
  | { type: 'content_delta'; data: { text: string } }
  | { type: 'thinking_delta'; data: { text: string } }
  | { type: 'thinking_done'; data: { summary: string } }
  | { type: 'done' };

// Tool display name mapping
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  get_nba_predictions: 'NBA Predictions',
  get_nfl_predictions: 'NFL Predictions',
  get_cfb_predictions: 'CFB Predictions',
  get_ncaab_predictions: 'NCAAB Predictions',
  get_mlb_predictions: 'MLB Predictions',
  get_polymarket_odds: 'Polymarket Odds',
  get_game_detail: 'Game Detail',
  search_games: 'Searching Games',
  get_editor_picks: 'Editor Picks',
  suggest_follow_ups: 'Follow-ups',
  web_search: 'Web Search',
};

// Tool icon mapping (MaterialCommunityIcons names)
export const TOOL_ICONS: Record<string, string> = {
  get_nba_predictions: 'basketball',
  get_nfl_predictions: 'football',
  get_cfb_predictions: 'football',
  get_ncaab_predictions: 'basketball',
  get_mlb_predictions: 'baseball',
  get_polymarket_odds: 'chart-line',
  get_game_detail: 'magnify',
  search_games: 'magnify',
  get_editor_picks: 'star',
  suggest_follow_ups: 'comment-question',
  web_search: 'web',
};
