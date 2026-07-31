import { useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { McpConnectionPanel, McpProviderStack } from '@/features/mcp/McpConnectionPanel';
import { MCP_TOOL_COUNT } from '@/features/mcp/mcpContent';

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

export default function ConnectAI() {
  const [copied, setCopied] = useState<string | null>(null);

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
    <div className="mx-auto flex w-full max-w-[1500px] flex-col pb-24" style={{ gap: '6rem' }}>
      <section className="relative isolate overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#101213] px-4 py-12 text-white shadow-[0_30px_90px_rgba(0,0,0,0.28)] sm:px-7 sm:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(circle_at_50%_8%,rgba(184,255,56,0.12),transparent_36%),radial-gradient(circle_at_14%_55%,rgba(34,197,94,0.07),transparent_24%),radial-gradient(circle_at_88%_48%,rgba(217,119,87,0.06),transparent_24%)]"
        />

        <McpProviderStack compact />

        <div className="mx-auto mt-9 max-w-5xl text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">
            Model Context Protocol
          </p>
          <h1 className="mt-4 text-balance text-4xl font-black uppercase leading-[0.96] tracking-[-0.05em] text-[#b8ff38] sm:text-5xl lg:text-[58px]">
            Connect WagerProof to your AI
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-balance text-sm font-semibold leading-6 text-white/48 sm:text-base">
            Use WagerProof from Claude, ChatGPT, Cursor, Claude Code, OpenClaw, or Hermes through one secure custom
            connection.
          </p>
        </div>

        <div className="mt-11">
          <McpConnectionPanel compact />
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/mcp"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#b8ff38] px-6 text-sm font-black text-[#111315] shadow-[0_4px_0_#659912] transition hover:-translate-y-0.5 hover:bg-[#c8ff62] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#101213] active:translate-y-[2px] active:shadow-none"
          >
            Open the full MCP tutorial
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-white/42">
            <ShieldCheck className="h-4 w-4 text-[#b8ff38]" />
            OAuth 2.1 sign-in · {MCP_TOOL_COUNT} tools
          </p>
        </div>
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
