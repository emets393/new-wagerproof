-- Add blocks column to chat_messages for ContentBlock-based storage.
-- The old `content` column is kept for backwards compatibility — the edge
-- function writes both fields. The mobile app reads `blocks` first, falling
-- back to `content` for legacy messages.

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS blocks JSONB;

-- Index for faster thread message loading
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created
  ON chat_messages (thread_id, created_at ASC);

-- Optional: configurable chat prompts table for remote prompt management
CREATE TABLE IF NOT EXISTS wagerbot_chat_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  system_prompt TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gpt-4o',
  tools_enabled TEXT[] NOT NULL DEFAULT '{}',
  max_turns INTEGER NOT NULL DEFAULT 8,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for wagerbot_chat_prompts (read-only for all authenticated users)
ALTER TABLE wagerbot_chat_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active prompts"
  ON wagerbot_chat_prompts FOR SELECT
  TO authenticated
  USING (is_active = true);
