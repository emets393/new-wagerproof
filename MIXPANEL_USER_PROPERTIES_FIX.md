# Mixpanel User Properties Fix

## Problem
New users' emails and names were not being logged in Mixpanel events. The issue affected:
- Email signups: User properties were never set until email verification
- OAuth signups: Names were not being extracted from provider metadata
- Missing Mixpanel standard properties: `$email` and `$name` were not being used

## Root Cause

### Email Signups
In `src/contexts/AuthContext.tsx`, the `signUp()` function only tracked the signup event but never identified the user or set their properties:

```typescript
// OLD CODE (lines 95-113)
if (!error) {
  trackSignUp('email');  // ❌ Only tracked event, never identified user
  debug.log('[Mixpanel] User signed up via email');
}
```

The `identifyUser()` function was only called in the `SIGNED_IN` event handler, which for email signups only fires **after email verification**. New users who hadn't verified their email yet had no properties in Mixpanel.

### OAuth Signups  
While OAuth users were identified immediately (since `SIGNED_IN` fires right after OAuth), their names weren't being extracted from the provider metadata.

## Solution Implemented

### 1. Email Signup Fix (`signUp` function)

Now immediately identifies the user with their email and name upon successful signup:

```typescript
// NEW CODE
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: { emailRedirectTo: redirectUrl }
});

if (!error && data.user) {
  const userId = data.user.id;
  const userEmail = data.user.email || email;
  const userName = data.user.user_metadata?.full_name || 
                   data.user.user_metadata?.display_name || 
                   null;
  
  // ✅ Identify user immediately with all properties
  identifyUser(userId, {
    $email: userEmail,     // Mixpanel standard property
    $name: userName,       // Mixpanel standard property
    email: userEmail,      // Custom property
    name: userName,        // Custom property
    auth_method: 'email',
    user_id: userId,
    signup_date: new Date().toISOString(),
  });
  
  trackSignUp('email');
}
```

### 2. Sign In Enhancement (`SIGNED_IN` event handler)

Now extracts user names from metadata and uses Mixpanel standard properties:

```typescript
// Extract user's name from metadata
const userName = session.user.user_metadata?.full_name || 
                session.user.user_metadata?.display_name || 
                session.user.user_metadata?.name ||
                null;

// Identify with standard Mixpanel properties
identifyUser(userId, {
  $email: userEmail,     // ✅ Mixpanel standard property
  $name: userName,       // ✅ Mixpanel standard property  
  email: userEmail,      // Custom property (backward compatibility)
  name: userName,        // Custom property (backward compatibility)
  auth_method: authMethod,
  user_id: userId,
  last_login: new Date().toISOString(),
});
```

## Benefits

1. **Email signups**: Users are immediately identified in Mixpanel with their email, even before email verification
2. **OAuth signups**: User names from Google/Apple are now properly captured
3. **Standard properties**: Using `$email` and `$name` enables Mixpanel's built-in features:
   - User profiles automatically populated
   - Email notifications work correctly
   - Better integration with Mixpanel's people analytics
4. **Backward compatibility**: Custom `email` and `name` properties maintained for existing reports/queries

## Testing Recommendations

### Test Email Signup
1. Open browser DevTools Console
2. Sign up with a new email address
3. Check console logs for: `[Mixpanel] User signed up via email: user@example.com`
4. In Mixpanel dashboard, verify the user appears with:
   - Email property set
   - `signup_date` timestamp
   - `auth_method: 'email'`

### Test OAuth Signup (Google)
1. Open browser DevTools Console  
2. Sign up/in with Google
3. Check console logs for: `[Mixpanel] User signed in: user@gmail.com (John Doe) via google`
4. In Mixpanel dashboard, verify the user appears with:
   - Email property set
   - Name property set (from Google profile)
   - `auth_method: 'google'`

### Test OAuth Signup (Apple)
1. Open browser DevTools Console
2. Sign up/in with Apple (requires Safari or iOS)
3. Check console logs for proper identification
4. Verify email and name (if shared) appear in Mixpanel

## Files Modified
- `src/contexts/AuthContext.tsx` - Enhanced `signUp()` function and `SIGNED_IN` event handler

## Mixpanel Properties Reference

### Standard Properties (auto-recognized by Mixpanel)
- `$email` - User's email address
- `$name` - User's full name

### Custom Properties (WagerProof-specific)
- `email` - User's email (duplicate for backward compatibility)
- `name` - User's name (duplicate for backward compatibility)  
- `auth_method` - How user authenticated: 'email' | 'google' | 'apple'
- `user_id` - Supabase user ID
- `signup_date` - ISO timestamp when user signed up
- `last_login` - ISO timestamp of most recent login

