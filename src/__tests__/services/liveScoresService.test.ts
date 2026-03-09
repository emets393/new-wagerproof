import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase before importing the service
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true, liveGames: 5 }, error: null }),
    },
  },
}));

vi.mock('@/integrations/supabase/college-football-client', () => ({
  collegeFootballSupabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  },
}));

vi.mock('@/utils/debug', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

import { getLiveScores, refreshLiveScores, checkIfRefreshNeeded } from '@/services/liveScoresService';
import { supabase } from '@/integrations/supabase/client';

describe('liveScoresService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLiveScores', () => {
    it('returns an array', async () => {
      const result = await getLiveScores();
      expect(Array.isArray(result)).toBe(true);
    });

    it('calls supabase with correct filters', async () => {
      await getLiveScores();
      expect(supabase.from).toHaveBeenCalledWith('live_scores');
    });

    it('returns empty array on error', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: { message: 'error' } }),
            }),
          }),
        }),
      } as any);

      const result = await getLiveScores();
      expect(result).toEqual([]);
    });
  });

  describe('refreshLiveScores', () => {
    it('returns success status', async () => {
      const result = await refreshLiveScores();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('liveGames');
    });

    it('calls the edge function', async () => {
      await refreshLiveScores();
      expect(supabase.functions.invoke).toHaveBeenCalledWith('fetch-live-scores');
    });

    it('handles errors gracefully', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: { message: 'Function error' },
      } as any);

      const result = await refreshLiveScores();
      expect(result.success).toBe(false);
      expect(result.liveGames).toBe(0);
    });
  });

  describe('checkIfRefreshNeeded', () => {
    it('returns a boolean', async () => {
      // Need to mock the chain for checkIfRefreshNeeded
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [{ last_updated: new Date().toISOString() }], error: null }),
          }),
        }),
      } as any);

      const result = await checkIfRefreshNeeded();
      expect(typeof result).toBe('boolean');
    });

    it('returns true when no recent data', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      } as any);

      const result = await checkIfRefreshNeeded();
      expect(result).toBe(true);
    });

    it('returns false when recent data exists', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ last_updated: new Date().toISOString() }],
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await checkIfRefreshNeeded();
      expect(result).toBe(false);
    });

    it('returns true on error (conservative approach)', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'error' } }),
          }),
        }),
      } as any);

      const result = await checkIfRefreshNeeded();
      expect(result).toBe(true);
    });
  });
});
