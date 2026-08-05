import { GlassCard } from '@/components/ios';

export function RulesTab() {
  return (
    <GlassCard radius={18} className="space-y-4 p-5 text-[14px] leading-relaxed">
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          How it works
        </h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-foreground/90">
          <li>Pick exactly <strong>6 games</strong> — spreads and/or totals, any mix of NFL + CFB.</li>
          <li>
            Star exactly <strong>1 Play of the Week</strong>. Regular win = 1 pt, POTW win ={' '}
            <strong>3 pts</strong>. Loss / push = 0.
          </li>
          <li>
            <strong>Week 0 (Practice Round)</strong> is unscored — picks and results are for
            learning the flow only and do not count toward season standings or Cover Points.
          </li>
          <li>
            Deadline: <strong>Friday 12:00 PM ET</strong>. Thursday-night and other weekday games are
            excluded — only Friday–Tuesday kickoffs count.
          </li>
          <li>
            Everyone plays the same <strong>consensus line</strong> (~11-book average). Your lines are{' '}
            <strong>stamped when you submit</strong> — beating later movement is part of the game.
          </li>
          <li>
            After submit you get a <strong>5-minute</strong> edit window. Editing reverts to draft;
            resubmitting re-stamps at then-current lines.
          </li>
          <li>Other players&apos; picks stay hidden until the deadline (enforced in the database).</li>
        </ul>
      </div>

      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Cover Points (season tiebreaker)
        </h3>
        <p className="mt-2 text-foreground/90">
          Cumulative margin vs your stamped line. Not tripled for POTW.
        </p>
        <p className="mt-2 rounded-xl bg-muted/40 px-3 py-2 font-mono text-[13px]">
          Pick −7 · team wins by 21 → <span className="text-emerald-600 dark:text-emerald-300">+14</span>
          <br />
          Pick −7 · lose by 21 → <span className="text-rose-600 dark:text-rose-300">−28</span>
          <br />
          Totals use the same idea · pushes land at 0
        </p>
      </div>
    </GlassCard>
  );
}
