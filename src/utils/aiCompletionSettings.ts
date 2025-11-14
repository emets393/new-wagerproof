/**
 * Utility for managing AI completion toggle settings
 * Uses localStorage to allow instant emergency override without database calls
 */

const STORAGE_KEY = 'wagerproof_ai_completions_enabled';

export interface CompletionSettings {
  nfl: boolean;
  cfb: boolean;
  nba: boolean;
  ncaab: boolean;
}

/**
 * Get the current completion settings from localStorage
 * Defaults to both sports enabled
 */
export function getCompletionSettings(): CompletionSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error reading completion settings from localStorage:', error);
  }
  
  // Default: all enabled
  return { nfl: true, cfb: true, nba: true, ncaab: true };
}

/**
 * Update the completion setting for a specific sport
 * @param sport - The sport to update ('nfl', 'cfb', 'nba', or 'ncaab')
 * @param enabled - Whether completions should be enabled for this sport
 */
export function setCompletionSetting(sport: 'nfl' | 'cfb' | 'nba' | 'ncaab', enabled: boolean): void {
  try {
    const current = getCompletionSettings();
    const updated = { ...current, [sport]: enabled };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving completion settings to localStorage:', error);
  }
}

/**
 * Check if completions are enabled for a specific sport
 * @param sport - The sport to check ('nfl', 'cfb', 'nba', or 'ncaab')
 */
export function areCompletionsEnabled(sport: 'nfl' | 'cfb' | 'nba' | 'ncaab'): boolean {
  const settings = getCompletionSettings();
  return settings[sport];
}

