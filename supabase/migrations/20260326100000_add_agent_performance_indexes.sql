-- Performance indexes for agent queries
-- These cover the most common query patterns in agentPicksService and agentPerformanceService

-- avatar_picks filtered by (avatar_id, game_date) — used by fetchTodaysPicks and widget service
CREATE INDEX IF NOT EXISTS idx_avatar_picks_avatar_game_date
  ON avatar_picks (avatar_id, game_date DESC);

-- avatar_picks filtered by (avatar_id, result) with ORDER BY game_date — used by fetchPendingPicks, fetchAgentPicks
CREATE INDEX IF NOT EXISTS idx_avatar_picks_avatar_result_date
  ON avatar_picks (avatar_id, result, game_date DESC, created_at DESC);

-- agent_generation_runs filtered by (avatar_id, target_date, status) — used by fetchTodaysGenerationRun
CREATE INDEX IF NOT EXISTS idx_agent_gen_runs_avatar_date_status
  ON agent_generation_runs (avatar_id, target_date, status);

-- user_avatar_follows filtered by (user_id, is_favorite) — used by useFavoriteAgentIds
CREATE INDEX IF NOT EXISTS idx_user_avatar_follows_user_fav
  ON user_avatar_follows (user_id, is_favorite) WHERE is_favorite = true;
