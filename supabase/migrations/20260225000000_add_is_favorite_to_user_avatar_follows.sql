-- Add is_favorite column to user_avatar_follows
-- Allows users to favorite followed agents (separate from just following)
-- Combined with avatar_profiles.is_widget_favorite for own agents, powers the "Favorites" filter in the Feed

ALTER TABLE user_avatar_follows
ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
