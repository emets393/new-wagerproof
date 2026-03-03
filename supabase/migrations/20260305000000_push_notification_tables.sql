-- =============================================================================
-- Push Notification Tables for Agent Auto-Pick Notifications
-- =============================================================================
-- Creates 3 tables:
-- 1. user_push_tokens — Expo push token registration
-- 2. user_notification_preferences — Per-user notification opt-out
-- 3. sent_push_notifications — Audit log / dedupe guard
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table 1: user_push_tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  platform text CHECK (platform IN ('ios', 'android')),
  device_name text,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_push_token UNIQUE (user_id, expo_push_token)
);

CREATE INDEX idx_push_tokens_user_active
  ON public.user_push_tokens (user_id) WHERE is_active = true;

DROP TRIGGER IF EXISTS user_push_tokens_updated_at ON public.user_push_tokens;
CREATE TRIGGER user_push_tokens_updated_at
  BEFORE UPDATE ON public.user_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Table 2: user_notification_preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_pick_ready boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS user_notification_preferences_updated_at ON public.user_notification_preferences;
CREATE TRIGGER user_notification_preferences_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Table 3: sent_push_notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sent_push_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.agent_generation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL DEFAULT 'auto_pick_ready',
  status text NOT NULL CHECK (status IN ('sent', 'partially_sent', 'failed', 'skipped')),
  skip_reason text,
  tokens_attempted integer NOT NULL DEFAULT 0,
  tokens_succeeded integer NOT NULL DEFAULT 0,
  tokens_failed integer NOT NULL DEFAULT 0,
  expo_response jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_sent_notification UNIQUE (run_id, user_id, notification_type)
);

CREATE INDEX idx_sent_notifications_run ON public.sent_push_notifications (run_id);

-- ---------------------------------------------------------------------------
-- RLS: user_push_tokens — owner read/write
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own push tokens"
  ON public.user_push_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push tokens"
  ON public.user_push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push tokens"
  ON public.user_push_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RLS: user_notification_preferences — owner read/write
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notification preferences"
  ON public.user_notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own notification preferences"
  ON public.user_notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON public.user_notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RLS: sent_push_notifications — service-role only + admin read
-- ---------------------------------------------------------------------------
ALTER TABLE public.sent_push_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sent notifications"
  ON public.sent_push_notifications FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
