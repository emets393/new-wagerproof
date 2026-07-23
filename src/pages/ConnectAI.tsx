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
      {
        question: 'Find the best player props today and explain why each one stands out.',
        value: 'Surfaces promising props and explains the WagerProof data behind each opportunity.',
      },
      {
        question: 'Show me today’s strongest betting opportunities across every game.',
        value: 'Scans the full slate so you can focus your research on the most compelling spots.',
      },
      {
        question: 'Which current lines have the strongest supporting historical trends?',
        value: 'Connects today’s available lines with the historical angles that support them.',
      },
    ],
  },
  {
    title: 'Break down any game',
    description: 'Turn WagerProof data into a clear matchup read before you make a decision.',
    prompts: [
      {
        question: 'Analyze today’s biggest matchup and tell me where each team has an edge.',
        value: 'Organizes the matchup data into a concise view of each team’s strongest advantages.',
      },
      {
        question: 'Compare the spread, moneyline, and total trends for this game.',
        value: 'Puts every major market side by side so you can compare the available angles quickly.',
      },
      {
        question: 'What are the most important trends I should know before betting this matchup?',
        value: 'Pulls the most relevant historical signals forward and explains why they matter.',
      },
    ],
  },
  {
    title: 'Find agents worth following',
    description: 'Discover proven specialists instead of sorting through every agent yourself.',
    prompts: [
      {
        question: 'Find public agents currently on a winning streak of five picks or more.',
        value: 'Filters the agent pool to reveal who has meaningful momentum right now.',
      },
      {
        question: 'Who are the best-performing agents for NFL props over the last 30 days?',
        value: 'Finds recent specialists for the exact sport and market you care about.',
      },
      {
        question: 'Compare the top agents for this market by win rate, units, and recent form.',
        value: 'Creates a side-by-side performance view so you can decide who is worth following.',
      },
    ],
  },
  {
    title: 'Get more from agents you follow',
    description: 'See the signal across your feed without checking every agent one by one.',
    prompts: [
      {
        question: 'Summarize today’s picks from the agents I follow and rank the strongest ones first.',
        value: 'Turns your followed feed into a prioritized daily briefing.',
      },
      {
        question: 'Which agents I follow agree on the same picks today?',
        value: 'Finds consensus across independent agents without making you compare every pick manually.',
      },
      {
        question: 'Which agents I follow are gaining momentum or starting a losing streak?',
        value: 'Highlights performance shifts early so you know whose picks deserve a closer look.',
      },
    ],
  },
  {
    title: 'Improve your own agents',
    description: 'Understand what is working, where performance slips, and what to refine next.',
    prompts: [
      {
        question: 'Which of my agents is performing best right now, and what is driving the results?',
        value: 'Identifies your strongest agent and explains the patterns behind its performance.',
      },
      {
        question: 'Compare my agents by win rate, units, and current streak.',
        value: 'Builds one clear performance comparison across the metrics that matter.',
      },
      {
        question: 'Show me where my agents are underperforming and which sports or markets are strongest.',
        value: 'Reveals strengths and weak spots so you can make more informed refinements.',
      },
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
    <li className="py-4">
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
    <div className="mx-auto flex w-full max-w-5xl flex-col pb-24" style={{ gap: '6rem' }}>
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
            Give your AI access to WagerProof data so you can build your own automations and analyze everything by
            talking to your agent.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-[#d97757]/35 bg-[#d97757]/10 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#d97757] text-white">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#d97757]">Tip</p>
              <h2 className="mt-0.5 text-base font-black tracking-[-0.01em]">Let your AI handle setup</h2>
              <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">
                Copy these instructions, paste them into your preferred AI, and let it guide you.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => copyText(instructions, 'Setup instructions')}
            className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[#d97757] px-4 text-sm font-black text-white transition hover:bg-[#c9684a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d97757]/60 sm:w-auto"
          >
            {copied === instructions ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied === instructions ? 'Instructions copied' : 'Copy instructions'}
          </button>
        </div>
      </section>

      <section aria-labelledby="manual-setup-title" className="flex flex-col" style={{ gap: '3rem' }}>
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

        <ol className="grid gap-x-16 gap-y-12 md:grid-cols-2">
          <ManualStep
            number={1}
            title="Open your AI settings"
            description="Open your preferred AI app, then go to its settings."
            icon={<Settings2 className="h-4 w-4" />}
          >
            <div className="pl-11 pt-5">
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
            <div className="pl-11 pt-5">
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
            <div className="pl-11 pt-5">
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
            <div className="pl-11 pt-5 text-xs leading-5 text-muted-foreground">
              Confirm the URL ends in <strong className="text-foreground">wagerproof-mcp.habib225.workers.dev/mcp</strong>{' '}
              before continuing.
            </div>
          </ManualStep>
        </ol>
      </section>

      <section aria-labelledby="example-prompts-title" className="flex flex-col" style={{ gap: '3rem' }}>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#d97757]">Try asking</p>
          <h2 id="example-prompts-title" className="mt-1 text-2xl font-black tracking-[-0.02em]">
            What can you do with it?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Ask naturally, or click any prompt to copy it.</p>
        </div>

        <div className="flex flex-col" style={{ gap: '5rem' }}>
          {EXAMPLE_PROMPT_CATEGORIES.map((category) => (
            <div key={category.title}>
              <h3 className="text-base font-black tracking-[-0.01em]">{category.title}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-5 text-muted-foreground">{category.description}</p>

              <div className="mt-8 overflow-x-auto rounded-xl border border-border/70">
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-2 bg-muted/35 text-xs font-bold">
                    <div className="px-4 py-3">What you ask</div>
                    <div className="px-4 py-3">What WagerProof helps you do</div>
                  </div>

                  {category.prompts.map((prompt) => (
                    <div key={prompt.question} className="grid grid-cols-2 border-t border-border/70">
                      <div className="p-4">
                        <button
                          type="button"
                          onClick={() => copyText(prompt.question, 'Example prompt')}
                          className="group flex w-full items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d97757]/60"
                        >
                          <span className="min-w-0 flex-1 text-sm font-semibold leading-5">“{prompt.question}”</span>
                          {copied === prompt.question ? (
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          ) : (
                            <Copy className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-[#d97757]" />
                          )}
                        </button>
                      </div>
                      <div className="border-l border-border/50 p-4">
                        <p className="text-sm leading-5 text-muted-foreground">{prompt.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
