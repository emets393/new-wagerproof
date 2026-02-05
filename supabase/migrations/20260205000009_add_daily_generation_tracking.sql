-- Add daily generation tracking columns to avatar_profiles
ALTER TABLE avatar_profiles
  ADD COLUMN IF NOT EXISTS daily_generation_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_generation_date date;
