-- Create community_picks table for user-submitted betting picks
CREATE TABLE IF NOT EXISTS public.community_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport text NOT NULL,
  is_native_pick boolean NOT NULL DEFAULT false,
  game_id text,
  team_name text NOT NULL,
  pick_type text NOT NULL CHECK (pick_type IN ('moneyline', 'spread', 'over', 'under')),
  pick_details text NOT NULL,
  reasoning text,
  game_date date NOT NULL,
  opponent_team text,
  upvotes integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  outcome text CHECK (outcome IN ('win', 'loss', 'push')),
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create community_pick_votes table for tracking user votes
CREATE TABLE IF NOT EXISTS public.community_pick_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id uuid NOT NULL REFERENCES public.community_picks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type text NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pick_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_community_picks_user_id ON public.community_picks(user_id);
CREATE INDEX IF NOT EXISTS idx_community_picks_sport ON public.community_picks(sport);
CREATE INDEX IF NOT EXISTS idx_community_picks_game_date ON public.community_picks(game_date);
CREATE INDEX IF NOT EXISTS idx_community_picks_outcome ON public.community_picks(outcome);
CREATE INDEX IF NOT EXISTS idx_community_picks_is_locked ON public.community_picks(is_locked);
CREATE INDEX IF NOT EXISTS idx_community_pick_votes_pick_id ON public.community_pick_votes(pick_id);
CREATE INDEX IF NOT EXISTS idx_community_pick_votes_user_id ON public.community_pick_votes(user_id);

-- Enable RLS
ALTER TABLE public.community_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_pick_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for community_picks
-- Anyone authenticated can view all picks
CREATE POLICY "Anyone can view community picks"
  ON public.community_picks
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can create their own picks
CREATE POLICY "Users can create their own picks"
  ON public.community_picks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own picks (if not locked)
CREATE POLICY "Users can update their own picks"
  ON public.community_picks
  FOR UPDATE
  USING (auth.uid() = user_id AND is_locked = false);

-- Admins can update any pick
CREATE POLICY "Admins can update any pick"
  ON public.community_picks
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can delete their own picks
CREATE POLICY "Users can delete their own picks"
  ON public.community_picks
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can delete any pick
CREATE POLICY "Admins can delete any pick"
  ON public.community_picks
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for community_pick_votes
-- Anyone can view all votes
CREATE POLICY "Anyone can view votes"
  ON public.community_pick_votes
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can create votes
CREATE POLICY "Users can create votes"
  ON public.community_pick_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own votes
CREATE POLICY "Users can update their own votes"
  ON public.community_pick_votes
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own votes
CREATE POLICY "Users can delete their own votes"
  ON public.community_pick_votes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_community_picks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
CREATE TRIGGER community_picks_updated_at
BEFORE UPDATE ON public.community_picks
FOR EACH ROW
EXECUTE FUNCTION update_community_picks_updated_at();

-- Create function to update vote counts on community_picks
CREATE OR REPLACE FUNCTION update_community_pick_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'upvote' THEN
      UPDATE public.community_picks SET upvotes = upvotes + 1 WHERE id = NEW.pick_id;
    ELSIF NEW.vote_type = 'downvote' THEN
      UPDATE public.community_picks SET downvotes = downvotes + 1 WHERE id = NEW.pick_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.vote_type = 'upvote' AND NEW.vote_type = 'downvote' THEN
      UPDATE public.community_picks SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = NEW.pick_id;
    ELSIF OLD.vote_type = 'downvote' AND NEW.vote_type = 'upvote' THEN
      UPDATE public.community_picks SET downvotes = downvotes - 1, upvotes = upvotes + 1 WHERE id = NEW.pick_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'upvote' THEN
      UPDATE public.community_picks SET upvotes = upvotes - 1 WHERE id = OLD.pick_id;
    ELSIF OLD.vote_type = 'downvote' THEN
      UPDATE public.community_picks SET downvotes = downvotes - 1 WHERE id = OLD.pick_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update vote counts
CREATE TRIGGER community_pick_vote_counts
AFTER INSERT OR UPDATE OR DELETE ON public.community_pick_votes
FOR EACH ROW
EXECUTE FUNCTION update_community_pick_vote_counts();

-- Add comments
COMMENT ON TABLE public.community_picks IS 'User-submitted betting picks for community voting';
COMMENT ON TABLE public.community_pick_votes IS 'User votes on community picks';



