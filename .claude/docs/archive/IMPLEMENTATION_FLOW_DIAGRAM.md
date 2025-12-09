# Implementation Flow Diagram

## Feature 1: Sidemenu Login Redirect

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER CLICKS SIDEMENU ITEM                  │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │   handleNavItemClick │
        │      (to: string)    │
        └──────────┬──────────┘
                   │
           ┌───────┴────────┐
           │                │
        YES│                │NO
      ┌────┴────┐       ┌───┴───────┐
      │ user?   │       │ No user   │
      └────┬────┘       └─────┬─────┘
           │                  │
           ▼                  ▼
      ┌─────────────┐  ┌─────────────────────┐
      │   navigate  │  │ setSignInPromptOpen │
      │     (to)    │  │      (true)         │
      └─────────────┘  └────────┬────────────┘
                                │
                                ▼
                        ┌──────────────────────┐
                        │  AlertDialog Opens   │
                        │ "Sign In Required"   │
                        │  [Cancel] [Sign In]  │
                        └──────────┬───────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  Navigate to    │
                          │   /account      │
                          └─────────────────┘
```

---

## Feature 2: Access Restricted Password Overlay Toggle

### Admin Panel Toggle Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           SITE SETTINGS                              │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ Launch Mode (Free Access)           [Toggle]  ✓    │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ Access Restricted Password Overlay  [Toggle]  ✓    │   │◄──┐
│  │ (NEW FEATURE)                                        │   │  │
│  │ When enabled, users must enter a password            │   │  │
│  │ before accessing the login page...                   │   │  │
│  ├──────────────────────────────────────────────────────┤   │  │
│  │ Test Paywall                        [View Paywall]   │   │  │
│  └──────────────────────────────────────────────────────┘   │  │
└──────────────────────────────────────────────────────────────┘  │
                                                                   │
                                            Toggle action triggers │
                                                    toggleAccessRestricted.mutate()
                                                                   │
                    ┌──────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ supabase.from         │
        │ ('site_settings')     │
        │ .update({             │
        │   access_restricted   │
        │ })                    │
        └───────┬───────────────┘
                │
                ▼
        ┌───────────────────────┐
        │ Database Updated      │
        │ Toast: Success/Error  │
        │ Cache Invalidated     │
        └───────┬───────────────┘
                │
                ▼
    ┌─────────────────────────────┐
    │ Next Login Attempt by User  │
    │ (Account.tsx / Welcome.tsx)  │
    └─────────────────────────────┘
```

### User Login Flow (Based on Access Restricted Setting)

```
┌─────────────────────────────────────────┐
│   USER NAVIGATES TO /account OR /      │
└──────────────┬──────────────────────────┘
               │
               ▼
    ┌──────────────────────────┐
    │ Component Mounts         │
    │ fetchAccessRestricted()  │
    │ (queries site_settings)  │
    └──────────────┬───────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    accessRestricted     accessRestricted
    = true (default)      = false (disabled)
         │                   │
         ▼                   ▼
    ┌─────────────────┐  ┌─────────────────┐
    │ SHOW PASSWORD   │  │ SKIP PASSWORD   │
    │ OVERLAY         │  │ OVERLAY         │
    │                 │  │                 │
    │ [Access         │  │ [Login Form]    │
    │  Restricted]    │  │ or              │
    │                 │  │ [Sign Up Form]  │
    │ Enter password  │  │                 │
    │ to proceed ►    │  │ Enter email +   │
    └────────┬────────┘  │ password ►      │
             │           └─────────────────┘
             ▼
    ┌─────────────────────┐
    │ [Login Form]        │
    │ [Sign Up Form]      │
    └────────┬────────────┘
             │
             ▼
    ┌──────────────────┐
    │ Authentication   │
    │ Processing       │
    └──────────────────┘
```

---

## Database Schema Changes

### Before
```sql
CREATE TABLE site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_mode boolean DEFAULT true,
  require_subscription boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
```

### After
```sql
CREATE TABLE site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_mode boolean DEFAULT true,
  require_subscription boolean DEFAULT false,
  access_restricted boolean DEFAULT true,  -- ◄ NEW FIELD
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
```

---

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      AppLayout.tsx                          │
│  (Sidemenu - all items check user auth)                     │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐        │
│  │ navItem    │  │ navItem    │  │ navItem      │        │
│  │ onClick    │  │ onClick    │  │ onClick      │        │
│  │ ▼          │  │ ▼          │  │ ▼            │        │
│  │handleNav   │  │handleNav   │  │handleNav     │        │
│  │ItemClick   │  │ItemClick   │  │ItemClick     │        │
│  └──┬─────────┘  └──┬─────────┘  └──┬───────────┘        │
│     │ user?         │ user?         │ user?               │
│     └──────┬────────┴─────┬────────┴──────┘               │
│            │              │                               │
│     navigate or    setSignInPromptOpen                    │
│    openSignInDialog        │                              │
└────────────────────────────┼──────────────────────────────┘
                             │
          ┌──────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Account.tsx                               │
│              (Login Page Component)                        │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ useEffect: fetchAccessRestricted()                   │ │
│  │   └─► query site_settings.access_restricted          │ │
│  └──────┬───────────────────────────────────────────────┘ │
│         │                                                  │
│         ▼                                                  │
│  {accessRestricted && !isUnlocked ? (                    │
│     <PasswordOverlay />                                   │
│  ) : (                                                    │
│     <ModernAuthForm />                                    │
│  )}                                                       │
└─────────────────────────────────────────────────────────────┘
         ▲
         │
         │ Also used in
         │
┌─────────────────────────────────────────────────────────────┐
│                  Welcome.tsx                               │
│            (Landing Page Component)                        │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ useEffect: fetchAccessRestricted()                   │ │
│  │   └─► query site_settings.access_restricted          │ │
│  └──────┬───────────────────────────────────────────────┘ │
│         │                                                  │
│         ▼                                                  │
│  {accessRestricted && !isUnlocked ? (                    │
│     <PasswordOverlay />                                   │
│  ) : (                                                    │
│     <ModernAuthForm />                                    │
│  )}                                                       │
└─────────────────────────────────────────────────────────────┘
         ▲
         │
         │ Admin controls via
         │
┌─────────────────────────────────────────────────────────────┐
│                  Admin.tsx                                 │
│              (Admin Dashboard)                             │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Site Settings Card                                   │ │
│  │ ┌────────────────────────────────────────────────┐   │ │
│  │ │ Access Restricted Password Overlay             │   │ │
│  │ │ When enabled, users must enter a password...   │   │ │
│  │ │                                    [Toggle] ✓  │   │ │
│  │ │                                    onClick ◄──┼───┼─┼─┐
│  │ │                                                │   │ │ │
│  │ └────────────────────────────────────────────────┘   │ │ │
│  └──────────────────────────────────────────────────────┘ │ │
│                                                           │ │
│  toggleAccessRestricted.mutate(checked)                  │ │
│    └─► supabase.from('site_settings').update({...})     │ │
│        ├─► Cache invalidated                             │ │
│        └─► Toast notification                            │ │
└──────────────────────────────────────────────────────────┼─┘
                                                            │
                                             Syncs to DB ───┘
```

---

## Security & Access Control

```
┌─────────────────────────────────────────────────────────┐
│             Authentication & Authorization              │
└─────────────────────────────────────────────────────────┘

1. SIDEMENU ACCESS
   ├─ User not logged in
   │  └─► Click sidemenu → setSignInPromptOpen(true)
   │       └─► Dialog: "Sign In Required" → /account
   │
   └─ User logged in
      └─► Click sidemenu → navigate(to)
           └─► Route protected by ProtectedRoute component
                ├─ User check: ✓ (already passed)
                └─ Access check: Verified via useAccessControl hook

2. ACCESS RESTRICTED SETTING
   ├─ Read Access: PUBLIC
   │  └─► All users can fetch site_settings.access_restricted
   │
   └─ Write Access: ADMIN ONLY
      └─► RLS Policy checks has_role(auth.uid(), 'admin')
          ├─ Admin can toggle
          └─ Non-admin denied with exception

3. PASSWORD OVERLAY
   ├─ Controlled by site_settings.access_restricted
   ├─ Default: true (enabled)
   └─ Can be disabled by admins via Admin Dashboard
```

---

## Migration & Deployment

```
Local Development:
1. supabase db push
   └─► Runs migration 20251107000004_add_access_restricted_field.sql

Production Deployment:
1. Review migration SQL
2. Deploy application code
3. Run migration:
   supabase migration deploy
4. Verify:
   - Admin panel loads without errors
   - access_restricted toggle appears
   - Login pages respect the setting

Rollback (if needed):
1. supabase db reset  (local only)
2. Or manually drop column (production)
```

