import { useMemo, useState } from 'react';
import {
  BarChart3,
  Bot,
  Check,
  CircleDollarSign,
  Clock3,
  Database,
  FileText,
  Flame,
  Gamepad2,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Vote,
} from 'lucide-react';

import {
  MCP_TOOL_CARDS,
  MCP_TOOL_CATEGORIES,
  MCP_TOOL_COUNT,
  type McpToolCard,
  type McpToolCategory,
  type McpToolPreview,
} from './mcpContent';

const categoryIcons: Record<McpToolCategory, typeof Sparkles> = {
  featured: Flame,
  slate: BarChart3,
  matchups: Gamepad2,
  market: CircleDollarSign,
  database: Database,
  agents: Bot,
  community: Users,
};

function MiniMeter({ label, value, width }: { label: string; value: string; width: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-bold text-white/55">
        <span>{label}</span>
        <span className="text-white/80">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-[#b8ff38]" style={{ width }} />
      </div>
    </div>
  );
}

function ToolPreview({ type }: { type: McpToolPreview }) {
  const shell = 'relative h-full min-h-[210px] overflow-hidden rounded-[18px] border border-white/[0.055] bg-[#151819] p-5';

  if (type === 'predictions') {
    return (
      <div className={shell}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#b8ff38]">NBA model</span>
          <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[9px] font-bold text-white/40">5 games</span>
        </div>
        <div className="mt-7 flex items-center justify-between">
          <div><p className="text-3xl font-black text-white">PHX</p><p className="text-[10px] text-white/38">Away</p></div>
          <div className="text-center"><p className="text-[10px] font-bold text-white/32">MODEL</p><p className="mt-1 text-xl font-black text-[#b8ff38]">61.2%</p></div>
          <div className="text-right"><p className="text-3xl font-black text-white">DEN</p><p className="text-[10px] text-white/38">Home</p></div>
        </div>
        <div className="mt-7 space-y-3">
          <MiniMeter label="Win probability" value="61.2%" width="61.2%" />
          <MiniMeter label="Market probability" value="54.4%" width="54.4%" />
        </div>
      </div>
    );
  }

  if (type === 'game') {
    return (
      <div className={shell}>
        <div className="flex items-center justify-between text-[10px] font-bold text-white/38">
          <span>TONIGHT · 7:30 PM ET</span><span>NBA</span>
        </div>
        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full border border-amber-300/20 bg-amber-300/10 text-lg font-black text-amber-200">LAL</div>
          <span className="text-xs font-black text-white/25">VS</span>
          <div className="ml-auto grid h-14 w-14 place-items-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-lg font-black text-emerald-200">BOS</div>
        </div>
        <div className="mt-7 grid grid-cols-3 gap-2">
          {[['58.4%', 'Model'], ['−1.7', 'Vs. market'], ['2', 'Injuries']].map(([value, label]) => (
            <div key={label} className="rounded-xl bg-white/[0.045] p-3 text-center">
              <p className="text-sm font-black text-white">{value}</p><p className="mt-1 text-[9px] text-white/35">{label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'search') {
    return (
      <div className={shell}>
        <div className="flex h-11 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3">
          <Search className="h-4 w-4 text-[#b8ff38]" /><span className="text-xs font-semibold text-white/70">Lakers</span>
        </div>
        <p className="mt-5 text-[9px] font-black uppercase tracking-[0.1em] text-white/30">Matching games</p>
        <div className="mt-3 space-y-2">
          {['Lakers @ Celtics · NBA', 'Warriors @ Lakers · NBA'].map((item, index) => (
            <div key={item} className="flex items-center gap-3 rounded-xl bg-white/[0.045] p-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-300/10 text-[10px] font-black text-amber-200">LA</span>
              <div><p className="text-xs font-bold text-white/75">{item}</p><p className="mt-0.5 text-[9px] text-white/30">{index === 0 ? 'Tonight' : 'Friday'}</p></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'market') {
    return (
      <div className={shell}>
        <div className="flex items-center justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.1em] text-sky-300">Polymarket</p><p className="mt-1 text-sm font-bold text-white">PHX @ DEN</p></div>
          <p className="text-2xl font-black text-white">54.4¢</p>
        </div>
        <svg viewBox="0 0 320 110" className="mt-5 h-24 w-full" role="img" aria-label="Illustrative prediction-market line chart">
          <defs>
            <linearGradient id="marketFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 90 C35 78 48 91 78 68 S132 74 164 48 S216 59 245 31 S286 36 320 18 L320 110 L0 110 Z" fill="url(#marketFill)" />
          <path d="M0 90 C35 78 48 91 78 68 S132 74 164 48 S216 59 245 31 S286 36 320 18" fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <div className="flex items-center justify-between text-[9px] font-semibold text-white/30"><span>Open</span><span>Now</span></div>
      </div>
    );
  }

  if (type === 'editor') {
    return (
      <div className={shell}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.08em] text-white/40"><FileText className="h-3.5 w-3.5" /> Editor analysis</span>
          <span className="rounded-full border border-[#b8ff38]/25 bg-[#b8ff38]/10 px-2 py-1 text-[9px] font-black text-[#b8ff38]">WON</span>
        </div>
        <h4 className="mt-6 text-lg font-black leading-tight text-white">Why pace matters in tonight’s matchup</h4>
        <div className="mt-5 space-y-2">
          <span className="block h-2 rounded bg-white/[0.08]" />
          <span className="block h-2 w-[88%] rounded bg-white/[0.08]" />
          <span className="block h-2 w-[70%] rounded bg-white/[0.08]" />
        </div>
        <div className="mt-6 flex items-center gap-2 text-[10px] font-bold text-white/34"><Check className="h-3.5 w-3.5 text-[#b8ff38]" /> Reasoning and grade included</div>
      </div>
    );
  }

  if (type === 'schema') {
    return (
      <div className={shell}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-violet-300">
            <Database className="h-3.5 w-3.5" /> Schema catalog
          </span>
          <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[9px] font-bold text-white/40">Signed in</span>
        </div>
        <div className="mt-5 space-y-2.5">
          {[
            ['mlb_analysis_base', '48 columns'],
            ['nfl_betting_lines', '31 columns'],
            ['nba_odds_snapshots', '26 columns'],
          ].map(([table, detail], index) => (
            <div key={table} className="flex items-center gap-3 rounded-xl border border-white/[0.055] bg-white/[0.035] p-3">
              <span className={`grid h-8 w-8 place-items-center rounded-lg text-[10px] font-black ${index === 0 ? 'bg-violet-300 text-black' : 'bg-white/[0.08] text-white'}`}>
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-[10px] font-bold text-white/75">{table}</p>
                <p className="mt-0.5 text-[9px] text-white/30">{detail} · types and comments</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'sql') {
    return (
      <div className={shell}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#b8ff38]">
            <Database className="h-3.5 w-3.5" /> Custom query
          </span>
          <span className="text-[9px] font-bold text-white/30">12s limit</span>
        </div>
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/25 p-3 font-mono text-[9px] leading-5 text-white/55">
          <span className="text-violet-300">SELECT</span> season, COUNT(*) games,<br />
          AVG(covered) cover_rate<br />
          <span className="text-violet-300">FROM</span> mlb_analysis_base<br />
          <span className="text-violet-300">GROUP BY</span> season
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/[0.045] p-3">
            <p className="text-lg font-black text-white">124</p>
            <p className="mt-1 text-[9px] text-white/32">sample games</p>
          </div>
          <div className="rounded-xl bg-[#b8ff38]/10 p-3">
            <p className="text-lg font-black text-[#b8ff38]">57.3%</p>
            <p className="mt-1 text-[9px] text-white/32">historical rate</p>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'agent-list') {
    return (
      <div className={shell}>
        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#b8ff38]">My agent desk</p>
        <div className="mt-5 space-y-2.5">
          {[['MM', 'Market Maven', 'MLB · Public'], ['DD', 'Diamond Data', 'NBA · Private'], ['SS', 'Sunday Sharp', 'NFL · Public']].map(([initials, name, detail], index) => (
            <div key={name} className="flex items-center gap-3 rounded-xl border border-white/[0.055] bg-white/[0.035] p-3">
              <span className={`grid h-9 w-9 place-items-center rounded-lg text-[10px] font-black ${index === 0 ? 'bg-[#b8ff38] text-black' : 'bg-white/[0.08] text-white'}`}>{initials}</span>
              <div className="min-w-0"><p className="truncate text-xs font-bold text-white">{name}</p><p className="mt-0.5 text-[9px] text-white/35">{detail}</p></div>
              <span className="ml-auto h-2 w-2 rounded-full bg-[#b8ff38]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'performance') {
    return (
      <div className={shell}>
        <div className="flex items-start justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#b8ff38]">Agent performance</p><p className="mt-2 text-3xl font-black text-white">+10.2u</p></div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#b8ff38]/10 px-2 py-1 text-[9px] font-black text-[#b8ff38]"><Flame className="h-3 w-3" /> W4</span>
        </div>
        <div className="mt-7 flex h-20 items-end gap-2">
          {[38, 56, 42, 64, 53, 76, 88].map((height, index) => (
            <span key={index} className="flex-1 rounded-t bg-[#b8ff38]/70" style={{ height: `${height}%`, opacity: 0.45 + index * 0.07 }} />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-white/40"><span>56.8% win rate</span><span>48–35–2</span></div>
      </div>
    );
  }

  if (type === 'picks') {
    return (
      <div className={shell}>
        <div className="rounded-[16px] border border-dashed border-white/15 bg-white/[0.035] p-4">
          <div className="flex items-center justify-between"><span className="text-[10px] font-black text-white/35">AGENT RESEARCH</span><span className="rounded-full bg-[#b8ff38]/10 px-2 py-1 text-[9px] font-black text-[#b8ff38]">GRADED</span></div>
          <p className="mt-5 text-base font-black text-white">PHX @ DEN</p>
          <p className="mt-1 text-[10px] text-white/35">Confidence · 4 / 5</p>
          <div className="mt-5 border-t border-dashed border-white/10 pt-4">
            <p className="text-[10px] leading-5 text-white/48">Pace, rest, and recent efficiency context are included with the recorded outcome.</p>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'follows') {
    return (
      <div className={shell}>
        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-sky-300">Following</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[['QL', 'Quant Lab', '62–44'], ['TR', 'Tempo Reader', '41–30'], ['DE', 'Data Edge', '55–49'], ['SP', 'Split Pro', '29–24']].map(([initials, name, record], index) => (
            <div key={name} className="rounded-xl border border-white/[0.055] bg-white/[0.035] p-3 text-center">
              <span className={`mx-auto grid h-10 w-10 place-items-center rounded-full text-[10px] font-black ${index === 0 ? 'bg-sky-300 text-black' : 'bg-white/[0.08] text-white'}`}>{initials}</span>
              <p className="mt-2 truncate text-[10px] font-bold text-white">{name}</p><p className="mt-1 text-[9px] text-white/35">{record}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'activity') {
    return (
      <div className={shell}>
        <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[0.1em] text-violet-300">My activity</span><Vote className="h-4 w-4 text-white/35" /></div>
        <div className="mt-5 space-y-3">
          {[['NBA', 'PHX @ DEN', '+18'], ['MLB', 'PIT @ NYY', '+11']].map(([sport, game, votes], index) => (
            <div key={game} className="rounded-xl border border-white/[0.055] bg-white/[0.035] p-4">
              <div className="flex items-center justify-between"><span className="text-[9px] font-black text-white/35">{sport}</span><span className="text-xs font-black text-[#b8ff38]">{votes}</span></div>
              <p className="mt-2 text-sm font-bold text-white">{game}</p>
              <p className="mt-2 text-[9px] text-white/35">{index === 0 ? 'Won · reasoning included' : 'Pending · community votes'}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#b8ff38]">Tracked record</span><Trophy className="h-4 w-4 text-amber-300" /></div>
      <div className="mt-5 flex items-center gap-5">
        <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-[10px] border-[#b8ff38]/75 bg-[#101213]">
          <div className="text-center"><p className="text-xl font-black text-white">55.8%</p><p className="text-[8px] text-white/35">WIN RATE</p></div>
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <MiniMeter label="MLB" value="61.3%" width="61.3%" />
          <MiniMeter label="NBA" value="52.8%" width="52.8%" />
          <MiniMeter label="NFL" value="54.5%" width="54.5%" />
        </div>
      </div>
      <p className="mt-5 text-center text-[10px] font-bold text-white/32">86 graded picks · informational tracking</p>
    </div>
  );
}

function ToolCard({ tool }: { tool: McpToolCard }) {
  return (
    <article className="group min-w-0">
      <div className="rounded-[22px] bg-gradient-to-br from-white/[0.075] to-white/[0.015] p-1 transition duration-200 group-hover:from-[#b8ff38]/25 group-hover:to-white/[0.03]">
        <ToolPreview type={tool.preview} />
      </div>
      <div className="flex items-start justify-between gap-4 px-1 pt-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white">{tool.title}</h3>
          <p className="mt-1 font-mono text-[10px] font-semibold text-white/30">{tool.name}</p>
          <p className="mt-2 max-w-[55ch] text-xs leading-5 text-white/44">{tool.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 pt-0.5 text-[10px] font-bold text-white/38">
          <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> instant</span>
          <span className="inline-flex items-center gap-1.5">{tool.scope === 'Public' ? <ShieldCheck className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />} {tool.scope}</span>
        </div>
      </div>
    </article>
  );
}

export default function McpToolGallery() {
  const [category, setCategory] = useState<McpToolCategory>('featured');
  const [query, setQuery] = useState('');

  const tools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return MCP_TOOL_CARDS.filter((tool) => {
      const inCategory = category === 'featured' ? tool.featured : tool.category === category;
      const matchesQuery =
        !normalizedQuery ||
        `${tool.title} ${tool.name} ${tool.description}`.toLowerCase().includes(normalizedQuery);
      return inCategory && matchesQuery;
    });
  }, [category, query]);

  return (
    <section id="tools" className="scroll-mt-24 px-4 py-24 sm:px-6 md:py-32">
      <div className="mx-auto max-w-[1500px]">
        <div className="text-center">
          <h2 className="text-balance text-4xl font-black uppercase leading-[0.98] tracking-[-0.045em] text-white sm:text-5xl md:text-6xl">
            Explore WagerProof tools in <span className="text-[#b8ff38]">your AI</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-6 text-white/42 sm:text-base">
            Give a compatible assistant secure access to WagerProof model research and your own account data.
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
          <aside className="rounded-[24px] border border-white/[0.055] bg-[#17191a] p-4 lg:sticky lg:top-24">
            <label className="flex h-12 items-center gap-3 border-b border-white/[0.08] px-2 text-white/40 focus-within:text-white/75">
              <Search className="h-4 w-4 shrink-0" />
              <span className="sr-only">Search MCP tools</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tools"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/35"
              />
            </label>

            <div className="mt-4 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1" role="tablist" aria-label="Filter MCP tools">
              {MCP_TOOL_CATEGORIES.map((item) => {
                const Icon = categoryIcons[item.key];
                const selected = category === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setCategory(item.key)}
                    className={`flex min-h-[68px] items-center gap-3 rounded-[15px] px-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff38] ${
                      selected ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-[11px] border ${
                        selected
                          ? 'border-[#b8ff38]/35 bg-[#b8ff38] text-[#121415]'
                          : 'border-white/[0.08] bg-gradient-to-b from-white/[0.11] to-white/[0.035] text-white/72'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-white">{item.label}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-white/35">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-center gap-2 border-t border-white/[0.07] px-2 pt-4 text-[10px] font-semibold leading-4 text-white/30">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#b8ff38]/70" />
              {MCP_TOOL_COUNT} tools in the current connector catalog.
            </div>
          </aside>

          <div>
            <div className="mb-6 flex items-center justify-between gap-4">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-white/35" aria-live="polite">
                {tools.length} {tools.length === 1 ? 'tool' : 'tools'}
              </p>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.055] bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold text-white/34">
                <Database className="h-3.5 w-3.5 text-[#b8ff38]" />
                Live connector catalog
              </span>
            </div>

            {tools.length > 0 ? (
              <div className="grid gap-x-8 gap-y-12 xl:grid-cols-2">
                {tools.map((tool) => <ToolCard key={tool.name} tool={tool} />)}
              </div>
            ) : (
              <div className="grid min-h-[360px] place-items-center rounded-[24px] border border-dashed border-white/[0.09] bg-white/[0.02] p-8 text-center">
                <div>
                  <Search className="mx-auto h-8 w-8 text-white/25" />
                  <p className="mt-4 text-base font-bold text-white">No tools match “{query}”</p>
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="mt-3 text-sm font-bold text-[#b8ff38] hover:text-[#c8ff68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff38]"
                  >
                    Clear search
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
