-- 1) Add onboarding fields to profiles (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_data JSONB;

-- 2) Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3) Allow each user to SELECT their own profile (idempotent via drop+create)
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
CREATE POLICY "Users can view their own profile."
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- 4) Allow each user to UPDATE their own profile (idempotent via drop+create)
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile."
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

### Instructions for Use

1.  Navigate to the **SQL Editor** in your Supabase project dashboard.
2.  Copy and paste the entire script into a new query window.
3.  Click **Run**.

After executing the script, you should regenerate your Supabase types to ensure your application's TypeScript definitions are up-to-date with the new schema.

**Local Type Generation (after `supabase login`):**
```bash
npx supabase gen types typescript --project-id <YOUR_PROJECT_ID> --schema public > src/integrations/supabase/types.ts
```
