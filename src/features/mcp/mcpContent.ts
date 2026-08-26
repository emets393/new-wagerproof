import chatGPTIcon from '../../assets/mcp/providers/chatgpt.svg';
import claudeIcon from '../../assets/mcp/providers/claude.svg';
import cursorIcon from '../../assets/mcp/providers/cursor.svg';
import hermesIcon from '../../assets/mcp/providers/hermes.svg';
import openClawIcon from '../../assets/mcp/providers/openclaw.svg';

export const MCP_ENDPOINT = 'https://wagerproof-mcp.habib225.workers.dev/mcp';

const CURSOR_INSTALL_URL =
  'https://cursor.com/install-mcp?name=WagerProof&config=eyJ1cmwiOiJodHRwczovL3dhZ2VycHJvb2YtbWNwLmhhYmliMjI1LndvcmtlcnMuZGV2L21jcCJ9';

export type McpProviderKey = 'claude' | 'chatgpt' | 'cursor' | 'claude-code' | 'openclaw' | 'hermes';
export type McpSetupMode = 'mcp' | 'cli';

export interface McpSetupGuide {
  copyValue: string;
  copyDisplayValue?: string;
  copyLabel: string;
  copyTitle: string;
  copyDescription: string;
  setupTitle: string;
  setupDescription: string;
  setupUrl: string;
  setupLabel: string;
  finishTitle: string;
  finishDescription: string;
  finishUrl: string;
  finishLabel: string;
}

export interface McpProvider {
  key: McpProviderKey;
  name: string;
  icon: string;
  accent: string;
  iconBackground: string;
  iconFit?: 'cover' | 'contain';
  defaultMode: McpSetupMode;
  guides: Record<McpSetupMode, McpSetupGuide>;
}

export const MCP_PROVIDERS: McpProvider[] = [
  {
    key: 'claude',
    name: 'Claude',
    icon: claudeIcon,
    accent: '#d97757',
    iconBackground: '#f0eee6',
    iconFit: 'contain',
    defaultMode: 'mcp',
    guides: {
      mcp: {
        copyValue: MCP_ENDPOINT,
        copyLabel: 'Connector URL',
        copyTitle: 'Copy the WagerProof connector URL',
        copyDescription: 'You’ll paste this URL into Claude in the next step.',
        setupTitle: 'Go to Claude → Connectors',
        setupDescription:
          'Open Customize → Connectors → Add custom connector. Name it WagerProof, paste the URL, and leave Advanced OAuth fields blank.',
        setupUrl: 'https://claude.ai/settings/connectors',
        setupLabel: 'Open Claude Connectors',
        finishTitle: 'Connect, sign in, and research',
        finishDescription:
          'Approve WagerProof access, then ask Claude about a game, model estimate, market price, or one of your agents.',
        finishUrl: 'https://claude.ai/new',
        finishLabel: 'Start in Claude',
      },
      cli: {
        copyValue: `claude mcp add --scope user --transport http wagerproof ${MCP_ENDPOINT}
claude mcp login wagerproof`,
        copyDisplayValue: 'claude mcp add … && claude mcp login wagerproof',
        copyLabel: 'Claude Code commands',
        copyTitle: 'Copy the Claude Code commands',
        copyDescription: 'Use the CLI route when you want WagerProof available across Claude Code sessions.',
        setupTitle: 'Run both commands in Terminal',
        setupDescription:
          'The first command adds WagerProof for your user. The second starts the browser-based WagerProof OAuth sign-in.',
        setupUrl: 'https://code.claude.com/docs/en/mcp',
        setupLabel: 'Open Claude Code MCP docs',
        finishTitle: 'Return to Claude Code',
        finishDescription:
          'After sign-in, ask Claude Code to list the WagerProof tools or research a matchup with live model context.',
        finishUrl: 'https://claude.com/product/claude-code',
        finishLabel: 'Open Claude Code',
      },
    },
  },
  {
    key: 'chatgpt',
    name: 'ChatGPT',
    icon: chatGPTIcon,
    accent: '#10a37f',
    iconBackground: '#ffffff',
    iconFit: 'cover',
    defaultMode: 'mcp',
    guides: {
      mcp: {
        copyValue: MCP_ENDPOINT,
        copyLabel: 'Connector URL',
        copyTitle: 'Copy the WagerProof connector URL',
        copyDescription: 'You’ll add this as a custom MCP connection in ChatGPT.',
        setupTitle: 'Enable Developer mode and add WagerProof',
        setupDescription:
          'Open Plugins, enable Developer mode in Settings, press +, and paste the URL. Menu placement can vary by plan and workspace.',
        setupUrl: 'https://chatgpt.com/plugins',
        setupLabel: 'Open ChatGPT Plugins',
        finishTitle: 'Connect, sign in, and research',
        finishDescription:
          'Complete the WagerProof OAuth screen, then ask ChatGPT to use WagerProof for live sports research.',
        finishUrl: 'https://chatgpt.com/',
        finishLabel: 'Start in ChatGPT',
      },
      cli: {
        copyValue: MCP_ENDPOINT,
        copyLabel: 'Connector URL',
        copyTitle: 'ChatGPT uses a browser connection',
        copyDescription: 'ChatGPT does not need a local CLI command. Copy the remote MCP URL instead.',
        setupTitle: 'Add it from ChatGPT Plugins',
        setupDescription:
          'Enable Developer mode, press +, and paste the URL. Workspace owners may need to allow custom connections first.',
        setupUrl: 'https://chatgpt.com/plugins',
        setupLabel: 'Open ChatGPT Plugins',
        finishTitle: 'Sign in and start researching',
        finishDescription:
          'Approve access, then open a chat and ask ChatGPT to call a WagerProof tool.',
        finishUrl: 'https://chatgpt.com/',
        finishLabel: 'Start in ChatGPT',
      },
    },
  },
  {
    key: 'cursor',
    name: 'Cursor',
    icon: cursorIcon,
    accent: '#edecec',
    iconBackground: '#14120b',
    iconFit: 'cover',
    defaultMode: 'mcp',
    guides: {
      mcp: {
        copyValue: MCP_ENDPOINT,
        copyLabel: 'Connector URL',
        copyTitle: 'Copy the WagerProof connector URL',
        copyDescription: 'Keep the URL handy, or use the one-click installer in the next step.',
        setupTitle: 'Install WagerProof in Cursor',
        setupDescription:
          'Use the one-click installer. Cursor will add WagerProof as a remote HTTP MCP server and prompt you to authenticate.',
        setupUrl: CURSOR_INSTALL_URL,
        setupLabel: 'Install in Cursor',
        finishTitle: 'Approve access and start researching',
        finishDescription:
          'Complete WagerProof sign-in, then ask Cursor Agent to list the tools or analyze a live matchup.',
        finishUrl: 'https://cursor.com/',
        finishLabel: 'Open Cursor',
      },
      cli: {
        copyValue: `{
  "mcpServers": {
    "wagerproof": {
      "url": "${MCP_ENDPOINT}"
    }
  }
}`,
        copyDisplayValue: '{ "mcpServers": { "wagerproof": { "url": "…" } } }',
        copyLabel: 'Cursor MCP config',
        copyTitle: 'Copy the Cursor MCP config',
        copyDescription: 'Use this JSON when you prefer to configure Cursor manually.',
        setupTitle: 'Add it to mcp.json',
        setupDescription:
          'Paste the block into your Cursor MCP configuration, save it, and enable WagerProof from Cursor Settings.',
        setupUrl: 'https://cursor.com/docs/mcp',
        setupLabel: 'Open Cursor MCP docs',
        finishTitle: 'Sign in from Cursor',
        finishDescription:
          'Open the WagerProof server in Cursor, complete OAuth, and use its sports research tools.',
        finishUrl: CURSOR_INSTALL_URL,
        finishLabel: 'Install in Cursor',
      },
    },
  },
  {
    key: 'claude-code',
    name: 'Claude Code',
    icon: claudeIcon,
    accent: '#d97757',
    iconBackground: '#1f2021',
    iconFit: 'contain',
    defaultMode: 'cli',
    guides: {
      mcp: {
        copyValue: MCP_ENDPOINT,
        copyLabel: 'Connector URL',
        copyTitle: 'Copy the WagerProof connector URL',
        copyDescription: 'Claude Code connects to this remote Streamable HTTP MCP endpoint.',
        setupTitle: 'Add the remote server in Claude Code',
        setupDescription:
          'Use the HTTP transport, name the server wagerproof, and set user scope if you want it in every project.',
        setupUrl: 'https://code.claude.com/docs/en/mcp',
        setupLabel: 'Open Claude Code MCP docs',
        finishTitle: 'Authenticate and research',
        finishDescription:
          'Run the login flow, approve access in your browser, and return to Claude Code.',
        finishUrl: 'https://claude.com/product/claude-code',
        finishLabel: 'Open Claude Code',
      },
      cli: {
        copyValue: `claude mcp add --scope user --transport http wagerproof ${MCP_ENDPOINT}
claude mcp login wagerproof`,
        copyDisplayValue: 'claude mcp add … && claude mcp login wagerproof',
        copyLabel: 'Claude Code commands',
        copyTitle: 'Copy the Claude Code commands',
        copyDescription: 'The commands add WagerProof at user scope, then start OAuth.',
        setupTitle: 'Run both commands in Terminal',
        setupDescription:
          'Claude Code will recognize the remote server, open WagerProof sign-in, and store the connection after approval.',
        setupUrl: 'https://code.claude.com/docs/en/mcp',
        setupLabel: 'Open Claude Code MCP docs',
        finishTitle: 'Return to Claude Code',
        finishDescription:
          'Ask Claude Code to list WagerProof tools or research a matchup with current model and market context.',
        finishUrl: 'https://claude.com/product/claude-code',
        finishLabel: 'Open Claude Code',
      },
    },
  },
  {
    key: 'openclaw',
    name: 'OpenClaw',
    icon: openClawIcon,
    accent: '#ef4444',
    iconBackground: '#f5f3ed',
    iconFit: 'contain',
    defaultMode: 'cli',
    guides: {
      mcp: {
        copyValue: MCP_ENDPOINT,
        copyLabel: 'Connector URL',
        copyTitle: 'Copy the WagerProof connector URL',
        copyDescription: 'OpenClaw connects to WagerProof over remote Streamable HTTP.',
        setupTitle: 'Add a remote OAuth MCP server',
        setupDescription:
          'Name it wagerproof, select Streamable HTTP rather than SSE, use OAuth, and paste the connector URL.',
        setupUrl: 'https://docs.openclaw.ai/cli/mcp',
        setupLabel: 'Open OpenClaw MCP docs',
        finishTitle: 'Sign in and start researching',
        finishDescription:
          'Complete browser OAuth, return to OpenClaw, and ask it to call a WagerProof tool.',
        finishUrl: 'https://openclaw.ai/',
        finishLabel: 'Open OpenClaw',
      },
      cli: {
        copyValue: `openclaw mcp add wagerproof --url ${MCP_ENDPOINT} --transport streamable-http --auth oauth
openclaw mcp login wagerproof`,
        copyDisplayValue: 'openclaw mcp add wagerproof … && openclaw mcp login wagerproof',
        copyLabel: 'OpenClaw commands',
        copyTitle: 'Copy the OpenClaw commands',
        copyDescription: 'The explicit transport flag prevents OpenClaw from falling back to SSE.',
        setupTitle: 'Run both commands in Terminal',
        setupDescription:
          'Add the server, then open the WagerProof OAuth flow. Use mcp doctor wagerproof --probe if you need to verify it.',
        setupUrl: 'https://docs.openclaw.ai/cli/mcp',
        setupLabel: 'Open OpenClaw MCP docs',
        finishTitle: 'Return to OpenClaw',
        finishDescription:
          'After sign-in, ask OpenClaw to list WagerProof tools or start a sports research task.',
        finishUrl: 'https://openclaw.ai/',
        finishLabel: 'Open OpenClaw',
      },
    },
  },
  {
    key: 'hermes',
    name: 'Hermes',
    icon: hermesIcon,
    accent: '#4f9eae',
    iconBackground: '#214f5d',
    iconFit: 'cover',
    defaultMode: 'cli',
    guides: {
      mcp: {
        copyValue: MCP_ENDPOINT,
        copyLabel: 'Connector URL',
        copyTitle: 'Copy the WagerProof connector URL',
        copyDescription: 'Hermes Agent can discover this remote MCP server and its OAuth flow.',
        setupTitle: 'Add WagerProof as a remote server',
        setupDescription:
          'Name it wagerproof, paste the URL, select OAuth, and allow extra time for browser authentication.',
        setupUrl: 'https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp',
        setupLabel: 'Open Hermes MCP docs',
        finishTitle: 'Choose tools and start researching',
        finishDescription:
          'Hermes will discover the tools after sign-in. Select the WagerProof tools you want available to the agent.',
        finishUrl: 'https://hermes-agent.nousresearch.com/',
        finishLabel: 'Open Hermes',
      },
      cli: {
        copyValue: `hermes mcp add wagerproof --url ${MCP_ENDPOINT} --auth oauth --connect-timeout 315`,
        copyDisplayValue: 'hermes mcp add wagerproof … --auth oauth',
        copyLabel: 'Hermes command',
        copyTitle: 'Copy the Hermes MCP command',
        copyDescription: 'Hermes handles discovery, browser OAuth, and tool selection in this single add flow.',
        setupTitle: 'Run the command in Terminal',
        setupDescription:
          'Finish WagerProof sign-in in the browser Hermes opens. Use hermes mcp test wagerproof afterward if needed.',
        setupUrl: 'https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp',
        setupLabel: 'Open Hermes MCP docs',
        finishTitle: 'Return to Hermes',
        finishDescription:
          'Select the WagerProof tools you want enabled, then ask Hermes to research a matchup or your agent history.',
        finishUrl: 'https://hermes-agent.nousresearch.com/',
        finishLabel: 'Open Hermes',
      },
    },
  },
];

export type McpScenarioKey = 'slate' | 'matchup' | 'market' | 'agents' | 'record';

export interface McpScenario {
  key: McpScenarioKey;
  label: string;
  eyebrow: string;
  prompt: string;
  intro: string;
  progress: string;
  tool: string;
  toolLabel: string;
  response: string;
  resultTitle: string;
  resultKicker: string;
  resultStatus: string;
  resultMetric: string;
  resultMetricLabel: string;
  resultRows: Array<{
    label: string;
    value: string;
    detail: string;
    tone: 'green' | 'amber' | 'blue';
  }>;
};

export const MCP_SCENARIOS: McpScenario[] = [
  {
    key: 'slate',
    label: "Today's slate",
    eyebrow: 'Model research',
    prompt: "Scan today's NBA slate and show me where WagerProof's model differs most from the market.",
    intro:
      "I’ll load today’s NBA model estimates, compare them with prediction-market prices, and sort the largest probability gaps first.",
    progress: 'The model and market data are ready. I found three matchups with a gap above four percentage points.',
    tool: 'get_sport_predictions',
    toolLabel: 'WagerProof model predictions',
    response:
      'The largest model-to-market differences are below. These are analytic estimates, not guarantees or betting advice.',
    resultTitle: 'NBA probability gaps',
    resultKicker: 'Illustrative MCP response',
    resultStatus: '3 matchups',
    resultMetric: '+6.8 pp',
    resultMetricLabel: 'largest gap',
    resultRows: [
      { label: 'Phoenix @ Denver', value: '+6.8 pp', detail: 'Model 61.2% · Market 54.4%', tone: 'green' },
      { label: 'Miami @ New York', value: '+5.1 pp', detail: 'Model 57.9% · Market 52.8%', tone: 'amber' },
      { label: 'Dallas @ Minnesota', value: '+4.3 pp', detail: 'Model 55.6% · Market 51.3%', tone: 'blue' },
    ],
  },
  {
    key: 'matchup',
    label: 'Matchup research',
    eyebrow: 'Game detail',
    prompt: 'Break down Lakers vs. Celtics and explain the most important model and market signals.',
    intro:
      'I’ll find the game, load its full WagerProof analytics row, and compare the model estimate with the current market.',
    progress: 'I found the matchup and combined its efficiency, recent-form, injury, and market context.',
    tool: 'get_game_detail',
    toolLabel: 'WagerProof game detail',
    response:
      'Boston grades better in the full-season efficiency profile, while recent form narrows the gap. The market is slightly more bullish than the model.',
    resultTitle: 'Lakers @ Celtics',
    resultKicker: 'Matchup snapshot',
    resultStatus: 'NBA · 7:30 PM ET',
    resultMetric: '58.4%',
    resultMetricLabel: 'model estimate',
    resultRows: [
      { label: 'Market estimate', value: '60.1%', detail: 'Model is 1.7 pp lower', tone: 'amber' },
      { label: 'Recent form', value: 'BOS +3.8', detail: 'Last five efficiency margin', tone: 'green' },
      { label: 'Availability', value: '2 notes', detail: 'Injury context included', tone: 'blue' },
    ],
  },
  {
    key: 'market',
    label: 'Market check',
    eyebrow: 'Model vs. market',
    prompt: "Compare WagerProof's NBA estimates with the current prediction-market prices.",
    intro:
      'I’ll load the grouped NBA prediction-market prices and line them up with the current WagerProof model estimates.',
    progress: 'The market data is ready. Three matchups have enough coverage for a direct comparison.',
    tool: 'get_market_odds',
    toolLabel: 'Prediction-market odds',
    response:
      'The model is above market consensus on two home teams and below it on one. Prices are attributed to Polymarket and remain subject to change.',
    resultTitle: 'Model vs. market',
    resultKicker: 'Public analytics',
    resultStatus: '3 matchups',
    resultMetric: '+6.8 pp',
    resultMetricLabel: 'largest difference',
    resultRows: [
      { label: 'Phoenix @ Denver', value: '+6.8 pp', detail: 'Model above market', tone: 'green' },
      { label: 'Miami @ New York', value: '+5.1 pp', detail: 'Model above market', tone: 'amber' },
      { label: 'Dallas @ Minnesota', value: '−2.4 pp', detail: 'Model below market', tone: 'blue' },
    ],
  },
  {
    key: 'agents',
    label: 'My agents',
    eyebrow: 'Private performance',
    prompt: 'Compare my WagerProof agents by win rate, units, current streak, and strongest sport.',
    intro:
      'I’ll securely load only the agents attached to your signed-in account, then compare their recorded performance.',
    progress: 'Your four agents are loaded. Two have enough graded history for a meaningful sport breakdown.',
    tool: 'get_agent_performance',
    toolLabel: 'My agent performance',
    response:
      'Market Maven leads on net units, while Diamond Data has the higher win rate and the strongest current streak.',
    resultTitle: 'My agent desk',
    resultKicker: 'Private · RLS scoped',
    resultStatus: '4 agents',
    resultMetric: '+18.4u',
    resultMetricLabel: 'combined record',
    resultRows: [
      { label: 'Market Maven', value: '+10.2u', detail: '56.8% · MLB strongest', tone: 'green' },
      { label: 'Diamond Data', value: '+6.7u', detail: '58.1% · W4 streak', tone: 'amber' },
      { label: 'Sunday Sharp', value: '+1.5u', detail: '52.4% · NFL strongest', tone: 'blue' },
    ],
  },
  {
    key: 'record',
    label: 'My record',
    eyebrow: 'Personal tracking',
    prompt: 'Summarize my tracked record and show which sports have been strongest.',
    intro:
      'I’ll read your self-logged community-pick history and calculate the win-loss summary and sport breakdown.',
    progress: 'Your record is ready, including graded outcomes and wins you chose to share.',
    tool: 'get_my_record',
    toolLabel: 'My WagerProof record',
    response:
      'MLB has been your strongest tracked sport by win rate. NBA has the largest sample, but its results are closer to even.',
    resultTitle: 'Tracked record',
    resultKicker: 'Private · informational',
    resultStatus: '86 graded picks',
    resultMetric: '55.8%',
    resultMetricLabel: 'overall win rate',
    resultRows: [
      { label: 'MLB', value: '61.3%', detail: '19–12 · strongest rate', tone: 'green' },
      { label: 'NBA', value: '52.8%', detail: '28–25 · largest sample', tone: 'amber' },
      { label: 'NFL', value: '54.5%', detail: '12–10 · tracked record', tone: 'blue' },
    ],
  },
];

export type McpToolCategory = 'featured' | 'slate' | 'matchups' | 'market' | 'database' | 'agents' | 'community';

export type McpToolPreview =
  | 'predictions'
  | 'game'
  | 'search'
  | 'market'
  | 'editor'
  | 'schema'
  | 'sql'
  | 'community'
  | 'agent-list'
  | 'performance'
  | 'picks'
  | 'follows'
  | 'activity'
  | 'record';

export interface McpToolCard {
  name: string;
  title: string;
  description: string;
  category: Exclude<McpToolCategory, 'featured'>;
  featured?: boolean;
  scope: 'Public' | 'Private' | 'Signed in';
  preview: McpToolPreview;
}

export const MCP_TOOL_CARDS: McpToolCard[] = [
  {
    name: 'get_sport_predictions',
    title: 'Model predictions',
    description: 'Win probabilities, fair lines, model edges, and league-specific analytics for every loaded slate.',
    category: 'slate',
    featured: true,
    scope: 'Public',
    preview: 'predictions',
  },
  {
    name: 'get_game_detail',
    title: 'Game detail',
    description: 'A complete model, matchup, and prediction-market breakdown for one specific game.',
    category: 'matchups',
    featured: true,
    scope: 'Public',
    preview: 'game',
  },
  {
    name: 'search_games',
    title: 'Search games',
    description: 'Find a team across NFL, NBA, CFB, NCAAB, and MLB before loading deeper analysis.',
    category: 'matchups',
    scope: 'Public',
    preview: 'search',
  },
  {
    name: 'get_market_odds',
    title: 'Prediction-market odds',
    description: 'Compare WagerProof estimates with Polymarket-implied probabilities, grouped by game.',
    category: 'market',
    featured: true,
    scope: 'Public',
    preview: 'market',
  },
  {
    name: 'get_editor_picks',
    title: 'Editor analyses',
    description: 'Read WagerProof’s published expert reasoning alongside its transparent graded result.',
    category: 'market',
    scope: 'Public',
    preview: 'editor',
  },
  {
    name: 'get_sports_schema',
    title: 'Sports database schema',
    description: 'Browse queryable tables, columns, types, row estimates, and comments before writing a custom sports query.',
    category: 'database',
    scope: 'Signed in',
    preview: 'schema',
  },
  {
    name: 'query_sports_database',
    title: 'Custom sports research',
    description: 'Test bespoke historical theories with one bounded SQL query and return aggregate findings plus illustrative games.',
    category: 'database',
    featured: true,
    scope: 'Signed in',
    preview: 'sql',
  },
  {
    name: 'list_my_agents',
    title: 'My AI agents',
    description: 'List the signed-in user’s agents, strategies, sports, visibility, and automation settings.',
    category: 'agents',
    scope: 'Private',
    preview: 'agent-list',
  },
  {
    name: 'get_agent_performance',
    title: 'Agent performance',
    description: 'Compare win rate, units, streaks, and sport or bet-type performance for your agents.',
    category: 'agents',
    featured: true,
    scope: 'Private',
    preview: 'performance',
  },
  {
    name: 'list_my_agent_picks',
    title: 'My agent picks',
    description: 'Read recent agent research, analytic confidence, filters, and transparent graded outcomes.',
    category: 'agents',
    scope: 'Private',
    preview: 'picks',
  },
  {
    name: 'list_my_follows',
    title: 'Agents I follow',
    description: 'List followed public agents with their archetype and current win-loss record.',
    category: 'community',
    featured: true,
    scope: 'Private',
    preview: 'follows',
  },
  {
    name: 'get_my_community_activity',
    title: 'My community activity',
    description: 'Review your posted research, reasoning, graded outcomes, and community vote totals.',
    category: 'community',
    scope: 'Private',
    preview: 'activity',
  },
  {
    name: 'get_my_record',
    title: 'My tracked record',
    description: 'Summarize wins, losses, pushes, win rate, sport splits, and shared wins.',
    category: 'community',
    featured: true,
    scope: 'Private',
    preview: 'record',
  },
];

export const MCP_TOOL_CATEGORIES: Array<{
  key: McpToolCategory;
  label: string;
  description: string;
}> = [
  { key: 'featured', label: 'Featured', description: 'Popular tools to get started' },
  { key: 'slate', label: "Today’s slate", description: 'Scan every loaded league' },
  { key: 'matchups', label: 'Matchups', description: 'Find and break down games' },
  { key: 'market', label: 'Model & market', description: 'Compare estimates and context' },
  { key: 'database', label: 'Sports database', description: 'Test custom historical theories' },
  { key: 'agents', label: 'My agents', description: 'Private agent research' },
  { key: 'community', label: 'Community & record', description: 'Public signal and your history' },
];

export const MCP_TOOL_COUNT = MCP_TOOL_CARDS.length;

export const MCP_FAQS = [
  {
    question: 'How does WagerProof connect to AI agents?',
    answer:
      'WagerProof uses MCP (Model Context Protocol), an open standard that lets compatible AI clients call external tools. Add the remote connector URL, sign in with WagerProof, approve access, and the AI can request WagerProof analytics inside the conversation.',
  },
  {
    question: 'Which AI apps are supported?',
    answer:
      'This tutorial includes custom-connection guides for Claude, ChatGPT, Cursor, Claude Code, OpenClaw, and Hermes. WagerProof uses remote Streamable HTTP MCP with OAuth 2.1; availability, menu labels, and workspace permissions can vary by client, plan, and app version.',
  },
  {
    question: 'What data and tools are available?',
    answer:
      `There are ${MCP_TOOL_COUNT} tools in the current connector catalog: public model predictions, game detail, game search, prediction-market prices, and editor analyses; signed-in sports schema and custom database research; plus private tools for your agents, their performance and picks, followed agents, community activity, and tracked record.`,
  },
  {
    question: 'What can I research?',
    answer:
      'You can scan a league’s slate, investigate a specific matchup, compare model probabilities with market prices, test bespoke historical theories against the sports database, review published analyses, and summarize your own agents, followed agents, community activity, or tracked history.',
  },
  {
    question: 'Do I need an API key?',
    answer:
      'No API key is required. The connector uses OAuth: your AI sends you to WagerProof, you sign in, and you approve access. Your password is never shared with the AI client.',
  },
  {
    question: 'Is my private WagerProof data protected?',
    answer:
      'Private tools run as the signed-in user and are scoped by WagerProof’s row-level security. Public sports tools use global data, while personal agent and record tools can only read data available to the authorized account.',
  },
  {
    question: 'Can the connector change data or place bets?',
    answer:
      'No. It cannot create or edit agents, publish picks, place wagers, move money, or interact with a sportsbook.',
  },
  {
    question: 'Does WagerProof guarantee outcomes?',
    answer:
      'No. WagerProof reports model estimates, historical performance, and market information for analysis and research. Sports outcomes remain uncertain, and the connector does not provide guarantees or betting advice.',
  },
  {
    question: 'Can I use WagerProof with my own agent setup?',
    answer:
      `Yes. Any compatible remote-MCP client can connect to ${MCP_ENDPOINT}. Name the connector WagerProof, leave advanced settings empty unless your client requires them, and complete the WagerProof OAuth flow when prompted.`,
  },
];

export const MCP_EXPLORE_LINKS = [
  { label: "Today’s Outliers", to: '/today-in-sports' },
  { label: 'AI Agent HQ', to: '/agents' },
  { label: 'Games', to: '/games' },
  { label: "Today’s Trends", to: '/todays-trends' },
  { label: 'Historical Analysis', to: '/historical-trends' },
  { label: 'Player Props', to: '/mlb/picks-report' },
  { label: 'Model Predictions', to: '/games' },
  { label: 'Market Odds', to: '/games' },
  { label: 'Community Agents', to: '/agents' },
  { label: 'My Record', to: '/account' },
  { label: 'Research Guides', to: '/guides/' },
  { label: 'Build an Agent', to: '/agents/create' },
  { label: 'WagerProof for iOS', to: '/mobile-app' },
  { label: 'WagerProof for Android', to: '/mobile-app' },
  { label: 'Support', to: '/support' },
];
