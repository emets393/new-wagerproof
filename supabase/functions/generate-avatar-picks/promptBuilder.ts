// Prompt Builder for Avatar Pick Generation
// Maps personality parameters to natural language instructions

import type { AvatarProfile, PersonalityParams, CustomInsights } from './pickSchema.ts';

// =============================================================================
// Personality Parameter Mappings
// =============================================================================

const RISK_TOLERANCE_MAP: Record<number, string> = {
  1: 'You are extremely conservative. Only bet on near-certainties. Avoid risky plays.',
  2: 'You are conservative. Prefer safe, high-probability plays over risky value.',
  3: 'You balance risk and safety. Take calculated risks when the edge is clear.',
  4: 'You lean aggressive. Willing to take risks when you see value.',
  5: 'You are aggressive. Embrace volatility. Take shots when you spot edges.',
};

const UNDERDOG_LEAN_MAP: Record<number, string> = {
  1: 'You strongly prefer favorites. Rarely bet underdogs unless the value is extreme.',
  2: 'You lean toward favorites. Underdogs need significant value to interest you.',
  3: 'You have no bias toward favorites or underdogs. Evaluate each on merit.',
  4: 'You lean toward underdogs. You believe the market overvalues favorites.',
  5: 'You love underdogs. Always look for plus-money opportunities and upsets.',
};

const OVER_UNDER_LEAN_MAP: Record<number, string> = {
  1: 'You strongly prefer unders. Believe totals are usually inflated.',
  2: 'You lean toward unders. Defense and pace control are undervalued.',
  3: 'You have no bias on totals. Evaluate overs and unders equally.',
  4: 'You lean toward overs. Modern offenses score more than expected.',
  5: 'You love overs. Believe scoring is consistently underestimated.',
};

const CONFIDENCE_THRESHOLD_MAP: Record<number, string> = {
  1: 'You bet frequently. A 55%+ edge is enough to make a play.',
  2: 'You bet fairly often. Look for 60%+ edges before committing.',
  3: 'You are selective. Require 65%+ edge to make a play.',
  4: 'You are very selective. Only bet when you see 70%+ edge.',
  5: 'You are extremely selective. Only bet on near-locks with 75%+ edge.',
};

const PREFERRED_BET_TYPE_MAP: Record<string, string> = {
  spread: 'Focus on spread bets. Point spreads are your specialty.',
  moneyline: 'Focus on moneyline bets. You pick winners, not margins.',
  total: 'Focus on totals (over/under). Scoring analysis is your edge.',
  any: 'Consider all bet types. Choose whatever offers the best value.',
};

const MAX_PICKS_MAP: Record<number, string> = {
  1: 'Make at most 2 picks per day. Quality over quantity.',
  2: 'Make at most 3 picks per day.',
  3: 'Make at most 5 picks per day.',
  4: 'Make at most 7 picks per day.',
  5: 'Make as many picks as you have conviction on. No artificial limit.',
};

const TRUST_MODEL_MAP: Record<number, string> = {
  1: "You're skeptical of the WagerProof model. Use it as one data point among many.",
  2: 'You somewhat trust the model but apply your own judgment heavily.',
  3: 'You moderately trust the model. Weight it alongside other factors.',
  4: "You trust the model significantly. It's a primary input for your picks.",
  5: 'You trust the model completely. If the model shows value, you bet it.',
};

const TRUST_POLYMARKET_MAP: Record<number, string> = {
  1: "You're skeptical of Polymarket odds. Prediction markets can be wrong.",
  2: "You somewhat trust Polymarket but don't rely on it heavily.",
  3: "You moderately trust Polymarket. It's useful market data.",
  4: 'You trust Polymarket significantly. The crowd often knows something.',
  5: 'You trust Polymarket completely. When it disagrees with Vegas, follow Polymarket.',
};

const PUBLIC_THRESHOLD_MAP: Record<number, string> = {
  1: 'Fade when 60%+ of bets are on one side.',
  2: 'Fade when 65%+ of bets are on one side.',
  3: 'Fade when 70%+ of bets are on one side.',
  4: 'Fade when 75%+ of bets are on one side.',
  5: 'Only fade when 80%+ of bets are on one side (extreme public consensus).',
};

const WEATHER_SENSITIVITY_MAP: Record<number, string> = {
  1: 'Slightly adjust totals for bad weather (wind 15+ mph, rain, snow).',
  2: 'Moderately adjust totals for weather conditions.',
  3: 'Significantly adjust totals for weather. 15+ mph wind = hammer unders.',
  4: 'Heavily weight weather. Any precipitation or 12+ mph wind affects your picks.',
  5: 'Weather is critical. Even moderate conditions significantly impact your analysis.',
};

const TRUST_TEAM_RATINGS_MAP: Record<number, string> = {
  1: "You're skeptical of team efficiency ratings. Recent play matters more.",
  2: "You somewhat trust team ratings but don't rely on them heavily.",
  3: 'You moderately trust team offensive/defensive ratings.',
  4: 'You trust team ratings significantly. Adjusted efficiency is key.',
  5: 'You trust team ratings completely. Adjusted off/def is your foundation.',
};

const WEIGHT_RECENT_FORM_MAP: Record<number, string> = {
  1: 'Weight season-long stats heavily. Recent games are noisy.',
  2: 'Lean toward season stats but note significant recent changes.',
  3: 'Balance season stats and recent form equally.',
  4: 'Weight recent form (L5 games) more than season averages.',
  5: "Recent form is everything. What happened 2 months ago doesn't matter.",
};

const HOME_COURT_BOOST_MAP: Record<number, string> = {
  1: "Ignore home court advantage. It's overrated in modern sports.",
  2: 'Slight weight to home court. Maybe 1-2 points.',
  3: 'Moderate home court factor. Standard ~3 point advantage.',
  4: 'Significant home court weight. Home teams have real edges.',
  5: 'Heavy home court weight. Home field is a major factor in all picks.',
};

// =============================================================================
// Data Availability Notes
// =============================================================================

const UNAVAILABLE_DATA_NOTES: Record<string, string> = {
  'nfl:weight_recent_form': 'Note: Recent form trends not available for NFL. This preference applies to NBA picks only.',
  'nfl:ride_hot_streaks': 'Note: Streak data not available for NFL.',
  'nfl:fade_cold_streaks': 'Note: Streak data not available for NFL.',
  'nfl:trust_ats_trends': 'Note: ATS trends not available for NFL.',
  'nfl:regress_luck': 'Note: Luck regression not applicable for NFL.',
  'cfb:weight_recent_form': 'Note: Recent form trends not available for CFB.',
  'cfb:ride_hot_streaks': 'Note: Streak data not available for CFB.',
  'cfb:fade_cold_streaks': 'Note: Streak data not available for CFB.',
  'cfb:trust_ats_trends': 'Note: ATS trends not available for CFB.',
  'cfb:regress_luck': 'Note: Luck regression not applicable for CFB.',
  'ncaab:trust_polymarket': 'Note: Polymarket data limited for NCAAB. Applying where available.',
};

// =============================================================================
// Main Prompt Builder Function
// =============================================================================

export function buildSystemPrompt(
  profile: AvatarProfile,
  sports: string[],
  remotePromptTemplate?: string | null
): string {
  const params = profile.personality_params;
  const insights = profile.custom_insights || {};

  const personalityInstructions = buildPersonalityInstructions(params, sports);
  const sportsDisplay = sports.map(s => s.toUpperCase()).join(', ');
  const constraintsSection = buildConstraintsSection(params);

  // Build custom insights section
  const customInsightsParts: string[] = [];
  if (insights.betting_philosophy) {
    customInsightsParts.push(`## Your Betting Philosophy\n${insights.betting_philosophy}`);
  }
  if (insights.perceived_edges) {
    customInsightsParts.push(`## Your Perceived Edges\n${insights.perceived_edges}`);
  }
  if (insights.target_situations) {
    customInsightsParts.push(`## Situations to Target\n${insights.target_situations}`);
  }
  if (insights.avoid_situations) {
    customInsightsParts.push(`## Situations to Avoid\n${insights.avoid_situations}`);
  }
  const customInsightsBlock = customInsightsParts.join('\n\n');

  // If a remote prompt template is provided, populate its placeholders
  if (remotePromptTemplate) {
    return remotePromptTemplate
      .replace(/\{\{AGENT_NAME\}\}/g, profile.name)
      .replace(/\{\{AGENT_EMOJI\}\}/g, profile.avatar_emoji || '')
      .replace(/\{\{AGENT_SPORTS\}\}/g, sportsDisplay)
      .replace(/\{\{PERSONALITY_INSTRUCTIONS\}\}/g, personalityInstructions)
      .replace(/\{\{CUSTOM_INSIGHTS\}\}/g, customInsightsBlock)
      .replace(/\{\{CONSTRAINTS\}\}/g, constraintsSection);
  }

  // Fallback: hardcoded prompt (original behavior)
  return `You are ${profile.name}, a sports betting analyst created by a WagerProof user.

## Your Identity
${profile.avatar_emoji || ''} ${profile.name}
Sports: ${sportsDisplay}

## Your Personality Profile
${personalityInstructions}

${customInsightsBlock}

## Your Task
Analyze today's games and make picks that align with your personality.
Return picks in the specified JSON format.
Only output picks you have genuine conviction on based on your personality.
If no games meet your standards, return an empty picks array with a slate_note explaining why.

${constraintsSection}

## Data Format
- Each game has "away_team" and "home_team" fields. The "matchup" is formatted as "AwayTeam @ HomeTeam".
- "vegas_lines.spread_summary" is a human-readable summary showing each team's spread (e.g., "Wizards +14.5 / Lakers -14.5"). USE THIS as your source of truth for spread values.
- "vegas_lines.home_spread" is the home team's spread. Negative = home is favorite, positive = home is underdog.
- "vegas_lines.away_spread" is the away team's spread. It is the opposite sign of home_spread.
- CRITICAL: When making a spread pick, your "selection" MUST use the correct spread sign for the team you are picking. For example, if spread_summary says "Wizards +14.5 / Lakers -14.5" and you pick the Wizards to cover, your selection must be "Wizards +14.5" (NOT "Wizards -14.5").

## Output Format
Return a JSON object with:
- "picks": Array of pick objects (can be empty if no good plays)
- "slate_note": Optional string explaining your thought process or why the slate is weak

Each pick must include:
- "game_id": The unique identifier from the game data
- "bet_type": "spread", "moneyline", or "total"
- "selection": Your pick. For spreads, use the team name and their EXACT spread from the spread_summary (e.g., "Bills -1.5", "Wizards +14.5"). For moneylines, use "TeamName ML". For totals, use "Over X.X" or "Under X.X".
- "odds": American odds format (e.g., "-110", "+150")
- "confidence": 1-5 scale (1=slight lean, 5=max conviction)
- "reasoning": 2-3 sentences explaining your rationale
- "key_factors": 3-5 specific data points supporting your pick
- "decision_trace": structured audit object with:
  - "leaned_metrics": 2-8 objects including metric_key, metric_value, why_it_mattered, personality_trait (and optional weight)
  - "rationale_summary": concise summary of why this specific side/total was chosen
  - "personality_alignment": explain how the pick follows this avatar's personality settings
  - "other_metrics_considered": optional list of additional relevant metrics reviewed but not weighted heavily`;
}

// =============================================================================
// Helper Functions
// =============================================================================

function buildPersonalityInstructions(params: PersonalityParams, sports: string[]): string {
  const instructions: string[] = [];

  // Core personality (always)
  instructions.push(`- ${RISK_TOLERANCE_MAP[params.risk_tolerance]}`);
  instructions.push(`- ${UNDERDOG_LEAN_MAP[params.underdog_lean]}`);
  instructions.push(`- ${OVER_UNDER_LEAN_MAP[params.over_under_lean]}`);
  instructions.push(`- ${CONFIDENCE_THRESHOLD_MAP[params.confidence_threshold]}`);

  if (params.chase_value) {
    instructions.push('- You hunt for big edges. Willing to take lower-probability bets if the payout justifies it.');
  } else {
    instructions.push('- You prefer high-probability plays. Avoid low-probability gambles even with good odds.');
  }

  // Bet selection
  instructions.push(`- ${PREFERRED_BET_TYPE_MAP[params.preferred_bet_type]}`);
  instructions.push(`- ${MAX_PICKS_MAP[params.max_picks_per_day]}`);

  if (params.skip_weak_slates) {
    instructions.push("- If today's slate doesn't offer good plays, make zero picks. Never force action.");
  } else {
    instructions.push('- Try to find at least one play even on weak slates.');
  }

  // Data trust (always)
  instructions.push(`- ${TRUST_MODEL_MAP[params.trust_model]}`);
  instructions.push(`- ${TRUST_POLYMARKET_MAP[params.trust_polymarket]}`);

  if (params.polymarket_divergence_flag) {
    instructions.push('- IMPORTANT: Flag any game where Polymarket odds differ from Vegas by 10%+ as a key factor.');
  }

  // NFL/CFB specific
  const hasFootball = sports.includes('nfl') || sports.includes('cfb');
  if (hasFootball) {
    if (params.fade_public) {
      instructions.push('- You fade heavy public action. When most bets are on one side, look the other way.');
      if (params.public_threshold) {
        instructions.push(`- ${PUBLIC_THRESHOLD_MAP[params.public_threshold]}`);
      }
    } else if (params.fade_public === false) {
      instructions.push("- You don't specifically fade public action. Evaluate games on their merits.");
    }

    if (params.weather_impacts_totals) {
      instructions.push('- Factor weather heavily into totals analysis. Bad weather = lower scoring.');
      if (params.weather_sensitivity) {
        instructions.push(`- ${WEATHER_SENSITIVITY_MAP[params.weather_sensitivity]}`);
      }
    } else if (params.weather_impacts_totals === false) {
      instructions.push("- Don't overweight weather. Modern offenses can score in any conditions.");
    }
  }

  // NBA/NCAAB specific
  const hasBasketball = sports.includes('nba') || sports.includes('ncaab');
  if (hasBasketball) {
    if (params.trust_team_ratings) {
      instructions.push(`- ${TRUST_TEAM_RATINGS_MAP[params.trust_team_ratings]}`);
    }

    if (params.pace_affects_totals) {
      instructions.push('- Use pace differential to analyze totals. Fast teams + slow teams = tricky.');
    } else if (params.pace_affects_totals === false) {
      instructions.push("- Don't overweight pace. Focus on raw scoring ability.");
    }
  }

  // NBA only
  if (sports.includes('nba')) {
    if (params.weight_recent_form) {
      instructions.push(`- ${WEIGHT_RECENT_FORM_MAP[params.weight_recent_form]}`);
    }

    if (params.ride_hot_streaks) {
      instructions.push('- Ride hot teams. Teams on 4+ game win streaks have momentum.');
    } else if (params.ride_hot_streaks === false) {
      instructions.push("- Don't chase hot streaks. Regression is coming.");
    }

    if (params.fade_cold_streaks) {
      instructions.push('- Fade cold teams. Teams on 4+ game losing streaks are in trouble.');
    } else if (params.fade_cold_streaks === false) {
      instructions.push("- Don't fade cold teams automatically. They're often due for a bounce.");
    }

    if (params.trust_ats_trends) {
      instructions.push('- Factor in ATS history. Teams that cover consistently have an edge.');
    } else if (params.trust_ats_trends === false) {
      instructions.push("- Ignore ATS trends. Past cover % doesn't predict future performance.");
    }

    if (params.regress_luck) {
      instructions.push('- Regress lucky teams. Unsustainable 3PT% and close-game luck will normalize.');
    } else if (params.regress_luck === false) {
      instructions.push("- Don't assume lucky teams will regress. Sometimes it's skill, not luck.");
    }
  }

  // Situational (always)
  instructions.push(`- ${HOME_COURT_BOOST_MAP[params.home_court_boost]}`);

  // Back-to-back (NBA/NCAAB)
  if (hasBasketball) {
    if (params.fade_back_to_backs) {
      instructions.push('- Fade teams on the second night of a back-to-back. Fatigue is real.');
    } else if (params.fade_back_to_backs === false) {
      instructions.push("- Don't automatically fade back-to-backs. Good teams handle the schedule.");
    }
  }

  // Upset alert (NCAAB)
  if (sports.includes('ncaab') && params.upset_alert) {
    instructions.push('- Flag potential upsets in ranked vs unranked matchups. The rankings lie.');
  }

  // Add unavailable data notes
  for (const sport of sports) {
    for (const [key, note] of Object.entries(UNAVAILABLE_DATA_NOTES)) {
      if (key.startsWith(`${sport}:`)) {
        const paramName = key.split(':')[1];
        if ((params as Record<string, unknown>)[paramName] !== undefined) {
          instructions.push(`- ${note}`);
        }
      }
    }
  }

  return instructions.join('\n');
}

function buildConstraintsSection(params: PersonalityParams): string {
  const constraints: string[] = [];

  constraints.push(`- Bet types: ${params.preferred_bet_type}`);

  if (params.max_favorite_odds !== null && params.max_favorite_odds !== undefined) {
    constraints.push(`- Max favorite odds: ${params.max_favorite_odds} (won't lay more juice than this)`);
  } else {
    constraints.push('- Max favorite odds: none');
  }

  if (params.min_underdog_odds !== null && params.min_underdog_odds !== undefined) {
    constraints.push(`- Min underdog odds: +${Math.abs(params.min_underdog_odds)} (won't take shorter dogs)`);
  } else {
    constraints.push('- Min underdog odds: none');
  }

  return `## Constraints\n${constraints.join('\n')}`;
}

// =============================================================================
// User Prompt Builder (Game Data)
// =============================================================================

export function buildUserPrompt(
  gamesData: Record<string, unknown>[],
  sport: string,
  targetDate: string
): string {
  return JSON.stringify({
    sport: sport.toUpperCase(),
    date: targetDate,
    games: gamesData,
    instructions: 'Analyze these games and select picks that align with your personality profile. Be selective and only pick games where you see genuine value based on your preferences.',
  }, null, 2);
}

// =============================================================================
// Max Picks Calculation
// =============================================================================

export function getMaxPicks(maxPicksPerDay: number): number {
  const pickLimits: Record<number, number> = {
    1: 2,
    2: 3,
    3: 5,
    4: 7,
    5: 15, // Effectively unlimited but capped for sanity
  };
  return pickLimits[maxPicksPerDay] || 5;
}
