import { useState } from 'react';
import {
  Check,
  Copy,
  Lightbulb,
  Plus,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import claudeIcon from '../../wagerproof-ios-native/Wagerproof/Assets.xcassets/AIClaudeIcon.imageset/claude.jpg';
import chatGPTIcon from '../../wagerproof-ios-native/Wagerproof/Assets.xcassets/AIChatGPTIcon.imageset/chatgpt.jpg';
import geminiIcon from '../../wagerproof-ios-native/Wagerproof/Assets.xcassets/AIGeminiIcon.imageset/gemini.jpg';
import grokIcon from '../../wagerproof-ios-native/Wagerproof/Assets.xcassets/AIGrokIcon.imageset/grok.jpg';
import codexIcon from '../../wagerproof-ios-native/Wagerproof/Assets.xcassets/AICodexIcon.imageset/codex.jpg';
import claudeSymbol from '../../wagerproof-ios-native/Wagerproof/Assets.xcassets/ClaudeSymbol.imageset/claude-symbol.png';
import claudeSettings from '../../wagerproof-ios-native/Wagerproof/Assets.xcassets/ClaudeSetupSettings.imageset/claude-setup-settings.png';
import claudeConnectors from '../../wagerproof-ios-native/Wagerproof/Assets.xcassets/ClaudeSetupConnectors.imageset/claude-setup-connectors.png';

const ENDPOINT = 'https://wagerproof-mcp.habib225.workers.dev/mcp';

const PROVIDERS = [
  { name: 'Claude', icon: claudeIcon },
  { name: 'ChatGPT', icon: chatGPTIcon },
  { name: 'Gemini', icon: geminiIcon },
  { name: 'Grok', icon: grokIcon },
  { name: 'Codex', icon: codexIcon },
];

const EXAMPLE_PROMPT_CATEGORIES = [
  {
    title: 'Find your best bets',
    description: 'Cut through the slate and surface the opportunities worth researching.',
    prompts: [
      'Find the best player props today and explain why each one stands out.',
      'Show me today’s strongest betting opportunities across every game.',
      'Which current lines have the strongest supporting historical trends?',
    ],
  },
  {
    title: 'Break down any game',
    description: 'Turn WagerProof data into a clear matchup read before you make a decision.',
    prompts: [
      'Analyze today’s biggest matchup and tell me where each team has an edge.',
      'Compare the spread, moneyline, and total trends for this game.',
      'What are the most important trends I should know before betting this matchup?',
    ],
  },
  {
    title: 'Find agents worth following',
    description: 'Discover proven specialists instead of sorting through every agent yourself.',
    prompts: [
      'Find public agents currently on a winning streak of five picks or more.',
      'Who are the best-performing agents for NFL props over the last 30 days?',
      'Compare the top agents for this market by win rate, units, and recent form.',
    ],
  },
  {
    title: 'Get more from agents you follow',
    description: 'See the signal across your feed without checking every agent one by one.',
    prompts: [
      'Summarize today’s picks from the agents I follow and rank the strongest ones first.',
      'Which agents I follow agree on the same picks today?',
      'Which agents I follow are gaining momentum or starting a losing streak?',
    ],
  },
  {
    title: 'Improve your own agents',
    description: 'Understand what is working, where performance slips, and what to refine next.',
    prompts: [
      'Which of my agents is performing best right now, and what is driving the results?',
      'Compare my agents by win rate, units, and current streak.',
      'Show me where my agents are underperforming and which sports or markets are strongest.',
    ],
  },
];

function setupInstructions(): string {
  return `Help me connect WagerProof to this AI using its remote MCP connector.

Connector name: WagerProof
Connector URL: ${ENDPOINT}
Access: read-only

Please do as much of the setup as you can. If you cannot add the connector directly, give me the shortest exact steps for your current interface. Tell me where to paste the URL, leave advanced settings empty unless required, and have me authenticate with my WagerProof account when prompted. Before connecting, confirm the URL ends in wagerproof-mcp.habib225.workers.dev/mcp.`;
}

function ProviderStack() {
  return (
    <div className="flex items-center" aria-label="Claude, ChatGPT, Gemini, Grok, and Codex">
      {PROVIDERS.map((provider, index) => (
        <div
          key={provider.name}
          className="relative -ml-3 h-11 w-11 overflow-hidden rounded-full border-2 border-white/80 bg-black shadow-[0_5px_14px_rgba(0,0,0,0.38)] first:ml-0 sm:h-12 sm:w-12"
          style={{ zIndex: PROVIDERS.length - index }}
          title={provider.name}
        >
          <img src={provider.icon} alt="" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}

function ManualStep({
  number,
  title,
  description,
  icon,
  children,
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className="py-3">
      <div className="flex items-start gap-3.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#d97757] text-xs font-black text-white">
          {number}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[#d97757]">{icon}</span>
            <h3 className="text-sm font-bold sm:text-base">{title}</h3>
          </div>
          <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </li>
  );
}

export default function ConnectAI() {
  const [copied, setCopied] = useState<string | null>(null);
  const instructions = setupInstructions();

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      toast.success(`${label} copied`, {
        description: 'Paste it into your AI to continue.',
      });
      window.setTimeout(() => setCopied((current) => (current === value ? null : current)), 1800);
    } catch {
      toast.error(`Couldn't copy ${label.toLowerCase()}`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12">
      <section className="relative isolate overflow-hidden rounded-[26px] border border-white/10 bg-[#30231f] shadow-lg">
        <div className="absolute inset-0 bg-[linear-gradient(112deg,#30231f_0%,#4d2d27_46%,#a6533f_78%,#d97757_100%)]" />
        <img
          src={claudeSymbol}
          alt=""
          className="pointer-events-none absolute -bottom-20 right-[-3rem] h-72 w-72 object-contain opacity-[0.07] sm:right-0"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(255,255,255,0.14),transparent_34%)]" />

        <div className="relative px-6 py-7 sm:px-8 sm:py-8">
          <ProviderStack />
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/65">WagerProof AI connector</p>
          <h1 className="mt-1.5 text-3xl font-black tracking-[-0.025em] text-white sm:text-4xl">
            Connect WagerProof to your AI
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/85 sm:text-base">
            Give your AI read-only access to your agents, picks, follows, and WagerProof analytics.
          </p>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#d97757]/35 bg-[#d97757]/10 p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d97757] text-white">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#d97757]">Tip</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.015em]">Let your preferred AI help set it up</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
              Just click here to copy instructions for your preferred AI, paste them there, and let it guide you
              through the rest.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => copyText(instructions, 'Setup instructions')}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d97757] px-5 text-sm font-black text-white transition hover:bg-[#c9684a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d97757]/60 sm:w-auto"
        >
          {copied === instructions ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied === instructions ? 'Instructions copied' : 'Copy instructions'}
        </button>
      </section>

      <section aria-labelledby="manual-setup-title" className="space-y-4">
        <div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#d97757]">Manual setup</p>
            <h2 id="manual-setup-title" className="mt-1 text-2xl font-black tracking-[-0.02em]">
              How to connect an MCP
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Four short steps. Labels may vary slightly between AI apps.
            </p>
          </div>
        </div>

        <ol className="grid gap-3 md:grid-cols-2">
          <ManualStep
            number={1}
            title="Open your AI settings"
            description="Open your preferred AI app, then go to its settings."
            icon={<Settings2 className="h-4 w-4" />}
          >
            <div className="pl-11 pt-3">
              <img
                src={claudeSettings}
                alt="Claude account menu with Settings selected"
                className="mx-auto h-28 w-auto rounded-lg object-contain"
              />
            </div>
          </ManualStep>

          <ManualStep
            number={2}
            title="Find Connectors or MCP"
            description="Open the Connectors, Integrations, or MCP section and add a new one."
            icon={<Plus className="h-4 w-4" />}
          >
            <div className="pl-11 pt-3">
              <img
                src={claudeConnectors}
                alt="Claude Settings with Connectors selected"
                className="mx-auto h-28 w-auto rounded-lg object-contain"
              />
            </div>
          </ManualStep>

          <ManualStep
            number={3}
            title="Add the custom connector"
            description="Name it WagerProof, paste the URL, and leave Advanced settings empty."
            icon={<Copy className="h-4 w-4" />}
          >
            <div className="pl-11 pt-3">
              <button
                type="button"
                onClick={() => copyText(ENDPOINT, 'Connector URL')}
                className="flex w-full items-center gap-3 border-b border-border/70 py-2.5 text-left transition hover:border-[#d97757]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d97757]/60"
                aria-label={copied === ENDPOINT ? 'WagerProof connector URL copied' : 'Copy WagerProof connector URL'}
              >
                <code className="min-w-0 flex-1 break-all text-[11px] font-semibold sm:text-xs">{ENDPOINT}</code>
                {copied === ENDPOINT ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4 shrink-0 text-[#d97757]" />
                )}
              </button>
            </div>
          </ManualStep>

          <ManualStep
            number={4}
            title="Sign in and approve"
            description="Click Connect, sign in to WagerProof, and approve read-only access."
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            <div className="pl-11 pt-3 text-xs leading-5 text-muted-foreground">
              Confirm the URL ends in <strong className="text-foreground">wagerproof-mcp.habib225.workers.dev/mcp</strong>{' '}
              before continuing.
            </div>
          </ManualStep>
        </ol>
      </section>

      <section aria-labelledby="example-prompts-title" className="space-y-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#d97757]">Try asking</p>
          <h2 id="example-prompts-title" className="mt-1 text-2xl font-black tracking-[-0.02em]">
            What can you do with it?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Ask naturally, or click any prompt to copy it.</p>
        </div>

        <div className="space-y-8">
          {EXAMPLE_PROMPT_CATEGORIES.map((category) => (
            <div key={category.title}>
              <h3 className="text-base font-black tracking-[-0.01em]">{category.title}</h3>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{category.description}</p>

              <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
                {category.prompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => copyText(prompt, 'Example prompt')}
                    className="group flex min-h-14 items-center gap-3 border-b border-border/60 py-3 text-left transition hover:border-[#d97757]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d97757]/60"
                  >
                    <span className="min-w-0 flex-1 text-sm font-semibold leading-5">{prompt}</span>
                    {copied === prompt ? (
                      <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-[#d97757]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
