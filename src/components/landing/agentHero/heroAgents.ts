import { MCP_ENDPOINT, MCP_PROVIDERS, type McpProviderKey } from '@/features/mcp/mcpContent';

export interface HeroAgent {
  key: string;
  name: string;
  accent: string;
  icon: string;
  iconBackground: string;
  iconFit: 'cover' | 'contain';
  /** What picking this agent does, shown as the row subtitle in the connect menu. */
  surface: string;
  /** How far a single click can take the user — see LAUNCH below. */
  launch: AgentLaunch;
  /** True when setup has to finish on a computer (terminal or desktop app). */
  desktopOnly: boolean;
  copyValue: string;
  copyLabel: string;
  isCommand: boolean;
  instructions: string;
  openUrl: string;
  openLabel: string;
}

/**
 * What a click can actually do differs per agent, because each vendor exposes a different
 * (or no) install hook. Verified 2026-11-13:
 *  - protocol: the app registers a URL scheme that installs an MCP server. Cursor documents
 *    cursor://anysphere.cursor-deeplink/mcp/install (cursor.com/docs/mcp/install-links);
 *    Hermes merged hermes://mcp/install in Aug 2026 (NousResearch/hermes-agent#87581).
 *    Both show their own confirm dialog — no vendor allows a silent install.
 *  - prefill: Claude opens its "Add custom connector" dialog with name + URL filled in from
 *    query params. Widely used but NOT in Anthropic's docs, so it can change without notice.
 *  - paste: ChatGPT and Grok have no install link at all. Best possible is copying the URL
 *    and opening the exact page it gets pasted into.
 *  - command: CLI agents with no URL scheme (Claude Code, OpenClaw). A web page cannot run
 *    a terminal command, so the click copies it.
 */
export type AgentLaunch =
  | { kind: 'protocol'; url: string; confirmHint: string }
  | { kind: 'prefill'; url: string; confirmHint: string }
  | { kind: 'paste'; url: string }
  | { kind: 'command' };

const SERVER_CONFIG = JSON.stringify({ url: MCP_ENDPOINT });
const toBase64Url = (value: string) => btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const LAUNCHES: Record<McpProviderKey, AgentLaunch> = {
  claude: {
    kind: 'prefill',
    url: `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=WagerProof&connectorUrl=${encodeURIComponent(MCP_ENDPOINT)}`,
    confirmHint: 'Claude opens with WagerProof already filled in. Press Add, then sign in.',
  },
  chatgpt: { kind: 'paste', url: 'https://chatgpt.com/plugins' },
  cursor: {
    kind: 'protocol',
    url: `cursor://anysphere.cursor-deeplink/mcp/install?name=WagerProof&config=${encodeURIComponent(btoa(SERVER_CONFIG))}`,
    confirmHint: 'Cursor opens with the WagerProof install prompt. Press Install, then sign in.',
  },
  'claude-code': { kind: 'command' },
  openclaw: { kind: 'command' },
  hermes: {
    kind: 'protocol',
    url: `hermes://mcp/install?name=wagerproof&config=${toBase64Url(SERVER_CONFIG)}`,
    confirmHint: 'Hermes opens with the WagerProof install prompt. Confirm it, then sign in.',
  },
};

// Grok isn't in MCP_PROVIDERS (that list drives the /mcp tutorial panels, which have
// a CLI mode Grok doesn't have), so the mark and its setup live here.
const GROK_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#0b0b0c"/><g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"><path d="M33.5 17.2A12.5 12.5 0 1 0 36.3 26"/><path d="M15 34 37 11"/></g></svg>',
)}`;

const SURFACES: Record<McpProviderKey, { surface: string; desktopOnly: boolean }> = {
  claude: { surface: 'Opens Claude, ready to add', desktopOnly: false },
  chatgpt: { surface: 'Copies the link, opens ChatGPT', desktopOnly: false },
  cursor: { surface: 'Opens Cursor and installs', desktopOnly: true },
  'claude-code': { surface: 'Copies the terminal command', desktopOnly: true },
  openclaw: { surface: 'Copies the terminal command', desktopOnly: true },
  hermes: { surface: 'Opens Hermes and installs', desktopOnly: true },
};

function fromProvider(key: McpProviderKey): HeroAgent {
  const provider = MCP_PROVIDERS.find((item) => item.key === key) ?? MCP_PROVIDERS[0];
  const guide = provider.guides[provider.defaultMode];
  return {
    key: provider.key,
    name: provider.name,
    accent: provider.accent,
    icon: provider.icon,
    iconBackground: provider.iconBackground,
    iconFit: provider.iconFit ?? 'cover',
    ...SURFACES[key],
    launch: LAUNCHES[key],
    copyValue: guide.copyValue,
    copyLabel: guide.copyLabel,
    isCommand: provider.defaultMode === 'cli',
    instructions: guide.setupDescription,
    openUrl: guide.setupUrl,
    openLabel: guide.setupLabel,
  };
}

const GROK: HeroAgent = {
  key: 'grok',
  name: 'Grok',
  accent: '#9ca3af',
  icon: GROK_ICON,
  iconBackground: '#0b0b0c',
  iconFit: 'cover',
  surface: 'Copies the link, opens Grok',
  desktopOnly: false,
  launch: { kind: 'paste', url: 'https://grok.com/connectors' },
  copyValue: MCP_ENDPOINT,
  copyLabel: 'Connector URL',
  isCommand: false,
  instructions:
    'Open Connectors, choose New Connector → Custom, name it WagerProof, and paste the URL. Custom connectors need a paid Grok plan.',
  openUrl: 'https://grok.com/connectors',
  openLabel: 'Open Grok Connectors',
};

/** Every agent offered in the connect menu, most-used first. */
export const HERO_AGENTS: HeroAgent[] = [
  fromProvider('claude'),
  fromProvider('chatgpt'),
  GROK,
  fromProvider('cursor'),
  fromProvider('claude-code'),
  fromProvider('openclaw'),
  fromProvider('hermes'),
];

/** Names that rotate through the headline. Claude Code is left out — it reads as a repeat of Claude. */
export const HEADLINE_AGENTS: HeroAgent[] = HERO_AGENTS.filter((agent) => agent.key !== 'claude-code');
