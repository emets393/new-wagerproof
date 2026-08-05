const OFFICE_TILE_SIZE = 32;
const OFFICE_WIDTH = 864;
const OFFICE_HEIGHT = 800;

const OFFICE_GRID_COLUMNS = Math.ceil(OFFICE_WIDTH / OFFICE_TILE_SIZE);
const OFFICE_GRID_ROWS = Math.ceil(OFFICE_HEIGHT / OFFICE_TILE_SIZE);

// Parsed from office_collision.webp. This is the same 27 x 25 walkability map
// used by the native Agent HQ scene: 1 is walkable and 0 is blocked.
export const OFFICE_COLLISION_GRID = [
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
] as const;

export type OfficeGridPoint = { col: number; row: number };

type SearchNode = OfficeGridPoint & {
  g: number;
  f: number;
  parent: SearchNode | null;
};

type Direction = {
  dc: number;
  dr: number;
  cost: number;
};

const DIRECTIONS: Direction[] = [
  { dc: 0, dr: -1, cost: 1 },
  { dc: 0, dr: 1, cost: 1 },
  { dc: -1, dr: 0, cost: 1 },
  { dc: 1, dr: 0, cost: 1 },
  { dc: -1, dr: -1, cost: 1.4 },
  { dc: 1, dr: -1, cost: 1.4 },
  { dc: -1, dr: 1, cost: 1.4 },
  { dc: 1, dr: 1, cost: 1.4 },
];

function clamp(value: number, lower: number, upper: number) {
  return Math.max(lower, Math.min(upper, value));
}

function gridKey(col: number, row: number) {
  return row * OFFICE_GRID_COLUMNS + col;
}

export function isOfficeTileBlocked(point: OfficeGridPoint) {
  return OFFICE_COLLISION_GRID[point.row]?.[point.col] !== '1';
}

export function pixelToOfficeGrid(x: number, y: number): OfficeGridPoint {
  return {
    col: clamp(Math.floor(x / OFFICE_TILE_SIZE), 0, OFFICE_GRID_COLUMNS - 1),
    row: clamp(Math.floor(y / OFFICE_TILE_SIZE), 0, OFFICE_GRID_ROWS - 1),
  };
}

export function officeGridCenter(point: OfficeGridPoint) {
  return {
    x: point.col * OFFICE_TILE_SIZE + OFFICE_TILE_SIZE / 2,
    y: point.row * OFFICE_TILE_SIZE + OFFICE_TILE_SIZE / 2,
  };
}

/**
 * Returns the office-grid waypoints after the start tile. The destination tile
 * may be blocked because interaction points intentionally sit against desks and
 * furniture, matching the native scene's collision behavior.
 */
export function findOfficePath(
  startPoint: OfficeGridPoint,
  endPoint: OfficeGridPoint,
): OfficeGridPoint[] {
  const start = {
    col: clamp(startPoint.col, 0, OFFICE_GRID_COLUMNS - 1),
    row: clamp(startPoint.row, 0, OFFICE_GRID_ROWS - 1),
  };
  const end = {
    col: clamp(endPoint.col, 0, OFFICE_GRID_COLUMNS - 1),
    row: clamp(endPoint.row, 0, OFFICE_GRID_ROWS - 1),
  };

  if (start.col === end.col && start.row === end.row) return [];

  const startKey = gridKey(start.col, start.row);
  const endKey = gridKey(end.col, end.row);
  const heuristic = (col: number, row: number) =>
    Math.abs(col - end.col) + Math.abs(row - end.row);

  const startNode: SearchNode = {
    ...start,
    g: 0,
    f: heuristic(start.col, start.row),
    parent: null,
  };
  const openList: SearchNode[] = [startNode];
  const openMap = new Map<number, SearchNode>([[startKey, startNode]]);
  const closed = new Set<number>();

  while (openList.length > 0) {
    openList.sort((left, right) => left.f - right.f);
    const current = openList.shift()!;
    const currentKey = gridKey(current.col, current.row);
    openMap.delete(currentKey);

    if (currentKey === endKey) {
      const path: OfficeGridPoint[] = [];
      let node: SearchNode | null = current;
      while (node && gridKey(node.col, node.row) !== startKey) {
        path.unshift({ col: node.col, row: node.row });
        node = node.parent;
      }
      return path;
    }

    closed.add(currentKey);

    for (const direction of DIRECTIONS) {
      const col = current.col + direction.dc;
      const row = current.row + direction.dr;
      if (col < 0 || col >= OFFICE_GRID_COLUMNS || row < 0 || row >= OFFICE_GRID_ROWS) {
        continue;
      }

      const nextKey = gridKey(col, row);
      if (closed.has(nextKey)) continue;
      if (isOfficeTileBlocked({ col, row }) && nextKey !== endKey) continue;

      // Agents may walk diagonally through open floor, but never through the
      // corner where two pieces of furniture or walls meet.
      if (direction.dc !== 0 && direction.dr !== 0) {
        const horizontal = { col: current.col + direction.dc, row: current.row };
        const vertical = { col: current.col, row: current.row + direction.dr };
        if (isOfficeTileBlocked(horizontal) || isOfficeTileBlocked(vertical)) continue;
      }

      const g = current.g + direction.cost;
      const existing = openMap.get(nextKey);
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = g + heuristic(col, row);
          existing.parent = current;
        }
        continue;
      }

      const node: SearchNode = {
        col,
        row,
        g,
        f: g + heuristic(col, row),
        parent: current,
      };
      openList.push(node);
      openMap.set(nextKey, node);
    }
  }

  // Keep the native fallback: if malformed collision data ever disconnects a
  // destination, still let the agent reach it rather than freezing forever.
  return [end];
}

export function findOfficePathBetweenPixels(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) {
  return findOfficePath(
    pixelToOfficeGrid(startX, startY),
    pixelToOfficeGrid(endX, endY),
  );
}
