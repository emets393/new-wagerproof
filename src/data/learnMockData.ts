// Mock data for Learn WagerProof page
// All data is fake/sample for demonstration purposes

export const mockCFBGames = [
  {
    id: 'cfb-1',
    away_team: 'Alabama',
    home_team: 'Georgia',
    away_ml: 165,
    home_ml: -185,
    api_spread: -4.5,
    api_over_line: 52.5,
    start_time: '2025-10-18T19:30:00Z',
    weather_temp_f: 68,
    weather_windspeed_mph: 8,
    weather_icon_text: 'clear-day',
    pred_ml_proba: 0.42,
    pred_spread_proba: 0.58,
    pred_total_proba: 0.65,
    pred_away_score: 24,
    pred_home_score: 31,
    home_spread_diff: 2.5,
    pred_over_line: 55,
    over_line_diff: 2.5,
    spread_splits_label: 'Public: 65% on Georgia',
    total_splits_label: 'Sharp Money: 58% on Over',
    ml_splits_label: 'Consensus: 62% on Georgia',
    opening_spread: -3.5
  },
  {
    id: 'cfb-2',
    away_team: 'Ohio State',
    home_team: 'Michigan',
    away_ml: -210,
    home_ml: 180,
    api_spread: 5.5,
    api_over_line: 48.5,
    start_time: '2025-10-18T15:30:00Z',
    weather_temp_f: 52,
    weather_windspeed_mph: 12,
    weather_icon_text: 'partly-cloudy-day',
    pred_ml_proba: 0.68,
    pred_spread_proba: 0.62,
    pred_total_proba: 0.48,
    pred_away_score: 31,
    pred_home_score: 21,
    home_spread_diff: -3.5,
    pred_over_line: 47,
    over_line_diff: -1.5,
    spread_splits_label: 'Sharp Money: 72% on Ohio State',
    total_splits_label: 'Public: 54% on Under',
    ml_splits_label: 'Sharp Money: 68% on Ohio State',
    opening_spread: 6.5
  }
];

export const mockNFLGames = [
  {
    id: 'nfl-1',
    away_team: 'Kansas City',
    home_team: 'Buffalo',
    away_ml: -145,
    home_ml: 125,
    home_spread: 3.5,
    away_spread: -3.5,
    over_line: 51.5,
    game_date: '2025-10-19',
    game_time: '20:20:00',
    home_away_ml_prob: 0.58,
    home_away_spread_cover_prob: 0.54,
    ou_result_prob: 0.62,
    temperature: 45,
    wind_speed: 15,
    icon: 'wind',
    spread_splits_label: 'Public: 58% on Kansas City',
    total_splits_label: 'Sharp Money: 64% on Over',
    ml_splits_label: 'Consensus: 56% on Kansas City'
  },
  {
    id: 'nfl-2',
    away_team: 'San Francisco',
    home_team: 'Dallas',
    away_ml: -190,
    home_ml: 165,
    home_spread: 4.5,
    away_spread: -4.5,
    over_line: 47.5,
    game_date: '2025-10-20',
    game_time: '16:25:00',
    home_away_ml_prob: 0.35,
    home_away_spread_cover_prob: 0.42,
    ou_result_prob: 0.55,
    temperature: null,
    wind_speed: null,
    icon: 'indoor',
    spread_splits_label: 'Sharp Money: 71% on San Francisco',
    total_splits_label: 'Public: 52% on Under',
    ml_splits_label: 'Sharp Money: 68% on San Francisco'
  }
];

export const mockAnalyticsSummary = {
  totalGames: 2847,
  homeWinPercentage: 56.8,
  awayWinPercentage: 43.2,
  homeCoverPercentage: 51.2,
  awayCoverPercentage: 48.8,
  favoriteCoverPercentage: 49.5,
  underdogCoverPercentage: 50.5,
  overPercentage: 50.8,
  underPercentage: 49.2
};

export const mockAnalyticsTeams = [
  {
    teamId: 'KC',
    teamName: 'Kansas City Chiefs',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
    games: 156,
    winPercentage: 64.1,
    coverPercentage: 52.6,
    overPercentage: 48.7
  },
  {
    teamId: 'BUF',
    teamName: 'Buffalo Bills',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
    games: 152,
    winPercentage: 58.6,
    coverPercentage: 54.3,
    overPercentage: 51.3
  },
  {
    teamId: 'SF',
    teamName: 'San Francisco 49ers',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
    games: 148,
    winPercentage: 55.4,
    coverPercentage: 49.3,
    overPercentage: 47.9
  }
];

export const mockTeaserData = [
  {
    team_id: 1,
    team_name: 'Buffalo',
    ou_bias_2025: 2.3,
    ou_sharpness_2025: 4.2,
    spread_bias_2025: 1.8,
    spread_sharpness_2025: 3.9,
    games_ou_2025: 5
  },
  {
    team_id: 2,
    team_name: 'Kansas City',
    ou_bias_2025: -1.5,
    ou_sharpness_2025: 3.8,
    spread_bias_2025: -2.1,
    spread_sharpness_2025: 4.5,
    games_ou_2025: 5
  },
  {
    team_id: 3,
    team_name: 'San Francisco',
    ou_bias_2025: 0.8,
    ou_sharpness_2025: 3.2,
    spread_bias_2025: 1.2,
    spread_sharpness_2025: 3.5,
    games_ou_2025: 5
  },
  {
    team_id: 4,
    team_name: 'Dallas',
    ou_bias_2025: -3.2,
    ou_sharpness_2025: 5.8,
    spread_bias_2025: -2.8,
    spread_sharpness_2025: 6.2,
    games_ou_2025: 5
  }
];

export const mockChatMessages = [
  {
    role: 'assistant',
    content: "Hi! I'm WagerBot, your AI sports betting assistant. I have access to all the latest game data, predictions, and analytics. How can I help you today?"
  },
  {
    role: 'user',
    content: "What's your prediction for the Alabama vs Georgia game?"
  },
  {
    role: 'assistant',
    content: "Based on our model predictions for Alabama @ Georgia:\n\n🏈 **Spread Prediction**: Georgia -4.5 (Model favors Georgia with 58% confidence)\n📊 **Total Prediction**: Over 52.5 (65% confidence)\n🎯 **Predicted Score**: Alabama 24, Georgia 31\n\nKey factors:\n- Georgia has 2.5 points of edge on the spread\n- Public is 65% on Georgia, aligning with sharp money\n- Weather conditions are favorable (68°F, 8mph wind)\n\nWould you like me to dive deeper into any specific aspect?"
  }
];

export const mockGameAnalysis = {
  game_info: {
    unique_id: 'game-123',
    primary_team: 'Kansas City',
    opponent_team: 'Buffalo',
    is_home_team: false,
    o_u_line: 51.5,
    primary_ml: -145,
    opponent_ml: 125,
    primary_rl: -3.5,
    opponent_rl: 3.5
  },
  matches: [
    {
      unique_id: 'game-123',
      primary_team: 'Kansas City',
      opponent_team: 'Buffalo',
      is_home_team: false,
      combo: 'Model A',
      win_pct: 0.58,
      opponent_win_pct: 0.42,
      games: 45,
      feature_count: 12,
      features: ['Team Win%', 'Home Advantage', 'Recent Form', 'Head to Head', 'Weather', 'Rest Days'],
      model_name: 'EPA Composite Model',
      confidence: 65,
      o_u_line: 51.5
    },
    {
      unique_id: 'game-123',
      primary_team: 'Kansas City',
      opponent_team: 'Buffalo',
      is_home_team: false,
      combo: 'Model B',
      win_pct: 0.62,
      opponent_win_pct: 0.38,
      games: 38,
      feature_count: 8,
      features: ['Offensive Rating', 'Defensive Rating', 'Turnover Margin', 'Red Zone%'],
      model_name: 'Offensive Efficiency Model',
      confidence: 72,
      o_u_line: 51.5
    }
  ],
  target: 'moneyline',
  consensus: {
    primary_percentage: 0.60,
    opponent_percentage: 0.40,
    confidence: 68,
    models: 2,
    team_winner_prediction: 'Kansas City'
  }
};

export interface TouchpointData {
  id: string;
  position: { x: number; y: number };
  title: string;
  briefText: string;
  detailSteps: Array<{
    title: string;
    description: string;
    tip?: string;
  }>;
}

export const cfbTouchpoints: TouchpointData[] = [
  {
    id: 'cfb-spread',
    position: { x: 45, y: 35 },
    title: 'Spread Predictions',
    briefText: 'See point spread predictions with model confidence',
    detailSteps: [
      {
        title: 'Understanding the Spread',
        description: 'The spread shows which team is favored and by how many points. A negative spread (e.g., -4.5) means that team is favored to win by 4.5 points.',
        tip: 'Look for games where the model edge differs significantly from the opening line'
      },
      {
        title: 'Model Confidence',
        description: 'Our AI model analyzes hundreds of factors to determine spread cover probability. Higher percentages indicate stronger confidence.',
        tip: 'Confidence above 60% is considered high by our models'
      },
      {
        title: 'Edge Calculation',
        description: 'The "edge" shows the difference between our model prediction and the actual betting line. Larger edges suggest better betting opportunities.',
        tip: 'Look for 2+ point edges for the best value bets'
      }
    ]
  },
  {
    id: 'cfb-weather',
    position: { x: 50, y: 15 },
    title: 'Weather Impact',
    briefText: 'Real-time weather conditions that affect gameplay',
    detailSteps: [
      {
        title: 'Weather Conditions',
        description: 'Temperature, wind speed, and precipitation can significantly impact game outcomes, especially for passing offenses.',
        tip: 'High winds (15+ mph) typically favor under bets'
      },
      {
        title: 'Game-Time Data',
        description: 'Weather is updated in real-time for the most accurate forecasts at kickoff.',
        tip: 'Check weather an hour before kickoff for last-minute adjustments'
      }
    ]
  },
  {
    id: 'cfb-public-splits',
    position: { x: 50, y: 65 },
    title: 'Public Betting Splits',
    briefText: 'See where the money is going - public vs sharp',
    detailSteps: [
      {
        title: 'Public vs Sharp Money',
        description: 'Public bets represent casual bettors, while sharp money comes from professional handicappers. Sharp money often indicates the smarter play.',
        tip: 'Fade the public when sharp money is on the other side'
      },
      {
        title: 'Reading the Labels',
        description: 'Labels like "Sharp Money: 72% on Team A" tell you where the professional money is flowing.',
        tip: 'Heavy sharp money movement can cause line shifts'
      },
      {
        title: 'Consensus Betting',
        description: 'When public and sharp money align, it creates consensus bets - the strongest signals.',
        tip: 'Consensus bets have historically higher win rates'
      }
    ]
  },
  {
    id: 'cfb-simulator',
    position: { x: 50, y: 85 },
    title: 'Match Simulator',
    briefText: 'See predicted final scores from our models',
    detailSteps: [
      {
        title: 'Score Predictions',
        description: 'Our simulator runs thousands of game simulations to predict the most likely final score.',
        tip: 'Use predicted scores to identify over/under value'
      },
      {
        title: 'Total Implications',
        description: 'Compare the predicted total (sum of both scores) to the betting line to find value on over/under bets.',
        tip: 'A 3+ point difference suggests strong over/under value'
      }
    ]
  }
];

export const nflTouchpoints: TouchpointData[] = [
  {
    id: 'nfl-epa-model',
    position: { x: 50, y: 50 },
    title: 'EPA Model Predictions',
    briefText: 'Advanced Expected Points Added model analysis',
    detailSteps: [
      {
        title: 'What is EPA?',
        description: 'Expected Points Added (EPA) measures the value of every play by calculating how much it changes a team\'s expected points. Our model uses EPA to predict outcomes.',
        tip: 'EPA is more predictive than traditional stats like yards'
      },
      {
        title: 'Reading Confidence',
        description: 'The model shows confidence percentages for each prediction type: Moneyline, Spread, and Over/Under.',
        tip: 'Look for 65%+ confidence for the strongest plays'
      },
      {
        title: 'Team Logos Show Favorites',
        description: 'The team logo displayed indicates which team or outcome the model favors for that bet type.',
        tip: 'Logos with gradient backgrounds indicate high confidence'
      }
    ]
  },
  {
    id: 'nfl-historical',
    position: { x: 30, y: 55 },
    title: 'Historical Data',
    briefText: 'Access head-to-head history and line movement',
    detailSteps: [
      {
        title: 'Head-to-Head Analysis',
        description: 'View past matchups between these teams including scores, trends, and betting outcomes.',
        tip: 'Recent matchups (last 3 years) are most relevant'
      },
      {
        title: 'Line Movement',
        description: 'Track how betting lines have moved since opening, revealing where sharp money is going.',
        tip: 'Significant line movement (1+ point) indicates sharp action'
      }
    ]
  }
];

export const analyticsTouchpoints: TouchpointData[] = [
  {
    id: 'analytics-filters',
    position: { x: 85, y: 40 },
    title: 'Advanced Filters',
    briefText: 'Filter by 20+ criteria to find betting patterns',
    detailSteps: [
      {
        title: 'Schedule Filters',
        description: 'Filter games by season, week, day of week, and start time to identify patterns.',
        tip: 'Division games often have different trends than conference games'
      },
      {
        title: 'Weather Conditions',
        description: 'Filter by temperature, wind speed, precipitation to see how weather affects outcomes.',
        tip: 'Cold weather games (below 32°F) typically go under'
      },
      {
        title: 'Team Selection',
        description: 'Select specific teams or opponents to analyze their performance in various situations.',
        tip: 'Use multi-select to compare similar teams'
      },
      {
        title: 'Betting Lines',
        description: 'Filter by spread ranges or totals to find patterns in specific bet types.',
        tip: 'Underdogs of 7+ points cover at a higher rate historically'
      }
    ]
  },
  {
    id: 'analytics-donuts',
    position: { x: 30, y: 50 },
    title: 'Visual Analytics',
    briefText: 'Donut charts show win rates across categories',
    detailSteps: [
      {
        title: 'Reading the Charts',
        description: 'Each donut shows the percentage split for different outcomes: Home/Away wins, Covers, Favorite/Dog, and Over/Under.',
        tip: 'Look for percentages far from 50% - they indicate edges'
      },
      {
        title: 'Sample Size Matters',
        description: 'Check the total games count. Larger samples (500+) are more reliable.',
        tip: 'Be cautious with patterns based on small samples'
      },
      {
        title: 'Combining Filters',
        description: 'Stack multiple filters to discover unique betting situations with historical edges.',
        tip: 'Try "Cold weather + Underdog + Division game" for interesting patterns'
      }
    ]
  }
];

export const teaserTouchpoints: TouchpointData[] = [
  {
    id: 'teaser-zones',
    position: { x: 50, y: 30 },
    title: 'Safe Zone (Green)',
    briefText: 'Teams in this zone are ideal teaser candidates',
    detailSteps: [
      {
        title: 'Understanding Sharpness',
        description: 'The Y-axis shows how close games finish to the spread. Lower values mean more predictable outcomes.',
        tip: 'Teams with sharpness below 5 are teaser-friendly'
      },
      {
        title: 'Bias Explained',
        description: 'The X-axis shows whether teams consistently cover (right) or fail to cover (left) spreads.',
        tip: 'Teams near center (±3) have the most balanced outcomes'
      },
      {
        title: 'The Green Zone',
        description: 'Teams in the green zone have low error and balanced bias - perfect for teasers because outcomes are predictable.',
        tip: 'Teasing teams in this zone historically yields 60%+ win rates'
      }
    ]
  },
  {
    id: 'teaser-matchup',
    position: { x: 80, y: 10 },
    title: 'Matchup Filter',
    briefText: 'Filter to see specific upcoming matchups',
    detailSteps: [
      {
        title: 'Focus on This Week',
        description: 'Select an upcoming matchup to highlight both teams on the chart.',
        tip: 'Build teasers using multiple teams from the safe zone'
      },
      {
        title: 'Comparing Opponents',
        description: 'See how both teams in a matchup compare in terms of teaser viability.',
        tip: 'Best teasers involve two teams from the green zone'
      }
    ]
  }
];

export const wagerbotTouchpoints: TouchpointData[] = [
  {
    id: 'wagerbot-context',
    position: { x: 50, y: 30 },
    title: 'Context-Aware AI',
    briefText: 'WagerBot knows all your current game data',
    detailSteps: [
      {
        title: 'Automatic Data Loading',
        description: 'When you visit a page (like College Football), WagerBot automatically loads all the games and predictions into its context.',
        tip: 'Ask specific questions like "What\'s your best pick today?"'
      },
      {
        title: 'Ask Natural Questions',
        description: 'You can ask questions in plain English about games, teams, trends, and predictions.',
        tip: 'Try: "Compare the Alabama and Ohio State predictions"'
      },
      {
        title: 'Explains Complex Concepts',
        description: 'WagerBot can break down complex betting concepts, statistics, and strategies in simple terms.',
        tip: 'Ask "Why do you favor the over in this game?"'
      }
    ]
  },
  {
    id: 'wagerbot-anywhere',
    position: { x: 90, y: 85 },
    title: 'Available Everywhere',
    briefText: 'Access WagerBot from any page via floating button',
    detailSteps: [
      {
        title: 'Floating Chat Button',
        description: 'The green WagerBot button appears on every page and can be dragged anywhere on screen.',
        tip: 'Keep it open while browsing games for quick questions'
      },
      {
        title: 'Page-Specific Context',
        description: 'WagerBot adjusts its knowledge based on which page you\'re on, giving you relevant answers.',
        tip: 'Switch between pages to ask questions about different sports'
      }
    ]
  }
];

export const gameAnalysisTouchpoints: TouchpointData[] = [
  {
    id: 'analysis-consensus',
    position: { x: 50, y: 35 },
    title: 'Weighted Consensus',
    briefText: 'Multiple models combined for the best prediction',
    detailSteps: [
      {
        title: 'Model Ensemble',
        description: 'We run multiple prediction models and combine their outputs using weighted averages based on historical accuracy.',
        tip: 'More models = more reliable predictions'
      },
      {
        title: 'Confidence Scoring',
        description: 'Consensus confidence shows how much the models agree. Higher agreement = stronger signal.',
        tip: 'Look for 65%+ consensus confidence'
      },
      {
        title: 'Visual Probability',
        description: 'The circular charts show exact win probabilities for each team or outcome.',
        tip: 'The larger the difference in probabilities, the stronger the pick'
      }
    ]
  },
  {
    id: 'analysis-models',
    position: { x: 50, y: 65 },
    title: 'Individual Models',
    briefText: 'See how each model makes its prediction',
    detailSteps: [
      {
        title: 'Model Features',
        description: 'Each model uses different features (stats) to make predictions. More features generally means more comprehensive analysis.',
        tip: 'Models with 10+ features tend to be more accurate'
      },
      {
        title: 'Sample Size',
        description: 'The "games" number shows how much historical data the model is based on. Larger samples are more reliable.',
        tip: 'Look for models with 30+ game samples'
      },
      {
        title: 'Model Agreement',
        description: 'When all models agree, it creates a strong signal. Disagreement suggests uncertainty.',
        tip: 'Skip bets where models strongly disagree'
      }
    ]
  }
];

