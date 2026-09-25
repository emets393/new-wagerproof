import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import AccessDenied from './AccessDenied';
import PaywallTest from './PaywallTest';

const routing = vi.hoisted(() => ({
  location: { search: '?tier=premium&period=yearly&minimum=premium&origin=generic_feature', hash: '#plans' },
  navigate: vi.fn((_props: { to: string; replace: boolean }) => null),
}));
vi.mock('react-router-dom', () => ({
  useLocation: () => routing.location,
  Navigate: routing.navigate,
}));
vi.mock('@/features/tieredPaywall/TieredPlansPage', () => ({
  default: () => 'Current tiered checkout',
}));

describe('legacy web paywall entry points', () => {
  it('replaces old links with tiered checkout while preserving selection and attribution', () => {
    renderToStaticMarkup(createElement(AccessDenied));
    expect(routing.navigate.mock.calls[0][0]).toEqual({
      to: '/plans/tiers?tier=premium&period=yearly&minimum=premium&origin=generic_feature#plans',
      replace: true,
    });
  });

  it('previews the current tiered checkout on the admin test page', () => {
    expect(renderToStaticMarkup(createElement(PaywallTest))).toBe('Current tiered checkout');
  });
});
