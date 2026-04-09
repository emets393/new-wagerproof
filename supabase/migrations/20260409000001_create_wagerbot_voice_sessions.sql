-- Rate-limiting table for WagerBot Voice sessions.
-- Mirrors Honeydew's Firestore roast_chef_sessions collection.
-- Max 20 sessions per user per 24-hour rolling window.

CREATE TABLE IF NOT EXISTS wagerbot_voice_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice text NOT NULL DEFAULT 'marin',
  rudeness text NOT NULL DEFAULT 'friendly',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for the rate-limit query: user + recent sessions
CREATE INDEX IF NOT EXISTS idx_wagerbot_voice_sessions_user_created
  ON wagerbot_voice_sessions (user_id, created_at DESC);

-- RLS: users can read their own sessions, inserts handled by service role
ALTER TABLE wagerbot_voice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own voice sessions"
  ON wagerbot_voice_sessions FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE wagerbot_voice_sessions IS
  'Tracks WagerBot Voice sessions for rate limiting (20/day per user).';
