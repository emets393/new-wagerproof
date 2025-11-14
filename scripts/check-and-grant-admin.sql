-- Check and Grant Admin Access for Today in Sports System Prompt Updates
-- Run this in Supabase SQL Editor

-- STEP 1: Check your current admin status
SELECT 
  au.email,
  au.id as user_id,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = au.id AND ur.role = 'admin'
    ) THEN '✅ HAS ADMIN ROLE'
    ELSE '❌ NO ADMIN ROLE - Run STEP 2 to grant'
  END as admin_status
FROM auth.users au
WHERE au.id = auth.uid();

-- STEP 2: If you don't have admin role, uncomment and run this:
-- (Make sure to run STEP 1 first to get your user info)

/*
INSERT INTO public.user_roles (user_id, role)
VALUES (auth.uid(), 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;
*/

-- STEP 3: Verify admin role was granted (run STEP 1 again)

-- STEP 4: Test that you can now read the today_in_sports schedule
SELECT 
  sport_type,
  enabled,
  scheduled_time,
  LENGTH(system_prompt) as prompt_length,
  SUBSTRING(system_prompt, 1, 100) as prompt_preview
FROM ai_page_level_schedules
WHERE sport_type = 'today_in_sports';

