import { useState } from 'react';
import {
  BarChart3,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Database,
  Gamepad2,
  History,
  RotateCcw,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react';

import { MCP_PROVIDERS, MCP_SCENARIOS, type McpScenarioKey } from './mcpContent';

const scenarioIcons: Record<McpScenarioKey, typeof BarChart3> = {
  slate: BarChart3,
  matchup: Gamepad2,
  market: CircleDollarSign,
  agents: Bot,
  record: History,
};

const toneClasses = {
  green: 'border-[#b8ff38]/25 bg-[#b8ff38]/[0.08] text-[#b8ff38]',
  amber: 'border-amber-400/25 bg-amber-400/[0.08] text-amber-300',
  blue: 'border-sky-400/25 bg-sky-400/[0.08] text-sky-300',
};

export default function McpDemoSection() {
  const [scenarioKey, setScenarioKey] = useState<McpScenarioKey>('slate');
  const scenario = MCP_SCENARIOS.find((item) => item.key === scenarioKey) ?? MCP_SCENARIOS[0];
  const claude = MCP_PROVIDERS[0];

  return (
    <section id="how-it-works" className="scroll-mt-24 px-4 py-24 sm:px-6 md:py-32">
      <div className="mx-auto max-w-[1440px]">
        <h2 className="text-center text-4xl font-black uppercase leading-none tracking-[-0.045em] text-white sm:text-5xl md:text-6xl">
          How does MCP work?
        </h2>

        <div
          className="mx-auto mt-9 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/[0.06] bg-[#202223] p-1.5"
          role="tablist"
          aria-label="Choose a WagerProof MCP example"
        >
          {MCP_SCENARIOS.map((item) => {
            const Icon = scenarioIcons[item.key];
            const selected = item.key === scenarioKey;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setScenarioKey(item.key)}
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff38] sm:px-4 ${
                  selected ? 'bg-white text-[#161819]' : 'text-white/45 hover:bg-white/[0.05] hover:text-white/75'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-11 grid overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#1b1d1e] shadow-[0_34px_100px_rgba(0,0,0,0.32)] lg:grid-cols-[minmax(0,1.62fr)_minmax(360px,1fr)]">
          <div className="flex min-h-[620px] flex-col border-b border-white/[0.07] p-6 sm:p-9 lg:border-b-0 lg:border-r lg:p-11">
            <div className="flex items-center justify-center gap-3">
              <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-white">
                <img src={claude.icon} alt="" className="h-full w-full object-cover" />
              </span>
              <span className="text-lg font-bold text-white">Claude</span>
            </div>

            <div key={scenario.key} className="mt-10 animate-fade-in text-base leading-7 text-white/72 sm:text-lg sm:leading-8">
              <p>{scenario.intro}</p>
              <p className="mt-3">{scenario.progress}</p>

              <div className="mt-9">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-[9px] border border-[#b8ff38]/30 bg-[#08252b]">
                    <img src="/wagerproofGreenDark.png" alt="" className="h-full w-full object-cover" />
                  </span>
                  <span className="font-bold text-white/75">WagerProof</span>
                </div>

                <div className="mt-6 rounded-[18px] border border-white/[0.07] bg-[#111314] p-5">
                  <div className="flex items-start gap-4">
                    <Database className="mt-0.5 h-4 w-4 shrink-0 text-[#b8ff38]" />
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-white/42">
                        {scenario.tool}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-white/62 sm:text-base">{scenario.prompt}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/[0.055] px-3 py-1.5 text-xs font-bold text-white/45">
                      OAuth
                    </span>
                    <span className="rounded-full bg-white/[0.055] px-3 py-1.5 text-xs font-bold text-white/45">
                      MCP
                    </span>
                    <span className="rounded-full bg-white/[0.055] px-3 py-1.5 text-xs font-bold text-white/45">
                      {scenario.eyebrow}
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-8">{scenario.response}</p>
            </div>

            <div className="mt-auto flex items-center gap-4 pt-8 text-white/35">
              <button type="button" className="rounded-md p-1 hover:text-white" aria-label="Like example response">
                <ThumbsUp className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-md p-1 hover:text-white" aria-label="Dislike example response">
                <ThumbsDown className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-md p-1 hover:text-white" aria-label="Copy example response">
                <Copy className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-md p-1 hover:text-white" aria-label="Regenerate example response">
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex min-h-[620px] flex-col p-6 sm:p-9 lg:p-10">
            <div className="flex items-center justify-center gap-2 text-base font-bold text-white">
              <CheckCircle2 className="h-5 w-5 text-[#b8ff38]" />
              Result
            </div>

            <div key={`${scenario.key}-result`} className="my-auto animate-fade-in">
              <div className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#111415] p-5 shadow-[0_26px_70px_rgba(0,0,0,0.38)] sm:p-6">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_82%_0%,rgba(184,255,56,0.2),transparent_55%)]"
                />
                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#b8ff38]">
                        {scenario.resultKicker}
                      </p>
                      <h3 className="mt-2 text-2xl font-black tracking-[-0.025em] text-white">
                        {scenario.resultTitle}
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-white/38">{scenario.resultStatus}</p>
                    </div>
                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[13px] border border-[#b8ff38]/25 bg-[#08252b]">
                      <img src="/wagerproofGreenDark.png" alt="" className="h-full w-full object-cover" />
                    </span>
                  </div>

                  <div className="mt-7 rounded-[18px] border border-[#b8ff38]/20 bg-[#b8ff38]/[0.065] p-5">
                    <p className="text-4xl font-black tracking-[-0.045em] text-white">{scenario.resultMetric}</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.08em] text-[#b8ff38]/75">
                      {scenario.resultMetricLabel}
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    {scenario.resultRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between gap-4 rounded-[16px] border border-white/[0.065] bg-white/[0.035] p-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{row.label}</p>
                          <p className="mt-1 truncate text-xs text-white/38">{row.detail}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-black ${toneClasses[row.tone]}`}
                        >
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-5 flex items-center gap-2 text-[10px] font-semibold leading-4 text-white/32">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#b8ff38]/65" />
                    Illustrative UI using the live WagerProof connector.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-5 text-xs font-bold text-white/52">
                <span className="inline-flex items-center gap-2">
                  <Database className="h-4 w-4 text-[#b8ff38]" />
                  {scenario.toolLabel}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4 text-white/45" />
                  Account scoped
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
