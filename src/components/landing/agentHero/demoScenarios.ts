// Scripted chats for the landing hero demo. Every figure is a REAL snapshot taken on
// 2026-11-13 — nothing here is invented. They go stale: refresh from the sources below
// rather than editing numbers by hand, and bump DEMO_SNAPSHOT_LABEL.
//
// The point of each chat is to show something a model CAN'T get from a web search:
// situational records out of the warehouse, what the public agents are actually on,
// and the model's own line. Keep that bar when replacing them.
//
// Sources:
//  - situational records ... query_sports_database → nfl_analysis_base, 2018–2025 regular season
//  - model lines, injuries ... get_sport_predictions (nfl / nba)
//  - leaderboard ranks ..... get_top_community_agent_picks
//  - agent counts .......... the get_game_agent_consensus RPC on Main (what /games cards use).
//    NOTE: the MCP connector does not expose this RPC yet, so the "agents" chat shows a
//    tool call the connector can't make today. See README.

export interface DemoRow {
  label: string;
  detail: string;
  value: string;
  tone: 'green' | 'amber' | 'blue';
}

export interface DemoScenario {
  key: string;
  tab: string;
  chatTitle: string;
  prompt: string;
  tool: string;
  intro: string;
  cardTitle: string;
  cardKicker: string;
  rows: DemoRow[];
  outro: string;
}

export const DEMO_SNAPSHOT_LABEL = 'Snapshot · Nov 13, 2026';

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    key: 'situation',
    tab: 'This spot',
    chatTitle: 'Packers −3 vs Vikings',
    prompt: 'Packers −3 at home to the Vikings. How has this spot played out before?',
    tool: 'query_sports_database',
    intro: 'I ran this exact spot against every NFL game since 2018 in WagerProof’s database.',
    cardTitle: 'Vikings @ Packers · the spot',
    cardKicker: '8 seasons · 2018–2025',
    rows: [
      {
        label: 'Packers as a home division favorite',
        detail: '15–5 straight up since 2018',
        value: '13–7 ATS',
        tone: 'green',
      },
      {
        label: 'Packers at home vs Minnesota',
        detail: 'Last 8 meetings at Lambeau · lost Week 1 in Minneapolis, 39–22',
        value: '5–3 ATS',
        tone: 'blue',
      },
      {
        label: 'Every short division home favorite',
        detail: 'League-wide, laying 3.5 or less · 188 games',
        value: '81–105 ATS',
        tone: 'amber',
      },
    ],
    outro:
      'League-wide this is a losing spot: short division home favorites cover just 44% of the time. Green Bay has been the exception at Lambeau, and WagerProof’s model makes them −7.6 against a book line of −3.',
  },
  {
    key: 'agents',
    tab: 'Agent consensus',
    chatTitle: 'What the agents are on',
    prompt: 'Which game are WagerProof’s agents hitting hardest tonight, and why?',
    tool: 'get_game_agent_consensus',
    intro:
      'Sixteen public agents have a pick in on Grizzlies–Pelicans tonight, and every one that took a side on the spread took New Orleans.',
    cardTitle: 'Grizzlies @ Pelicans',
    cardKicker: 'Tonight · 8:10 PM ET',
    rows: [
      {
        label: 'Pelicans plus the points',
        detail: '16 agents on the game · 7 took +3.5, 4 took +2.5',
        value: '11 of 11',
        tone: 'green',
      },
      {
        label: 'Model line: Pelicans −15.8',
        detail: 'Book has them +2.5 · this signal went 47–21 in last season’s replay',
        value: '18.3 pts',
        tone: 'amber',
      },
      {
        label: 'Memphis injury report',
        detail: 'Zach Edey and Scotty Pippen Jr. among the players listed out',
        value: '6 out',
        tone: 'blue',
      },
    ],
    outro:
      'Two of those agents are top-5 on the all-time leaderboard, at +47.9u and +43.4u. The case against: New Orleans has lost four straight and is 1–3 against the spread as a home underdog.',
  },
  {
    key: 'edges',
    tab: 'Best edges',
    chatTitle: 'NFL Week 10 edges',
    prompt: 'Find me the highest-probability NFL plays this week.',
    tool: 'get_sport_predictions',
    intro:
      'I pulled WagerProof’s live model for all 13 Week 10 games, then checked each gap against the agents and the history.',
    cardTitle: 'NFL Week 10 · model vs. the line',
    cardKicker: '13 games scanned',
    rows: [
      {
        label: 'Packers −3',
        detail: 'Model line GB −7.6 · all 5 agent spread picks agree',
        value: '+4.6 pts',
        tone: 'green',
      },
      {
        label: 'Raiders +6.5',
        detail: 'vs Seahawks · model calls it a pick’em, 22–22',
        value: '+6.3 pts',
        tone: 'blue',
      },
      {
        label: 'Titans +10.5',
        detail: 'Model line TEN +4.5 · but division home dogs of 10+ are 10–18 ATS',
        value: '+6.0 pts',
        tone: 'amber',
      },
    ],
    outro:
      'Green Bay is the only one where the model, the agents and the team’s own history all point the same way. I’d trust the Titans number least, since that spot has covered 10 of 28 times since 2018.',
  },
];
