import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { GeneratePicksResponse } from '@/types/agent';
import type { AgentGenerationProgress } from './split/generationState';

type TerminalStatus = 'idle' | 'generating' | 'success' | 'error';

interface AgentGenerationTerminalProps {
  status: TerminalStatus;
  errorMessage?: string | null;
  result?: GeneratePicksResponse | null;
  progress?: AgentGenerationProgress | null;
  accent?: string;
}

const FALLBACK_VERBS = [
  'Reading the slate', 'Scanning the lines', 'Crunching the model',
  'Weighing the edges', 'Checking the public', 'Pricing the value',
  'Cross-referencing odds', 'Stress-testing picks', 'Reasoning it through', 'Locking it in',
];

function humanize(value?: string) {
  if (!value) return undefined;
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function GlyphMatrix({ accent }: { accent: string }) {
  return (
    <span className="agent-generation-glyph" style={{ color: accent }} aria-hidden>
      {Array.from({ length: 9 }, (_, index) => <i key={index} style={{ animationDelay: `${index * 80}ms` }} />)}
    </span>
  );
}

function ToolStack({ count, accent }: { count: number; accent: string }) {
  const visible = Math.min(count, 4);
  if (!visible) return null;
  return (
    <div className="relative h-16" aria-label={`${count} research tools used`}>
      {Array.from({ length: visible }, (_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1 - index * 0.16, y: index * 7, scale: 1 - index * 0.018 }}
          className="absolute inset-x-3 top-0 rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 backdrop-blur-sm"
          style={{ zIndex: visible - index, borderLeftColor: accent }}
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: accent }} />
            <span className="h-1.5 w-1/3 rounded-full bg-white/25" />
            <span className="ml-auto h-1.5 w-12 rounded-full bg-white/10" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function AgentGenerationTerminal({
  status,
  errorMessage,
  result,
  progress,
  accent = '#6366f1',
}: AgentGenerationTerminalProps) {
  const [elapsed, setElapsed] = useState(0);
  const [verbIndex, setVerbIndex] = useState(0);
  const generating = status === 'generating';

  useEffect(() => {
    if (!generating) return;
    const started = Date.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((Date.now() - started) / 1000), 200);
    return () => window.clearInterval(timer);
  }, [generating]);

  useEffect(() => {
    if (!generating || progress?.currentTool) return;
    const timer = window.setInterval(() => setVerbIndex((value) => value + 1), 2800);
    return () => window.clearInterval(timer);
  }, [generating, progress?.currentTool]);

  const label = useMemo(() => {
    const tool = humanize(progress?.currentTool);
    const detail = humanize(progress?.currentToolDetail);
    if (tool) return detail ? `${tool} · ${detail}` : tool;
    return humanize(progress?.phaseDetail) || FALLBACK_VERBS[verbIndex % FALLBACK_VERBS.length];
  }, [progress, verbIndex]);

  const turn = progress?.turn ?? 0;
  const maxTurns = progress?.maxTurns ?? 0;
  const fraction = generating
    ? (maxTurns > 0 ? Math.min(0.96, turn / maxTurns) : turn > 0 ? 0.12 : 0.05)
    : 1;
  const picksFound = progress?.picksAccepted ?? result?.picks_generated ?? result?.picks?.length ?? 0;

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`agent-generation-card relative overflow-hidden rounded-[26px] border p-4 text-white ${generating ? 'is-generating' : ''}`}
      style={{ borderColor: `${accent}2a`, backgroundColor: '#050707', '--agent-accent': accent } as React.CSSProperties}
      aria-live="polite"
    >
      {generating && <div className="agent-generation-pixels pointer-events-none absolute inset-0" aria-hidden />}
      <div className="relative z-10 space-y-3.5">
        {status === 'success' && (
          <div className="space-y-1 font-mono text-xs text-[#00e676]">
            <p>› {picksFound ? `Generation complete: ${picksFound} picks published.` : 'Analysis complete: no high-confidence picks found.'}</p>
            <p className="text-[#00e676]/70">› {result?.slate_note || (picksFound ? 'Picks are ready below.' : 'No qualifying edges were identified for this slate.')}</p>
          </div>
        )}
        {status === 'error' && (
          <div className="space-y-1 font-mono text-xs text-red-400">
            <p>› Generation failed.</p><p className="text-red-300/75">› {errorMessage}</p>
          </div>
        )}

        {generating && picksFound > 0 && (
          <div className="flex justify-end">
            <span className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-extrabold" style={{ color: accent, background: `${accent}2e` }}>
              <CheckCircle2 className="h-3 w-3" /> {picksFound} found
            </span>
          </div>
        )}

        {generating && <ToolStack count={progress?.toolCalls ?? 0} accent={accent} />}

        <div className="flex min-h-6 items-center gap-2.5 px-3.5">
          <GlyphMatrix accent={generating ? '#ff8a00' : accent} />
          <motion.span key={label} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 truncate text-sm font-bold text-[#ff9f0a]">
            {generating ? label : status === 'success' ? 'Research complete' : 'Research paused'}
          </motion.span>
          {generating && <span className="shrink-0 font-mono text-[13px] font-extrabold tabular-nums text-[#ff9f0a]">{elapsed.toFixed(1).padStart(4, '0')}s</span>}
        </div>

        <div className="px-4 py-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full" animate={{ width: `${fraction * 100}%` }} transition={{ type: 'spring', stiffness: 90, damping: 18 }} style={{ background: accent }} />
          </div>
          {generating && maxTurns > 0 && <p className="mt-1.5 text-right text-[10px] font-bold text-white/40">Turn {turn} of {maxTurns}</p>}
        </div>
      </div>
    </motion.section>
  );
}
