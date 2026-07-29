import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTHENTICATED_ROUTE, PAYWALL_ROUTE } from './routes';

describe('website access routes', () => {
  it('keeps the paywall and post-auth destinations centralized', () => {
    expect(PAYWALL_ROUTE).toBe('/access-denied');
    expect(DEFAULT_AUTHENTICATED_ROUTE).toBe('/today-in-sports');
  });
});
