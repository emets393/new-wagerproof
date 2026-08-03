import { describe, expect, it } from 'vitest';
import {
  findOfficePath,
  isOfficeTileBlocked,
  pixelToOfficeGrid,
  type OfficeGridPoint,
} from './agentHQPathfinding';

describe('Agent HQ office pathfinding', () => {
  it('routes between distant office points without walking through blocked tiles', () => {
    const start = pixelToOfficeGrid(48, 128);
    const end = pixelToOfficeGrid(368, 672);
    const path = findOfficePath(start, end);

    expect(path.length).toBeGreaterThan(1);
    expect(path.at(-1)).toEqual(end);
    expect(path.every((point) => !isOfficeTileBlocked(point))).toBe(true);
  });

  it('allows an interaction point on furniture only as the final step', () => {
    const start = pixelToOfficeGrid(688, 192);
    const end = pixelToOfficeGrid(112, 544);
    const path = findOfficePath(start, end);

    expect(isOfficeTileBlocked(end)).toBe(true);
    expect(path.at(-1)).toEqual(end);
    expect(path.slice(0, -1).every((point) => !isOfficeTileBlocked(point))).toBe(true);
  });

  it('does not cut diagonally through blocked corners', () => {
    const start = pixelToOfficeGrid(48, 128);
    const end = pixelToOfficeGrid(720, 608);
    const path = findOfficePath(start, end);
    const steps: OfficeGridPoint[] = [start, ...path];

    for (let index = 1; index < steps.length; index += 1) {
      const previous = steps[index - 1];
      const current = steps[index];
      const dc = current.col - previous.col;
      const dr = current.row - previous.row;

      expect(Math.abs(dc)).toBeLessThanOrEqual(1);
      expect(Math.abs(dr)).toBeLessThanOrEqual(1);

      if (dc !== 0 && dr !== 0) {
        expect(isOfficeTileBlocked({ col: previous.col + dc, row: previous.row })).toBe(false);
        expect(isOfficeTileBlocked({ col: previous.col, row: previous.row + dr })).toBe(false);
      }
    }
  });
});
