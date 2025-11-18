
-- Create user_wins table
CREATE TABLE IF NOT EXISTS public.user_wins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT,
    is_public BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add show_user_wins_section to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS show_user_wins_section BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE public.user_wins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_wins
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own wins" ON public.user_wins;
DROP POLICY IF EXISTS "Users can view their own wins" ON public.user_wins;
DROP POLICY IF EXISTS "Public can view featured wins" ON public.user_wins;
DROP POLICY IF EXISTS "Admins can do everything with user_wins" ON public.user_wins;

-- Users can insert their own wins
CREATE POLICY "Users can insert their own wins" 
ON public.user_wins FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Users can view their own wins
CREATE POLICY "Users can view their own wins" 
ON public.user_wins FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Public can view featured wins (for landing page display)
CREATE POLICY "Public can view featured wins" 
ON public.user_wins FOR SELECT 
TO anon, authenticated 
USING (is_featured = true);

-- Admins can do everything (select, update, delete)
CREATE POLICY "Admins can do everything with user_wins" 
ON public.user_wins FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Storage policies (assuming 'user-wins' bucket needs to be created)
-- Note: Creating buckets via SQL works if the storage extension is active and schemas are set up.
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-wins', 'user-wins', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Public Access user-wins" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload user-wins" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own user-wins images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own user-wins images" ON storage.objects;

-- Public read access for featured wins
CREATE POLICY "Public Access user-wins"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'user-wins' );

-- Authenticated users can upload to their own folder
-- Path format: {user_id}/{filename}
CREATE POLICY "Authenticated users can upload user-wins"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( 
  bucket_id = 'user-wins' AND 
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Users can update their own images
CREATE POLICY "Users can update their own user-wins images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( 
  bucket_id = 'user-wins' AND 
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Users can delete their own images
CREATE POLICY "Users can delete their own user-wins images"
ON storage.objects FOR DELETE
TO authenticated
USING ( 
  bucket_id = 'user-wins' AND 
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

