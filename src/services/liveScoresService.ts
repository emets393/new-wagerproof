import { supabase } from "@/integrations/supabase/client";
import { LiveGame } from "@/types/liveScores";

export async function getLiveScores(): Promise<LiveGame[]> {
  const { data, error } = await supabase
    .from('live_scores')
    .select('*')
    .eq('is_live', true)
    .order('league', { ascending: true })
    .order('away_abbr', { ascending: true });
  
  if (error) {
    console.error('Error fetching live scores:', error);
    return [];
  }
  
  return (data || []) as LiveGame[];
}

export async function refreshLiveScores(): Promise<{ success: boolean; liveGames: number }> {
  try {
    // Call the edge function to refresh scores
    const { data, error } = await supabase.functions.invoke('fetch-live-scores');
    
    if (error) {
      console.error('Error refreshing live scores:', error);
      return { success: false, liveGames: 0 };
    }
    
    return {
      success: data?.success || false,
      liveGames: data?.liveGames || 0
    };
  } catch (error) {
    console.error('Error calling refresh function:', error);
    return { success: false, liveGames: 0 };
  }
}

export async function checkIfRefreshNeeded(): Promise<boolean> {
  // Check if we have recent data (within last 2 minutes)
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('live_scores')
    .select('last_updated')
    .gte('last_updated', twoMinutesAgo)
    .limit(1);
  
  if (error) {
    console.error('Error checking refresh status:', error);
    return true; // Refresh on error
  }
  
  // If no recent data, refresh is needed
  return !data || data.length === 0;
}

