// ContentBlock-based message model for agentic WagerBot chat.
// Modeled after Ellie's ContentBlock enum — each message contains
// an array of typed blocks that the UI renders per-block.

export type ToolStatus =
  | { state: 'running' }
  | { state: 'done'; ms: number; ok: boolean; summary: string };

// Normalized game card data for inline chat rendering — works across all 5 sports
export interface ChatGameCardData {
  sport: 'nba' | 'nfl' | 'cfb' | 'ncaab' | 'mlb';
  game_id: string;
  away_team: string;
  home_team: string;
  away_abbr: string;
  home_abbr: string;
  game_date: string;
  game_time: string;
  // Odds
  home_spread: number | null;
  away_spread: number | null;
  home_ml: number | null;
  away_ml: number | null;
  over_under: number | null;
  // Model picks
  spread_pick: string | null;
  spread_confidence: number | null;
  spread_edge: number | null;
  ou_pick: 'over' | 'under' | null;
  ou_edge: number | null;
  ml_pick_team: string | null;
  ml_prob: number | null;
  // AI analysis text — injected by present_analysis tool
  analysis?: string;
  // Full game object for bottom sheet tap-through
  raw_game: Record<string, unknown>;
}

// Flexible widget data for inline chat rendering — one type covers all widget variants
export type ChatWidgetType = 'matchup' | 'model_projection' | 'polymarket' | 'public_betting' | 'injuries' | 'betting_trends' | 'weather';

export interface ChatWidgetData {
  widget_type: ChatWidgetType;
  sport: 'nba' | 'nfl' | 'cfb' | 'ncaab' | 'mlb';
  game_id: string;
  title?: string;
  analysis?: string;
  data: Record<string, unknown>;
  raw_game: Record<string, unknown>;
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_use'; id: string; name: string; arguments: string; status: ToolStatus }
  | { type: 'follow_ups'; questions: string[] }
  | { type: 'game_cards'; cards: ChatGameCardData[] }
  | { type: 'chat_widgets'; widgets: ChatWidgetData[] };

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
  | { type: 'game_cards'; data: { cards: ChatGameCardData[] } }
  | { type: 'game_analyses'; data: { summary: string; analyses: Array<{ game_id: string; analysis: string }> } }
  | { type: 'chat_widgets'; data: { widgets: ChatWidgetData[] } }
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
  present_analysis: 'Analysis',
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
  present_analysis: 'chart-box-outline',
  web_search: 'web',
};
