import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: { id: 'test-user' } as { id: string } | null,
  tier: null as 'standard' | 'premium' | 'pro' | null,
  loading: false,
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: state.user, signOut: vi.fn() }) }));
vi.mock('@/contexts/AdminModeContext', () => ({ useAdminMode: () => ({ adminModeEnabled: false }) }));
vi.mock('@/hooks/useRevenueCatWeb', () => ({ useRevenueCatWeb: () => ({ hasProAccess: state.tier === 'pro', loading: state.loading }) }));
vi.mock('./SettingsModal', () => ({ SettingsModal: () => null }));
vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { AppLayout } from './AppLayout';
import { SidebarProvider } from './ui/sidebar';

function render(defaultOpen = true) {
  return renderToStaticMarkup(React.createElement(MemoryRouter, {},
    React.createElement(SidebarProvider, { defaultOpen }, React.createElement(AppLayout))));
}

describe('account upgrade entry point', () => {
  beforeEach(() => { state.user = { id: 'test-user' }; state.tier = null; state.loading = false; });
  it.each([null, 'standard', 'premium'] as const)('offers the Pro checkout to the %s tier', tier => {
    state.tier = tier;
    expect(render()).toContain('href="/plans/tiers?tier=pro&amp;minimum=pro&amp;origin=tier_upgrade_pro"');
  });
  it('hides upgrades for both legacy and tiered Pro access', () => {
    state.tier = 'pro';
    expect(render()).not.toContain('aria-label="Upgrade to Pro"');
  });
  it('keeps the upgrade link accessible in the collapsed sidebar', () => {
    expect(render(false)).toContain('aria-label="Upgrade to Pro"');
  });
  it('waits for entitlement resolution', () => {
    state.loading = true;
    expect(render()).not.toContain('aria-label="Upgrade to Pro"');
  });
  it('hides the account upgrade action for signed-out visitors', () => {
    state.user = null;
    expect(render()).not.toContain('aria-label="Upgrade to Pro"');
  });
});
