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
  high_value_badges: any[];
  page_header_data: {
    summary_text: string;
    compact_picks: any[];
  };
  editor_cards: any[];
  value_picks: any[]; // Backward compat
  analysis_json: any;
  summary_text: string;
  generated_at: string;
  generated_by: string | null;
  published: boolean;
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

    // Check if the data itself indicates an error (from Edge Function's error response)
    if (data && !data.success) {
      debug.error('Edge Function returned error:', data);
      return { 
        success: false, 
        error: `${data.error || 'Unknown error'}${data.errorType ? ` (${data.errorType})` : ''}${data.stack ? `\n\n${data.stack}` : ''}`
      };
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

/**
 * Toggle the published status of a Value Find
 */
export async function toggleValueFindPublished(
  valueFindId: string,
  published: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('ai_value_finds')
      .update({ published })
      .eq('id', valueFindId);

    if (error) throw error;

    debug.log(`Value Find ${valueFindId} ${published ? 'published' : 'unpublished'}`);
    return { success: true };
  } catch (error) {
    debug.error('Error toggling Value Find published status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get latest value finds for preview in AI Settings (published or unpublished)
 * This allows admins to see and manage the most recent value finds regardless of status
 */
export async function getUnpublishedValueFinds(
  sportType: 'nfl' | 'cfb'
): Promise<AIValueFind | null> {
  try {
    const { data, error } = await supabase
      .from('ai_value_finds')
      .select('*')
      .eq('sport_type', sportType)
      .order('generated_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    debug.error('Error fetching latest value finds:', error);
    return null;
  }
}

/**
 * Get high value badges for a sport (only published)
 */
export async function getHighValueBadges(
  sportType: 'nfl' | 'cfb'
): Promise<Array<{ game_id: string; recommended_pick: string; confidence: number; tooltip_text: string }>> {
  try {
    const { data, error} = await supabase
      .from('ai_value_finds')
      .select('high_value_badges')
      .eq('sport_type', sportType)
      .eq('published', true)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return data?.high_value_badges || [];
  } catch (error) {
    debug.error('Error fetching high value badges:', error);
    return [];
  }
}

/**
 * Get page header data for a sport (only published by default, unless admin mode is specified)
 */
export async function getPageHeaderData(
  sportType: 'nfl' | 'cfb',
  includeUnpublished: boolean = false
): Promise<{ id: string; published: boolean; data: { summary_text: string; compact_picks: any[] } } | null> {
  try {
    let query = supabase
      .from('ai_value_finds')
      .select('id, published, page_header_data')
      .eq('sport_type', sportType);
    
    // Only filter by published status if not including unpublished
    if (!includeUnpublished) {
      query = query.eq('published', true);
    }
    
    const { data, error } = await query
      .order('generated_at', { ascending: false})
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data?.page_header_data) return null;

    return {
      id: data.id,
      published: data.published,
      data: data.page_header_data,
    };
  } catch (error) {
    debug.error('Error fetching page header data:', error);
    return null;
  }
}

/**
 * Get editor cards for a sport (only published)
 */
export async function getEditorCards(
  sportType: 'nfl' | 'cfb'
): Promise<Array<any>> {
  try {
    const { data, error } = await supabase
      .from('ai_value_finds')
      .select('editor_cards')
      .eq('sport_type', sportType)
      .eq('published', true)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return data?.editor_cards || [];
  } catch (error) {
    debug.error('Error fetching editor cards:', error);
    return [];
  }
}

/**
 * Delete a Value Find completely from the database
 */
export async function deleteValueFind(
  valueFindId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('ai_value_finds')
      .delete()
      .eq('id', valueFindId);

    if (error) throw error;

    debug.log(`Value Find ${valueFindId} deleted`);
    return { success: true };
  } catch (error) {
    debug.error('Error deleting Value Find:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Bulk generate missing completions for games in the next 3 days
 * Calls the check-missing-completions edge function which handles both NFL and CFB
 */
export async function bulkGenerateMissingCompletions(): Promise<{
  success: boolean;
  totalGenerated?: number;
  totalErrors?: number;
  results?: any[];
  error?: string;
}> {
  try {
    debug.log('Starting bulk completion generation...');
    
    const { data, error } = await supabase.functions.invoke('check-missing-completions', {
      body: {},
    });

    if (error) {
      debug.error('Error invoking check-missing-completions:', error);
      return { success: false, error: error.message };
    }

    debug.log('Bulk generation completed:', data);
    return {
      success: true,
      totalGenerated: data?.totalGenerated || 0,
      totalErrors: data?.totalErrors || 0,
      results: data?.results || [],
    };
  } catch (error: any) {
    debug.error('Error in bulkGenerateMissingCompletions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Today in Sports related functions
 */

export interface TodayInSportsCompletion {
  id: string;
  completion_date: string;
  completion_text: string;
  generated_at: string;
  published: boolean;
  sent_to_discord: boolean;
  discord_message_id: string | null;
}

/**
 * Get today's sports completion
 * @param includeUnpublished - If true, returns completion even if unpublished
 */
export async function getTodayInSportsCompletion(includeUnpublished: boolean = false): Promise<TodayInSportsCompletion | null> {
  try {
    // Get today's date in Eastern Time
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const today = easternTime.toISOString().split('T')[0];

    let query = supabase
      .from('today_in_sports_completions')
      .select('*')
      .eq('completion_date', today);
    
    if (!includeUnpublished) {
      query = query.eq('published', true);
    }
    
    const { data, error } = await query.maybeSingle();

    if (error) {
      debug.error('Error fetching today in sports completion:', error);
      return null;
    }

    return data;
  } catch (error) {
    debug.error('Error in getTodayInSportsCompletion:', error);
    return null;
  }
}

/**
 * Delete today's sports completion
 */
export async function deleteTodayInSportsCompletion(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get today's date in Eastern Time
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const today = easternTime.toISOString().split('T')[0];

    const { error } = await supabase
      .from('today_in_sports_completions')
      .delete()
      .eq('completion_date', today);

    if (error) {
      debug.error('Error deleting today in sports completion:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    debug.error('Error in deleteTodayInSportsCompletion:', error);
    return { success: false, error: error.message || 'Failed to delete completion' };
  }
}

/**
 * Publish/unpublish a completion (update published status and optionally update completion text)
 */
export async function publishTodayInSportsCompletion(
  completionId: string, 
  published: boolean = true,
  completionText?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const updates: any = {
      published: published,
      updated_at: new Date().toISOString(),
    };

    if (completionText) {
      updates.completion_text = completionText;
    }

    const { error } = await supabase
      .from('today_in_sports_completions')
      .update(updates)
      .eq('id', completionId);

    if (error) {
      debug.error('Error updating today in sports completion:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    debug.error('Error in publishTodayInSportsCompletion:', error);
    return { success: false, error: error.message || 'Failed to update completion' };
  }
}

/**
 * Generate today's sports completion (manual trigger)
 * @param force - If true, generates a new completion even if one exists for today
 */
export async function generateTodayInSportsCompletion(force: boolean = false): Promise<{
  success: boolean;
  completion?: string;
  completion_id?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-today-in-sports-completion', {
      body: { force }
    });

    if (error) {
      // If the error response contains data with error message, use it
      if (error.context?.body) {
        try {
          const errorBody = typeof error.context.body === 'string' 
            ? JSON.parse(error.context.body) 
            : error.context.body;
          if (errorBody.error) {
            throw new Error(errorBody.error);
          }
        } catch (e) {
          // If parsing fails, use original error
        }
      }
      throw error;
    }
    
    // Check if data indicates failure
    if (data && !data.success && data.error) {
      return { success: false, error: data.error };
    }
    
    return data;
  } catch (error: any) {
    debug.error('Error generating today in sports completion:', error);
    
    // Try to extract error message from various possible locations
    let errorMessage = error.message || 'Unknown error occurred';
    
    if (error.context?.body) {
      try {
        const errorBody = typeof error.context.body === 'string' 
          ? JSON.parse(error.context.body) 
          : error.context.body;
        if (errorBody.error) {
          errorMessage = errorBody.error;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Send test Discord notification
 */
export async function sendTestDiscordNotification(completionText: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase.functions.invoke('send-discord-notification', {
      body: {
        completion_id: 'test',
        completion_text: completionText,
        completion_date: today,
      }
    });

    if (error) throw error;
    return data;
  } catch (error: any) {
    debug.error('Error sending test Discord notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update Today in Sports schedule settings
 */
export async function updateTodayInSportsSchedule(updates: {
  system_prompt?: string;
  enabled?: boolean;
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ai_page_level_schedules')
      .update(updates)
      .eq('sport_type', 'today_in_sports');

    if (error) {
      debug.error('Error updating today in sports schedule:', error);
      return false;
    }

    return true;
  } catch (error) {
    debug.error('Error in updateTodayInSportsSchedule:', error);
    return false;
  }
}

/**
 * Get Today in Sports schedule
 */
export async function getTodayInSportsSchedule(): Promise<PageLevelSchedule | null> {
  try {
    const { data, error } = await supabase
      .from('ai_page_level_schedules')
      .select('*')
      .eq('sport_type', 'today_in_sports')
      .maybeSingle();

    if (error) {
      debug.error('Error fetching today in sports schedule:', error);
      return null;
    }

    return data;
  } catch (error) {
    debug.error('Error in getTodayInSportsSchedule:', error);
    return null;
  }
}

