# Admin System

## Overview

Web admin pages under `/admin/*` for managing site settings, users, AI-generated content, announcements, and community features. All pages check admin role client-side before rendering.

## Admin Pages

| Page | Route | Purpose |
|------|-------|---------|
| `Admin.tsx` | `/admin` | Redirects to `/admin/settings` |
| `AdminDashboard.tsx` | `/admin/dashboard` | User statistics via `get_admin_user_data` RPC |
| `AdminSettings.tsx` | `/admin/settings` | Site-wide toggles: sale mode, sandbox mode, display settings |
| `AISettings.tsx` | `/admin/ai-settings` | AI completion configs, generation schedules, value finds |
| `TodayInSportsAdmin.tsx` | `/admin/today-in-sports` | Daily sports summary content and Discord notifications |
| `AdminAnnouncements.tsx` | `/admin/announcements` | Create and manage site announcements via `site_settings` |
| `AdminUsers.tsx` | `/admin/users` | User table with role management and entitlement granting |
| `UserWinsAdmin.tsx` | `/admin/user-wins` | Moderate user win submissions, toggle wins section visibility |

## AI Settings

`AISettings.tsx` manages all AI-generated content through `aiCompletionService`:

- **Completion Configs**: Per-sport prompt templates stored as `AICompletionConfig` records. Admins edit prompts and save via `updateCompletionConfig`.
- **Page-Level Schedules**: Separate schedule state for NFL, CFB, NBA, NCAAB controlling when analysis auto-generates.
- **Manual Generation**: Trigger on-demand analysis via `generatePageLevelAnalysis` for any sport.
- **Bulk Generation**: Generate missing completions in batch per sport using `bulkGenerateMissingCompletions`.
- **Value Finds**: Review, publish, unpublish, or delete AI-identified value betting opportunities per sport.
- **Payload Tester**: Built-in dialog to test prompts against live game data for debugging.
- **Emergency Toggle**: Client-side completion settings to disable AI features without a deploy.

`TodayInSportsAdmin.tsx` manages the daily sports summary:

- Edit generation prompt and scheduled time
- Trigger generation via `generateTodayInSportsCompletion`
- Preview, publish, or delete the daily completion
- Send test Discord notifications via `sendTestDiscordNotification`

## Site Settings

`AdminSettings.tsx` reads from and writes to the `site_settings` Supabase table (single row):

- **Sale Mode**: Toggle via `SaleModeToggle` component — affects pricing display
- **Sandbox Mode**: Toggle via `SandboxModeToggle` — uses test payment environment
- **Display Toggles** (via `useDisplaySettings` hook):
  - `showNFLMoneylinePills` — NFL moneyline pill visibility
  - `showExtraValueSuggestions` — extra value suggestion display
- **User Stats**: Fetches counts via `get_admin_user_data` RPC

`UserWinsAdmin.tsx` reads `site_settings` for `show_user_wins_section` to toggle community win submissions.

## Access Control

Every admin page performs the same role check:

1. Get current user from `useAuth()` (Supabase auth context)
2. Call `supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })` on mount
3. Store result in local state (`isAdmin`)
4. While checking: loading spinner. If not admin: `<Navigate to="/" />`

The `has_role` RPC verifies role membership server-side. Admin data queries are only enabled when `isAdmin` is `true`.

## File Map

```
src/pages/
├── Admin.tsx                    # Redirect to /admin/settings
└── admin/
    ├── AdminDashboard.tsx       # User stats
    ├── AdminSettings.tsx        # Site toggles
    ├── AISettings.tsx           # AI completion management
    ├── TodayInSportsAdmin.tsx   # Daily summary
    ├── AdminAnnouncements.tsx   # Announcements
    ├── AdminUsers.tsx           # User management
    └── UserWinsAdmin.tsx        # Win submissions
```
