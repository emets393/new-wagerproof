import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Copy, ExternalLink, Loader2, Plus, Share2, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';

import { trackCTAClick } from '@/lib/mixpanel';
import { HERO_AGENTS, type HeroAgent } from './heroAgents';

async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Embedded webviews and in-app browsers expose the API but deny the permission — fall through.
    }
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

function useIsPhone() {
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const update = () => setIsPhone(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return isPhone;
}

export function AgentIcon({ agent, className = '' }: { agent: HeroAgent; className?: string }) {
  return (
    <span
      aria-hidden
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-[24%] ${className}`}
      style={{ backgroundColor: agent.iconBackground }}
    >
      <img
        src={agent.icon}
        alt=""
        className={`h-full w-full ${agent.iconFit === 'contain' ? 'object-contain p-[14%]' : 'object-cover'}`}
      />
    </span>
  );
}

function AgentList({ onPick }: { onPick: (agent: HeroAgent) => void }) {
  return (
    <div>
      <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-black/40 dark:text-white/40">
        Pick your agent — we open it and connect
      </p>
      <ul className="flex flex-col gap-0.5">
        {HERO_AGENTS.map((agent) => (
          <li key={agent.key}>
            <button
              type="button"
              onClick={() => onPick(agent)}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-white/[0.07]"
            >
              <AgentIcon agent={agent} className="h-9 w-9 ring-1 ring-black/10 dark:ring-white/15" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-gray-950 dark:text-white">{agent.name}</span>
                <span className="block text-xs text-black/45 dark:text-white/45">{agent.surface}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-black/25 transition group-hover:translate-x-0.5 group-hover:text-black/60 dark:text-white/30 dark:group-hover:text-white/70" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Fire a custom-scheme link (cursor://, hermes://) and report whether an app took it.
 * Browsers give no success signal for unknown schemes; the only tell is that the page
 * loses focus when the OS hands off to the app. No blur within the window = nothing opened.
 */
function launchProtocol(url: string, onNoHandler: () => void) {
  let handedOff = false;
  const onBlur = () => {
    handedOff = true;
  };
  window.addEventListener('blur', onBlur, { once: true });
  window.location.href = url;
  window.setTimeout(() => {
    window.removeEventListener('blur', onBlur);
    if (!handedOff && document.hasFocus()) onNoHandler();
  }, 2000);
}

function CodeBlock({ agent, copied, onCopy }: { agent: HeroAgent; copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-2xl bg-[#17191a] p-3 text-white">
      <div className="flex items-center justify-between gap-3 pb-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">{agent.copyLabel}</span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/10 px-2.5 text-xs font-semibold transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-32 select-all overflow-auto whitespace-pre-wrap break-all font-mono text-[12.5px] leading-5 text-emerald-200">
        {agent.isCommand
          ? agent.copyValue.split('\n').map((line) => (
              <span key={line} className="block">
                {/* Prompt is decoration: unselectable so a manual select-and-copy stays runnable. */}
                <span className="select-none text-white/35">$ </span>
                {line}
              </span>
            ))
          : agent.copyValue}
      </pre>
    </div>
  );
}

const PRIMARY_BUTTON =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gray-950 text-sm font-semibold text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200';

function AgentSetup({
  agent,
  copied,
  onCopy,
  onBack,
  onPhone,
  launchFailed,
}: {
  agent: HeroAgent;
  copied: boolean;
  onCopy: () => void;
  onBack: () => void;
  onPhone: boolean;
  launchFailed: boolean;
}) {
  const needsComputer = onPhone && agent.desktopOnly;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const { launch } = agent;
  // The app was launched for the user; everything else is a fallback, so it stays folded away.
  const launched = !needsComputer && (launch.kind === 'protocol' || launch.kind === 'prefill') && !launchFailed;

  let status: { title: string; body: string };
  if (needsComputer) {
    status = {
      title: `${agent.name} runs on your computer`,
      body: 'Send this to yourself and open it there. It connects in one step.',
    };
  } else if (launch.kind === 'protocol') {
    status = launchFailed
      ? {
          title: `${agent.name} didn’t open`,
          body: `It may not be installed on this computer. Install ${agent.name} and try again, or add WagerProof by hand below.`,
        }
      : { title: `Opening ${agent.name}…`, body: launch.confirmHint };
  } else if (launch.kind === 'prefill') {
    status = { title: `${agent.name} is open in a new tab`, body: launch.confirmHint };
  } else if (launch.kind === 'paste') {
    status = {
      title: `Link copied. ${agent.name} is open in a new tab`,
      body: `${agent.name} has no install link yet, so this one takes a paste. ${agent.instructions}`,
    };
  } else {
    status = {
      title: 'Command copied. Paste it in your terminal',
      body: `${agent.name} has no install link, so it connects from the command line. ${agent.instructions}`,
    };
  }

  return (
    <div className="px-1 pb-1">
      <div className="flex items-center gap-2.5 px-2 pb-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to all agents"
          className="grid h-8 w-8 place-items-center rounded-full text-black/50 transition hover:bg-black/[0.06] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-white/50 dark:hover:bg-white/[0.08] dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <AgentIcon agent={agent} className="h-7 w-7 ring-1 ring-black/10 dark:ring-white/15" />
        <span className="text-[15px] font-semibold text-gray-950 dark:text-white">Add WagerProof to {agent.name}</span>
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-emerald-500/[0.09] px-3.5 py-3" role="status">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
          {launched && launch.kind === 'protocol' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : launchFailed ? (
            <X className="h-3.5 w-3.5" />
          ) : (
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          )}
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-950 dark:text-white">{status.title}</p>
          <p className="mt-0.5 text-sm leading-5 text-black/60 dark:text-white/60">{status.body}</p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-col gap-2 px-0.5">
        {launched ? (
          <details className="group rounded-2xl border border-black/[0.07] dark:border-white/[0.09]">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-sm font-medium text-black/60 dark:text-white/60 [&::-webkit-details-marker]:hidden">
              Nothing happened? Add it by hand
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-2 pb-2">
              <CodeBlock agent={agent} copied={copied} onCopy={onCopy} />
              <p className="px-1.5 pt-2 text-xs leading-5 text-black/55 dark:text-white/55">{agent.instructions}</p>
            </div>
          </details>
        ) : (
          <CodeBlock agent={agent} copied={copied} onCopy={onCopy} />
        )}

        {needsComputer && canShare ? (
          <button
            type="button"
            onClick={() => {
              // Share sheet covers AirDrop / Messages / Notes — fastest way to get this to a laptop.
              navigator.share({ title: `WagerProof for ${agent.name}`, text: agent.copyValue }).catch(() => undefined);
            }}
            className={PRIMARY_BUTTON}
          >
            <Share2 className="h-4 w-4" />
            Send to my computer
          </button>
        ) : launch.kind === 'command' || needsComputer ? (
          <a href={agent.openUrl} target="_blank" rel="noopener noreferrer" className={PRIMARY_BUTTON}>
            {agent.openLabel}
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : (
          // Same link the click already fired — a retry for blocked pop-ups or a dismissed prompt.
          <a
            href={launch.url}
            {...(launch.kind === 'protocol' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
            onClick={() => trackCTAClick(`Open ${agent.name}`, 'Hero Connect Menu', launch.url)}
            className={PRIMARY_BUTTON}
          >
            Open {agent.name} again
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <p className="flex items-center justify-center gap-1.5 pb-1 text-xs text-black/45 dark:text-white/45">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          Secure sign-in · read-only access to your WagerProof data
        </p>
      </div>
    </div>
  );
}

export default function AgentConnectMenu() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<HeroAgent | null>(null);
  const [copied, setCopied] = useState(false);
  const [launchFailed, setLaunchFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isPhone = useIsPhone();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const copiedTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const copy = async (agent: HeroAgent) => {
    // Clear the previous agent's pending reset so it can't wipe this copy's "Copied" state.
    window.clearTimeout(copiedTimer.current);
    setCopied(false);
    try {
      await copyToClipboard(agent.copyValue);
      setCopied(true);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error('Couldn’t copy automatically', { description: 'Select the text and copy it manually.' });
    }
  };

  // Picking an agent IS the action: copy, then hand off to the app as far as that agent allows.
  // Both must start inside this click handler — browsers block window.open and clipboard
  // writes that aren't tied to a user gesture.
  const pick = (agent: HeroAgent) => {
    setSelected(agent);
    setLaunchFailed(false);
    trackCTAClick(`Connect ${agent.name}`, 'Hero Connect Menu', agent.openUrl);
    void copy(agent); // before window.open: the write has to begin while this tab still has focus
    const { launch } = agent;
    if (isPhone && agent.desktopOnly) return; // nothing to launch on a phone; the panel offers "send to my computer"
    if (launch.kind === 'prefill' || launch.kind === 'paste') {
      window.open(launch.url, '_blank', 'noopener');
    } else if (launch.kind === 'protocol') {
      launchProtocol(launch.url, () => setLaunchFailed(true));
    }
  };

  const toggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    setSelected(null);
    if (nextOpen) trackCTAClick('Add to AI agent', 'Hero', '#connect-menu');
  };

  const panel = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={selected?.key ?? 'list'}
        initial={{ opacity: 0, x: selected ? 12 : -12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
      >
        {selected ? (
          <AgentSetup
            agent={selected}
            copied={copied}
            onCopy={() => void copy(selected)}
            onBack={() => setSelected(null)}
            onPhone={isPhone}
            launchFailed={launchFailed}
          />
        ) : (
          <AgentList onPick={pick} />
        )}
      </motion.div>
    </AnimatePresence>
  );

  return (
    <div ref={rootRef} className="relative">
      {/* Rainbow ring: a gradient wrapper with a 2px gap, plus a blurred copy behind for the glow. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-[20px] bg-[linear-gradient(100deg,#ff8a5c,#ffd166,#4ade80,#38bdf8,#a78bfa,#ff8a5c)] opacity-40 blur-md"
      />
      <span className="relative block rounded-2xl bg-[linear-gradient(100deg,#ff8a5c,#ffd166,#4ade80,#38bdf8,#a78bfa,#ff8a5c)] p-[2px]">
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-white px-6 text-lg font-semibold text-gray-950 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-[#161818] dark:text-white dark:hover:bg-[#1e2020] sm:w-auto"
        >
          <Plus className="h-5 w-5" strokeWidth={2.4} />
          Add to AI agent
          <ChevronDown className={`h-4 w-4 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </span>

      <AnimatePresence>
        {open && !isPhone && (
          <motion.div
            role="dialog"
            aria-label="Connect WagerProof to your AI agent"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-1/2 top-full z-50 mt-3 w-[400px] -translate-x-1/2 rounded-3xl border border-black/[0.08] bg-white p-2 text-left shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)] dark:border-white/[0.1] dark:bg-[#1b1d1d]"
          >
            {panel}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phones get a bottom sheet — a 400px popover under a centered button would clip off-screen. */}
      <AnimatePresence>
        {open && isPhone && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black/45 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-label="Connect WagerProof to your AI agent"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 340 }}
              className="fixed inset-x-0 bottom-0 z-[9999] max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-left dark:bg-[#1b1d1d]"
            >
              <div className="flex items-center justify-between px-2 pb-1">
                <span className="mx-auto h-1 w-10 rounded-full bg-black/15 dark:bg-white/20" />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/[0.06] text-black/60 dark:bg-white/10 dark:text-white/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="pt-4">{panel}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
