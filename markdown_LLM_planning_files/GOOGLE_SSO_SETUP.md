# Google SSO Setup Guide

## ✅ Completed Tasks

The following code changes have been implemented:

- [x] Updated `ModernAuthForm.tsx` to accept Google/Apple sign-in handlers
- [x] Connected Google button onClick to authentication flow
- [x] Updated `Welcome.tsx` with Google/Apple sign-in handlers
- [x] Updated `Account.tsx` with Google/Apple sign-in handlers
- [x] Verified `AuthContext.tsx` has `signInWithProvider` method
- [x] All linter errors resolved

## 🔧 Configuration Required

### Step 1: Create Google OAuth 2.0 Credentials

1. **Navigate to Google Cloud Console**
   - Go to: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Select or Create a Project**
   - Click the project dropdown at the top
   - Either select existing project or click "NEW PROJECT"
   - Project name suggestion: "WagerProof"
   - Click "CREATE"

3. **Configure OAuth Consent Screen** (First-time setup)
   - Go to **APIs & Services** → **OAuth consent screen**
   - Select **External** user type
   - Click **CREATE**
   - Fill in required fields:
     - **App name**: WagerProof
     - **User support email**: Your email
     - **App logo**: (Optional - upload WagerProof logo)
     - **Application home page**: https://your-domain.com
     - **Authorized domains**: Add your production domain
     - **Developer contact information**: Your email
   - Click **SAVE AND CONTINUE**
   - **Scopes**: Click **SAVE AND CONTINUE** (default scopes are sufficient)
   - **Test users**: (Optional) Add test emails if needed
   - Click **SAVE AND CONTINUE**
   - Review and click **BACK TO DASHBOARD**

4. **Create OAuth 2.0 Client ID**
   - Go to **APIs & Services** → **Credentials**
   - Click **+ CREATE CREDENTIALS** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `WagerProof Web Client`
   
5. **Configure Authorized Origins and Redirect URIs**
   
   **Authorized JavaScript origins:**
   ```
   https://gnjrklxotmbvnxbnnqgq.supabase.co
   http://localhost:8080
   http://127.0.0.1:8080
   ```
   
   **Authorized redirect URIs:**
   ```
   https://gnjrklxotmbvnxbnnqgq.supabase.co/auth/v1/callback
   http://localhost:8080/auth/v1/callback
   http://127.0.0.1:8080/auth/v1/callback
   ```

6. **Save Credentials**
   - Click **CREATE**
   - **IMPORTANT**: Copy the **Client ID** and **Client Secret**
   - Save them securely (you'll need them in Step 2)

### Step 2: Configure Supabase Authentication

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/gnjrklxotmbvnxbnnqgq
   - Navigate to **Authentication** (left sidebar)

2. **Enable Google Provider**
   - Click on **Providers**
   - Scroll down to find **Google**
   - Toggle **Enable Sign in with Google** to **ON**

3. **Enter OAuth Credentials**
   - Paste **Client ID** from Step 1
   [YOUR_CLIENT_ID]
   - Paste **Client Secret** from Step 1
   [YOUR_CLIENT_SECRET]
   - Click **Save**

4. **Verify Configuration**
   - The Google provider should now show as "Enabled"
   - The redirect URL should be: `https://gnjrklxotmbvnxbnnqgq.supabase.co/auth/v1/callback`

### Step 3: Update Environment Variables (Optional)

If you need to override the default redirect URL for development:

1. Create/update `.env.local`:
   ```bash
   VITE_SUPABASE_URL=https://gnjrklxotmbvnxbnnqgq.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

2. Ensure your Supabase client is using these variables

### Step 4: Testing

#### Local Development Testing

1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to the login page**:
   - Go to `http://localhost:8080` or your welcome page

3. **Test Google Sign-In**:
   - Click the **Google** button
   - You should be redirected to Google's OAuth consent screen
   - Authorize the application
   - Verify you're redirected back and logged in
   - Check that you land on `/wagerbot-chat` page with automatic welcome message

4. **Verify User Data**:
   - Open Supabase Dashboard → Authentication → Users
   - You should see your Google-authenticated user
   - Check that email and metadata are populated correctly

#### Production Testing Checklist

- [ ] Add production domain to Google OAuth authorized origins
- [ ] Add production redirect URL to Google OAuth
- [ ] Test sign-in flow on production URL
- [ ] Verify SSL/HTTPS is working correctly
- [ ] Test sign-out and re-authentication
- [ ] Test with different Google accounts
- [ ] Verify user data is stored correctly in Supabase

## 🐛 Troubleshooting

### Issue: "redirect_uri_mismatch" Error

**Cause**: The redirect URI doesn't match what's configured in Google Cloud Console

**Solution**:
- Verify redirect URIs in Google Cloud Console exactly match:
  - `https://gnjrklxotmbvnxbnnqgq.supabase.co/auth/v1/callback`
- Check for trailing slashes or typos
- Wait 5 minutes after saving changes in Google Cloud Console

### Issue: "invalid_client" Error

**Cause**: Client ID or Client Secret is incorrect

**Solution**:
- Double-check credentials in Supabase match Google Cloud Console
- Regenerate Client Secret if needed
- Make sure there are no extra spaces when copying/pasting

### Issue: Google Sign-In Opens but Doesn't Redirect Back

**Cause**: Missing authorized JavaScript origins

**Solution**:
- Add all origins to Google Cloud Console:
  - `https://gnjrklxotmbvnxbnnqgq.supabase.co`
  - `http://localhost:8080`
- Clear browser cache and cookies
- Try in incognito/private mode

### Issue: "Access blocked: This app's request is invalid"

**Cause**: OAuth consent screen not properly configured

**Solution**:
- Complete OAuth consent screen configuration in Google Cloud Console
- Ensure app is either in "Testing" or "Published" status
- Add test users if app is in "Testing" mode

### Issue: User Logged In but No Data in Supabase

**Cause**: Supabase auth not properly configured

**Solution**:
- Verify Supabase provider is enabled
- Check Supabase logs in Dashboard → Logs
- Ensure site_url in Supabase config is correct

## 📋 Production Deployment Checklist

Before deploying to production:

- [ ] **Google Cloud Console**:
  - [ ] Add production domain to authorized origins
  - [ ] Add production redirect URL
  - [ ] Publish OAuth consent screen (if required)
  - [ ] Set up proper branding (logo, privacy policy, terms of service)

- [ ] **Supabase**:
  - [ ] Verify production redirect URLs are configured
  - [ ] Check rate limits for authentication
  - [ ] Set up email templates for account linking (if needed)
  - [ ] Configure site_url in Authentication settings

- [ ] **Application**:
  - [ ] Test complete authentication flow
  - [ ] Verify error handling for failed logins
  - [ ] Test account linking (if user exists with email)
  - [ ] Verify redirect after login goes to correct page
  - [ ] Test sign-out functionality
  - [ ] Check mobile responsiveness of OAuth flow

- [ ] **Security**:
  - [ ] Ensure HTTPS is enabled on production
  - [ ] Verify CORS settings in Supabase
  - [ ] Review Supabase RLS policies
  - [ ] Set up monitoring for auth failures

- [ ] **Documentation**:
  - [ ] Update user documentation with Google sign-in option
  - [ ] Document account recovery process
  - [ ] Create support documentation for common issues

## 🔒 Security Best Practices

1. **Never Commit Credentials**:
   - Keep Client Secret secure
   - Don't commit `.env` files with secrets
   - Use environment variables for sensitive data

2. **Validate Redirect URLs**:
   - Only whitelist known domains
   - Use HTTPS in production
   - Avoid wildcard patterns

3. **Monitor Authentication**:
   - Set up alerts for unusual sign-in patterns
   - Monitor Supabase auth logs regularly
   - Track failed authentication attempts

4. **User Privacy**:
   - Only request necessary OAuth scopes
   - Comply with GDPR/privacy regulations
   - Provide clear privacy policy

## 📚 Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Google OAuth Guide](https://supabase.com/docs/guides/auth/social-login/auth-google)

## 🎯 Current Implementation Details

### Authentication Flow

1. User clicks "Google" button in `ModernAuthForm`
2. `handleGoogleSignIn` is triggered in Welcome/Account page
3. Calls `signInWithProvider('google')` from `AuthContext`
4. Supabase initiates OAuth flow with Google
5. User authorizes on Google's page
6. Google redirects to: `https://gnjrklxotmbvnxbnnqgq.supabase.co/auth/v1/callback`
7. Supabase exchanges auth code for user info
8. Supabase creates session and redirects to `/wagerbot-chat`
9. `AuthContext` detects session change
10. User is logged in and automatic welcome message is triggered

### Code Locations

- **Auth Context**: `/src/contexts/AuthContext.tsx`
- **Auth Form**: `/src/components/ModernAuthForm.tsx`
- **Welcome Page**: `/src/pages/Welcome.tsx`
- **Account Page**: `/src/pages/Account.tsx`
- **Supabase Client**: `/src/integrations/supabase/client.ts`

### Configuration Files

- **Supabase Config**: `/supabase/config.toml`
- **Project Config**: `gnjrklxotmbvnxbnnqgq` (Supabase project ID)

## ✅ Next Steps Summary

1. **Immediate**:
   - Create Google OAuth credentials
   - Configure Supabase Google provider
   - Test locally

2. **Before Production**:
   - Add production URLs to Google Cloud
   - Publish OAuth consent screen
   - Complete security review

3. **Optional Enhancements**:
   - Add Apple Sign-In (button already wired up)
   - Add GitHub authentication
   - Implement account linking for existing users

---

**Last Updated**: October 14, 2025
**Status**: Code Complete - Configuration Required
**Estimated Setup Time**: 15-30 minutes

