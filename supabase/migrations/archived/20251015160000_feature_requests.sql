-- Create feature_requests table
CREATE TABLE IF NOT EXISTS public.feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  submitter_display_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'roadmap')),
  roadmap_status text CHECK (roadmap_status IN ('planned', 'in_progress', 'completed')),
  upvotes integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create feature_request_votes table
CREATE TABLE IF NOT EXISTS public.feature_request_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_request_id uuid REFERENCES public.feature_requests(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vote_type text NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(feature_request_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON public.feature_requests(status);
CREATE INDEX IF NOT EXISTS idx_feature_requests_submitted_by ON public.feature_requests(submitted_by);
CREATE INDEX IF NOT EXISTS idx_feature_request_votes_feature_id ON public.feature_request_votes(feature_request_id);
CREATE INDEX IF NOT EXISTS idx_feature_request_votes_user_id ON public.feature_request_votes(user_id);

-- Enable RLS
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_request_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feature_requests

-- Anyone can view approved or roadmap feature requests
CREATE POLICY "Anyone can view approved or roadmap feature requests"
  ON public.feature_requests
  FOR SELECT
  USING (status IN ('approved', 'roadmap'));

-- Admins can view all feature requests (including pending)
CREATE POLICY "Admins can view all feature requests"
  ON public.feature_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Authenticated users can insert feature requests
CREATE POLICY "Authenticated users can submit feature requests"
  ON public.feature_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- Admins can update feature requests (for approval, status changes, etc.)
CREATE POLICY "Admins can update feature requests"
  ON public.feature_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can delete feature requests
CREATE POLICY "Admins can delete feature requests"
  ON public.feature_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for feature_request_votes

-- Anyone can view votes
CREATE POLICY "Anyone can view votes"
  ON public.feature_request_votes
  FOR SELECT
  USING (true);

-- Authenticated users can insert their own votes
CREATE POLICY "Authenticated users can vote"
  ON public.feature_request_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own votes
CREATE POLICY "Users can update their own votes"
  ON public.feature_request_votes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own votes
CREATE POLICY "Users can delete their own votes"
  ON public.feature_request_votes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Function to update vote counts when votes are added/removed/updated
CREATE OR REPLACE FUNCTION public.update_feature_request_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment the appropriate vote count
    IF NEW.vote_type = 'upvote' THEN
      UPDATE public.feature_requests
      SET upvotes = upvotes + 1, updated_at = now()
      WHERE id = NEW.feature_request_id;
    ELSE
      UPDATE public.feature_requests
      SET downvotes = downvotes + 1, updated_at = now()
      WHERE id = NEW.feature_request_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Adjust vote counts if vote type changed
    IF OLD.vote_type != NEW.vote_type THEN
      IF NEW.vote_type = 'upvote' THEN
        UPDATE public.feature_requests
        SET upvotes = upvotes + 1, downvotes = downvotes - 1, updated_at = now()
        WHERE id = NEW.feature_request_id;
      ELSE
        UPDATE public.feature_requests
        SET upvotes = upvotes - 1, downvotes = downvotes + 1, updated_at = now()
        WHERE id = NEW.feature_request_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement the appropriate vote count
    IF OLD.vote_type = 'upvote' THEN
      UPDATE public.feature_requests
      SET upvotes = upvotes - 1, updated_at = now()
      WHERE id = OLD.feature_request_id;
    ELSE
      UPDATE public.feature_requests
      SET downvotes = downvotes - 1, updated_at = now()
      WHERE id = OLD.feature_request_id;
    END IF;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for vote count updates
DROP TRIGGER IF EXISTS feature_request_vote_counts_trigger ON public.feature_request_votes;
CREATE TRIGGER feature_request_vote_counts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.feature_request_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_feature_request_vote_counts();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_feature_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS feature_request_updated_at_trigger ON public.feature_requests;
CREATE TRIGGER feature_request_updated_at_trigger
  BEFORE UPDATE ON public.feature_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_feature_request_updated_at();

