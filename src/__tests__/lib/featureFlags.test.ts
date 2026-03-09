import { describe, it, expect } from 'vitest';
import { SHOW_WEBSITE_TAILING_FEATURES } from '@/lib/featureFlags';

describe('featureFlags', () => {
  describe('SHOW_WEBSITE_TAILING_FEATURES', () => {
    it('is a boolean', () => {
      expect(typeof SHOW_WEBSITE_TAILING_FEATURES).toBe('boolean');
    });

    it('is currently set to false', () => {
      expect(SHOW_WEBSITE_TAILING_FEATURES).toBe(false);
    });
  });
});
