import { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Info,
  LockKeyhole,
  MessageSquareQuote,
  Plus,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import claudeIcon from '../../wagerproof-ios-native/Wagerproof/Assets.xcassets/AIClaudeIcon.imageset/claude.jpg';
import chatGPTIcon from '../../wagerproof-ios-native/Wagerproof/Assets.xcassets/AIChatGPTIcon.imageset/chatgpt.jpg';
import geminiIcon from '../../wagerproof-ios-native/Wagerproof/Assets.xcassets/AIGeminiIcon.imageset/gemini.jpg';
import grokIcon from '../../wagerproof-ios-native/Wagerproof/Assets.xcassets/AIGrokIcon.imageset/grok.jpg';
import codexIcon from '../../wagerproof-ios-native/Wagerproof/Assets.xcassets/AICodexIcon.imageset/codex.jpg';
import claudeSymbol from '../../wagerproof-ios-native/Wagerproof/Assets.xcassets/ClaudeSymbol.imageset/claude-symbol.png';
import claudeSettings from '../../wagerproof-ios-native/Wagerproof/Assets.xcassets/ClaudeSetupSettings.imageset/claude-setup-settings.png';
import claudeConnectors from '../../wagerproof-ios-native/Wagerproof/Assets.xcassets/ClaudeSetupConnectors.imageset/claude-setup-connectors.png';

const ACCENT = '#d97757';
const ENDPOINT = 'https://wagerproof-mcp.habib225.workers.dev/mcp';
const CLAUDE_CONNECTORS_URL = 'https://claude.ai/settings/connectors';
const CONNECTOR_GUIDE_URL = 'https://wagerproof-mcp.habib225.workers.dev/docs';

const PROVIDERS = [
  { name: 'Claude', icon: claudeIcon },
  { name: 'ChatGPT', icon: chatGPTIcon },
  { name: 'Gemini', icon: geminiIcon },
  { name: 'Grok', icon: grokIcon },
  { name: 'Codex', icon: codexIcon },
];

const EXAMPLE_PROMPTS = [
  'How have my prediction agents performed over the last 30 days?',
  "Show my contrarian agent's last 10 picks and how they graded.",
  "Compare WagerProof's model for tonight's NBA games with prediction-market odds.",
  'Which agents do I follow, and what is their recent record?',
];

function ProviderStack({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center" aria-label="Claude, ChatGPT, Gemini, Grok, and Codex">
      {PROVIDERS.map((provider, index) => (
        <div
          key={provider.name}
          className={cn(
            'relative overflow-hidden rounded-full border-2 border-white/80 bg-black shadow-[0_5px_14px_rgba(0,0,0,0.38)]',
            compact ? 'h-10 w-10 -ml-2 first:ml-0' : 'h-12 w-12 -ml-3 first:ml-0 sm:h-14 sm:w-14',
          )}
          style={{ zIndex: PROVIDERS.length - index }}
          title={provider.name}
        >
          <img src={provider.icon} alt="" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}

function StepCard({
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
    <article className="relative overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm">
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-black text-white shadow-sm"
          style={{ backgroundColor: ACCENT }}
        >
          {number}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span style={{ color: ACCENT }}>{icon}</span>
            <h3 className="text-base font-bold tracking-[-0.01em] text-foreground sm:text-lg">{title}</h3>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      {children && <div className="border-t border-border/60 bg-muted/25 p-4 sm:px-6 sm:py-5">{children}</div>}
    </article>
  );
}

export default function ConnectAI() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      toast.success(`${label} copied`);
      window.setTimeout(() => setCopied((current) => (current === value ? null : current)), 1800);
    } catch {
      toast.error(`Couldn't copy ${label.toLowerCase()}`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-12">
      <section className="relative isolate overflow-hidden rounded-[28px] border border-white/10 bg-[#30231f] shadow-xl">
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(112deg, #30231f 0%, #4d2d27 43%, #a6533f 76%, #d97757 100%)' }}
        />
        <img
          src={claudeSymbol}
          alt=""
          className="pointer-events-none absolute -bottom-20 right-[-3rem] h-80 w-80 object-contain opacity-[0.07] sm:right-2"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.14),transparent_32%)]" />

        <div className="relative grid gap-8 px-6 py-8 sm:px-9 sm:py-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <ProviderStack />
            <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.12em] text-white/65">
              WagerProof AI connector
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.025em] text-white sm:text-4xl">
              Connect WagerProof to your AI
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/88 sm:text-base">
              Bring your agents, picks, follows, and model analytics into a secure, read-only AI workflow.
            </p>
            <p className="mt-5 text-[10px] font-bold tracking-[0.06em] text-white/58">
              CLAUDE&nbsp;&nbsp;·&nbsp;&nbsp;CHATGPT&nbsp;&nbsp;·&nbsp;&nbsp;GEMINI&nbsp;&nbsp;·&nbsp;&nbsp;GROK&nbsp;&nbsp;·&nbsp;&nbsp;CODEX
            </p>
          </div>

          <a
            href={CLAUDE_CONNECTORS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-[#4d2d27] shadow-lg transition hover:-translate-y-0.5 hover:bg-white/92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Open Claude Connectors
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-[22px] border border-[#d97757]/25 bg-[#d97757]/10 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d97757]/15 text-[#d97757]">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Add it once, then use it everywhere</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Add WagerProof manually from Claude on web or desktop. Once connected, it follows your Claude account
                onto mobile too.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-border/70 bg-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#d97757]" />
            <p className="text-sm leading-6 text-muted-foreground">
              Claude will label it <strong className="text-foreground">Custom</strong> because Anthropic has not reviewed
              the listing yet. The endpoint is operated by WagerProof and exposes read-only tools.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="setup-title" className="space-y-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#d97757]">Get connected</p>
          <h2 id="setup-title" className="mt-1 text-2xl font-black tracking-[-0.02em] sm:text-3xl">
            Four steps on Claude web or desktop
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">No API keys or advanced OAuth settings required.</p>
        </div>

        <div className="grid gap-4">
          <StepCard
            number={1}
            title="Open Claude Settings"
            description="In Claude, click your name at the bottom-left and choose Settings."
            icon={<Settings2 className="h-5 w-5" />}
          >
            <div className="overflow-hidden rounded-xl bg-[#222]">
              <img
                src={claudeSettings}
                alt="Claude account menu with Settings selected"
                className="mx-auto max-h-[250px] w-auto object-contain"
              />
            </div>
          </StepCard>

          <StepCard
            number={2}
            title="Choose Connectors"
            description="Under Customize, open Connectors, then click the plus button beside the Connectors heading."
            icon={<Plus className="h-5 w-5" />}
          >
            <div className="overflow-hidden rounded-xl bg-[#1a1a19]">
              <img
                src={claudeConnectors}
                alt="Claude Settings with Connectors selected under Customize"
                className="mx-auto max-h-[190px] w-auto object-contain"
              />
            </div>
          </StepCard>

          <StepCard
            number={3}
            title="Add WagerProof as a custom connector"
            description="Choose Add custom connector. Name it WagerProof, paste the URL below, leave Advanced settings empty, and click Add."
            icon={<Copy className="h-5 w-5" />}
          >
            <button
              type="button"
              onClick={() => copyText(ENDPOINT, 'Connector URL')}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:border-[#d97757]/50 hover:bg-[#d97757]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d97757]/60"
              aria-label={copied === ENDPOINT ? 'WagerProof connector URL copied' : 'Copy WagerProof connector URL'}
            >
              <code className="min-w-0 flex-1 break-all text-xs font-semibold text-foreground sm:text-sm">{ENDPOINT}</code>
              {copied === ENDPOINT ? (
                <Check className="h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <Copy className="h-5 w-5 shrink-0 text-[#d97757]" />
              )}
            </button>
          </StepCard>

          <StepCard
            number={4}
            title="Connect your WagerProof account"
            description="Click Connect, sign in with the same WagerProof email and password you use in the app, and approve read-only access."
            icon={<ShieldCheck className="h-5 w-5" />}
          >
            <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 p-4 text-sm leading-6 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <p>
                Claude may show an unverified connector warning. Confirm the URL ends in{' '}
                <strong className="text-foreground">wagerproof-mcp.habib225.workers.dev/mcp</strong> before continuing.
              </p>
            </div>
          </StepCard>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={CLAUDE_CONNECTORS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#d97757] px-5 text-sm font-bold text-white transition hover:bg-[#c9684a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d97757]/60"
          >
            <img src={claudeIcon} alt="" className="h-6 w-6 rounded-md" />
            Open Claude Connectors
            <ExternalLink className="h-4 w-4" />
          </a>
          <a
            href={CONNECTOR_GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-bold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Read the full connector guide
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <p className="px-1 text-xs leading-5 text-muted-foreground">
          On Claude Team or Enterprise, an Owner must add the custom web connector for the organization before members
          can connect their own accounts.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#d97757]">Try asking</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.02em]">Start with one of these</h2>
            <p className="mt-2 text-sm text-muted-foreground">Copy a prompt, then paste it into a Claude chat.</p>
          </div>

          <div className="grid gap-2.5">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => copyText(prompt, 'Prompt')}
                className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left transition hover:border-[#d97757]/40 hover:bg-[#d97757]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d97757]/60"
              >
                <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-[#d97757]" />
                <span className="min-w-0 flex-1 text-sm font-medium leading-5">{prompt}</span>
                {copied === prompt ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            ))}
          </div>
        </div>

        <aside className="self-start rounded-[24px] border border-[#d97757]/25 bg-[#d97757]/10 p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#d97757]/15 text-[#d97757]">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold">Read-only analytics</h2>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Claude can retrieve your agents, picks, follows, and community record when you ask. It can also read
            WagerProof&apos;s public model estimates, market prices, and editor analyses.
          </p>
          <ul className="mt-5 space-y-3 text-sm font-medium">
            {[
              'It cannot create, change, or delete your data.',
              'It cannot place a bet.',
              'Model estimates are informational, not guaranteed outcomes.',
              "Disconnect at any time in Claude's connector settings.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#d97757]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </div>
  );
}
