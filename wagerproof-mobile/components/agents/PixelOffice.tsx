import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  Image,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Canvas,
  Image as SkiaImage,
  useImage,
  Group,
  Circle,
  Rect,
  rect as skRect,
  FilterMode,
} from '@shopify/react-native-skia';
import { AgentWithPerformance } from '@/types/agent';

// ── Asset imports ────────────────────────────────────────────────
// V2 assets from pixel-agent-desk (the reference office)
const officeV2Bg = require('@/assets/pixel-office/v2/office_bg.webp');
const officeV2Fg = require('@/assets/pixel-office/v2/office_fg.webp');

// Floor plan background options
const FLOOR_BG = {
  standard_day: require('@/assets/pixel-office/floors/standard_day.webp'),
  standard_night: require('@/assets/pixel-office/floors/standard_night.webp'),
  future_day: require('@/assets/pixel-office/floors/future_day.webp'),
  future_night: require('@/assets/pixel-office/floors/future_night.webp'),
} as const;

type FloorStyle = 'standard' | 'future';
type TimeMode = 'auto' | 'day' | 'night';
const FLOOR_STORAGE_KEY = 'pixel-office-floor-style';
const TIME_STORAGE_KEY = 'pixel-office-time-mode';

const avatarSheetSources = [
  require('@/assets/pixel-office/characters/avatar_0.webp'),
  require('@/assets/pixel-office/characters/avatar_1.webp'),
  require('@/assets/pixel-office/characters/avatar_2.webp'),
  require('@/assets/pixel-office/characters/avatar_3.webp'),
  require('@/assets/pixel-office/characters/avatar_4.webp'),
  require('@/assets/pixel-office/characters/avatar_5.webp'),
  require('@/assets/pixel-office/characters/avatar_6.webp'),
  require('@/assets/pixel-office/characters/avatar_7.webp'),
];

// Laptop sprites — directional open/closed variants
const laptopAssets = {
  front_close: require('@/assets/pixel-office/v2/office_laptop_front_close.webp'),
  front_open: require('@/assets/pixel-office/v2/office_laptop_front_open.webp'),
  back_close: require('@/assets/pixel-office/v2/office_laptop_back_close.webp'),
  back_open: require('@/assets/pixel-office/v2/office_laptop_back_open.webp'),
  left_close: require('@/assets/pixel-office/v2/office_laptop_left_close.webp'),
  left_open: require('@/assets/pixel-office/v2/office_laptop_left_open.webp'),
  right_close: require('@/assets/pixel-office/v2/office_laptop_right_close.webp'),
  right_open: require('@/assets/pixel-office/v2/office_laptop_right_open.webp'),
};

// ── Constants ────────────────────────────────────────────────────
const MAP_W = 864;
const MAP_H = 800;

const FW = 48;   // frame width in sprite sheet
const FH = 64;   // frame height in sprite sheet
const SHEET_COLS = 8;
const SHEET_ROWS = 9;

const WALK_SPEED = 110; // px/sec in map coords (matching pixel-agent-desk)
const ANIM_FPS = 6;
const IDLE_ANIM_FPS = 2;
const ARRIVE_THRESHOLD = 2; // px - how close to consider "arrived"

// ── Tile Grid ────────────────────────────────────────────────────
const TILE = 32;
const GRID_COLS = Math.ceil(MAP_W / TILE); // 27
const GRID_ROWS = Math.ceil(MAP_H / TILE); // 25

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

// ── Activity bubble emojis ───────────────────────────────────────
const ACTIVITY_BUBBLES: Record<string, string> = {
  getting_coffee: '\u2615',
  eating: '\uD83C\uDF55',
  watching_tv: '\uD83D\uDCFA',
  gaming: '\uD83C\uDFAE',
  grilling: '\uD83D\uDD25',
  napping: '\uD83D\uDCA4',
  thinking: '\uD83D\uDCAD',
  snacking: '\uD83C\uDF7F',
  reading: '\uD83D\uDCDA',
  fire_hangout: '\uD83D\uDD25',
  socializing: '\uD83D\uDCAC',
  chatting: '\uD83D\uDCAC',
  checking_fridge: '\u2744\uFE0F',
  getting_water: '\uD83D\uDCA7',
  petting_dog: '\uD83D\uDC36',
  cornhole: '\uD83C\uDFAF',
  relaxing: '\uD83C\uDF3F',
  getting_drink: '\uD83C\uDF7A',
  outdoor_meeting: '\uD83D\uDCAC',
};

// ── Collision Grid (parsed from office_collision.webp) ────────────
// 1 = walkable, 0 = blocked. 27 cols x 25 rows (864x800 @ 32px tiles)
const COLLISION_GRID = [
  '000000000000000000000000000',
  '000000000000000000000000000',
  '000000011110000000000000000',
  '010111111110000000000000000',
  '011111111110000001110111100',
  '011110011100110111110111100',
  '011010011100111110010111100',
  '011110011100111111111111100',
  '000000111111111111111111100',
  '000000111111111000000000000',
  '000000111111111000000000000',
  '011110111111111000000000000',
  '000110111111111000001111100',
  '001110111111111011111111110',
  '011111111111111011111111110',
  '011111111111111011100000110',
  '011111111111111011100000110',
  '010000010000011111100000110',
  '010000010000011111111111110',
  '010000010000011111111111110',
  '010111010111011000000000000',
  '011111111111111000000000000',
  '000000000000000000000000000',
  '000000000000000000000000000',
  '000000000000000000000000000',
];

// Build blocked set from collision grid
const BLOCKED = new Set<string>();
for (let r = 0; r < COLLISION_GRID.length; r++) {
  for (let c = 0; c < COLLISION_GRID[r].length; c++) {
    if (COLLISION_GRID[r][c] === '0') {
      BLOCKED.add(`${c},${r}`);
    }
  }
}

// ── Interaction Points (parsed from office_xy.webp) ──────────────
// Desk points (blue) — agent sits here when working/thinking
// Seat IDs 0-3 face down (row 1, looking at monitors), 4-7 face up (row 2, looking at monitors)
const DESK_POINTS = [
  { x: 112, y: 544, facing: 'down' },  // seat 0 - bullpen row 1
  { x: 176, y: 544, facing: 'down' },  // seat 1 - bullpen row 1
  { x: 304, y: 544, facing: 'down' },  // seat 2 - bullpen row 1
  { x: 368, y: 544, facing: 'down' },  // seat 3 - bullpen row 1
  { x: 112, y: 672, facing: 'up' },    // seat 4 - bullpen row 2
  { x: 176, y: 672, facing: 'up' },    // seat 5 - bullpen row 2
  { x: 304, y: 672, facing: 'up' },    // seat 6 - bullpen row 2
  { x: 368, y: 672, facing: 'up' },    // seat 7 - bullpen row 2
];

// Idle points (green) — agent rests here when idle/done
const IDLE_POINTS = [
  { x: 240, y: 96, facing: 'down' },   // patio
  { x: 304, y: 96, facing: 'down' },   // patio
  { x: 48, y: 128, facing: 'right' },  // patio bench
  { x: 112, y: 128, facing: 'right' }, // patio bench
  { x: 528, y: 160, facing: 'down' },  // CEO office
  { x: 560, y: 160, facing: 'down' },  // CEO office
  { x: 592, y: 160, facing: 'left' },  // CEO office
  { x: 624, y: 160, facing: 'left' },  // CEO office
  { x: 400, y: 192, facing: 'down' },  // hallway
  { x: 688, y: 192, facing: 'down' },  // CEO sofa
  { x: 752, y: 192, facing: 'left' },  // CEO bookshelf
  { x: 784, y: 192, facing: 'left' },  // CEO corner
  { x: 80, y: 224, facing: 'down' },   // kitchen chair
  { x: 144, y: 224, facing: 'down' },  // kitchen chair
  { x: 304, y: 352, facing: 'down' },  // stairs landing
  { x: 336, y: 352, facing: 'down' },  // stairs landing
  { x: 368, y: 352, facing: 'down' },  // stairs landing
  { x: 304, y: 416, facing: 'up' },    // stairs lower
  { x: 336, y: 416, facing: 'up' },    // stairs lower
  { x: 368, y: 416, facing: 'up' },    // stairs lower
];

// Meeting points (yellow) — conference room seats
const MEETING_POINTS = [
  { x: 656, y: 480, facing: 'down' },  // conf top-left
  { x: 720, y: 480, facing: 'down' },  // conf top-right
  { x: 592, y: 512, facing: 'right' }, // conf left-1
  { x: 784, y: 512, facing: 'left' },  // conf right-1
  { x: 592, y: 576, facing: 'right' }, // conf left-2
  { x: 784, y: 576, facing: 'left' },  // conf right-2
  { x: 656, y: 608, facing: 'up' },    // conf bottom-left
  { x: 720, y: 608, facing: 'up' },    // conf bottom-right
];

// Combined interaction points for agent targeting
interface ClaimablePoint {
  x: number;
  y: number;
  facing: string;
  type: 'desk' | 'idle' | 'meeting';
  key: string;
  activity: string;
  roomId: string;
  pointIdx: number;
}

const ALL_POINTS: ClaimablePoint[] = [
  ...DESK_POINTS.map((p, i) => ({
    ...p, type: 'desk' as const, key: `desk_${i}`,
    activity: 'working', roomId: 'bullpen', pointIdx: i,
  })),
  ...IDLE_POINTS.map((p, i) => ({
    ...p, type: 'idle' as const, key: `idle_${i}`,
    activity: 'idle', roomId: 'idle', pointIdx: i,
  })),
  ...MEETING_POINTS.map((p, i) => ({
    ...p, type: 'meeting' as const, key: `meeting_${i}`,
    activity: 'meeting', roomId: 'conference', pointIdx: i,
  })),
];

// ── Laptop spots (parsed from office_laptop.webp) ────────────────
// dir uses game directions: 'down'/'up'/'left'/'right'
// mapped to image names: down→front, up→back, left→left, right→right
interface LaptopSpot {
  x: number;
  y: number;
  dir: 'down' | 'up' | 'left' | 'right';
}

// Direction → image filename key mapping
const DIR_TO_IMAGE: Record<string, string> = {
  down: 'front',
  up: 'back',
  left: 'left',
  right: 'right',
};

const LAPTOP_SPOTS: LaptopSpot[] = [
  { x: 608, y: 448, dir: 'right' },   // idx 0  - conference
  { x: 640, y: 448, dir: 'down' },    // idx 1  - conference
  { x: 704, y: 448, dir: 'down' },    // idx 2  - conference
  { x: 736, y: 448, dir: 'left' },    // idx 3  - conference
  { x: 96,  y: 512, dir: 'down' },    // idx 4  - bullpen row 1
  { x: 160, y: 512, dir: 'down' },    // idx 5  - bullpen row 1
  { x: 288, y: 512, dir: 'down' },    // idx 6  - bullpen row 1
  { x: 352, y: 512, dir: 'down' },    // idx 7  - bullpen row 1
  { x: 608, y: 512, dir: 'right' },   // idx 8  - conference
  { x: 640, y: 512, dir: 'up' },      // idx 9  - conference
  { x: 704, y: 512, dir: 'up' },      // idx 10 - conference
  { x: 736, y: 512, dir: 'left' },    // idx 11 - conference
  { x: 96,  y: 576, dir: 'up' },      // idx 12 - bullpen row 2
  { x: 160, y: 576, dir: 'up' },      // idx 13 - bullpen row 2
  { x: 288, y: 576, dir: 'up' },      // idx 14 - bullpen row 2
  { x: 352, y: 576, dir: 'up' },      // idx 15 - bullpen row 2
];

// Maps laptop index → seat ID (from pixel-agent-desk office-config.js)
const LAPTOP_ID_MAP: Record<number, number> = {
  0: 10, 1: 8, 2: 9, 3: 11,
  4: 0, 5: 1, 6: 2, 7: 3,
  8: 12, 9: 14, 10: 15, 11: 13,
  12: 4, 13: 5, 14: 6, 15: 7,
};

// Pre-built O(1) lookup map for hot-path access in the 60fps game loop
const POINTS_BY_KEY = new Map(ALL_POINTS.map(p => [p.key, p]));

function getPointsByRoom(roomIds: string[], activity?: string): ClaimablePoint[] {
  return ALL_POINTS.filter(
    p => roomIds.includes(p.roomId) && (!activity || p.activity === activity),
  );
}

// ── A* Pathfinding (8-directional) ──────────────────────────────
function aStarPath(
  startCol: number, startRow: number,
  endCol: number, endRow: number,
  blocked: Set<string>,
): Array<{ col: number; row: number }> {
  const sc = Math.max(0, Math.min(GRID_COLS - 1, startCol));
  const sr = Math.max(0, Math.min(GRID_ROWS - 1, startRow));
  const ec = Math.max(0, Math.min(GRID_COLS - 1, endCol));
  const er = Math.max(0, Math.min(GRID_ROWS - 1, endRow));

  if (sc === ec && sr === er) return [];

  const key = (c: number, r: number) => `${c},${r}`;

  // 8 directions: cardinal + diagonal
  const dirs = [
    { dc: 0, dr: -1, cost: 1 },   // up
    { dc: 0, dr: 1, cost: 1 },    // down
    { dc: -1, dr: 0, cost: 1 },   // left
    { dc: 1, dr: 0, cost: 1 },    // right
    { dc: -1, dr: -1, cost: 1.4 }, // up-left
    { dc: 1, dr: -1, cost: 1.4 },  // up-right
    { dc: -1, dr: 1, cost: 1.4 },  // down-left
    { dc: 1, dr: 1, cost: 1.4 },   // down-right
  ];

  interface AStarNode {
    col: number;
    row: number;
    g: number;
    f: number;
    parent: AStarNode | null;
  }

  const h = (c: number, r: number) => Math.abs(c - ec) + Math.abs(r - er);
  const closedSet = new Set<string>();
  const openMap = new Map<string, AStarNode>();

  const startNode: AStarNode = { col: sc, row: sr, g: 0, f: h(sc, sr), parent: null };
  const openList: AStarNode[] = [startNode];
  openMap.set(key(sc, sr), startNode);

  while (openList.length > 0) {
    // Find lowest f in open list
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift()!;
    const ck = key(current.col, current.row);
    openMap.delete(ck);

    if (current.col === ec && current.row === er) {
      // Reconstruct path
      const path: Array<{ col: number; row: number }> = [];
      let node: AStarNode | null = current;
      while (node && !(node.col === sc && node.row === sr)) {
        path.unshift({ col: node.col, row: node.row });
        node = node.parent;
      }
      return path;
    }

    closedSet.add(ck);

    for (const d of dirs) {
      const nc = current.col + d.dc;
      const nr = current.row + d.dr;

      if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;

      const nk = key(nc, nr);
      if (closedSet.has(nk)) continue;

      // Allow end tile even if blocked (interaction points near furniture)
      if (blocked.has(nk) && !(nc === ec && nr === er)) continue;

      // For diagonal movement, check that both cardinal neighbors are walkable
      // (prevents cutting corners through walls)
      if (d.dc !== 0 && d.dr !== 0) {
        if (blocked.has(key(current.col + d.dc, current.row)) ||
            blocked.has(key(current.col, current.row + d.dr))) {
          continue;
        }
      }

      const g = current.g + d.cost;
      const existing = openMap.get(nk);

      if (!existing) {
        const node: AStarNode = { col: nc, row: nr, g, f: g + h(nc, nr), parent: current };
        openList.push(node);
        openMap.set(nk, node);
      } else if (g < existing.g) {
        existing.g = g;
        existing.f = g + h(nc, nr);
        existing.parent = current;
      }
    }

    // Safety: cap search
    if (closedSet.size > 2000) break;
  }

  // No path found — direct fallback
  return [{ col: ec, row: er }];
}

// Tile center to pixel position
function tileCenterX(col: number): number {
  return col * TILE + TILE / 2;
}
function tileCenterY(row: number): number {
  return row * TILE + TILE / 2;
}

// Pixel to tile
function pixToCol(x: number): number {
  return Math.max(0, Math.min(GRID_COLS - 1, Math.floor(x / TILE)));
}
function pixToRow(y: number): number {
  return Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(y / TILE)));
}

// ── Agent state type ─────────────────────────────────────────────
interface AgentState {
  id: number;
  name: string;
  emoji: string;
  accentColor: string;
  stateLabel: string;
  avatarIdx: number;
  state: string;
  isActive: boolean;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facing: string;
  animKey: string;
  frameIdx: number;
  claimedPointKey: string;
  arrived: boolean;
  // BFS pathfinding state
  path: Array<{ col: number; row: number }>;
  pathIdx: number;
  moveProgress: number; // 0-1 interpolation between tile centers
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  // Activity bubble
  bubbleEmoji: string;
}

// ── Particle system ──────────────────────────────────────────────
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;    // 0-1 remaining
  maxLife: number;
  radius: number;
  color: string;
  opacity: number;
}

const FALLBACK_NAMES = [
  'Line Hawk', 'Spread Eagle', 'Model Maven', 'Value Hunter',
  'Risk Ranger', 'Trend Spotter', 'Odds Oracle', 'Sharp Edge',
];

// Derive an office display state from real agent data
function deriveOfficeState(agent: AgentWithPerformance): { state: string; label: string } {
  const hasPicksToday = agent.last_generated_at &&
    new Date(agent.last_generated_at).toDateString() === new Date().toDateString();

  if (!agent.is_active) {
    return { state: 'idle', label: 'OFF' };
  }
  if (hasPicksToday) {
    return { state: 'done', label: 'PICKS READY' };
  }
  return { state: 'working', label: 'WORKING' };
}

function getPrimaryFromColor(value: string): string {
  if (value.startsWith('gradient:')) {
    return value.replace('gradient:', '').split(',')[0];
  }
  return value;
}

// ── Name tag component (React Native overlay) ───────────────────

const NameTag = React.memo(({ name, emoji, state, stateLabel, accentColor, scale }: {
  name: string; emoji: string; state: string; stateLabel: string; accentColor: string; scale: number;
}) => {
  const color = STATE_COLORS[state] || '#94a3b8';
  const label = stateLabel || STATE_LABELS[state] || 'IDLE';
  const borderTint = accentColor || color;
  return (
    <View style={tagStyles.container}>
      <View style={[tagStyles.pill, { backgroundColor: color }]}>
        <Text style={[tagStyles.pillText, { fontSize: Math.max(5, 5 * scale) }]}>{label}</Text>
      </View>
      <View style={[tagStyles.nameBox, { borderColor: borderTint, flexDirection: 'row', alignItems: 'center', gap: 2 }]}>
        {emoji ? (
          <Text style={{ fontSize: Math.max(6, 6 * scale) }}>{emoji} </Text>
        ) : null}
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
  container: { alignItems: 'center', position: 'absolute', top: -24, left: -40, width: 80 },
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

// ── Speech bubble component (React Native overlay) ───────────────
const SpeechBubble = React.memo(({ emoji, scale }: { emoji: string; scale: number }) => {
  const size = Math.max(14, 16 * scale);
  return (
    <View style={[bubbleStyles.container, {
      width: size + 8,
      height: size + 4,
      borderRadius: (size + 4) / 2,
      top: -38,
      left: -((size + 8) / 2),
    }]}>
      <Text style={{ fontSize: size * 0.7, textAlign: 'center' }}>{emoji}</Text>
    </View>
  );
});

const bubbleStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
});

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
interface PixelOfficeProps {
  agents?: AgentWithPerformance[];
  agentCount?: number;
  forceNight?: boolean;
  forceAgentState?: string;
  startAtDesks?: boolean;
  hideControls?: boolean;
}

export function PixelOffice({
  agents: realAgents,
  agentCount = 4,
  forceNight,
  forceAgentState,
  startAtDesks = false,
  hideControls = false,
}: PixelOfficeProps) {
  // Floor style state (persisted)
  const [floorStyle, setFloorStyle] = useState<FloorStyle>('future');
  const [timeMode, setTimeMode] = useState<TimeMode>('auto');

  useEffect(() => {
    AsyncStorage.getItem(FLOOR_STORAGE_KEY).then((val) => {
      if (val === 'standard' || val === 'future') setFloorStyle(val);
    });
    AsyncStorage.getItem(TIME_STORAGE_KEY).then((val) => {
      if (val === 'auto' || val === 'day' || val === 'night') setTimeMode(val);
    });
  }, []);

  const toggleFloorStyle = useCallback(() => {
    setFloorStyle((prev) => {
      const next = prev === 'standard' ? 'future' : 'standard';
      AsyncStorage.setItem(FLOOR_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const cycleTimeMode = useCallback(() => {
    setTimeMode((prev) => {
      const next: TimeMode = prev === 'auto' ? 'day' : prev === 'day' ? 'night' : 'auto';
      AsyncStorage.setItem(TIME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  // Day/night mode
  const hour = new Date().getHours();
  const autoNight = forceNight !== undefined ? forceNight : (hour >= 19 || hour < 6);
  const isNight = timeMode === 'auto' ? autoNight : timeMode === 'night';

  // Select background based on floor style + day/night
  const floorBgKey = `${floorStyle}_${isNight ? 'night' : 'day'}` as keyof typeof FLOOR_BG;
  const bgImage = useImage(FLOOR_BG[floorBgKey]);
  const fgImage = useImage(officeV2Fg);

  // Laptop sprite images
  const laptopFrontClose = useImage(laptopAssets.front_close);
  const laptopFrontOpen = useImage(laptopAssets.front_open);
  const laptopBackClose = useImage(laptopAssets.back_close);
  const laptopBackOpen = useImage(laptopAssets.back_open);
  const laptopLeftClose = useImage(laptopAssets.left_close);
  const laptopLeftOpen = useImage(laptopAssets.left_open);
  const laptopRightClose = useImage(laptopAssets.right_close);
  const laptopRightOpen = useImage(laptopAssets.right_open);

  // Laptop images keyed by image-name direction (front/back/left/right)
  const laptopImgMap = useMemo(() => ({
    front: { close: laptopFrontClose, open: laptopFrontOpen },
    back: { close: laptopBackClose, open: laptopBackOpen },
    left: { close: laptopLeftClose, open: laptopLeftOpen },
    right: { close: laptopRightClose, open: laptopRightOpen },
  }), [laptopFrontClose, laptopFrontOpen, laptopBackClose, laptopBackOpen,
       laptopLeftClose, laptopLeftOpen, laptopRightClose, laptopRightOpen]);

  // Load avatar sprite sheets — only for agents that will be displayed
  // Passing null to useImage skips decoding, saving ~880KB GPU memory per unused sheet
  const maxAgents = realAgents ? Math.min(realAgents.length, 8) : Math.min(agentCount, 8);
  const sheet0 = useImage(maxAgents > 0 ? avatarSheetSources[0] : null);
  const sheet1 = useImage(maxAgents > 1 ? avatarSheetSources[1] : null);
  const sheet2 = useImage(maxAgents > 2 ? avatarSheetSources[2] : null);
  const sheet3 = useImage(maxAgents > 3 ? avatarSheetSources[3] : null);
  const sheet4 = useImage(maxAgents > 4 ? avatarSheetSources[4] : null);
  const sheet5 = useImage(maxAgents > 5 ? avatarSheetSources[5] : null);
  const sheet6 = useImage(maxAgents > 6 ? avatarSheetSources[6] : null);
  const sheet7 = useImage(maxAgents > 7 ? avatarSheetSources[7] : null);

  const avatarSheets = useMemo(
    () => [sheet0, sheet1, sheet2, sheet3, sheet4, sheet5, sheet6, sheet7],
    [sheet0, sheet1, sheet2, sheet3, sheet4, sheet5, sheet6, sheet7],
  );

  const screenWidth = Dimensions.get('window').width - 16;
  const scale = screenWidth / MAP_W;
  const displayW = screenWidth;
  const displayH = MAP_H * scale;

  // Agent state managed via ref for perf (mutated in rAF loop)
  const agentsRef = useRef<AgentState[]>([]);
  const claimedPoints = useRef<Set<string>>(new Set());
  const particlesRef = useRef<Particle[]>([]);
  const [renderTick, setRenderTick] = useState(0);
  const [overlayTick, setOverlayTick] = useState(0);

  // Stable key for real agents to detect actual data changes
  const agentKey = realAgents
    ? realAgents.map(a => `${a.id}:${a.is_active}:${a.last_generated_at ?? ''}`).join('|')
    : `fallback:${agentCount}`;

  // Find an unclaimed point from a list, claim it, and return it
  const claimPoint = useCallback((candidates: ClaimablePoint[]): ClaimablePoint | null => {
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    for (const pt of shuffled) {
      if (!claimedPoints.current.has(pt.key)) {
        claimedPoints.current.add(pt.key);
        return pt;
      }
    }
    return null;
  }, []);

  const releasePoint = useCallback((key: string) => {
    if (key) {
      claimedPoints.current.delete(key);
    }
  }, []);

  // Set agent state with room-based activity assignment + BFS pathing
  const setAgentState = useCallback((id: number, newState: string) => {
    const agent = agentsRef.current.find(a => a.id === id);
    if (!agent || agent.state === newState) return;

    agent.state = newState;
    if (!agent.isActive) {
      agent.stateLabel = 'OFF';
    } else {
      agent.stateLabel = STATE_LABELS[newState] || 'IDLE';
    }

    // Release current claimed point
    if (agent.claimedPointKey) {
      releasePoint(agent.claimedPointKey);
      agent.claimedPointKey = '';
    }

    let point: ClaimablePoint | null = null;

    if (newState === 'working' || newState === 'thinking') {
      // Working/thinking → go to a desk
      const deskCandidates = ALL_POINTS.filter(p => p.type === 'desk');
      point = claimPoint(deskCandidates);
    } else if (newState === 'done') {
      // Done → go to an idle spot
      const idleCandidates = ALL_POINTS.filter(p => p.type === 'idle');
      point = claimPoint(idleCandidates);
    } else if (newState === 'idle') {
      // Idle → go to an idle or meeting spot
      const candidates = ALL_POINTS.filter(p => p.type === 'idle' || p.type === 'meeting');
      point = claimPoint(candidates);
    } else if (newState === 'error') {
      // Error → stay at current desk
      return;
    }

    if (!point) {
      point = claimPoint(ALL_POINTS);
    }

    if (point) {
      agent.claimedPointKey = point.key;
      agent.targetX = point.x;
      agent.targetY = point.y;
      agent.arrived = false;

      // Compute BFS path
      const startCol = pixToCol(agent.x);
      const startRow = pixToRow(agent.y);
      const endCol = pixToCol(point.x);
      const endRow = pixToRow(point.y);

      const path = aStarPath(startCol, startRow, endCol, endRow, BLOCKED);
      agent.path = path;
      agent.pathIdx = 0;
      agent.moveProgress = 0;
      agent.fromX = agent.x;
      agent.fromY = agent.y;

      if (path.length > 0) {
        agent.toX = tileCenterX(path[0].col);
        agent.toY = tileCenterY(path[0].row);
      } else {
        // Already at destination tile, just snap
        agent.toX = point.x;
        agent.toY = point.y;
      }

      // Set bubble emoji based on activity
      agent.bubbleEmoji = ACTIVITY_BUBBLES[point.activity] || '';
    }
  }, [claimPoint, releasePoint]);

  // ── Particle spawning helpers ──────────────────────────────────
  const spawnParticle = useCallback((
    x: number, y: number, color: string, opts?: Partial<Particle>,
  ) => {
    const p: Particle = {
      x,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: -12 - Math.random() * 8,
      life: 1,
      maxLife: 0.8 + Math.random() * 0.6,
      radius: 1.5 + Math.random() * 1.5,
      color,
      opacity: 0.6 + Math.random() * 0.3,
      ...opts,
    };
    particlesRef.current.push(p);
  }, []);

  // Initialize agents
  useEffect(() => {
    const hasReal = realAgents && realAgents.length > 0;
    const count = hasReal ? Math.min(realAgents!.length, 8) : Math.min(agentCount, 8);
    const agents: AgentState[] = [];
    claimedPoints.current.clear();
    particlesRef.current = [];

    // When startAtDesks is true (onboarding/login), place agents directly at desks
    // with no pathfinding. This avoids A* computation and staggered timeouts.
    if (startAtDesks) {
      const deskPoints = DESK_POINTS.slice(0, count);
      for (let i = 0; i < count; i++) {
        const real = hasReal ? realAgents![i] : null;
        const desk = deskPoints[i % deskPoints.length];
        const dirMap: Record<string, string> = { down: 'front', up: 'back', left: 'left', right: 'right' };
        const dir = dirMap[desk.facing] || 'front';
        const deskKey = `desk_${i}`;
        claimedPoints.current.add(deskKey);

        agents.push({
          id: i,
          name: real ? real.name : FALLBACK_NAMES[i],
          emoji: real ? real.avatar_emoji : '',
          accentColor: real ? getPrimaryFromColor(real.avatar_color) : '',
          stateLabel: 'WORKING',
          avatarIdx: i % 8,
          state: 'working',
          isActive: true,
          x: desk.x,
          y: desk.y,
          targetX: desk.x,
          targetY: desk.y,
          facing: desk.facing,
          animKey: `${dir}_sit_work`,
          frameIdx: 0,
          claimedPointKey: deskKey,
          arrived: true,
          path: [],
          pathIdx: 0,
          moveProgress: 0,
          fromX: desk.x,
          fromY: desk.y,
          toX: desk.x,
          toY: desk.y,
          bubbleEmoji: '',
        });
      }
      agentsRef.current = agents;
      return;
    }

    // Normal mode: spawn at random locations, then stagger state assignments
    const allSpawnPoints = [...IDLE_POINTS, ...MEETING_POINTS, ...DESK_POINTS];
    const shuffledSpawns = allSpawnPoints.sort(() => Math.random() - 0.5);

    for (let i = 0; i < count; i++) {
      const real = hasReal ? realAgents![i] : null;
      const derived = real ? deriveOfficeState(real) : null;

      const spawnPoint = shuffledSpawns[i % shuffledSpawns.length];
      const startX = spawnPoint.x + (Math.random() * 8 - 4);
      const startY = spawnPoint.y + (Math.random() * 8 - 4);

      agents.push({
        id: i,
        name: real ? real.name : FALLBACK_NAMES[i],
        emoji: real ? real.avatar_emoji : '',
        accentColor: real ? getPrimaryFromColor(real.avatar_color) : '',
        stateLabel: derived ? derived.label : '',
        avatarIdx: i % 8,
        state: derived ? derived.state : 'idle',
        isActive: real ? real.is_active : true,
        x: startX,
        y: startY,
        targetX: startX,
        targetY: startY,
        facing: 'down',
        animKey: 'front_idle',
        frameIdx: 0,
        claimedPointKey: '',
        arrived: true,
        path: [],
        pathIdx: 0,
        moveProgress: 0,
        fromX: startX,
        fromY: startY,
        toX: startX,
        toY: startY,
        bubbleEmoji: '',
      });
    }
    agentsRef.current = agents;

    // Stagger initial state assignments
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    if (hasReal) {
      for (let i = 0; i < count; i++) {
        const derived = deriveOfficeState(realAgents![i]);
        const state = forceAgentState || derived.state;
        timeouts.push(setTimeout(() => {
          setAgentState(i, state);
        }, 600 + i * 400));
      }
    } else {
      const initialStates = ['working', 'thinking', 'working', 'idle', 'done', 'working', 'thinking', 'idle'];
      for (let i = 0; i < count; i++) {
        const state = forceAgentState || initialStates[i % initialStates.length];
        timeouts.push(setTimeout(() => {
          setAgentState(i, state);
        }, 600 + i * 400));
      }
    }

    return () => timeouts.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey]);

  // ── Game loop ──────────────────────────────────────────────────
  useEffect(() => {
    let lastTime = performance.now();
    let frameTick = 0;
    let running = true;
    let particleTimer = 0;

    const updateAgents = (dt: number) => {
      const agents = agentsRef.current;

      for (const a of agents) {
        // ── Tile-based smooth movement ──
        if (!a.arrived && a.path.length > 0) {
          const segDist = Math.sqrt(
            (a.toX - a.fromX) ** 2 + (a.toY - a.fromY) ** 2,
          );
          const progressStep = segDist > 0 ? (WALK_SPEED * dt) / segDist : 1;
          a.moveProgress += progressStep;

          if (a.moveProgress >= 1) {
            // Arrived at current tile waypoint
            a.x = a.toX;
            a.y = a.toY;
            a.pathIdx++;

            if (a.pathIdx < a.path.length) {
              // Move to next tile in path
              a.moveProgress = 0;
              a.fromX = a.x;
              a.fromY = a.y;
              a.toX = tileCenterX(a.path[a.pathIdx].col);
              a.toY = tileCenterY(a.path[a.pathIdx].row);
            } else {
              // Reached end of BFS path, now do final approach to exact target
              const dxFinal = a.targetX - a.x;
              const dyFinal = a.targetY - a.y;
              const distFinal = Math.sqrt(dxFinal * dxFinal + dyFinal * dyFinal);

              if (distFinal < 4) {
                // Close enough, snap
                a.x = a.targetX;
                a.y = a.targetY;
                a.arrived = true;
                a.path = [];
                a.pathIdx = 0;
                a.moveProgress = 0;

                // Snap facing to the interaction point's facing direction
                const claimedPt = POINTS_BY_KEY.get(a.claimedPointKey);
                if (claimedPt) {
                  a.facing = claimedPt.facing;
                }
              } else {
                // One more interpolation segment to exact point
                a.moveProgress = 0;
                a.fromX = a.x;
                a.fromY = a.y;
                a.toX = a.targetX;
                a.toY = a.targetY;
                // Add a dummy path entry so the loop continues
                a.path.push({ col: pixToCol(a.targetX), row: pixToRow(a.targetY) });
              }
            }
          } else {
            // Interpolate between from and to
            a.x = a.fromX + (a.toX - a.fromX) * a.moveProgress;
            a.y = a.fromY + (a.toY - a.fromY) * a.moveProgress;

            // Update facing based on movement direction
            const dx = a.toX - a.fromX;
            const dy = a.toY - a.fromY;
            if (Math.abs(dx) > Math.abs(dy)) {
              a.facing = dx > 0 ? 'right' : 'left';
            } else {
              a.facing = dy > 0 ? 'down' : 'up';
            }
          }
        } else if (!a.arrived && a.path.length === 0) {
          // Direct movement fallback (no path found)
          const dx = a.targetX - a.x;
          const dy = a.targetY - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 3) {
            a.x = a.targetX;
            a.y = a.targetY;
            a.arrived = true;
            const claimedPt = POINTS_BY_KEY.get(a.claimedPointKey);
            if (claimedPt) {
              a.facing = claimedPt.facing;
            }
          } else {
            const step = WALK_SPEED * dt;
            a.x += (dx / dist) * Math.min(step, dist);
            a.y += (dy / dist) * Math.min(step, dist);
            a.facing = Math.abs(dx) > Math.abs(dy)
              ? (dx > 0 ? 'right' : 'left')
              : (dy > 0 ? 'down' : 'up');
          }
        }

        // ── Animation key ──
        const dirMap: Record<string, string> = { down: 'front', up: 'back', left: 'left', right: 'right' };
        const dir = dirMap[a.facing] || 'front';

        if (!a.arrived) {
          a.animKey = `${dir}_walk`;
          a.bubbleEmoji = ''; // Clear bubble while walking
        } else if (a.state === 'done') {
          a.animKey = 'front_done_dance';
        } else if (a.state === 'error') {
          a.animKey = 'front_alert_jump';
        } else if ((a.state === 'working' || a.state === 'thinking') && a.claimedPointKey) {
          const claimedPt = POINTS_BY_KEY.get(a.claimedPointKey);
          if (claimedPt && (claimedPt.activity === 'working' || claimedPt.activity === 'thinking')) {
            const ptDir = dirMap[claimedPt.facing] || dir;
            a.animKey = a.state === 'working' ? `${ptDir}_sit_work` : `${ptDir}_sit_idle`;
          } else {
            a.animKey = `${dir}_idle`;
          }
        } else {
          a.animKey = `${dir}_idle`;
        }

        // ── Frame cycling ──
        const fps = a.arrived && a.state === 'idle' ? IDLE_ANIM_FPS : ANIM_FPS;
        const frameInterval = Math.round(60 / fps);
        if (frameTick % frameInterval === 0) {
          const frames = FRAMES[a.animKey];
          if (frames) {
            a.frameIdx = (a.frameIdx + 1) % frames.length;
          }
        }
      }
    };

    const updateParticles = (dt: number) => {
      const particles = particlesRef.current;

      // Update existing particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt / p.maxLife;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.opacity = p.life * 0.5;
      }

      // Cap particle count (lower for mobile perf)
      if (particles.length > 30) {
        particles.splice(0, particles.length - 30);
      }
    };

    // Idle detection: when all agents have arrived and no particles are active,
    // throttle the loop to ~2fps instead of 60fps to free the JS thread.
    let idleFrameCount = 0;
    let lastOverlayTick = 0;

    const loop = () => {
      if (!running) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      frameTick++;

      const agents = agentsRef.current;
      const allIdle = agents.length > 0 && agents.every(a => a.arrived);
      const hasParticles = particlesRef.current.length > 0;

      if (allIdle && !hasParticles) {
        idleFrameCount++;
      } else {
        idleFrameCount = 0;
      }

      // After 60 consecutive idle frames (~1s), throttle to ~2fps
      const isThrottled = idleFrameCount > 60;
      // When fully idle, skip most frames entirely — no state updates needed
      if (isThrottled) {
        // Only run 1 in 30 frames (~2fps) for animation cycling
        if (frameTick % 30 !== 0) {
          requestAnimationFrame(loop);
          return;
        }
      }

      updateAgents(dt);

      // Particle spawning
      particleTimer += dt;
      if (particleTimer > 0.3) {
        particleTimer = 0;

        for (const a of agents) {
          if (!a.arrived) continue;
          const claimedPt = POINTS_BY_KEY.get(a.claimedPointKey);
          if (!claimedPt) continue;

          // Coffee steam
          if (claimedPt.activity === 'getting_coffee') {
            spawnParticle(a.x + (Math.random() * 8 - 4), a.y - 20, 'rgba(255,255,255,0.5)', {
              vy: -15 - Math.random() * 10,
              radius: 1 + Math.random() * 1.5,
              maxLife: 1.0,
            });
          }

          // Fire embers (night only or always for fire_hangout)
          if (claimedPt.activity === 'fire_hangout' || claimedPt.activity === 'grilling') {
            spawnParticle(a.x + (Math.random() * 12 - 6), a.y - 10, 'rgba(255,140,0,0.7)', {
              vy: -20 - Math.random() * 15,
              vx: (Math.random() - 0.5) * 12,
              radius: 1 + Math.random(),
              maxLife: 0.7,
            });
          }
        }

        // Monitor glow particles (night only)
        if (isNight) {
          const workingAgents = agents.filter(a =>
            a.arrived && a.state === 'working' && a.claimedPointKey,
          );
          for (const a of workingAgents) {
            if (Math.random() < 0.4) {
              spawnParticle(a.x + (Math.random() * 16 - 8), a.y - 24, 'rgba(45,212,191,0.35)', {
                vy: -5 - Math.random() * 5,
                vx: (Math.random() - 0.5) * 6,
                radius: 2 + Math.random() * 2,
                maxLife: 1.2,
              });
            }
          }
        }
      }

      updateParticles(dt);

      // Canvas render at ~12fps (every 5th frame of ~60fps rAF) — pixel art looks great at low fps
      if (frameTick % 5 === 0) {
        setRenderTick(t => t + 1);

        // RN overlays (name tags) update at ~4fps (every 3rd canvas tick)
        lastOverlayTick++;
        if (lastOverlayTick % 3 === 0) {
          setOverlayTick(t => t + 1);
        }
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);

    // Periodic state changes — skip when startAtDesks (onboarding/login)
    // to avoid unnecessary pathfinding and keep agents stationary
    let stateInterval: ReturnType<typeof setInterval> | null = null;
    if (!startAtDesks) {
      stateInterval = setInterval(() => {
        const agents = agentsRef.current;
        if (agents.length === 0) return;

        if (forceAgentState) {
          for (const a of agents) {
            setAgentState(a.id, forceAgentState);
          }
          return;
        }

        const a = agents[Math.floor(Math.random() * agents.length)];

        if (!a.isActive) {
          const states = ['idle', 'idle', 'idle', 'thinking'];
          setAgentState(a.id, states[Math.floor(Math.random() * states.length)]);
        } else {
          const states = ['working', 'thinking', 'done', 'working', 'thinking', 'idle'];
          setAgentState(a.id, states[Math.floor(Math.random() * states.length)]);
        }
      }, 5000);
    }

    return () => {
      running = false;
      if (stateInterval) clearInterval(stateInterval);
    };
  }, [setAgentState, forceAgentState, isNight, spawnParticle, startAtDesks]);

  // Apply forced state immediately when it changes
  useEffect(() => {
    if (!forceAgentState) return;
    const agents = agentsRef.current;
    for (const a of agents) {
      setAgentState(a.id, forceAgentState);
    }
  }, [forceAgentState, setAgentState]);

  // Sort agents by Y for depth (lower Y = further back = drawn first)
  // Used for Skia canvas rendering — updates at canvas rate (~12fps)
  const sortedAgents = useMemo(() => {
    const agents = [...agentsRef.current];
    agents.sort((a, b) => a.y - b.y);
    return agents;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderTick]);

  // Snapshot agents for RN overlays — updates at slower rate (~4fps)
  const overlayAgents = useMemo(() => {
    const agents = [...agentsRef.current];
    agents.sort((a, b) => a.y - b.y);
    return agents;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayTick]);

  // Snapshot particles for render
  const particles = useMemo(() => {
    return [...particlesRef.current];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderTick]);

  return (
    <View style={[styles.container, { width: displayW, height: displayH, alignSelf: 'center' }]}>
      {/* ── Skia Canvas: background, characters, foreground ── */}
      <Canvas style={StyleSheet.absoluteFill}>
        {/* 1. Background image (V2 from pixel-agent-desk) */}
        {bgImage && (
          <SkiaImage
            image={bgImage}
            x={0}
            y={0}
            width={displayW}
            height={displayH}
            fit="fill"
            sampling={{ filter: FilterMode.Nearest }}
          />
        )}

        {/* 2. Laptop overlays (open if agent is working at that desk) */}
        {LAPTOP_SPOTS.map((spot, idx) => {
          // Map game direction (down/up/left/right) to image key (front/back/left/right)
          const imgDir = DIR_TO_IMAGE[spot.dir] as keyof typeof laptopImgMap;
          const dirImgs = laptopImgMap[imgDir];
          if (!dirImgs) return null;

          // Use LAPTOP_ID_MAP to find which seat this laptop belongs to
          const seatId = LAPTOP_ID_MAP[idx] ?? idx;
          const isOccupied = agentsRef.current.some(a =>
            a.claimedPointKey === `desk_${seatId}` &&
            ['working', 'thinking', 'error'].includes(a.state),
          );

          const img = isOccupied ? dirImgs.open : dirImgs.close;
          if (!img) return null;

          // Draw at spot.x, spot.y directly — no offset (matching reference)
          return (
            <SkiaImage
              key={`laptop-${idx}`}
              image={img}
              x={spot.x * scale}
              y={spot.y * scale}
              width={32 * scale}
              height={64 * scale}
              fit="fill"
              sampling={{ filter: FilterMode.Nearest }}
            />
          );
        })}

        {/* 3. Characters sorted by Y (lower Y = further back = drawn first) */}
        {sortedAgents.map(agent => {
          const frames = FRAMES[agent.animKey];
          if (!frames) return null;
          const frameIndex = frames[agent.frameIdx % frames.length];
          const sheet = avatarSheets[agent.avatarIdx];
          if (!sheet) return null;

          // Source frame position in sprite sheet (pixel coords)
          const srcCol = frameIndex % SHEET_COLS;
          const srcRow = Math.floor(frameIndex / SHEET_COLS);

          // Destination on canvas (anchored at character feet)
          const charW = FW * scale;
          const charH = FH * scale;
          const destX = agent.x * scale - charW / 2;
          const destY = agent.y * scale - charH + 8 * scale;

          // Scale factor from sprite sheet pixels to display pixels
          const sheetScaleX = charW / FW;
          const sheetScaleY = charH / FH;

          // The full sheet drawn at this scale
          const sheetDisplayW = SHEET_COLS * FW * sheetScaleX;
          const sheetDisplayH = SHEET_ROWS * FH * sheetScaleY;

          // Offset to shift the correct frame into the clip window
          const offsetX = -srcCol * charW;
          const offsetY = -srcRow * charH;

          return (
            <Group
              key={`char-${agent.id}`}
              clip={skRect(destX, destY, charW, charH)}
            >
              <SkiaImage
                image={sheet}
                x={destX + offsetX}
                y={destY + offsetY}
                width={sheetDisplayW}
                height={sheetDisplayH}
                fit="fill"
                sampling={{ filter: FilterMode.Nearest }}
              />
            </Group>
          );
        })}

        {/* 4. Particles */}
        {particles.map((p, i) => (
          <Circle
            key={`p-${i}`}
            cx={p.x * scale}
            cy={p.y * scale}
            r={p.radius * scale}
            color={p.color}
            opacity={p.opacity}
          />
        ))}

        {/* 5. Foreground overlay (chairs that render over characters) */}
        {fgImage && (
          <SkiaImage
            image={fgImage}
            x={0}
            y={0}
            width={displayW}
            height={displayH}
            fit="fill"
            sampling={{ filter: FilterMode.Nearest }}
          />
        )}

        {/* Night overlay removed — night backgrounds have lighting baked in */}
      </Canvas>

      {/* ── React Native overlays: name tags, speech bubbles ── */}
      {/* Uses overlayAgents which updates at ~4fps to reduce RN layout work */}
      {overlayAgents.map(agent => {
        const charW = FW * scale;
        const charH = FH * scale;
        const left = agent.x * scale - charW / 2;
        const top = agent.y * scale - charH + 8 * scale;

        return (
          <View
            key={`overlay-${agent.id}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left,
              top,
              zIndex: Math.round(agent.y) + 1000,
            }}
          >
            <NameTag
              name={agent.name}
              emoji={agent.emoji}
              state={agent.state}
              stateLabel={agent.stateLabel}
              accentColor={agent.accentColor}
              scale={scale}
            />
            {agent.arrived && agent.bubbleEmoji !== '' && (
              <SpeechBubble emoji={agent.bubbleEmoji} scale={scale} />
            )}
          </View>
        );
      })}

      {/* ── Bottom-left label ── */}
      <View style={styles.label}>
        <View style={styles.labelDot} />
        <Text style={styles.labelText}>Agent HQ — {isNight ? 'Night Shift' : 'Live'}</Text>
      </View>

      {/* ── Bottom-right controls ── */}
      {!hideControls && <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlPill}
          onPress={cycleTimeMode}
          activeOpacity={0.7}
        >
          <Text style={styles.controlIcon}>
            {isNight ? '🌙' : '☀️'}
          </Text>
          <Text style={styles.controlText}>
            {timeMode === 'auto' ? 'Auto' : timeMode === 'day' ? 'Day' : 'Night'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlPill}
          onPress={toggleFloorStyle}
          activeOpacity={0.7}
        >
          <Text style={styles.controlIcon}>
            {floorStyle === 'standard' ? '🏢' : '🚀'}
          </Text>
          <Text style={styles.controlText}>
            {floorStyle === 'standard' ? 'Standard' : 'Future'}
          </Text>
        </TouchableOpacity>
      </View>}
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
    zIndex: 2000,
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
  controls: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
    zIndex: 2000,
  },
  controlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,12,18,0.75)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  controlIcon: {
    fontSize: 9,
  },
  controlText: {
    color: '#8b949e',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
