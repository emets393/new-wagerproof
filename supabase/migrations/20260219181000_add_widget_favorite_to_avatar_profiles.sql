-- Add widget favorite flag for agent selection in iOS Top Agents widget
ALTER TABLE public.avatar_profiles
ADD COLUMN IF NOT EXISTS is_widget_favorite boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_avatar_profiles_widget_favorite
ON public.avatar_profiles(user_id, is_widget_favorite, is_active);
