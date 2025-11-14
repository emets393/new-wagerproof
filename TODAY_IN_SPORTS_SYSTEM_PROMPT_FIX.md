# Today in Sports - System Prompt & Discord Thread Fix

## Issues Fixed

### 1. Discord Thread ID Updated ✅
**Problem**: Messages were being sent to the old general channel instead of the dedicated Today in Sports thread.

**Solution**: Updated the Discord thread ID in `/supabase/functions/send-discord-notification/index.ts`:
- **Old**: `1428416705171951821` (general channel)
- **New**: `1437548685205700846` (Today in Sports thread)

**Status**: ✅ Deployed to Supabase

### 2. System Prompt Debugging Added ✅
**Problem**: System prompt updates from admin panel weren't being reflected in the generated content.

**Solution**: Added comprehensive debugging logs in `/supabase/functions/generate-today-in-sports-completion/index.ts`:
- Logs schedule configuration when retrieved
- Shows system prompt length and preview
- Displays full system prompt being used

**Status**: ✅ Deployed to Supabase

### 3. Admin Permission Requirement Identified ⚠️
**Problem**: The `ai_page_level_schedules` table requires admin role to update due to RLS policy:
```sql
CREATE POLICY "Admins can manage schedules"
  ON ai_page_level_schedules FOR ALL
  USING (has_role(auth.uid(), 'admin'));
```

**Solution**: Verify you have admin role in the database.

## How to Verify Admin Access

Run this in your Supabase SQL Editor:

```sql
-- Check if your current user has admin role
SELECT 
  au.email,
  au.id as user_id,
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = au.id AND ur.role = 'admin'
  ) as has_admin_role
FROM auth.users au
WHERE au.id = auth.uid();
```

## If You DON'T Have Admin Role

Grant yourself admin access:

```sql
-- Replace with your actual email or user_id
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'your-email@example.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

## Testing the Fixes

### 1. Test System Prompt Update
1. Go to `/admin` → AI Settings → Today in Sports tab
2. Update the system prompt
3. Click "Save System Prompt"
4. You should see a success toast
5. Click "Test Generate Completion"
6. Check the edge function logs in Supabase Dashboard → Edge Functions → `generate-today-in-sports-completion`
7. Look for these debug logs:
   ```
   Schedule configuration retrieved: {
     enabled: true,
     system_prompt_length: XXX,
     system_prompt_preview: "Your system prompt..."
   }
   System prompt being used: [full prompt]
   ```

### 2. Test Discord Thread
1. In the admin panel, click "Test Send to Discord"
2. Check the Discord thread ID `1437548685205700846`
3. You should see the test message appear in that thread

### 3. Monitor Edge Function Logs
View logs in Supabase Dashboard:
- https://supabase.com/dashboard/project/gnjrklxotmbvnxbnnqgq/functions
- Click on `generate-today-in-sports-completion` to see generation logs
- Click on `send-discord-notification` to see Discord posting logs

## What Changed in the Code

### File: `supabase/functions/send-discord-notification/index.ts`
```typescript
// Line 67 - Updated Discord thread ID
const channelId = '1437548685205700846'; // Today in Sports thread ID
```

### File: `supabase/functions/generate-today-in-sports-completion/index.ts`
```typescript
// Lines 93-97 - Added schedule configuration logging
console.log('Schedule configuration retrieved:', {
  enabled: schedule.enabled,
  system_prompt_length: schedule.system_prompt?.length || 0,
  system_prompt_preview: schedule.system_prompt?.substring(0, 100) || 'NO PROMPT'
});

// Line 117 - Added full system prompt logging
console.log('System prompt being used:', schedule.system_prompt || 'NO SYSTEM PROMPT');
```

## Deployment Status

Both edge functions have been successfully deployed:
- ✅ `send-discord-notification` - Deployed with new thread ID
- ✅ `generate-today-in-sports-completion` - Deployed with debugging logs

## Next Steps

1. **Verify Admin Access**: Run the SQL query above to check if you have admin role
2. **Grant Access if Needed**: Use the INSERT query if you don't have admin role
3. **Test System Prompt Save**: Try saving a system prompt update in the admin panel
4. **Test Generation**: Generate a completion and check the logs
5. **Test Discord**: Send a test message to verify it goes to the correct thread
6. **Monitor Cron Job**: The next automatic generation at 10 AM CST should:
   - Use your updated system prompt
   - Post to the correct Discord thread ID

## Troubleshooting

### "Failed to save system prompt"
- **Cause**: No admin role assigned to your user
- **Fix**: Run the admin role grant SQL query above

### "System prompt still not being used"
- **Cause**: Edge function might be caching or not redeployed
- **Fix**: Check the edge function logs for the debug output showing the system prompt being used

### "Discord message not appearing in thread"
- **Cause**: Bot might not have access to the thread, or thread ID is incorrect
- **Fix**: 
  - Verify thread ID is `1437548685205700846`
  - Check bot has permissions for that thread
  - Check edge function logs for errors

## Database Schema Reference

### Table: `ai_page_level_schedules`
- `sport_type`: Must be 'today_in_sports' for this feature
- `system_prompt`: The prompt text used for AI generation
- `enabled`: Whether automation is active
- `scheduled_time`: When the cron job runs (10:00:00 = 10 AM CST)

### RLS Policy
Only users with `admin` role in `user_roles` table can update this table.

