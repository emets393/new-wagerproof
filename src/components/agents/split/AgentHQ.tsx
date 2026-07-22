import * as React from 'react';
import type { AgentWithPerformance } from '@/types/agent';
import { agentSpriteIndex } from '@/utils/agentSprites';

const W = 864;
const H = 800;
const FW = 48;
const FH = 64;
const SPEED = 110;

type OfficeState = 'idle' | 'working' | 'thinking' | 'done' | 'error';
type Facing = 'down' | 'up' | 'left' | 'right';
type Point = { x: number; y: number; facing: Facing; kind: 'desk' | 'idle' | 'meeting'; key: string };
type SimAgent = {
  id: string;
  name: string;
  emoji: string;
  accent: string;
  sprite: number;
  state: OfficeState;
  stateLabel: string;
  active: boolean;
  x: number;
  y: number;
  target: Point;
  arrived: boolean;
  facing: Facing;
  frame: number;
};

const DESKS: Point[] = [
  [112, 544, 'down'], [176, 544, 'down'], [304, 544, 'down'], [368, 544, 'down'],
  [112, 672, 'up'], [176, 672, 'up'], [304, 672, 'up'], [368, 672, 'up'],
].map(([x, y, facing], i) => ({ x: x as number, y: y as number, facing: facing as Facing, kind: 'desk', key: `desk_${i}` }));

const IDLE: Point[] = [
  [240, 96, 'down'], [304, 96, 'down'], [48, 128, 'right'], [112, 128, 'right'],
  [528, 160, 'down'], [592, 160, 'left'], [688, 192, 'down'], [752, 192, 'left'],
  [80, 224, 'down'], [144, 224, 'down'], [304, 352, 'down'], [368, 352, 'down'],
  [304, 416, 'up'], [368, 416, 'up'],
].map(([x, y, facing], i) => ({ x: x as number, y: y as number, facing: facing as Facing, kind: 'idle', key: `idle_${i}` }));

const MEETING: Point[] = [
  [656, 480, 'down'], [720, 480, 'down'], [592, 512, 'right'], [784, 512, 'left'],
  [592, 576, 'right'], [784, 576, 'left'], [656, 608, 'up'], [720, 608, 'up'],
].map(([x, y, facing], i) => ({ x: x as number, y: y as number, facing: facing as Facing, kind: 'meeting', key: `meeting_${i}` }));

const LAPTOPS = [
  [608, 448, 'right'], [640, 448, 'front'], [704, 448, 'front'], [736, 448, 'left'],
  [96, 512, 'front'], [160, 512, 'front'], [288, 512, 'front'], [352, 512, 'front'],
  [608, 512, 'right'], [640, 512, 'back'], [704, 512, 'back'], [736, 512, 'left'],
  [96, 576, 'back'], [160, 576, 'back'], [288, 576, 'back'], [352, 576, 'back'],
] as const;

const FRAMES: Record<string, number[]> = {
  front_idle: [0, 1, 2, 3], front_walk: [4, 5, 6, 7], front_sit_idle: [8, 9, 10, 11], front_sit_work: [12, 13, 14, 15],
  left_idle: [16, 17, 18, 19], left_walk: [20, 21, 22, 23], left_sit_idle: [24, 25, 26, 27], left_sit_work: [28, 29, 30, 31],
  right_idle: [32, 33, 34, 35], right_walk: [36, 37, 38, 39], right_sit_idle: [40, 41, 42, 43], right_sit_work: [44, 45, 46, 47],
  back_idle: [48, 49, 50, 51], back_walk: [52, 53, 54, 55], back_sit_idle: [56, 57, 58, 59], back_sit_work: [60, 61, 62, 63],
  front_done_dance: [64, 65, 66, 67], front_alert_jump: [68, 69, 70, 71],
};

const STATE_COLOR: Record<OfficeState, string> = { idle: '#94a3b8', working: '#f97316', thinking: '#8b5cf6', done: '#22c55e', error: '#ef4444' };
const DIR: Record<Facing, string> = { down: 'front', up: 'back', left: 'left', right: 'right' };

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function deriveState(agent: AgentWithPerformance): Pick<SimAgent, 'state' | 'stateLabel'> {
  if (!agent.is_active) return { state: 'idle', stateLabel: 'OFF' };
  if (agent.last_generated_at && new Date(agent.last_generated_at).toDateString() === new Date().toDateString()) {
    return { state: 'done', stateLabel: 'PICKS READY' };
  }
  return { state: 'working', stateLabel: 'WORKING' };
}

function targetFor(state: OfficeState, index: number): Point {
  if (state === 'working' || state === 'thinking' || state === 'error') return DESKS[index % DESKS.length];
  const choices = state === 'idle' ? [...IDLE, ...MEETING] : IDLE;
  return choices[Math.floor(Math.random() * choices.length)];
}

function primaryColor(value: string) {
  return value.startsWith('gradient:') ? value.slice(9).split(',')[0] : value;
}

function animationKey(agent: SimAgent) {
  if (!agent.arrived) return `${DIR[agent.facing]}_walk`;
  if (agent.state === 'done') return 'front_done_dance';
  if (agent.state === 'error') return 'front_alert_jump';
  if ((agent.state === 'working' || agent.state === 'thinking') && agent.target.kind === 'desk') {
    return `${DIR[agent.target.facing]}_${agent.state === 'working' ? 'sit_work' : 'sit_idle'}`;
  }
  return `${DIR[agent.facing]}_idle`;
}

function glassPillClass() {
  return 'rounded-full border border-white/20 bg-black/35 text-white shadow-lg shadow-black/20 backdrop-blur-md';
}

interface AgentHQProps {
  agents: AgentWithPerformance[];
  loading?: boolean;
  onSelectAgent: (id: string) => void;
}

export function AgentHQ({ agents, loading, onSelectAgent }: AgentHQProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const simRef = React.useRef<SimAgent[]>([]);
  const imagesRef = React.useRef<Record<string, HTMLImageElement>>({});
  const [ready, setReady] = React.useState(false);
  const [floorStyle, setFloorStyle] = React.useState<'standard' | 'future'>(() => (localStorage.getItem('pixel-office-floor-style') as 'standard' | 'future') || 'future');
  const [timeMode, setTimeMode] = React.useState<'auto' | 'day' | 'night'>(() => (localStorage.getItem('pixel-office-time-mode') as 'auto' | 'day' | 'night') || 'auto');
  const hour = new Date().getHours();
  const isNight = timeMode === 'night' || (timeMode === 'auto' && (hour >= 19 || hour < 6));

  const shownAgents = React.useMemo(() => agents.slice(0, 8), [agents]);
  const netUnits = agents.reduce((sum, agent) => sum + (agent.performance?.net_units ?? 0), 0);
  const rates = agents.flatMap((agent) => {
    const wins = agent.performance?.wins ?? 0;
    const losses = agent.performance?.losses ?? 0;
    return wins + losses ? [wins / (wins + losses)] : [];
  });
  const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  const active = agents.filter((agent) => agent.is_active).length;

  React.useEffect(() => {
    let live = true;
    const sources = [
      'office_bg', 'office_fg',
      'floor_future_day', 'floor_future_night', 'floor_standard_day', 'floor_standard_night',
      ...Array.from({ length: 8 }, (_, i) => `avatar_${i}`),
      ...['front', 'back', 'left', 'right'].flatMap((dir) => [`office_laptop_${dir}_close`, `office_laptop_${dir}_open`]),
    ];
    Promise.all(sources.map(async (key) => [key, await loadImage(`/pixel-office/${key}.png`)] as const)).then((loaded) => {
      if (!live) return;
      imagesRef.current = Object.fromEntries(loaded);
      setReady(true);
    });
    return () => { live = false; };
  }, []);

  React.useEffect(() => {
    simRef.current = shownAgents.map((agent, index) => {
      const state = deriveState(agent);
      const start = [...IDLE, ...MEETING, ...DESKS][(index * 5 + 2) % (IDLE.length + MEETING.length + DESKS.length)];
      return {
        id: agent.id, name: agent.name, emoji: agent.avatar_emoji, accent: primaryColor(agent.avatar_color),
        sprite: agentSpriteIndex(agent.id, agent.sprite_index), active: agent.is_active,
        ...state, x: start.x, y: start.y, target: targetFor(state.state, index), arrived: false, facing: 'down', frame: index % 4,
      };
    });
  }, [shownAgents]);

  React.useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.imageSmoothingEnabled = false;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const images = imagesRef.current;
      context.clearRect(0, 0, W, H);
      context.drawImage(images[`floor_${floorStyle}_${isNight ? 'night' : 'day'}`], 0, 0, W, H);
      context.drawImage(images.office_bg, 0, 0, W, H);

      const sim = simRef.current;
      if (!reduceMotion) {
        sim.forEach((agent) => {
          if (!agent.arrived) {
            const dx = agent.target.x - agent.x;
            const dy = agent.target.y - agent.y;
            const distance = Math.hypot(dx, dy);
            if (distance < 3) {
              agent.x = agent.target.x; agent.y = agent.target.y; agent.arrived = true; agent.facing = agent.target.facing;
            } else {
              const step = Math.min(SPEED * dt, distance);
              agent.x += dx / distance * step; agent.y += dy / distance * step;
              agent.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
            }
          }
          agent.frame = Math.floor(now / (agent.arrived && agent.state === 'idle' ? 500 : 166) + agent.sprite) % 4;
        });
      }

      LAPTOPS.forEach(([x, y, direction], index) => {
        const deskIndex = index >= 4 && index <= 7 ? index - 4 : index >= 12 ? index - 8 : -1;
        const open = deskIndex >= 0 && sim.some((agent) => agent.arrived && agent.target.key === `desk_${deskIndex}` && ['working', 'thinking', 'error'].includes(agent.state));
        context.drawImage(images[`office_laptop_${direction}_${open ? 'open' : 'close'}`], x, y, 32, 64);
      });

      [...sim].sort((a, b) => a.y - b.y).forEach((agent) => {
        const key = animationKey(agent);
        const frameIndex = FRAMES[key][agent.frame];
        const sx = (frameIndex % 8) * FW;
        const sy = Math.floor(frameIndex / 8) * FH;
        context.drawImage(images[`avatar_${agent.sprite}`], sx, sy, FW, FH, agent.x - FW / 2, agent.y - FH + 8, FW, FH);

        const label = agent.name.length > 12 ? `${agent.name.slice(0, 11)}…` : agent.name;
        context.font = '800 13px ui-rounded, system-ui';
        const stateWidth = Math.max(62, context.measureText(agent.stateLabel).width + 16);
        context.fillStyle = STATE_COLOR[agent.state];
        context.beginPath(); context.roundRect(agent.x - stateWidth / 2, agent.y - 100, stateWidth, 22, 5); context.fill();
        context.fillStyle = '#fff'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(agent.stateLabel, agent.x, agent.y - 89);
        context.font = '700 14px ui-rounded, system-ui';
        const fullLabel = agent.emoji ? `${agent.emoji} ${label}` : label;
        const nameWidth = Math.max(92, context.measureText(fullLabel).width + 18);
        context.fillStyle = 'rgba(10,12,18,.88)'; context.strokeStyle = agent.accent || '#94a3b8'; context.lineWidth = 1.5;
        context.beginPath(); context.roundRect(agent.x - nameWidth / 2, agent.y - 75, nameWidth, 24, 5); context.fill(); context.stroke();
        context.fillStyle = '#e0e4ec'; context.fillText(fullLabel, agent.x, agent.y - 63);
      });

      context.drawImage(images.office_fg, 0, 0, W, H);
      if (isNight) {
        sim.filter((agent) => agent.arrived && agent.state === 'working').forEach((agent, i) => {
          context.fillStyle = `rgba(45,212,191,${0.12 + ((Math.sin(now / 400 + i) + 1) * 0.08)})`;
          context.beginPath(); context.arc(agent.x, agent.y - 28, 8, 0, Math.PI * 2); context.fill();
        });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ready, floorStyle, isNight]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      const sim = simRef.current;
      if (!sim.length) return;
      const agent = sim[Math.floor(Math.random() * sim.length)];
      const choices: OfficeState[] = agent.active ? ['working', 'thinking', 'done', 'working', 'idle'] : ['idle', 'idle', 'thinking'];
      agent.state = choices[Math.floor(Math.random() * choices.length)];
      agent.stateLabel = agent.active ? ({ working: 'WORKING', thinking: 'THINKING', done: 'DONE', idle: 'RESTING', error: 'ERROR' }[agent.state]) : 'OFF';
      agent.target = targetFor(agent.state, sim.indexOf(agent));
      agent.arrived = false;
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const cycleTime = () => {
    const next = timeMode === 'auto' ? 'day' : timeMode === 'day' ? 'night' : 'auto';
    setTimeMode(next); localStorage.setItem('pixel-office-time-mode', next);
  };
  const toggleFloor = () => {
    const next = floorStyle === 'future' ? 'standard' : 'future';
    setFloorStyle(next); localStorage.setItem('pixel-office-floor-style', next);
  };

  return (
    <section className="relative aspect-[864/800] w-full overflow-hidden rounded-[20px] bg-[#0f1118] shadow-sm" aria-label="Agent HQ live simulation">
      <canvas ref={canvasRef} width={W} height={H} className="h-full w-full cursor-pointer [image-rendering:pixelated]" onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - rect.left) * W / rect.width;
        const y = (event.clientY - rect.top) * H / rect.height;
        const hit = [...simRef.current].reverse().find((agent) => Math.abs(agent.x - x) < 42 && y > agent.y - 120 && y < agent.y + 10);
        if (hit) onSelectAgent(hit.id);
      }} />
      {(!ready || loading) && <div className="absolute inset-0 animate-pulse bg-slate-800/70" />}

      <div className={`pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold tracking-[0.03em] ${glassPillClass()}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Agent HQ — {isNight ? 'Night Shift' : 'Live'}
      </div>
      <div className={`pointer-events-none absolute right-2.5 top-2.5 flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-extrabold ${glassPillClass()}`}>
        <span className={netUnits >= 0 ? 'text-green-400' : 'text-red-400'}>{netUnits >= 0 ? '+' : ''}{netUnits.toFixed(2)}u</span>
        <span className="text-white/50">·</span><span>{Math.round(avgRate * 100)}%</span>
        <span className="text-white/50">·</span><span>{active}/{agents.length}</span>
      </div>
      <div className="absolute bottom-2 right-2 flex gap-1.5">
        <button type="button" onClick={cycleTime} aria-label="Toggle time of day" className={`px-2.5 py-1.5 text-xs font-semibold tracking-[0.03em] transition hover:bg-black/50 ${glassPillClass()}`}>
          {isNight ? '🌙' : '☀️'} {timeMode === 'auto' ? 'Auto' : timeMode === 'day' ? 'Day' : 'Night'}
        </button>
        <button type="button" onClick={toggleFloor} aria-label="Toggle floor style" className={`px-2.5 py-1.5 text-xs font-semibold tracking-[0.03em] transition hover:bg-black/50 ${glassPillClass()}`}>
          {floorStyle === 'standard' ? '🏢 Standard' : '🚀 Future'}
        </button>
      </div>
    </section>
  );
}
