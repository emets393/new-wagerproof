# Deployment Checklist

## Pre-Deployment Tasks

### Code Review
- [ ] Review all changes in git diff
- [ ] Verify no console errors in linting
- [ ] Check TypeScript compilation
- [ ] Review security implications

### Testing Checklist

#### Feature 1: Sidemenu Login Check
- [ ] **Unauthenticated User**
  - [ ] Click "Learn WagerProof" in sidemenu
  - [ ] Verify "Sign In Required" dialog appears
  - [ ] Verify dialog has cancel and sign in buttons
  - [ ] Click "Sign In" and verify redirect to /account
  - [ ] Try other sidemenu items (WagerBot Chat, Score Board, etc.)
  - [ ] All should show sign in prompt

- [ ] **Authenticated User**
  - [ ] Log in first
  - [ ] Click "Learn WagerProof" in sidemenu
  - [ ] Verify page navigates immediately without dialog
  - [ ] Try multiple sidemenu items
  - [ ] All should navigate normally

- [ ] **Settings Button**
  - [ ] Log out
  - [ ] Click "Settings" in sidebar footer
  - [ ] Verify sign in prompt appears
  - [ ] Log in
  - [ ] Click "Settings" again
  - [ ] Verify settings modal opens

#### Feature 2: Access Restricted Toggle
- [ ] **Admin Access**
  - [ ] Log in as admin
  - [ ] Navigate to /admin
  - [ ] Verify "Access Restricted Password Overlay" toggle is visible
  - [ ] Toggle is in "Site Settings" section
  - [ ] Description text is correct

- [ ] **Toggle ON (Default)**
  - [ ] Verify toggle is ON by default
  - [ ] Log out
  - [ ] Navigate to /account
  - [ ] Verify password overlay appears
  - [ ] Enter correct password (3393)
  - [ ] Verify auth form appears
  - [ ] Navigate to / (landing page)
  - [ ] Verify password overlay appears there too

- [ ] **Toggle OFF**
  - [ ] As admin, toggle OFF the access restricted setting
  - [ ] Verify toast success message
  - [ ] Log out in new tab
  - [ ] Navigate to /account
  - [ ] Verify password overlay does NOT appear
  - [ ] Verify auth form is shown directly
  - [ ] Navigate to /
  - [ ] Verify password overlay does NOT appear there either

- [ ] **Toggle Back ON**
  - [ ] As admin, toggle ON again
  - [ ] Verify setting persists
  - [ ] Log out
  - [ ] Navigate to /account
  - [ ] Verify password overlay appears again

- [ ] **Admin-Only Access**
  - [ ] Verify only admins can toggle setting
  - [ ] Check that non-admins cannot access /admin page
  - [ ] Verify ProtectedRoute redirects non-admins to /home

#### Feature 3: Database Migration
- [ ] **Migration File Exists**
  - [ ] File: `supabase/migrations/20251107000004_add_access_restricted_field.sql`
  - [ ] Contains ALTER TABLE statement
  - [ ] Contains helper functions
  - [ ] Contains comments

- [ ] **Local Migration Test**
  - [ ] Run: `supabase db push`
  - [ ] Verify no SQL errors
  - [ ] Check site_settings table has access_restricted column
  - [ ] Verify default value is true

- [ ] **Data Integrity**
  - [ ] Existing site_settings rows have access_restricted = true
  - [ ] Can query: `SELECT access_restricted FROM site_settings`
  - [ ] Can update via function: `SELECT update_access_restricted(false)`

### Documentation
- [ ] README updated (if needed)
- [ ] Inline code comments are clear
- [ ] JSDoc comments added to new functions
- [ ] Summary documents created:
  - [x] SIDEMENU_LOGIN_AND_ACCESS_RESTRICTED_SUMMARY.md
  - [x] IMPLEMENTATION_FLOW_DIAGRAM.md
  - [x] CODE_SNIPPETS_REFERENCE.md
  - [x] DEPLOYMENT_CHECKLIST.md (this file)

---

## Deployment Steps

### Step 1: Local Validation
```bash
# Navigate to project
cd /Users/chrishabib/Documents/new-wagerproof

# Build project (verify no TypeScript errors)
npm run build

# Run linter
npm run lint

# Check for any remaining warnings
npm run type-check
```

### Step 2: Database Migration (Development)
```bash
# Apply local migrations
supabase db push

# Verify table structure
supabase db show site_settings
```

### Step 3: Database Migration (Production/Staging)
```bash
# Create backup first
# (Use Supabase dashboard: Project Settings > Backups)

# Apply migrations
supabase db deploy  # or via CI/CD pipeline

# Verify in Supabase dashboard:
# - Tables > site_settings
# - Columns: access_restricted should be visible
# - Type: boolean
# - Default: true
```

### Step 4: Deploy Application Code
```bash
# Commit changes
git add src/components/AppLayout.tsx
git add src/pages/Account.tsx
git add src/pages/Admin.tsx
git add src/pages/Welcome.tsx
git add supabase/migrations/20251107000004_add_access_restricted_field.sql
git commit -m "feat: Add sidemenu login check and access restricted toggle"

# Push to repository
git push origin main

# Deploy via your CI/CD pipeline (Vercel, Netlify, etc.)
# or manually deploy to your hosting service
```

### Step 5: Post-Deployment Verification
- [ ] Application loads without errors
- [ ] Admin dashboard loads for admins
- [ ] Access Restricted toggle visible in Admin panel
- [ ] Can toggle the setting
- [ ] Setting takes effect on next page load
- [ ] Password overlay appears/disappears based on setting
- [ ] Unauthenticated users get sign-in prompt on sidemenu click
- [ ] Authenticated users navigate normally in sidemenu
- [ ] No console errors
- [ ] No TypeScript compilation errors

---

## Rollback Plan

### If Issues Occur

#### Option 1: Quick Rollback (Frontend Only)
If database is fine, only frontend has issues:
```bash
# Revert to previous version
git revert <commit-hash>
git push origin main
# Redeploy via CI/CD
```

#### Option 2: Database Rollback
If migration caused issues:
```bash
# From Supabase dashboard
# Backups > Restore from backup

# Or manually remove the column:
ALTER TABLE site_settings DROP COLUMN access_restricted;
```

#### Option 3: Complete Rollback
```bash
# Revert all changes
git revert <commit-hash>
git push

# Restore database from backup
# (via Supabase dashboard)

# Redeploy
```

---

## Monitoring & Support

### What to Monitor
1. **Application Errors**
   - Check Sentry/error logging for frontend errors
   - Monitor database query errors
   - Watch for failed mutations in admin panel

2. **User Behavior**
   - Monitor login success rate
   - Track sign-in prompt interactions
   - Check password overlay interactions

3. **Performance**
   - Monitor database query times
   - Check API response times
   - Verify no N+1 queries

### Support Communication
- **Users**: No communication needed - feature is internal admin tool
- **Admins**: Brief email explaining the new toggle and its purpose
- **Dev Team**: Share the documentation files included with this PR

---

## Success Criteria

✅ **Feature 1 (Sidemenu Login Check)**
- Unauthenticated users cannot navigate sidemenu items
- Sign-in prompt appears for any sidemenu click
- Authenticated users navigate normally
- Settings button also requires login

✅ **Feature 2 (Access Restricted Toggle)**
- Toggle appears in Admin Dashboard
- Admin can enable/disable without errors
- Setting persists across page reloads
- Changes take effect immediately for new page visits
- Only admins can access the toggle

✅ **Code Quality**
- No linting errors
- No TypeScript errors
- All tests pass
- Documentation is complete

✅ **Database**
- Migration runs without errors
- New column added successfully
- Existing data preserved
- Functions created and working

✅ **Security**
- RLS policies enforced
- Admin-only access verified
- No sensitive data leaks
- Audit trail maintained

---

## Files Changed Summary

| File | Changes | Lines |
|------|---------|-------|
| `src/components/AppLayout.tsx` | Added handleNavItemClick, updated menu items | +85, -42 |
| `src/pages/Admin.tsx` | Added toggle mutation and UI | +38 |
| `src/pages/Account.tsx` | Added access_restricted fetch and conditional render | +30 |
| `src/pages/Welcome.tsx` | Added access_restricted fetch and conditional render | +29 |
| `supabase/migrations/20251107000004_add_access_restricted_field.sql` | New migration file | +50 |
| **Total** | | **+232, -42** |

---

## Sign-Off Checklist

- [ ] Feature requirements met
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Documentation complete
- [ ] No breaking changes
- [ ] Database migration verified
- [ ] Security review complete
- [ ] Performance acceptable
- [ ] Ready for production deployment

---

## Contact & Questions

For questions about this implementation:
1. Review the summary documents in the project root
2. Check CODE_SNIPPETS_REFERENCE.md for code examples
3. Reference IMPLEMENTATION_FLOW_DIAGRAM.md for architecture

---

**Last Updated**: November 7, 2025
**Version**: 1.0
**Status**: Ready for Deployment

