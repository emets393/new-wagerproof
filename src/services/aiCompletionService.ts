import { supabase } from '@/integrations/supabase/client';
import debug from '@/utils/debug';

export interface AICompletionConfig {
  id: string;
  widget_type: string;
  sport_type: 'nfl' | 'cfb';
  system_prompt: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface AICompletion {
  id: string;
  game_id: string;
  sport_type: 'nfl' | 'cfb';
  widget_type: string;
  completion_text: string;
  data_payload: any;
  generated_at: string;
  model_used: string;
}

export interface AIValueFind {
  id: string;
  sport_type: 'nfl' | 'cfb';
  analysis_date: string;
  value_picks: any[];
  analysis_json: any;
  summary_text: string;
  generated_at: string;
  generated_by: string | null;
}

export interface PageLevelSchedule {
  id: string;
  sport_type: 'nfl' | 'cfb';
  enabled: boolean;
  scheduled_time: string;
  system_prompt: string;
  last_run_at: string | null;
}

/**
 * Fetch AI completion for a specific game and widget type
 */
export async function getAICompletion(
  gameId: string,
  sportType: 'nfl' | 'cfb',
  widgetType: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('ai_completions')
      .select('completion_text')
      .eq('game_id', gameId)
      .eq('sport_type', sportType)
      .eq('widget_type', widgetType)
      .maybeSingle();

    if (error) {
      debug.error('Error fetching AI completion:', error);
      return null;
    }

    return data?.completion_text || null;
  } catch (error) {
    debug.error('Error in getAICompletion:', error);
    return null;
  }
}

/**
 * Fetch all completions for a game
 */
export async function getGameCompletions(
  gameId: string,
  sportType: 'nfl' | 'cfb'
): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase
      .from('ai_completions')
      .select('widget_type, completion_text')
      .eq('game_id', gameId)
      .eq('sport_type', sportType);

    if (error) {
      debug.error('Error fetching game completions:', error);
      return {};
    }

    return (data || []).reduce((acc, item) => {
      acc[item.widget_type] = item.completion_text;
      return acc;
    }, {} as Record<string, string>);
  } catch (error) {
    debug.error('Error in getGameCompletions:', error);
    return {};
  }
}

/**
 * Fetch all completion configs
 */
export async function getCompletionConfigs(): Promise<AICompletionConfig[]> {
  try {
    const { data, error } = await supabase
      .from('ai_completion_configs')
      .select('*')
      .order('sport_type', { ascending: true })
      .order('widget_type', { ascending: true });

    if (error) {
      debug.error('Error fetching completion configs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    debug.error('Error in getCompletionConfigs:', error);
    return [];
  }
}

/**
 * Update a completion config
 */
export async function updateCompletionConfig(
  id: string,
  updates: Partial<Pick<AICompletionConfig, 'system_prompt' | 'enabled'>>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ai_completion_configs')
      .update(updates)
      .eq('id', id);

    if (error) {
      debug.error('Error updating completion config:', error);
      return false;
    }

    return true;
  } catch (error) {
    debug.error('Error in updateCompletionConfig:', error);
    return false;
  }
}

/**
 * Manually trigger completion generation for a game
 */
export async function generateCompletion(
  gameId: string,
  sportType: 'nfl' | 'cfb',
  widgetType: string,
  gameDataPayload: any,
  customSystemPrompt?: string
): Promise<{ success: boolean; completion?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-ai-completion', {
      body: {
        game_id: gameId,
        sport_type: sportType,
        widget_type: widgetType,
        game_data_payload: gameDataPayload,
        custom_system_prompt: customSystemPrompt, // Optional override
      },
    });

    if (error) {
      debug.error('Error invoking generate-ai-completion:', error);
      return { success: false, error: error.message };
    }

    return data;
  } catch (error: any) {
    debug.error('Error in generateCompletion:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Trigger page-level analysis
 */
export async function generatePageLevelAnalysis(
  sportType: 'nfl' | 'cfb',
  analysisDate?: string,
  userId?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-page-level-analysis', {
      body: {
        sport_type: sportType,
        analysis_date: analysisDate,
        user_id: userId,
      },
    });

    if (error) {
      debug.error('Error invoking generate-page-level-analysis:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    debug.error('Error in generatePageLevelAnalysis:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get latest value finds for a sport
 */
export async function getLatestValueFinds(
  sportType: 'nfl' | 'cfb',
  limit: number = 1
): Promise<AIValueFind[]> {
  try {
    const { data, error } = await supabase
      .from('ai_value_finds')
      .select('*')
      .eq('sport_type', sportType)
      .order('generated_at', { ascending: false })
      .limit(limit);

    if (error) {
      debug.error('Error fetching value finds:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    debug.error('Error in getLatestValueFinds:', error);
    return [];
  }
}

/**
 * Get page-level schedule config
 */
export async function getPageLevelSchedule(
  sportType: 'nfl' | 'cfb'
): Promise<PageLevelSchedule | null> {
  try {
    const { data, error } = await supabase
      .from('ai_page_level_schedules')
      .select('*')
      .eq('sport_type', sportType)
      .single();

    if (error) {
      debug.error('Error fetching page level schedule:', error);
      return null;
    }

    return data;
  } catch (error) {
    debug.error('Error in getPageLevelSchedule:', error);
    return null;
  }
}

/**
 * Update page-level schedule
 */
export async function updatePageLevelSchedule(
  sportType: 'nfl' | 'cfb',
  updates: Partial<Pick<PageLevelSchedule, 'enabled' | 'scheduled_time' | 'system_prompt'>>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ai_page_level_schedules')
      .update(updates)
      .eq('sport_type', sportType);

    if (error) {
      debug.error('Error updating page level schedule:', error);
      return false;
    }

    return true;
  } catch (error) {
    debug.error('Error in updatePageLevelSchedule:', error);
    return false;
  }
}

/**
 * Build game data payload for AI completion
 * This is used by the payload viewer
 */
export function buildGameDataPayload(
  game: any,
  sportType: 'nfl' | 'cfb',
  widgetType: string,
  polymarketData?: any
): any {
  const basePayload = {
    game: {
      away_team: game.away_team,
      home_team: game.home_team,
      game_date: game.game_date,
      game_time: game.game_time,
    },
    vegas_lines: {
      home_spread: game.home_spread,
      away_spread: game.away_spread,
      home_ml: game.home_ml,
      away_ml: game.away_ml,
      over_line: sportType === 'nfl' ? game.over_line : (game.api_over_line || game.total_line),
    },
    weather: {
      temperature: sportType === 'nfl' ? game.temperature : (game.weather_temp_f || game.temperature),
      wind_speed: sportType === 'nfl' ? game.wind_speed : (game.weather_windspeed_mph || game.wind_speed),
      precipitation: game.precipitation,
      icon: sportType === 'nfl' ? game.icon : (game.weather_icon_text || game.icon_code),
    },
    public_betting: {
      spread_split: game.spread_splits_label,
      ml_split: game.ml_splits_label,
      total_split: game.total_splits_label,
    },
    polymarket: null as any, // Will be populated below
  };

  // Add polymarket data if available
  if (polymarketData) {
    basePayload.polymarket = {
      moneyline: polymarketData.moneyline ? {
        away_odds: polymarketData.moneyline.currentAwayOdds,
        home_odds: polymarketData.moneyline.currentHomeOdds,
      } : null,
      spread: polymarketData.spread ? {
        away_odds: polymarketData.spread.currentAwayOdds,
        home_odds: polymarketData.spread.currentHomeOdds,
      } : null,
      total: polymarketData.total ? {
        over_odds: polymarketData.total.currentAwayOdds,
        under_odds: polymarketData.total.currentHomeOdds,
      } : null,
    };
  }

  // Add widget-specific data
  if (widgetType === 'spread_prediction') {
    const spreadProb = sportType === 'nfl' 
      ? game.home_away_spread_cover_prob 
      : (game.pred_spread_proba || game.home_away_spread_cover_prob);

    return {
      ...basePayload,
      predictions: {
        spread_cover_prob: spreadProb,
        spread_line: game.home_spread,
        predicted_team: (spreadProb || 0) > 0.5 ? 'home' : 'away',
        confidence_level: spreadProb <= 0.58 ? 'low' : spreadProb <= 0.65 ? 'moderate' : 'high',
      },
    };
  } else if (widgetType === 'ou_prediction') {
    const ouProb = sportType === 'nfl'
      ? game.ou_result_prob
      : (game.pred_total_proba || game.ou_result_prob);

    return {
      ...basePayload,
      predictions: {
        ou_prob: ouProb,
        ou_line: basePayload.vegas_lines.over_line,
        predicted_result: (ouProb || 0) > 0.5 ? 'over' : 'under',
        confidence_level: ouProb <= 0.58 ? 'low' : ouProb <= 0.65 ? 'moderate' : 'high',
      },
    };
  }

  return basePayload;
}

