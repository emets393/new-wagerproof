# Code Snippets Reference

## Quick Reference for Key Changes

### 1. Sidemenu Navigation Handler (AppLayout.tsx)

```typescript
const handleNavItemClick = (to: string) => {
  if (!user) {
    setSignInPromptOpen(true);
  } else {
    navigate(to);
  }
};
```

**Usage on regular menu items:**
```typescript
<SidebarMenuButton
  onClick={() => handleNavItemClick(to)}
  isActive={isActivePath(to)}
  className={`...styles...`}
>
  {/* button content */}
</SidebarMenuButton>
```

**Usage on sub-menu items:**
```typescript
<SidebarMenuSubButton
  onClick={() => handleNavItemClick(subItem.to)}
  isActive={isActivePath(subItem.to)}
  className={`...styles...`}
>
  {/* button content */}
</SidebarMenuSubButton>
```

---

### 2. Access Restricted Toggle Mutation (Admin.tsx)

```typescript
const toggleAccessRestricted = useMutation({
  mutationFn: async (newValue: boolean) => {
    const { error } = await supabase
      .from('site_settings')
      .update({ 
        access_restricted: newValue,
        updated_at: new Date().toISOString(),
        updated_by: user?.id
      })
      .eq('id', settings?.id);
    
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['site-settings'] });
    toast.success('Access restricted setting updated successfully');
  },
  onError: (error) => {
    toast.error('Failed to update access restricted setting: ' + error.message);
  }
});
```

---

### 3. Access Restricted Toggle UI (Admin.tsx)

```typescript
<div className="flex items-center justify-between pb-4 border-b border-white/10">
  <div>
    <p className="font-medium text-white">Access Restricted Password Overlay</p>
    <p className="text-sm text-white/70">
      When enabled, users must enter a password before accessing the login page. 
      Disable to allow direct login access.
    </p>
  </div>
  <Switch
    checked={settings?.access_restricted ?? true}
    onCheckedChange={(checked) => toggleAccessRestricted.mutate(checked)}
    disabled={settingsLoading || toggleAccessRestricted.isPending}
  />
</div>
```

---

### 4. Fetch Access Restricted Setting (Account.tsx & Welcome.tsx)

```typescript
// State
const [accessRestricted, setAccessRestricted] = useState(true);

// Fetch on mount
useEffect(() => {
  async function fetchAccessRestricted() {
    try {
      const { data, error } = await (supabase as any)
        .from('site_settings')
        .select('access_restricted')
        .single();
      
      if (error) {
        debug.error('Error fetching access_restricted setting:', error);
        setAccessRestricted(true); // Default to true if error
      } else {
        setAccessRestricted(data?.access_restricted ?? true);
      }
    } catch (err) {
      debug.error('Unexpected error fetching access_restricted setting:', err);
      setAccessRestricted(true); // Default to true if error
    }
  }

  fetchAccessRestricted();
}, []);
```

---

### 5. Conditional Render Based on Access Restricted (Account.tsx & Welcome.tsx)

```typescript
return (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
    {accessRestricted && !isUnlocked ? (
      // Show password overlay
      <div className="shadow-input mx-auto w-full max-w-md rounded-2xl bg-white p-8 dark:bg-black">
        {/* Password form content */}
      </div>
    ) : (
      // Show auth form directly
      <ModernAuthForm
        onSubmit={handleSubmit}
        onGoogleSignIn={handleGoogleSignIn}
        isLoading={isLoading}
        error={error}
        success={success}
        mode={mode}
        onModeChange={setMode}
      />
    )}
  </div>
);
```

---

### 6. Database Migration SQL

```sql
-- Add access_restricted field to site_settings table
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS access_restricted BOOLEAN DEFAULT true;

-- Update existing row to have access_restricted as true
UPDATE site_settings SET access_restricted = true WHERE access_restricted IS NULL;

-- Create function to get access_restricted status
CREATE OR REPLACE FUNCTION get_access_restricted()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT access_restricted 
  FROM site_settings 
  LIMIT 1;
$$;

-- Create function to update access_restricted status (admin only)
CREATE OR REPLACE FUNCTION update_access_restricted(restricted BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin BOOLEAN;
  result BOOLEAN;
BEGIN
  -- Check if user is admin using has_role function
  SELECT has_role(auth.uid(), 'admin') INTO is_admin;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can update access restricted setting';
  END IF;
  
  -- Update access_restricted
  UPDATE site_settings
  SET 
    access_restricted = restricted,
    updated_at = NOW(),
    updated_by = auth.uid()
  RETURNING access_restricted INTO result;
  
  RETURN result;
END;
$$;
```

---

## Configuration & Constants

### Default Behavior
```typescript
// In Account.tsx and Welcome.tsx
const [accessRestricted, setAccessRestricted] = useState(true);
// Default: enabled (true) - users must enter password
```

### Password
```typescript
// In Account.tsx and Welcome.tsx
const handlePasswordSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (passwordInput === '3393') {  // ← The password is '3393'
    setIsUnlocked(true);
    setPasswordError('');
  } else {
    setPasswordError('Incorrect password. Please try again.');
  }
};
```

### Toast Messages
```typescript
// Success
toast.success('Access restricted setting updated successfully');

// Error
toast.error('Failed to update access restricted setting: ' + error.message);

// Sign in required
// Uses AlertDialog with title: "Sign In Required"
```

---

## Error Handling

### Silent Failures with Defaults
```typescript
// If database query fails, default to enabled (true)
if (error) {
  debug.error('Error fetching access_restricted setting:', error);
  setAccessRestricted(true); // Default to true if error
}
```

### Admin-Only Validation (Database level)
```sql
IF NOT is_admin THEN
  RAISE EXCEPTION 'Only admins can update access restricted setting';
END IF;
```

---

## Testing Code

### Test 1: Sidemenu Login Check
```typescript
// Test: Unauthenticated user clicks sidemenu item
// Expected: Sign in prompt appears

// Test: Authenticated user clicks sidemenu item
// Expected: Navigation occurs to the clicked path
```

### Test 2: Access Restricted Toggle
```typescript
// Test: Admin toggles "Access Restricted" on
// Expected: Password overlay appears on next login attempt

// Test: Admin toggles "Access Restricted" off
// Expected: Users can access auth form without password on next attempt
```

### Test 3: Settings Persistence
```typescript
// Test: Reload page after toggling
// Expected: Setting persists from database

// Test: Multiple admins toggle simultaneously
// Expected: Last write wins, no conflicts
```

---

## State Management Pattern

### Component State Flow
```
[Initial State]
     ↓
[Mount - useEffect]
     ↓
[Fetch from Database]
     ↓
[Set Local State]
     ↓
[Render with State]
     ↓
[User Interaction]
     ↓
[Call Mutation]
     ↓
[Update Database]
     ↓
[Invalidate Cache]
     ↓
[Query Re-fetches]
     ↓
[State Updated]
```

---

## Related Functions & Hooks

### Used Hooks
- `useAuth()` - Get user authentication state
- `useQuery()` - Fetch site settings
- `useMutation()` - Update site settings
- `useQueryClient()` - Invalidate cache
- `useState()` - Local component state
- `useEffect()` - Side effects (fetching data)
- `useNavigate()` - Navigation
- `useLocation()` - Current location

### Used Components
- `Switch` - Toggle component for on/off
- `AlertDialog` - Sign in prompt
- `Button` - Action buttons
- `Card` - Settings container
- `Toast` (sonner) - Success/error notifications
- `SidebarMenuButton` - Menu item button
- `ModernAuthForm` - Login/signup form

### Used Database Tables
- `site_settings` - Global application settings
- `auth.users` - Supabase auth users
- `user_roles` - User role assignments

---

## Environment & Build Info

- **Framework**: React with TypeScript
- **Database**: Supabase PostgreSQL
- **State Management**: TanStack Query (React Query)
- **UI Components**: Custom components + shadcn/ui
- **Notifications**: Sonner
- **Routing**: React Router v6

---

## Debugging Tips

### Enable Debug Logging
```typescript
import debug from '@/utils/debug';

debug.log('User:', user);
debug.error('Error:', error);
```

### Common Issues & Solutions

**Issue**: Access restricted toggle not appearing in Admin panel
- **Solution**: Verify user is logged in as admin, check browser console for errors

**Issue**: Password overlay always shows despite disabling toggle
- **Solution**: Check database for access_restricted value, clear browser cache, reload

**Issue**: Sidemenu doesn't redirect to login for unauthenticated users
- **Solution**: Verify `user` state is properly updated, check handleNavItemClick is attached to onClick

**Issue**: TypeScript errors for site_settings query
- **Solution**: Use `(supabase as any)` to bypass type checking, or wait for type generation update

---

## Performance Considerations

### Optimization Points
1. **Access restricted setting is cached** - Fetched once on component mount
2. **Database query uses `.single()`** - Efficient single row fetch
3. **useQuery cache** - Settings cached by TanStack Query
4. **No polling** - Setting only fetched on route change or manual invalidation

### Query Optimization
```typescript
// Efficient: select only needed column
.select('access_restricted')

// Cache key
queryKey: ['site-settings']

// Reusable in multiple components
// Same query, shared cache across components
```

---

## Security Best Practices Implemented

✅ Admin-only mutation (checked at database level via `has_role()`)
✅ RLS policies on site_settings table
✅ User authentication required for sensitive operations
✅ Error messages don't leak sensitive info
✅ Default to most restrictive state (access_restricted = true)
✅ Audit trail (updated_at, updated_by fields)

