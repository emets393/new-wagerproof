import { describe, expect, it } from 'vitest';
import { slateContextFacts, type NflSlateLine } from './hooks';

function row(overrides: Partial<NflSlateLine> = {}): NflSlateLine {
  return {
    home_ab: 'WAS',
    away_ab: 'NYG',
    fg_spread_close: -4,
    fg_total_close: 41.5,
    fg_ml_home_close: null,
    fg_ml_away_close: null,
    wx_indoors: false,
    wx_summary: '67°F, wind 12 mph',
    wx_temp_f: 67.5,
    wx_wind_mph: 12.1,
    wx_precip_mm: null,
    ...overrides,
  };
}

describe('slate context facts', () => {
  it('puts the market-implied score and the posted weather on the game strip', () => {
    const facts = slateContextFacts({ team: 'WAS', opponent: 'NYG', is_home: true }, [row()]);
    expect(facts).toEqual([
      { label: 'Team spread', value: 'WAS -4' },
      { label: 'Total', value: '41.5' },
      { label: 'Implied', value: 'NYG 18.8 · WAS 22.8' },
      { label: 'Weather', value: '67°F, wind 12 mph' },
    ]);
  });

  it('says indoors instead of a temperature when the roof is closed', () => {
    const facts = slateContextFacts(
      { team: 'WAS', opponent: 'NYG', is_home: true },
      [row({ wx_indoors: true, wx_summary: '72°F, wind 0 mph' })],
    );
    expect(facts.find((fact) => fact.label === 'Weather')?.value).toBe('Indoors');
  });
});
