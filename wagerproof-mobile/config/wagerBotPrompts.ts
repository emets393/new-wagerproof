/**
 * WagerBot Prompts Configuration - Types Only
 *
 * NOTE: System prompts and data formatters have been moved to the BuildShip API
 * for server-side management. This file only exports types for backward compatibility.
 *
 * All prompt logic is now in: config/buildship-api-endpoint.js
 * Mobile service sends raw JSON data to API which handles formatting.
 */

// Re-export types from the service for backward compatibility
export type { PageType, Sport, GamePolymarketData, PolymarketMarketData } from '../services/wagerBotSuggestionService';

// Legacy exports for any code that still imports from this file
// These are now no-ops since formatting happens server-side

/**
 * @deprecated Prompts are now managed server-side in BuildShip
 */
export const PAGE_PROMPTS = {
  feed: { scanEnabled: true, maxItems: 15, description: 'Analyze game predictions', systemPrompt: '' },
  picks: { scanEnabled: true, maxItems: 20, description: 'Analyze editor picks', systemPrompt: '' },
  outliers: { scanEnabled: true, maxItems: 10, description: 'Analyze outliers', systemPrompt: '' },
  scoreboard: { scanEnabled: true, maxItems: 15, description: 'Analyze live games', systemPrompt: '' },
};

/**
 * @deprecated Formatting now happens server-side in BuildShip
 */
export function getScanPageConfig(pageType: string) {
  console.warn('getScanPageConfig is deprecated - formatting now happens server-side');
  return {
    prompt: PAGE_PROMPTS[pageType as keyof typeof PAGE_PROMPTS] || PAGE_PROMPTS.feed,
    formatContext: () => '',
  };
}

/**
 * @deprecated Formatting now happens server-side in BuildShip
 */
export function getGameDetailsConfig() {
  console.warn('getGameDetailsConfig is deprecated - formatting now happens server-side');
  return {
    formatContext: () => '',
  };
}

/**
 * @deprecated Formatting now happens server-side in BuildShip
 */
export function formatFeedContext() {
  console.warn('formatFeedContext is deprecated - formatting now happens server-side');
  return '';
}

/**
 * @deprecated Formatting now happens server-side in BuildShip
 */
export function formatPicksContext() {
  console.warn('formatPicksContext is deprecated - formatting now happens server-side');
  return '';
}

/**
 * @deprecated Formatting now happens server-side in BuildShip
 */
export function formatOutliersContext() {
  console.warn('formatOutliersContext is deprecated - formatting now happens server-side');
  return '';
}

/**
 * @deprecated Formatting now happens server-side in BuildShip
 */
export function formatScoreboardContext() {
  console.warn('formatScoreboardContext is deprecated - formatting now happens server-side');
  return '';
}

/**
 * @deprecated Formatting now happens server-side in BuildShip
 */
export function formatGameDetailsContext() {
  console.warn('formatGameDetailsContext is deprecated - formatting now happens server-side');
  return '';
}
