# Community Voting Feature - Implementation Summary

## Overview
Successfully implemented the Community Voting feature that allows users to submit betting picks and vote on picks from other users. The feature includes Reddit-style voting, pick submission, filtering, and is ready for Phase 2 (outcome tracking and leaderboard) when data is available.

## What Was Implemented

### 1. Database Schema (`supabase/migrations/20250210000000_create_community_picks.sql`)

Created two main tables with full RLS policies:

**`community_picks` table:**
- Stores user-submitted betting picks
- Fields: sport, team_name, pick_type, pick_details, reasoning, game_date, opponent_team
- Tracks upvotes/downvotes, locked status, and outcome (for future use)
- Indexes on user_id, sport, game_date, outcome, is_locked

**`community_pick_votes` table:**
- Tracks individual user votes (upvote/downvote)
- One vote per user per pick (UNIQUE constraint)
- Automatic vote count updates via triggers

**Key Features:**
- Row Level Security (RLS) enabled
- Users can only edit/delete their own picks (unless admin)
- Picks lock when game starts (prevents editing after games begin)
- Automatic timestamp updates
- Vote count triggers that auto-update upvotes/downvotes on picks

### 2. Core Components

**UserCircle Component (`src/components/UserCircle.tsx`):**
- Displays user avatar with gradient background
- 26 unique gradients mapped to letters A-Z
- Shows first letter of display name or email
- Size variants: sm, md, lg, xl
- Consistent, beautiful color scheme for user identity

**TeamCircle Component (`src/components/TeamCircle.tsx`):**
- Displays team logo placeholder in circular frame
- Team initials shown when no logo available
- Colored border based on team colors (ready for expansion)
- Used for native picks from our games

**CommunityPickCard Component (`src/components/CommunityPickCard.tsx`):**
- Reddit-style voting interface with left sidebar
- Up/down arrows with vote count in middle
- Shows UserCircle or TeamCircle based on pick type
- Displays pick details, reasoning, game date, sport badge
- Lock indicator when game has started
- Outcome badges (Win/Loss/Push) for completed picks
- Edit/delete buttons for own picks (if not locked and no votes)
- Admin can delete any pick

**PickSubmissionModal Component (`src/components/PickSubmissionModal.tsx`):**
- Multi-step form with live preview
- Step 1: Select sport (NFL, CFB, NBA, NCAAB, MLB, NHL, MMA, Boxing, Soccer, Other)
- Step 2: Choose pick source (Native from games or Custom)
- Step 3a (Native): Select game, team, bet type (auto-populates available options)
- Step 3b (Custom): Enter team, opponent, bet type, details, game date
- Step 4: Optional reasoning textarea
- **Live preview** shows exactly how pick will appear before submission
- Validation prevents incomplete submissions

### 3. Game Data Service (`src/services/communityPicksGameService.ts`)

Fetches active games from existing data sources:
- **NFL games:** from `v_input_values_with_epa` table
- **CFB games:** from `cfb_live_weekly_inputs` table
- Filters out past games automatically
- Formats games consistently for pick submission
- Provides available betting options (ML, spread, total) per team
- Ready to add NBA, NCAAB, MLB when those data sources are available

### 4. Main Page (`src/pages/CommunityVoting.tsx`)

**Features:**
- Header with "Submit Pick" button
- Sport filter tabs (All, NFL, CFB, NBA, NCAAB, MLB)
- Sort options: Most Votes, Newest, Oldest
- Two main tabs:
  - **Active Picks:** Shows picks for upcoming games
  - **History:** Shows completed/locked picks with outcome filter

**Functionality:**
- Real-time voting with optimistic UI updates
- Groups picks by sport with collapsible sections
- Fetches user profiles to display names with picks
- Vote toggling (click again to un-vote, click opposite to change vote)
- Users cannot vote on their own picks
- Edit own picks (only if not locked and no votes yet)
- Delete own picks (anytime) or admin can delete any
- Outcome filter in History (All/Wins/Losses/Pushes)

### 5. Navigation Integration

**Updated `src/nav-items.tsx`:**
- Added Community Picks menu item with Users icon
- Positioned alongside Feature Requests and Discord Channel
- Creates logical "Social" section grouping

**Updated `src/App.tsx`:**
- Added route `/community-voting`
- Wrapped in ProtectedRoute (requires authentication)

**Updated `src/integrations/supabase/types.ts`:**
- Added TypeScript types for `community_picks` table
- Added TypeScript types for `community_pick_votes` table
- Full type safety for all database operations

## User Flow

### Submitting a Pick:
1. Click "Submit Pick" button
2. Select sport
3. Choose "From Current Games" (NFL/CFB) or "Custom Pick"
4. For native picks:
   - Select game from dropdown
   - Choose team (away/home)
   - Select bet type (ML, Spread, Over, Under)
   - Pick details auto-populate
5. For custom picks:
   - Enter team name
   - Enter opponent (optional)
   - Select bet type
   - Enter pick details manually
   - Select game date
6. Add optional reasoning
7. See live preview of how pick will appear
8. Submit

### Voting on Picks:
1. Browse Active Picks or History
2. Filter by sport and sort by votes/time
3. Click up arrow to upvote, down arrow to downvote
4. Click again to remove vote
5. Vote counts update in real-time
6. Cannot vote on own picks

### Managing Picks:
1. Edit own pick if not locked and has no votes yet
2. Delete own pick anytime
3. Admins can delete any pick
4. Picks automatically lock when games start (prevents editing)

## Phase 2 - Deferred Features

The following features are ready to implement once data is available:

### Pick Outcome Tracking:
- Requires `nfl_training_data` for NFL results
- Needs equivalent CFB historical results table
- Will automatically calculate Win/Loss/Push for each pick
- Cron job to sync outcomes hourly
- Manual sync tool in Admin panel

### Community Leaderboard:
- User rankings by win percentage
- Stats: Total picks, wins, losses, pushes, win %
- Net votes and engagement metrics
- Filters: All time, this month, this week, by sport
- Top 3 get special gold/silver/bronze styling
- Click user to see their picks

### Additional Enhancements:
- Email notifications for vote milestones
- Badges for "Hot Streak", "Pick of the Week"
- Pick comments/discussion threads
- Confidence ratings (1-5 stars)
- Export picks to CSV

## Technical Details

**Performance Optimizations:**
- Indexed database queries for fast filtering
- Real-time vote count updates via triggers (no separate updates needed)
- Optimistic UI updates for smooth voting experience
- Lazy loading of user profiles (batch fetched)

**Security:**
- Row Level Security (RLS) enforces user permissions
- Users can only modify their own picks
- Admin override available via has_role function
- Prevents voting on own picks (client and database level)

**Data Integrity:**
- UNIQUE constraint prevents duplicate votes
- CHECK constraints enforce valid pick types
- Cascading deletes clean up related votes
- Automatic timestamp management

## Testing Recommendations

1. **Pick Submission:**
   - Test native picks for NFL and CFB
   - Test custom picks with various sports
   - Verify pick details auto-populate correctly
   - Test validation (required fields)

2. **Voting:**
   - Upvote/downvote functionality
   - Vote toggling (change and remove votes)
   - Verify cannot vote on own picks
   - Check vote counts update correctly

3. **Filtering:**
   - Sport filters (All, NFL, CFB, etc.)
   - Sort options (votes, newest, oldest)
   - Active vs History tabs
   - Outcome filter in History

4. **Permissions:**
   - User can edit own pick (if no votes)
   - User can delete own pick
   - Admin can delete any pick
   - Cannot edit locked picks

5. **Edge Cases:**
   - No picks available (empty state)
   - Past game dates filter correctly
   - Long reasoning text displays properly
   - Mobile responsive layout

## Next Steps

1. **Monitor Usage:**
   - Track pick submission volume
   - Monitor voting engagement
   - Identify popular sports/bet types

2. **Gather Feedback:**
   - User experience with pick submission flow
   - Usefulness of native vs custom picks
   - Desire for additional features

3. **Prepare for Phase 2:**
   - Set up CFB historical results table
   - Design leaderboard UI mockups
   - Plan outcome calculation algorithm
   - Consider comment system architecture

## Files Created/Modified

**New Files:**
- `supabase/migrations/20250210000000_create_community_picks.sql`
- `src/components/UserCircle.tsx`
- `src/components/TeamCircle.tsx`
- `src/components/CommunityPickCard.tsx`
- `src/components/PickSubmissionModal.tsx`
- `src/pages/CommunityVoting.tsx`
- `src/services/communityPicksGameService.ts`

**Modified Files:**
- `src/nav-items.tsx` (added Community Picks nav item)
- `src/App.tsx` (added route)
- `src/integrations/supabase/types.ts` (added table types)

## Success Metrics (Future Tracking)

- Total picks submitted per week
- Average votes per pick
- User return rate (picks submitted by returning users)
- Pick accuracy by sport (when outcome tracking available)
- Most popular bet types
- Community engagement (votes cast per user)

---

**Status:** ✅ Phase 1 Complete - Ready for user testing
**Next Phase:** Outcome tracking and leaderboard (pending CFB data)



