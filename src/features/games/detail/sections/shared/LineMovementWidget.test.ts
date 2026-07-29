import { describe, expect, it } from 'vitest';
import { lineChartScale, lineChartWidth } from './LineMovementWidget';
import type { LineValueFormat } from './lineMovement';

const isMultipleOf = (value: number, step: number) =>
  Math.abs(value / step - Math.round(value / step)) < 1e-9;

describe('line movement chart layout', () => {
  it('keeps sparse snapshots close together and grows with the series', () => {
    expect(lineChartWidth(2)).toBe(340);
    expect(lineChartWidth(3)).toBe(460);
    expect(lineChartWidth(8)).toBe(1060);
  });
});

describe('lineChartScale', () => {
  it('zooms around the movement instead of anchoring to zero', () => {
    // ULM +28.5 -> +29. A zero-based axis flattens this against the top.
    const { domain } = lineChartScale([28.5, 29], 'signed');
    expect(domain[0]).toBeGreaterThan(20);
    expect(domain[1]).toBeLessThan(40);
  });

  it('only ever ticks on half-points for spreads and totals', () => {
    const cases: Array<[number[], LineValueFormat]> = [
      [[28.5, 29], 'signed'],
      [[-28.5, -29], 'signed'],
      [[51.5, 52.5], 'unsigned'],
      [[-3.5, -4, -4.5, -7], 'signed'],
      [[44.5, 51], 'unsigned'],
      [[-1.5, 13.5], 'signed'],
    ];

    for (const [values, format] of cases) {
      const { ticks } = lineChartScale(values, format);
      expect(ticks.length).toBeGreaterThan(1);
      for (const tick of ticks) {
        expect(isMultipleOf(tick, 0.5), `${tick} is not a legal ${format} line`).toBe(true);
      }
    }
  });

  it('never ticks inside the American dead zone', () => {
    // No book prices anything strictly between -100 and +100.
    const cases: number[][] = [
      [-7000, 2000],
      [-110, 120],
      [-105, -102],
      [105, 130],
      [-200, 175],
    ];

    for (const values of cases) {
      const { ticks } = lineChartScale(values, 'american');
      expect(ticks.length).toBeGreaterThan(1);
      for (const tick of ticks) {
        expect(tick > -100 && tick < 100, `${tick} is not a payable price`).toBe(false);
        expect(isMultipleOf(tick, 5), `${tick} is not a legal price increment`).toBe(true);
      }
    }
  });

  it('does not pad a favorite past even money', () => {
    // -110 sits close to the boundary; padding must stop at -100.
    const { domain, ticks } = lineChartScale([-110, -115], 'american');
    expect(domain[1]).toBeLessThanOrEqual(-100);
    expect(ticks).toContain(-110);
  });

  it('keeps every data point inside the domain', () => {
    const cases: Array<[number[], LineValueFormat]> = [
      [[28.5, 29], 'signed'],
      [[-110, 120], 'american'],
      [[-7000, 2000], 'american'],
      [[51.5, 52.5], 'unsigned'],
      [[-100, -100], 'american'],
    ];

    for (const [values, format] of cases) {
      const { domain } = lineChartScale(values, format);
      expect(domain[0]).toBeLessThanOrEqual(Math.min(...values));
      expect(domain[1]).toBeGreaterThanOrEqual(Math.max(...values));
    }
  });

  it('caps tick count so a wide series stays readable', () => {
    for (const values of [[-3.5, -14], [44.5, 62], [-2000, 1500]] as number[][]) {
      const format: LineValueFormat = values[0]! < -1000 ? 'american' : 'signed';
      expect(lineChartScale(values, format).ticks.length).toBeLessThanOrEqual(8);
    }
  });

  it('gives a flat series a readable band rather than a zero-height axis', () => {
    const { domain, ticks } = lineChartScale([-27.5, -27.5], 'signed');
    expect(domain[1]).toBeGreaterThan(domain[0]);
    expect(ticks).toContain(-27.5);
  });
});
