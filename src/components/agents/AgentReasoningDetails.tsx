import { BrainCircuit, Compass, ListChecks } from 'lucide-react';
import type { AgentDecisionTrace } from '@/types/agent';

interface AgentReasoningDetailsProps {
  reasoning?: string | null;
  keyFactors?: string[] | null;
  trace?: AgentDecisionTrace | null;
  accent: string;
}

export function AgentReasoningDetails({ reasoning, keyFactors, trace, accent }: AgentReasoningDetailsProps) {
  const factors = (keyFactors ?? []).filter(Boolean);
  const metrics = trace?.leaned_metrics?.filter((metric) => metric.metric_key || metric.metric_value || metric.why_it_mattered) ?? [];
  if (!reasoning?.trim() && !factors.length && !trace) return null;

  return (
    <div className="space-y-3 border-t border-stone-300 pt-3 dark:border-white/10">
      {reasoning?.trim() && (
        <section>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-white/40"><BrainCircuit className="h-3.5 w-3.5" /> Agent reasoning</div>
          <p className="text-[14px] leading-[1.65] text-slate-700 dark:text-white/70">{reasoning.trim()}</p>
        </section>
      )}

      {factors.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-white/40"><ListChecks className="h-3.5 w-3.5" /> Key factors</div>
          <div className="space-y-1.5">
            {factors.map((factor, index) => (
              <div key={`${factor}-${index}`} className="flex gap-2 rounded-lg bg-stone-900/[0.035] px-3 py-2.5 text-[13px] leading-relaxed text-slate-700 dark:bg-white/[0.045] dark:text-white/65">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
                <span>{factor}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {trace?.rationale_summary && trace.rationale_summary !== reasoning && (
        <section className="rounded-xl border border-stone-300 bg-stone-900/[0.025] p-3 dark:border-white/[0.07] dark:bg-white/[0.035]">
          <p className="mb-1 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-white/35">Decision summary</p>
          <p className="text-[13px] leading-relaxed text-slate-700 dark:text-white/65">{trace.rationale_summary}</p>
        </section>
      )}

      {metrics.length > 0 && (
        <section>
          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-white/35">Data leaned on</p>
          <div className="space-y-2">
            {metrics.map((metric, index) => (
              <div key={`${metric.metric_key}-${index}`} className="rounded-xl border border-stone-300 bg-stone-900/[0.035] p-2.5 dark:border-white/[0.07] dark:bg-black/15">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-bold capitalize text-slate-800 dark:text-white/75">{metric.metric_key.replace(/[_-]+/g, ' ')}</span>
                  {metric.metric_value && <span className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold" style={{ color: accent, background: `${accent}1f` }}>{metric.metric_value}</span>}
                </div>
                {metric.why_it_mattered && <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-white/45">{metric.why_it_mattered}</p>}
                {metric.personality_trait && <p className="mt-1 text-[9px] font-semibold text-slate-400 dark:text-white/30">Trait: {metric.personality_trait}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {trace?.personality_alignment && (
        <section className="flex gap-2 rounded-xl p-3" style={{ background: `${accent}12`, border: `1px solid ${accent}24` }}>
          <Compass className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
          <div><p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-white/35">Why it fits this agent</p><p className="mt-1 text-[13px] leading-relaxed text-slate-700 dark:text-white/60">{trace.personality_alignment}</p></div>
        </section>
      )}
    </div>
  );
}
