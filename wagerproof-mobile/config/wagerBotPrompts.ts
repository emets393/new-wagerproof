/**
 * WagerBot Page-Specific Prompt Configuration
 *
 * This file contains system prompts and context formatters for each page's
 * "Scan Page" feature. Customize these prompts to tailor the AI's behavior
 * and focus areas for each page type.
 *
 * HOW IT WORKS:
 * 1. User taps WagerBot icon → "Scan this page"
 * 2. System determines current page context
 * 3. Formats page-specific data using the formatter below
 * 4. Sends to AI with the page-specific system prompt
 * 5. AI returns a focused suggestion
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type PageType = 'feed' | 'picks' | 'outliers' | 'scoreboard';
export type Sport = 'nfl' | 'cfb' | 'nba' | 'ncaab';

export interface PagePromptConfig {
  /** The system prompt sent to the AI */
  systemPrompt: string;
  /** Description of what this scan does (shown to user if needed) */
  description: string;
  /** Whether this page supports scanning */
  scanEnabled: boolean;
  /** Maximum items to include in context */
  maxItems: number;
}

// ============================================================================
// PAGE-SPECIFIC SYSTEM PROMPTS
// ============================================================================

export const PAGE_PROMPTS: Record<PageType, PagePromptConfig> = {
  // ---------------------------------------------------------------------------
  // FEED PAGE - Game Predictions
  // ---------------------------------------------------------------------------
  feed: {
    scanEnabled: true,
    maxItems: 15,
    description: 'Analyze game predictions and find value bets',
    systemPrompt: `You are WagerBot, an expert sports betting analyst helping users find value in today's games.

CONTEXT: You're scanning the FEED page which shows upcoming games with model predictions AND Polymarket prediction market odds.

YOUR TASK: Analyze the games and provide ONE specific betting recommendation.

WHAT TO LOOK FOR:
- Games where model probability significantly differs from implied Vegas odds (value edge)
- Strong model confidence (>60%) on spreads or totals
- Contrarian opportunities where public is heavily on one side
- Weather factors that could impact totals (NFL/CFB outdoor games)
- Polymarket odds that differ from Vegas lines (prediction market edge)
- Polymarket line movement trends (odds shifting toward or away from model predictions)

RESPONSE FORMAT:
- 1-2 sentences MAX
- Be conversational and confident
- Mention the specific teams
- Highlight ONE betting angle (spread, over/under, or moneyline)
- If Polymarket data shows interesting divergence from Vegas, mention it
- End with [GAME_ID:xxx] where xxx is the game's ID

EXAMPLE RESPONSES:
"The Bills-Dolphins Over 48.5 looks solid - both offenses are elite in dome conditions! [GAME_ID:123]"
"Chiefs -3 at home has great value. Model shows 65% cover probability vs the 52% implied by the line. [GAME_ID:456]"
"Ravens ML is interesting - Polymarket has them at 58% while Vegas implies only 52%. Sharp money may be on Baltimore. [GAME_ID:789]"

AVAILABLE DATA:
`,
  },

  // ---------------------------------------------------------------------------
  // PICKS PAGE - Editor Picks
  // ---------------------------------------------------------------------------
  picks: {
    scanEnabled: true,
    maxItems: 20,
    description: 'Analyze editor picks and performance trends',
    systemPrompt: `You are WagerBot, helping users understand their Editor's Picks page.

CONTEXT: You're scanning the PICKS page which shows curated betting recommendations from expert analysts.

YOUR TASK: Provide a quick insight about the picks shown.

WHAT TO LOOK FOR:
- Overall win rate trends (how are picks performing?)
- Which sports or bet types are hitting best
- Notable picks with strong editor reasoning
- Free picks vs premium picks value
- Recent hot or cold streaks

RESPONSE FORMAT:
- 1-2 sentences MAX
- Be conversational and insightful
- Focus on patterns or standout picks
- If mentioning a specific pick, include [GAME_ID:xxx]

EXAMPLE RESPONSES:
"Editor picks are hitting 68% on NFL spreads this week! The Chiefs -3 pick has solid reasoning. [GAME_ID:123]"
"Interesting trend: CFB overs are 4-1 in recent picks. Worth following the Alabama over tonight."
"The free pick on Bills ML is actually the sharpest value on the board today. [GAME_ID:456]"

AVAILABLE DATA:
`,
  },

  // ---------------------------------------------------------------------------
  // OUTLIERS PAGE - Value Alerts & Fade Alerts
  // ---------------------------------------------------------------------------
  outliers: {
    scanEnabled: true,
    maxItems: 10,
    description: 'Analyze model vs market discrepancies',
    systemPrompt: `You are WagerBot, specialized in finding value discrepancies between model predictions and betting markets.

CONTEXT: You're scanning the OUTLIERS page which shows games where the model disagrees significantly with Vegas lines.

YOUR TASK: Highlight the most compelling value opportunity from the outliers shown.

WHAT TO LOOK FOR:
- Largest discrepancies between model and market
- High-confidence model predictions that contradict the line
- Value alerts with supporting factors (weather, injuries, public splits)
- Fade alerts where contrarian plays have edge

RESPONSE FORMAT:
- 1-2 sentences MAX
- Be direct about the value opportunity
- Quantify the edge when possible (e.g., "model shows 62% vs implied 50%")
- End with [GAME_ID:xxx]

EXAMPLE RESPONSES:
"Best outlier: Ravens +3 - model gives them 58% to cover vs the implied 48%. Sharp money agrees. [GAME_ID:123]"
"The Bengals Over 44.5 stands out - 12% edge over the market with both offenses healthy. [GAME_ID:456]"
"Fade alert on the Lakers: 70% of bets are on LA but model strongly favors the Celtics spread. [GAME_ID:789]"

AVAILABLE DATA:
`,
  },

  // ---------------------------------------------------------------------------
  // SCOREBOARD PAGE - Live Scores
  // ---------------------------------------------------------------------------
  scoreboard: {
    scanEnabled: true,
    maxItems: 15,
    description: 'Analyze live games and prediction tracking',
    systemPrompt: `You are WagerBot, providing live game analysis and prediction tracking.

CONTEXT: You're scanning the SCOREBOARD page which shows real-time scores and how predictions are tracking.

YOUR TASK: Provide insight on the live games - which predictions are hitting, close games to watch, or interesting live situations.

WHAT TO LOOK FOR:
- Predictions that are currently hitting or trending toward hitting
- Close games where the outcome is still in doubt
- Blowouts or unexpected results
- Games where the total is trending over/under

RESPONSE FORMAT:
- 1-2 sentences MAX
- Be timely and relevant to live action
- Mention specific games and scores when relevant
- If referencing a game, include [GAME_ID:xxx]

EXAMPLE RESPONSES:
"Chiefs-Ravens is exactly as predicted! Home spread is covering with a 10-point cushion in Q3. [GAME_ID:123]"
"Watch the Lakers-Celtics total - currently on pace for 230 points with one quarter left. Over bettors sweating! [GAME_ID:456]"
"3 of 4 model predictions hitting so far today. The Bills game is the one to watch for a potential cover. [GAME_ID:789]"

AVAILABLE DATA:
`,
  },
};

// ============================================================================
// SAMPLE PAYLOADS - What data looks like for each page
// ============================================================================

/**
 * SAMPLE PAYLOADS
 *
 * These show what data is available to format and send to the AI.
 * Use these as reference when customizing the formatters below.
 */

export const SAMPLE_PAYLOADS = {
  // ---------------------------------------------------------------------------
  // FEED PAGE - Game Prediction Data (with Polymarket)
  // ---------------------------------------------------------------------------
  feed: {
    description: 'Array of game predictions with model probabilities and Polymarket odds',
    sampleData: [
      {
        // Core identifiers
        id: 'abc123',
        training_key: 'nfl_2024_week15_KC_BAL',
        unique_id: 'nfl-kc-bal-2024-12-15',

        // Teams
        away_team: 'Kansas City Chiefs',
        home_team: 'Baltimore Ravens',
        away_abbr: 'KC',
        home_abbr: 'BAL',

        // Game timing
        game_date: '2024-12-15',
        game_time: '4:25 PM ET',

        // Betting lines (Vegas)
        home_spread: -3.0,
        away_spread: 3.0,
        home_ml: -155,
        away_ml: 135,
        over_line: 47.5,

        // Model predictions (0-1 probability)
        home_away_ml_prob: 0.62,          // 62% Ravens win probability
        home_away_spread_cover_prob: 0.58, // 58% Ravens cover spread
        ou_result_prob: 0.55,              // 55% Over probability

        // Public betting splits
        spread_splits_label: '65% on Chiefs',
        total_splits_label: '58% on Over',
        ml_splits_label: '70% on Chiefs',

        // Weather (NFL/CFB only)
        temperature: 42,
        wind_speed: 12,
        precipitation: 0,
        weather_icon: 'cloudy',

        // Advanced metrics (varies by sport)
        pred_home_score: 24,
        pred_away_score: 21,

        // =====================================================================
        // POLYMARKET DATA - Prediction market odds from Polymarket
        // =====================================================================
        polymarket: {
          // Moneyline market
          moneyline: {
            awayTeam: 'Chiefs',
            homeTeam: 'Ravens',
            currentAwayOdds: 42,           // 42% Chiefs win on Polymarket
            currentHomeOdds: 58,           // 58% Ravens win on Polymarket
            marketType: 'moneyline',
            volume: 125000,                // Total volume in USD
            marketId: 'poly_ml_123',
            // Historical data points (for trend analysis)
            data: [
              { timestamp: 1702540800000, awayTeamOdds: 45, homeTeamOdds: 55 }, // 24h ago
              { timestamp: 1702584000000, awayTeamOdds: 44, homeTeamOdds: 56 }, // 12h ago
              { timestamp: 1702627200000, awayTeamOdds: 42, homeTeamOdds: 58 }, // now
            ],
          },
          // Spread market (if available)
          spread: {
            awayTeam: 'Chiefs',
            homeTeam: 'Ravens',
            currentAwayOdds: 48,           // 48% Chiefs cover +3
            currentHomeOdds: 52,           // 52% Ravens cover -3
            marketType: 'spread',
            volume: 85000,
            marketId: 'poly_spread_123',
            data: [
              { timestamp: 1702540800000, awayTeamOdds: 50, homeTeamOdds: 50 },
              { timestamp: 1702584000000, awayTeamOdds: 49, homeTeamOdds: 51 },
              { timestamp: 1702627200000, awayTeamOdds: 48, homeTeamOdds: 52 },
            ],
          },
          // Total/Over-Under market (if available)
          total: {
            awayTeam: 'Under',             // For totals: away = Under
            homeTeam: 'Over',              // For totals: home = Over
            currentAwayOdds: 45,           // 45% Under
            currentHomeOdds: 55,           // 55% Over
            marketType: 'total',
            volume: 62000,
            marketId: 'poly_total_123',
            data: [
              { timestamp: 1702540800000, awayTeamOdds: 48, homeTeamOdds: 52 },
              { timestamp: 1702584000000, awayTeamOdds: 46, homeTeamOdds: 54 },
              { timestamp: 1702627200000, awayTeamOdds: 45, homeTeamOdds: 55 },
            ],
          },
        },
      },
    ],

    // How this data is currently formatted for AI (with Polymarket)
    currentFormat: `Today's NFL Games:
[nfl_2024_week15_KC_BAL] Chiefs @ Ravens: Spread -3 (model: 58% Ravens cover), O/U 47.5 (over prob: 55%), Ravens ML prob: 62%
Weather: 42°F, Wind 12mph
Public: 65% on Chiefs spread, 58% on Over
Polymarket: Ravens ML 58% (vs Vegas implied 61%), Spread 52% Ravens, Over 55% ($125k volume)
  → Polymarket trend: Ravens ML moved from 55% to 58% in 24h (3% toward model prediction)`,

    // Polymarket-specific insights to look for
    polymarketInsights: `
POLYMARKET VALUE SIGNALS:
- Compare Polymarket odds to Vegas implied probability
- Look for divergences >5% between Polymarket and Vegas
- Check volume ($50k+ indicates significant market interest)
- Analyze trend direction (moving toward or away from model)
- High volume + movement = sharp money indicator

EXAMPLE ANALYSIS:
"Polymarket has Ravens at 58% while Vegas ML (-155) implies 61%.
The 3% gap suggests value on Ravens, especially since Polymarket
has moved 3% toward the model prediction in the last 24h."`,
  },

  // ---------------------------------------------------------------------------
  // PICKS PAGE - Editor Picks Data
  // ---------------------------------------------------------------------------
  picks: {
    description: 'Array of editor picks with reasoning and results',
    sampleData: [
      {
        // Pick identifiers
        id: 'pick_001',
        game_id: 'abc123',
        game_type: 'nfl',

        // Pick details
        selected_bet_type: 'spread',      // spread | over_under | moneyline
        pick_value: 'Chiefs -3',
        best_price: -110,
        sportsbook: 'DraftKings',
        units: 1.5,

        // Editor info
        editor_id: 'editor_chris',
        editors_notes: 'Chiefs offense clicking. Mahomes 8-2 ATS as favorite this season. Ravens secondary banged up.',

        // Status
        result: 'pending',                // pending | won | lost | push
        is_free_pick: true,

        // Timestamps
        created_at: '2024-12-14T10:30:00Z',

        // Linked game data snapshot
        archived_game_data: {
          away_team: 'Kansas City Chiefs',
          home_team: 'Baltimore Ravens',
          game_date: '2024-12-15',
          home_spread: -3.0,
        },

        // Betslip links
        betslip_links: {
          draftkings: 'https://sportsbook.draftkings.com/...',
          fanduel: 'https://sportsbook.fanduel.com/...',
        },
      },
    ],

    // Suggested format for AI
    suggestedFormat: `Editor Picks Summary:
Total Picks: 12 | Record: 8-4 (67%)

Recent Picks:
[pick_001] NFL - Chiefs -3 @ -110 (1.5u) - PENDING
  Editor notes: "Chiefs offense clicking. Mahomes 8-2 ATS as favorite this season."

[pick_002] CFB - Alabama Over 52.5 @ -105 (1u) - WON ✓
  Editor notes: "Both teams average 35+ points. Weak secondaries."

By Sport: NFL 5-2 | CFB 2-1 | NBA 1-1
By Type: Spreads 4-2 | Totals 3-1 | ML 1-1`,
  },

  // ---------------------------------------------------------------------------
  // OUTLIERS PAGE - Value Alerts & Fade Alerts
  // ---------------------------------------------------------------------------
  outliers: {
    description: 'Arrays of value alerts (model > market) and fade alerts (contrarian)',
    sampleData: {
      valueAlerts: [
        {
          gameId: 'abc123',
          sport: 'nfl',
          awayTeam: 'Kansas City Chiefs',
          homeTeam: 'Baltimore Ravens',
          marketType: 'Spread',
          side: 'Ravens',
          percentage: 62,                 // Model confidence
          vegasImplied: 48,               // Vegas implied probability
          edge: 14,                       // Percentage edge
          game: {
            homeSpread: -3.0,
            totalLine: 47.5,
            homeMl: -155,
            awayMl: 135,
          },
        },
      ],
      fadeAlerts: [
        {
          gameId: 'def456',
          sport: 'nba',
          awayTeam: 'Boston Celtics',
          homeTeam: 'Los Angeles Lakers',
          pickType: 'Public Fade',
          predictedTeam: 'Celtics',
          confidence: 68,
          publicPercentage: 75,           // 75% of bets on Lakers
          game: {
            homeSpread: -2.5,
            totalLine: 225.5,
          },
        },
      ],
    },

    // Suggested format for AI
    suggestedFormat: `Outliers Analysis:

VALUE ALERTS (Model vs Market Edge):
[abc123] NFL: Ravens +3 - Model: 62% cover vs Vegas 48% (14% EDGE)
  Line: Ravens +3, Total 47.5

[ghi789] CFB: Bama Over 52.5 - Model: 68% over vs Vegas 52% (16% EDGE)

FADE ALERTS (Contrarian Plays):
[def456] NBA: Celtics +2.5 - 75% public on Lakers, but model favors Celtics at 68%
  Recommended: Fade the public, take Celtics

Top Opportunity: Ravens +3 has the largest edge at 14%`,
  },

  // ---------------------------------------------------------------------------
  // SCOREBOARD PAGE - Live Scores Data
  // ---------------------------------------------------------------------------
  scoreboard: {
    description: 'Array of live games with scores and prediction tracking',
    sampleData: [
      {
        id: 'live_001',
        league: 'NFL',

        // Teams
        home_team: 'Baltimore Ravens',
        away_team: 'Kansas City Chiefs',
        home_abbr: 'BAL',
        away_abbr: 'KC',

        // Live score
        home_score: 21,
        away_score: 17,
        quarter: '3rd',
        time_remaining: '8:42',

        // Status
        is_live: true,
        game_status: 'In Progress',

        // Prediction tracking (if available)
        predictions: {
          spread: {
            pick: 'Ravens -3',
            isHitting: true,
            currentMargin: 4,
          },
          total: {
            pick: 'Over 47.5',
            isHitting: false,
            currentTotal: 38,
            projectedTotal: 50.7,
          },
          moneyline: {
            pick: 'Ravens',
            isHitting: true,
          },
        },
      },
    ],

    // Suggested format for AI
    suggestedFormat: `Live Scoreboard:

IN PROGRESS:
[live_001] NFL: Chiefs 17 @ Ravens 21 (3Q - 8:42)
  Spread: Ravens -3 ✓ HITTING (covering by 4)
  Total: O/U 47.5 - Currently 38, pace for 50.7 (OVER trending)

[live_002] NBA: Celtics 89 @ Lakers 92 (4Q - 4:20)
  Spread: Celtics +2.5 ✗ NOT HITTING (down 3)
  Total: O/U 225.5 - Currently 181, pace for 226 (PUSH territory)

FINAL:
[live_003] CFB: Alabama 35, Georgia 28 - FINAL
  Spread: Bama -7 ✓ WON
  Total: Over 52.5 ✓ WON (63 total)

Today's Predictions: 4/6 hitting (67%)`,
  },
};

// ============================================================================
// GAME DETAILS PAYLOAD - For when user opens a specific game
// ============================================================================

/**
 * GAME DETAILS SAMPLE PAYLOAD
 *
 * This is the data available when the user opens a game detail sheet
 * and the floating assistant provides insights about that specific game.
 */
export const GAME_DETAILS_PAYLOAD = {
  description: 'Single game with full details including Polymarket data',
  sampleData: {
    // All fields from feed sampleData above, plus:
    game: {
      // ... all game fields from feed sample ...
      training_key: 'nfl_2024_week15_KC_BAL',
      away_team: 'Kansas City Chiefs',
      home_team: 'Baltimore Ravens',
      home_spread: -3.0,
      over_line: 47.5,
      home_away_ml_prob: 0.62,
      home_away_spread_cover_prob: 0.58,
      ou_result_prob: 0.55,
    },

    // Full Polymarket data for this game
    polymarket: {
      moneyline: {
        currentAwayOdds: 42,
        currentHomeOdds: 58,
        volume: 125000,
        // 24-hour trend
        trend: {
          direction: 'toward_home', // 'toward_home' | 'toward_away' | 'stable'
          change: 3,                 // percentage points moved
          period: '24h',
        },
      },
      spread: {
        currentAwayOdds: 48,
        currentHomeOdds: 52,
        volume: 85000,
        trend: {
          direction: 'toward_home',
          change: 2,
          period: '24h',
        },
      },
      total: {
        currentAwayOdds: 45,        // Under
        currentHomeOdds: 55,        // Over
        volume: 62000,
        trend: {
          direction: 'toward_over',
          change: 3,
          period: '24h',
        },
      },
    },

    // Comparison analysis
    analysis: {
      vegasImpliedML: 61,           // From -155 ML
      polymarketML: 58,
      modelML: 62,
      mlDivergence: -3,             // Polymarket vs Vegas (negative = value on home)

      vegasImpliedSpread: 50,       // Standard -110 both sides
      polymarketSpread: 52,
      modelSpread: 58,
      spreadDivergence: 2,          // Polymarket slightly favors home

      vegasImpliedTotal: 50,
      polymarketTotal: 55,
      modelTotal: 55,
      totalDivergence: 5,           // Polymarket agrees with model on Over
    },
  },

  // How game details are formatted for AI (floating assistant)
  suggestedFormat: `Game Details: Chiefs @ Ravens
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BETTING LINES (Vegas):
  Spread: Ravens -3 | O/U: 47.5 | ML: Ravens -155

MODEL PREDICTIONS:
  Ravens ML: 62% | Spread Cover: 58% | Over: 55%

POLYMARKET ODDS:
  ML: Ravens 58% ($125k volume) ← moved +3% in 24h
  Spread: Ravens 52% ($85k volume) ← moved +2% in 24h
  Total: Over 55% ($62k volume) ← moved +3% in 24h

VALUE ANALYSIS:
  • ML: Polymarket (58%) vs Vegas implied (61%) = 3% gap favoring Ravens value
  • Spread: Model (58%) > Polymarket (52%) > Vegas (50%) - alignment suggests Ravens cover
  • Total: Model & Polymarket agree at 55% Over - consensus play

PUBLIC BETTING: 65% on Chiefs spread, 58% on Over
WEATHER: 42°F, Wind 12mph`,
};

// ============================================================================
// DATA FORMATTERS - Convert page data to AI-readable context
// ============================================================================

/**
 * Format feed page game data for AI context (includes Polymarket)
 */
export function formatFeedContext(games: any[], sport: Sport, polymarketData?: Map<string, any>): string {
  if (!games || games.length === 0) {
    return 'No games available to analyze.';
  }

  const sportLabel = sport.toUpperCase();
  const limitedGames = games.slice(0, PAGE_PROMPTS.feed.maxItems);

  const lines = limitedGames.map(game => {
    const gameId = game.training_key || game.id || game.unique_id;
    const spread = game.home_spread || 0;
    const spreadProb = Math.round((game.home_away_spread_cover_prob || 0.5) * 100);
    const ouLine = game.over_line || 0;
    const ouProb = Math.round((game.ou_result_prob || 0.5) * 100);
    const mlProb = Math.round((game.home_away_ml_prob || 0.5) * 100);

    let line = `[${gameId}] ${game.away_team} @ ${game.home_team}: `;
    line += `Spread ${spread > 0 ? '+' : ''}${spread} (model: ${spreadProb}% home cover), `;
    line += `O/U ${ouLine} (over prob: ${ouProb}%), `;
    line += `Home ML prob: ${mlProb}%`;

    // Add weather for outdoor sports
    if ((sport === 'nfl' || sport === 'cfb') && game.temperature) {
      line += `\n  Weather: ${game.temperature}°F, Wind ${game.wind_speed || 0}mph`;
    }

    // Add public splits if available
    if (game.spread_splits_label) {
      line += `\n  Public: ${game.spread_splits_label}`;
    }

    // Add Polymarket data if available
    const polyData = polymarketData?.get(gameId) || game.polymarket;
    if (polyData) {
      line += formatPolymarketLine(polyData, game);
    }

    return line;
  });

  return `Today's ${sportLabel} Games:\n${lines.join('\n\n')}`;
}

/**
 * Format Polymarket data for a single game line
 */
function formatPolymarketLine(polyData: any, game: any): string {
  const parts: string[] = [];

  // Moneyline
  if (polyData.moneyline) {
    const ml = polyData.moneyline;
    const homeOdds = ml.currentHomeOdds || 0;
    const volume = ml.volume ? `$${Math.round(ml.volume / 1000)}k` : '';
    parts.push(`ML ${homeOdds}% ${game.home_team?.split(' ').pop() || 'Home'}${volume ? ` (${volume})` : ''}`);
  }

  // Spread
  if (polyData.spread) {
    const sp = polyData.spread;
    const homeOdds = sp.currentHomeOdds || 0;
    parts.push(`Spread ${homeOdds}%`);
  }

  // Total
  if (polyData.total) {
    const tot = polyData.total;
    const overOdds = tot.currentHomeOdds || 0; // home = Over for totals
    parts.push(`Over ${overOdds}%`);
  }

  if (parts.length === 0) return '';

  let result = `\n  Polymarket: ${parts.join(', ')}`;

  // Add trend if available
  if (polyData.moneyline?.data && polyData.moneyline.data.length >= 2) {
    const data = polyData.moneyline.data;
    const oldest = data[0]?.homeTeamOdds || 0;
    const newest = data[data.length - 1]?.homeTeamOdds || 0;
    const change = newest - oldest;
    if (Math.abs(change) >= 2) {
      result += `\n    → Trend: ${change > 0 ? '+' : ''}${change}% in 24h`;
    }
  }

  return result;
}

/**
 * Format single game details for floating assistant (with full Polymarket)
 */
export function formatGameDetailsContext(game: any, sport: Sport, polymarket?: any): string {
  if (!game) {
    return 'No game data available.';
  }

  const gameId = game.training_key || game.id || game.unique_id;
  const spread = game.home_spread || 0;
  const spreadProb = Math.round((game.home_away_spread_cover_prob || 0.5) * 100);
  const ouLine = game.over_line || 0;
  const ouProb = Math.round((game.ou_result_prob || 0.5) * 100);
  const mlProb = Math.round((game.home_away_ml_prob || 0.5) * 100);

  let context = `Game: ${game.away_team} @ ${game.home_team}\n`;
  context += `ID: [${gameId}]\n\n`;

  // Vegas lines
  context += `VEGAS LINES:\n`;
  context += `  Spread: ${game.home_team?.split(' ').pop()} ${spread > 0 ? '+' : ''}${spread}\n`;
  context += `  Total: ${ouLine}\n`;
  context += `  ML: ${game.home_ml || 'N/A'} / ${game.away_ml || 'N/A'}\n\n`;

  // Model predictions
  context += `MODEL PREDICTIONS:\n`;
  context += `  Home ML: ${mlProb}% | Spread Cover: ${spreadProb}% | Over: ${ouProb}%\n\n`;

  // Polymarket data
  const poly = polymarket || game.polymarket;
  if (poly) {
    context += `POLYMARKET ODDS:\n`;

    if (poly.moneyline) {
      const ml = poly.moneyline;
      const vol = ml.volume ? ` ($${Math.round(ml.volume / 1000)}k volume)` : '';
      context += `  ML: ${game.home_team?.split(' ').pop()} ${ml.currentHomeOdds}%${vol}\n`;

      // Trend
      if (ml.data && ml.data.length >= 2) {
        const oldest = ml.data[0]?.homeTeamOdds || 0;
        const newest = ml.data[ml.data.length - 1]?.homeTeamOdds || 0;
        const change = newest - oldest;
        if (Math.abs(change) >= 1) {
          context += `    ↳ Moved ${change > 0 ? '+' : ''}${change}% in 24h\n`;
        }
      }
    }

    if (poly.spread) {
      const sp = poly.spread;
      const vol = sp.volume ? ` ($${Math.round(sp.volume / 1000)}k)` : '';
      context += `  Spread: ${sp.currentHomeOdds}% home cover${vol}\n`;
    }

    if (poly.total) {
      const tot = poly.total;
      const vol = tot.volume ? ` ($${Math.round(tot.volume / 1000)}k)` : '';
      context += `  Total: Over ${tot.currentHomeOdds}%${vol}\n`;
    }

    context += '\n';

    // Value analysis - compare Polymarket to Vegas implied
    const vegasImpliedML = game.home_ml ? Math.round(100 / (1 + 100 / Math.abs(game.home_ml))) : 50;
    if (poly.moneyline) {
      const polyML = poly.moneyline.currentHomeOdds;
      const diff = polyML - vegasImpliedML;
      if (Math.abs(diff) >= 3) {
        context += `VALUE SIGNAL: Polymarket (${polyML}%) vs Vegas implied (${vegasImpliedML}%) = ${Math.abs(diff)}% gap\n`;
        context += `  → ${diff > 0 ? 'Market favors home more than Vegas' : 'Market favors away more than Vegas'}\n\n`;
      }
    }
  }

  // Weather (NFL/CFB)
  if ((sport === 'nfl' || sport === 'cfb') && game.temperature) {
    context += `WEATHER: ${game.temperature}°F, Wind ${game.wind_speed || 0}mph\n`;
  }

  // Public splits
  if (game.spread_splits_label) {
    context += `PUBLIC: ${game.spread_splits_label}\n`;
  }

  return context;
}

/**
 * Format picks page data for AI context
 */
export function formatPicksContext(picks: any[]): string {
  if (!picks || picks.length === 0) {
    return 'No editor picks available to analyze.';
  }

  const limitedPicks = picks.slice(0, PAGE_PROMPTS.picks.maxItems);

  // Calculate stats
  const results = picks.filter(p => p.result && p.result !== 'pending');
  const wins = results.filter(p => p.result === 'won').length;
  const losses = results.filter(p => p.result === 'lost').length;
  const winRate = results.length > 0 ? Math.round((wins / results.length) * 100) : 0;

  let context = `Editor Picks Summary:\n`;
  context += `Total: ${picks.length} picks | Record: ${wins}-${losses} (${winRate}%)\n\n`;
  context += `Recent Picks:\n`;

  limitedPicks.forEach(pick => {
    const gameId = pick.game_id || pick.id;
    const sport = (pick.game_type || 'nfl').toUpperCase();
    const resultIcon = pick.result === 'won' ? '✓' : pick.result === 'lost' ? '✗' : '⏳';

    context += `[${gameId}] ${sport} - ${pick.pick_value || 'Unknown pick'}`;
    context += ` @ ${pick.best_price || 'N/A'} (${pick.units || 1}u) - ${(pick.result || 'pending').toUpperCase()} ${resultIcon}\n`;

    if (pick.editors_notes) {
      context += `  Notes: "${pick.editors_notes.substring(0, 100)}${pick.editors_notes.length > 100 ? '...' : ''}"\n`;
    }
    context += '\n';
  });

  return context;
}

/**
 * Format outliers page data for AI context
 */
export function formatOutliersContext(
  valueAlerts: any[],
  fadeAlerts: any[]
): string {
  const hasValueAlerts = valueAlerts && valueAlerts.length > 0;
  const hasFadeAlerts = fadeAlerts && fadeAlerts.length > 0;

  if (!hasValueAlerts && !hasFadeAlerts) {
    return 'No outliers or value alerts found at this time.';
  }

  let context = 'Outliers Analysis:\n\n';

  if (hasValueAlerts) {
    context += 'VALUE ALERTS (Model vs Market Edge):\n';
    const limitedValueAlerts = valueAlerts.slice(0, 6);

    limitedValueAlerts.forEach(alert => {
      const gameId = alert.gameId || alert.game?.gameId;
      const sport = (alert.sport || 'nfl').toUpperCase();
      const edge = alert.edge || (alert.percentage - (alert.vegasImplied || 50));

      context += `[${gameId}] ${sport}: ${alert.homeTeam} vs ${alert.awayTeam}\n`;
      context += `  ${alert.marketType} - ${alert.side}: Model ${alert.percentage}%`;
      if (alert.vegasImplied) {
        context += ` vs Vegas ${alert.vegasImplied}% (${edge}% EDGE)`;
      }
      context += '\n\n';
    });
  }

  if (hasFadeAlerts) {
    context += 'FADE ALERTS (Contrarian Plays):\n';
    const limitedFadeAlerts = fadeAlerts.slice(0, 4);

    limitedFadeAlerts.forEach(alert => {
      const gameId = alert.gameId || alert.game?.gameId;
      const sport = (alert.sport || 'nfl').toUpperCase();

      context += `[${gameId}] ${sport}: ${alert.awayTeam} @ ${alert.homeTeam}\n`;
      context += `  ${alert.pickType}: ${alert.predictedTeam} (${alert.confidence}% confidence)`;
      if (alert.publicPercentage) {
        context += ` - ${alert.publicPercentage}% public on other side`;
      }
      context += '\n\n';
    });
  }

  return context;
}

/**
 * Format scoreboard page data for AI context
 */
export function formatScoreboardContext(liveGames: any[]): string {
  if (!liveGames || liveGames.length === 0) {
    return 'No live games at this time.';
  }

  const limitedGames = liveGames.slice(0, PAGE_PROMPTS.scoreboard.maxItems);

  // Separate by status
  const inProgress = limitedGames.filter(g => g.is_live || g.game_status === 'In Progress');
  const final = limitedGames.filter(g => g.game_status === 'Final');
  const scheduled = limitedGames.filter(g => g.game_status === 'Scheduled');

  let context = 'Live Scoreboard:\n\n';

  if (inProgress.length > 0) {
    context += 'IN PROGRESS:\n';
    inProgress.forEach(game => {
      const gameId = game.id;
      context += `[${gameId}] ${game.league}: ${game.away_abbr || game.away_team} ${game.away_score}`;
      context += ` @ ${game.home_abbr || game.home_team} ${game.home_score}`;
      context += ` (${game.quarter} - ${game.time_remaining})\n`;

      if (game.predictions) {
        if (game.predictions.spread) {
          const sp = game.predictions.spread;
          context += `  Spread: ${sp.pick} ${sp.isHitting ? '✓' : '✗'} ${sp.isHitting ? 'HITTING' : 'NOT HITTING'}\n`;
        }
        if (game.predictions.total) {
          const tot = game.predictions.total;
          context += `  Total: ${tot.pick} - Currently ${tot.currentTotal}, pace for ${tot.projectedTotal}\n`;
        }
      }
      context += '\n';
    });
  }

  if (final.length > 0) {
    context += 'FINAL:\n';
    final.forEach(game => {
      context += `[${game.id}] ${game.league}: ${game.away_team} ${game.away_score}, ${game.home_team} ${game.home_score} - FINAL\n`;
    });
    context += '\n';
  }

  if (scheduled.length > 0) {
    context += `UPCOMING: ${scheduled.length} games scheduled\n`;
  }

  return context;
}

// ============================================================================
// MAIN EXPORT - Get config and formatted context for a page
// ============================================================================

export interface ScanPageConfig {
  prompt: PagePromptConfig;
  formatContext: (data: any) => string;
}

export interface GameDetailsConfig {
  formatContext: (game: any, sport: Sport, polymarket?: any) => string;
}

/**
 * Get scan configuration for a specific page type
 */
export function getScanPageConfig(pageType: PageType): ScanPageConfig {
  const prompt = PAGE_PROMPTS[pageType];

  const formatters: Record<PageType, (data: any) => string> = {
    feed: (data) => formatFeedContext(data.games, data.sport, data.polymarketData),
    picks: (data) => formatPicksContext(data.picks),
    outliers: (data) => formatOutliersContext(data.valueAlerts, data.fadeAlerts),
    scoreboard: (data) => formatScoreboardContext(data.liveGames),
  };

  return {
    prompt,
    formatContext: formatters[pageType],
  };
}

/**
 * Get game details formatter for floating assistant
 */
export function getGameDetailsConfig(): GameDetailsConfig {
  return {
    formatContext: formatGameDetailsContext,
  };
}

// ============================================================================
// TYPE EXPORTS for integration
// ============================================================================

export interface PolymarketMarketData {
  awayTeam: string;
  homeTeam: string;
  currentAwayOdds: number;      // 0-100 percentage
  currentHomeOdds: number;      // 0-100 percentage
  volume?: number;              // USD volume
  marketId?: string;
  marketType: 'moneyline' | 'spread' | 'total';
  data?: Array<{
    timestamp: number;
    awayTeamOdds: number;
    homeTeamOdds: number;
  }>;
}

export interface GamePolymarketData {
  moneyline?: PolymarketMarketData;
  spread?: PolymarketMarketData;
  total?: PolymarketMarketData;
}
