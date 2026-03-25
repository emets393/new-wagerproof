import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  Text,
} from 'react-native';


// ── Asset imports ────────────────────────────────────────────────
const officeBg = require('@/assets/pixel-office/office/map/office_bg_32.webp');
const officeFg = require('@/assets/pixel-office/office/map/office_fg_32.webp');

const avatarSheets = [
  require('@/assets/pixel-office/characters/avatar_0.webp'),
  require('@/assets/pixel-office/characters/avatar_1.webp'),
  require('@/assets/pixel-office/characters/avatar_2.webp'),
  require('@/assets/pixel-office/characters/avatar_3.webp'),
  require('@/assets/pixel-office/characters/avatar_4.webp'),
  require('@/assets/pixel-office/characters/avatar_5.webp'),
  require('@/assets/pixel-office/characters/avatar_6.webp'),
  require('@/assets/pixel-office/characters/avatar_7.webp'),
];

// ── Constants ────────────────────────────────────────────────────
const MAP_W = 640;
const MAP_H = 768;
const FW = 48;   // frame width in sprite sheet
const FH = 64;   // frame height in sprite sheet
const SHEET_COLS = 8;
const SHEET_ROWS = 9;
const SHEET_W = FW * SHEET_COLS; // 384
const SHEET_H = FH * SHEET_ROWS; // 576

const MOVE_SPEED = 80; // px/sec in map coords
const ANIM_FPS = 6;
const IDLE_ANIM_FPS = 2;

// Sprite frame indices (matching pixel-agent-desk spec)
const FRAMES: Record<string, number[]> = {
  front_idle:       [0,1,2,3],
  front_walk:       [4,5,6,7],
  front_sit_idle:   [8,9,10,11],
  front_sit_work:   [12,13,14,15],
  left_idle:        [16,17,18,19],
  left_walk:        [20,21,22,23],
  left_sit_idle:    [24,25,26,27],
  left_sit_work:    [28,29,30,31],
  right_idle:       [32,33,34,35],
  right_walk:       [36,37,38,39],
  right_sit_idle:   [40,41,42,43],
  right_sit_work:   [44,45,46,47],
  back_idle:        [48,49,50,51],
  back_walk:        [52,53,54,55],
  back_sit_idle:    [56,57,58,59],
  back_sit_work:    [60,61,62,63],
  front_done_dance: [64,65,66,67],
  front_alert_jump: [68,69,70,71],
};

const STATE_COLORS: Record<string, string> = {
  idle:     '#94a3b8',
  working:  '#f97316',
  thinking: '#8b5cf6',
  done:     '#22c55e',
  error:    '#ef4444',
};

const STATE_LABELS: Record<string, string> = {
  idle: 'RESTING', working: 'WORKING', thinking: 'THINKING',
  done: 'DONE', error: 'ERROR',
};

// Pre-defined positions (in map pixel coords) — matches 640x768 map
const DESK_SPOTS = [
  // Left block (3x2)
  { x: 80, y: 130, dir: 'up' },
  { x: 200, y: 130, dir: 'up' },
  { x: 320, y: 130, dir: 'up' },
  { x: 80, y: 230, dir: 'up' },
  { x: 200, y: 230, dir: 'up' },
  { x: 320, y: 230, dir: 'up' },
  // Research lab (right of glass wall)
  { x: 460, y: 140, dir: 'up' },
  { x: 580, y: 140, dir: 'up' },
];

const IDLE_SPOTS = [
  // Hallway / corridor
  { x: 220, y: 340 }, { x: 300, y: 350 }, { x: 440, y: 340 },
  // Break room
  { x: 170, y: 500 }, { x: 200, y: 570 }, { x: 360, y: 550 },
  { x: 540, y: 540 }, { x: 100, y: 680 },
  // Open bottom area
  { x: 300, y: 700 }, { x: 440, y: 690 },
];

const AGENT_NAMES = [
  'Line Hawk', 'Spread Eagle', 'Model Maven', 'Value Hunter',
  'Risk Ranger', 'Trend Spotter', 'Odds Oracle', 'Sharp Edge',
];

// ── Agent state type ─────────────────────────────────────────────
interface AgentState {
  id: number;
  name: string;
  avatarIdx: number;
  state: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facing: string;
  animKey: string;
  frameIdx: number;
  deskIdx: number;
  arrived: boolean;
}

// ── Sprite component (crops a frame from the sheet) ──────────────
const SpriteCharacter = React.memo(({
  avatarIdx,
  frameIndex,
  scale,
}: {
  avatarIdx: number;
  frameIndex: number;
  scale: number;
}) => {
  const col = frameIndex % SHEET_COLS;
  const row = Math.floor(frameIndex / SHEET_COLS);

  const displayW = FW * scale;
  const displayH = FH * scale;
  const sheetDisplayW = SHEET_W * scale;
  const sheetDisplayH = SHEET_H * scale;

  return (
    <View style={{
      width: displayW,
      height: displayH,
      overflow: 'hidden',
    }}>
      <Image
        source={avatarSheets[avatarIdx]}
        style={{
          width: sheetDisplayW,
          height: sheetDisplayH,
          marginLeft: -col * displayW,
          marginTop: -row * displayH,
        }}
        resizeMode="stretch"
      />
    </View>
  );
});

// ── Name tag component ───────────────────────────────────────────
const NameTag = React.memo(({ name, state, scale }: { name: string; state: string; scale: number }) => {
  const color = STATE_COLORS[state] || '#94a3b8';
  const label = STATE_LABELS[state] || 'IDLE';
  return (
    <View style={tagStyles.container}>
      {/* Status pill */}
      <View style={[tagStyles.pill, { backgroundColor: color }]}>
        <Text style={[tagStyles.pillText, { fontSize: Math.max(5, 5 * scale) }]}>{label}</Text>
      </View>
      {/* Name background */}
      <View style={[tagStyles.nameBox, { borderColor: color }]}>
        <Text
          style={[tagStyles.nameText, { fontSize: Math.max(6, 6 * scale) }]}
          numberOfLines={1}
        >
          {name}
        </Text>
      </View>
    </View>
  );
});

const tagStyles = StyleSheet.create({
  container: { alignItems: 'center', position: 'absolute', top: -24, left: -30, width: 60 },
  pill: { paddingHorizontal: 3, paddingVertical: 1, borderRadius: 3, marginBottom: 1 },
  pillText: { color: '#fff', fontWeight: '800', letterSpacing: 0.3 },
  nameBox: {
    backgroundColor: 'rgba(10,12,18,0.85)',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  nameText: { color: '#e0e4ec', fontWeight: '700', textAlign: 'center' },
});

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
interface PixelOfficeProps {
  agentCount?: number;
}

export function PixelOffice({ agentCount = 4 }: PixelOfficeProps) {
  const screenWidth = Dimensions.get('window').width - 16; // match FlatList paddingHorizontal 8*2
  const scale = screenWidth / MAP_W;
  const displayW = screenWidth;
  const displayH = MAP_H * scale;

  // Agent state managed via ref for perf (mutated in rAF loop)
  const agentsRef = useRef<AgentState[]>([]);
  const deskClaims = useRef<Set<number>>(new Set());
  const [renderTick, setRenderTick] = useState(0);

  // Initialize agents
  useEffect(() => {
    const count = Math.min(agentCount, 8);
    const agents: AgentState[] = [];
    deskClaims.current.clear();

    for (let i = 0; i < count; i++) {
      const spot = IDLE_SPOTS[i % IDLE_SPOTS.length];
      agents.push({
        id: i,
        name: AGENT_NAMES[i],
        avatarIdx: i,
        state: 'idle',
        x: spot.x + (Math.random() * 20 - 10),
        y: spot.y + (Math.random() * 10 - 5),
        targetX: spot.x,
        targetY: spot.y,
        facing: 'down',
        animKey: 'front_idle',
        frameIdx: 0,
        deskIdx: -1,
        arrived: true,
      });
    }
    agentsRef.current = agents;

    // Stagger initial state assignments
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const initialStates = ['working', 'thinking', 'working', 'idle', 'done', 'working', 'thinking', 'idle'];
    for (let i = 0; i < count; i++) {
      timeouts.push(setTimeout(() => {
        setAgentState(i, initialStates[i % initialStates.length]);
      }, 600 + i * 400));
    }

    return () => timeouts.forEach(clearTimeout);
  }, [agentCount]);

  // Set agent state with desk assignment logic
  const setAgentState = useCallback((id: number, newState: string) => {
    const agent = agentsRef.current.find(a => a.id === id);
    if (!agent || agent.state === newState) return;

    agent.state = newState;

    if (newState === 'working' || newState === 'thinking') {
      // Assign desk
      if (agent.deskIdx < 0) {
        for (let i = 0; i < DESK_SPOTS.length; i++) {
          if (!deskClaims.current.has(i)) {
            agent.deskIdx = i;
            deskClaims.current.add(i);
            break;
          }
        }
      }
      if (agent.deskIdx >= 0) {
        const desk = DESK_SPOTS[agent.deskIdx];
        agent.targetX = desk.x;
        agent.targetY = desk.y;
        agent.arrived = false;
      }
    } else {
      // Release desk
      if (agent.deskIdx >= 0) {
        deskClaims.current.delete(agent.deskIdx);
        agent.deskIdx = -1;
      }
      // Go to idle spot
      const spot = IDLE_SPOTS[(id + Math.floor(Math.random() * 3)) % IDLE_SPOTS.length];
      agent.targetX = spot.x + (Math.random() * 24 - 12);
      agent.targetY = spot.y + (Math.random() * 16 - 8);
      agent.arrived = false;
    }
  }, []);

  // Game loop
  useEffect(() => {
    let lastTime = Date.now();
    let frameTick = 0;
    let running = true;

    const loop = () => {
      if (!running) return;
      const now = Date.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      frameTick++;

      const agents = agentsRef.current;
      let needsRender = false;

      for (const a of agents) {
        // Movement
        if (!a.arrived) {
          const dx = a.targetX - a.x;
          const dy = a.targetY - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 3) {
            a.x = a.targetX;
            a.y = a.targetY;
            a.arrived = true;
          } else {
            const step = MOVE_SPEED * dt;
            a.x += (dx / dist) * Math.min(step, dist);
            a.y += (dy / dist) * Math.min(step, dist);
            a.facing = Math.abs(dx) > Math.abs(dy)
              ? (dx > 0 ? 'right' : 'left')
              : (dy > 0 ? 'down' : 'up');
          }
          needsRender = true;
        }

        // Animation key
        const dirMap: Record<string, string> = { down: 'front', up: 'back', left: 'left', right: 'right' };
        const dir = dirMap[a.facing] || 'front';

        if (!a.arrived) {
          a.animKey = `${dir}_walk`;
        } else if (a.state === 'done') {
          a.animKey = 'front_done_dance';
        } else if (a.state === 'error') {
          a.animKey = 'front_alert_jump';
        } else if ((a.state === 'working' || a.state === 'thinking') && a.deskIdx >= 0) {
          const deskDir = dirMap[DESK_SPOTS[a.deskIdx].dir] || dir;
          a.animKey = a.state === 'working' ? `${deskDir}_sit_work` : `${deskDir}_sit_idle`;
        } else {
          a.animKey = `${dir}_idle`;
        }

        // Frame cycling
        const fps = a.arrived && a.state === 'idle' ? IDLE_ANIM_FPS : ANIM_FPS;
        const frameInterval = Math.round(60 / fps); // in ticks at ~60fps
        if (frameTick % frameInterval === 0) {
          const frames = FRAMES[a.animKey];
          if (frames) {
            a.frameIdx = (a.frameIdx + 1) % frames.length;
            needsRender = true;
          }
        }
      }

      // Re-render at ~20fps for perf (every 3rd frame of requestAnimationFrame)
      if (needsRender || frameTick % 3 === 0) {
        setRenderTick(t => t + 1);
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);

    // Periodic random state changes
    const stateInterval = setInterval(() => {
      const agents = agentsRef.current;
      if (agents.length === 0) return;
      const a = agents[Math.floor(Math.random() * agents.length)];
      const states = ['idle', 'working', 'thinking', 'done', 'working', 'thinking'];
      const newState = states[Math.floor(Math.random() * states.length)];
      setAgentState(a.id, newState);
    }, 5000);

    return () => {
      running = false;
      clearInterval(stateInterval);
    };
  }, [setAgentState]);

  // Sort agents by Y for depth
  const sortedAgents = useMemo(() => {
    const agents = [...agentsRef.current];
    agents.sort((a, b) => a.y - b.y);
    return agents;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderTick]);

  // Map image dimensions at 2x scale
  const mapDisplayW = MAP_W * scale;
  const mapDisplayH = MAP_H * scale;

  return (
    <View style={[styles.container, { width: displayW, height: displayH, alignSelf: 'center' }]}>
      {/* Background - rendered at 2x, clipped to container */}
      <Image
        source={officeBg}
        style={[styles.mapLayer, { width: mapDisplayW, height: mapDisplayH }]}
        resizeMode="stretch"
      />

      {/* Characters */}
      {sortedAgents.map(agent => {
        const frames = FRAMES[agent.animKey];
        if (!frames) return null;
        const frameIndex = frames[agent.frameIdx % frames.length];

        const charW = FW * scale;
        const charH = FH * scale;
        // Position: anchor at character's feet
        const left = agent.x * scale - charW / 2;
        const top = agent.y * scale - charH + 8 * scale;

        return (
          <View
            key={agent.id}
            style={[styles.character, {
              left,
              top,
              zIndex: Math.round(agent.y),
            }]}
          >
            <NameTag name={agent.name} state={agent.state} scale={scale} />
            <SpriteCharacter
              avatarIdx={agent.avatarIdx}
              frameIndex={frameIndex}
              scale={scale}
            />
          </View>
        );
      })}

      {/* Foreground overlay */}
      <Image
        source={officeFg}
        style={[styles.mapLayer, styles.foreground, { width: mapDisplayW, height: mapDisplayH }]}
        resizeMode="stretch"
      />

      {/* Bottom-left label */}
      <View style={styles.label}>
        <View style={styles.labelDot} />
        <Text style={styles.labelText}>Agent HQ — Live</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#0f1118',
    position: 'relative',
  },
  mapLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  foreground: {
    zIndex: 900,
    pointerEvents: 'none',
  },
  character: {
    position: 'absolute',
  },
  label: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,12,18,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
    zIndex: 1000,
  },
  labelDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  labelText: {
    color: '#8b949e',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
