import { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  MCP_PROVIDERS,
  MCP_TOOL_COUNT,
  type McpProvider,
  type McpProviderKey,
  type McpSetupMode,
} from './mcpContent';

interface McpConnectionPanelProps {
  compact?: boolean;
  initialProvider?: McpProviderKey;
}

async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const didCopy = document.execCommand('copy');
  textarea.remove();

  if (!didCopy) throw new Error('Clipboard copy failed');
}

function ProviderIcon({
  provider,
  className = '',
  imageClassName = '',
}: {
  provider: McpProvider;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-[11px] ${className}`}
      style={{
        backgroundColor: provider.iconBackground,
        boxShadow: `0 8px 24px ${provider.accent}22`,
      }}
      aria-hidden
    >
      <img
        src={provider.icon}
        alt=""
        className={`h-full w-full ${provider.iconFit === 'contain' ? 'object-contain p-[13%]' : 'object-cover'} ${imageClassName}`}
      />
    </span>
  );
}

export function McpProviderStack({ compact = false }: { compact?: boolean }) {
  const sizes = compact ? 'h-12 w-12 sm:h-14 sm:w-14' : 'h-14 w-14 sm:h-16 sm:w-16';
  const centerSizes = compact
    ? 'h-[66px] w-[66px] sm:h-[76px] sm:w-[76px]'
    : 'h-[78px] w-[78px] sm:h-[92px] sm:w-[92px]';
  const providerOrder: McpProviderKey[] = ['hermes', 'claude-code', 'chatgpt', 'cursor', 'openclaw', 'claude'];
  const providers = providerOrder.map(
    (key) => MCP_PROVIDERS.find((provider) => provider.key === key) ?? MCP_PROVIDERS[0],
  );
  const leftLayers = ['z-0 -rotate-6', 'z-10 rotate-3', 'z-20 -rotate-2'];
  const rightLayers = ['z-20 rotate-2', 'z-10 -rotate-4', 'z-0 rotate-6'];

  return (
    <div
      className="flex isolate items-center justify-center"
      aria-label="WagerProof with Claude, ChatGPT, Cursor, Claude Code, OpenClaw, and Hermes"
    >
      {providers.slice(0, 3).map((provider, index) => (
        <ProviderIcon
          key={provider.key}
          provider={provider}
          className={`${sizes} ${index === 0 ? '' : '-ml-6 sm:-ml-7'} ${leftLayers[index]} border border-white/25 ring-1 ring-black/20`}
        />
      ))}
      <span
        className={`relative z-30 -ml-6 grid ${centerSizes} place-items-center overflow-hidden rounded-[22px] border border-[#bdff3b]/50 bg-[#08252b] shadow-[0_18px_42px_rgba(157,255,46,0.22)] ring-1 ring-black/25 sm:-ml-7`}
      >
        <img src="/wagerproofGreenDark.png" alt="WagerProof" className="h-full w-full object-cover" />
      </span>
      {providers.slice(3).map((provider, index) => (
        <ProviderIcon
          key={provider.key}
          provider={provider}
          className={`${sizes} -ml-6 sm:-ml-7 ${rightLayers[index]} border border-white/25 ring-1 ring-black/20`}
        />
      ))}
    </div>
  );
}

function StepNumber({ children }: { children: number }) {
  return (
    <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.09] text-sm font-black text-white">
      {children}
    </span>
  );
}

function CopyField({
  value,
  copied,
  onCopy,
  ariaLabel,
}: {
  value: string;
  copied: boolean;
  onCopy: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="group flex min-h-14 w-full items-center gap-3 rounded-[14px] border border-white/[0.04] bg-white/[0.07] px-4 text-left transition duration-150 hover:border-[#b8ff38]/30 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff38]"
      aria-label={ariaLabel}
    >
      <code className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white/85 sm:text-sm">
        {value}
      </code>
      {copied ? (
        <Check className="h-4 w-4 shrink-0 text-[#b8ff38]" />
      ) : (
        <Copy className="h-4 w-4 shrink-0 text-white/70 transition group-hover:text-[#b8ff38]" />
      )}
    </button>
  );
}

export function McpConnectionPanel({
  compact = false,
  initialProvider = 'claude',
}: McpConnectionPanelProps) {
  const [providerKey, setProviderKey] = useState<McpProviderKey>(initialProvider);
  const [mode, setMode] = useState<McpSetupMode>(
    MCP_PROVIDERS.find((item) => item.key === initialProvider)?.defaultMode ?? 'mcp',
  );
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const provider = MCP_PROVIDERS.find((item) => item.key === providerKey) ?? MCP_PROVIDERS[0];
  const guide = provider.guides[mode];

  const handleCopy = async (value: string, label: string) => {
    try {
      await copyToClipboard(value);
      setCopiedValue(value);
      toast.success(`${label} copied`, {
        description:
          mode === 'mcp'
            ? `Paste it into ${provider.name} as the WagerProof connector URL.`
            : `Use it to finish the ${provider.name} setup.`,
      });
      window.setTimeout(() => setCopiedValue((current) => (current === value ? null : current)), 1800);
    } catch {
      toast.error(`Couldn’t copy ${label.toLowerCase()}`);
    }
  };

  return (
    <div
      className={`overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#202223] p-1.5 shadow-[0_32px_90px_rgba(0,0,0,0.34)] ${
        compact ? 'mx-auto w-full max-w-[1320px]' : 'w-full'
      }`}
    >
      <div className="flex flex-col gap-3 px-2 py-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="flex min-w-0 items-center gap-1 overflow-x-auto pb-1 lg:pb-0"
          role="tablist"
          aria-label="Choose an AI provider"
        >
          {MCP_PROVIDERS.map((item) => {
            const selected = item.key === providerKey;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setProviderKey(item.key);
                  setMode(item.defaultMode);
                }}
                className={`inline-flex shrink-0 items-center rounded-full font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff38] ${
                  compact ? 'h-9 gap-1.5 px-2.5 text-[13px]' : 'h-10 gap-2 px-3.5 text-sm'
                } ${
                  selected ? 'bg-white text-[#17191a]' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <ProviderIcon provider={item} className="h-5 w-5 rounded-md" />
                {item.name}
              </button>
            );
          })}
        </div>

        <div
          className="flex w-fit items-center rounded-full border border-white/[0.06] bg-white/[0.055] p-1"
          role="tablist"
          aria-label="Choose setup method"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'mcp'}
            onClick={() => setMode('mcp')}
            className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-black uppercase tracking-[0.08em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff38] ${
              mode === 'mcp' ? 'bg-white/[0.12] text-white' : 'text-white/45 hover:text-white/75'
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            MCP
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'cli'}
            onClick={() => setMode('cli')}
            className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-black uppercase tracking-[0.08em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff38] ${
              mode === 'cli' ? 'bg-white/[0.12] text-white' : 'text-white/45 hover:text-white/75'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            CLI
          </button>
        </div>
      </div>

      <div
        className="grid overflow-hidden rounded-[22px] border border-white/[0.045] bg-[#121415] lg:grid-cols-3"
        role="tabpanel"
        aria-label={`${provider.name} ${mode.toUpperCase()} setup`}
      >
        <div className="flex min-h-[260px] flex-col border-b border-white/[0.06] p-6 lg:border-b-0 lg:border-r lg:p-7">
          <StepNumber>1</StepNumber>
          <h3 className="mt-7 text-lg font-bold tracking-[-0.015em] text-white">{guide.copyTitle}</h3>
          <p className="mt-2 text-sm leading-6 text-white/45">{guide.copyDescription}</p>
          <div className="mt-auto pt-7">
            <CopyField
              value={guide.copyDisplayValue ?? guide.copyValue}
              copied={copiedValue === guide.copyValue}
              onCopy={() => handleCopy(guide.copyValue, guide.copyLabel)}
              ariaLabel={
                copiedValue === guide.copyValue
                  ? `${guide.copyLabel} copied`
                  : `Copy ${guide.copyLabel.toLowerCase()} for ${provider.name}`
              }
            />
          </div>
        </div>

        <div className="flex min-h-[260px] flex-col border-b border-white/[0.06] p-6 lg:border-b-0 lg:border-r lg:p-7">
          <StepNumber>2</StepNumber>
          <h3 className="mt-7 text-lg font-bold tracking-[-0.015em] text-white">{guide.setupTitle}</h3>
          <p className="mt-2 text-sm leading-6 text-white/45">{guide.setupDescription}</p>
          <a
            href={guide.setupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex min-h-14 w-fit items-center justify-center gap-2 rounded-[14px] border border-white/[0.08] px-4 text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff38]"
          >
            <ExternalLink className="h-4 w-4" />
            {guide.setupLabel}
          </a>
        </div>

        <div className="flex min-h-[260px] flex-col p-6 lg:p-7">
          <StepNumber>3</StepNumber>
          <h3 className="mt-7 text-lg font-bold tracking-[-0.015em] text-white">{guide.finishTitle}</h3>
          <p className="mt-2 text-sm leading-6 text-white/45">{guide.finishDescription}</p>
          <a
            href={guide.finishUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex min-h-14 w-fit items-center justify-center gap-2 rounded-[14px] bg-[#b8ff38] px-5 text-sm font-black text-[#111315] shadow-[0_5px_0_#659912] transition hover:-translate-y-0.5 hover:bg-[#c7ff5a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#121415] active:translate-y-[2px] active:shadow-none"
          >
            <Sparkles className="h-4 w-4" />
            {guide.finishLabel}
          </a>
        </div>
      </div>

      {!compact && (
        <p className="flex items-center justify-center gap-2 px-4 py-5 text-center text-xs font-semibold text-white/45 sm:text-sm">
          <ShieldCheck className="h-4 w-4 text-[#b8ff38]" />
          Remote Streamable HTTP · OAuth 2.1 sign-in · {MCP_TOOL_COUNT} tools
        </p>
      )}
    </div>
  );
}
