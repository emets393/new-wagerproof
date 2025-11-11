# Community Voting Feature - Testing Guide

## Prerequisites

1. **Run Database Migration:**
   ```bash
   # Apply the migration to create the tables
   # This should be done via Supabase dashboard or CLI
   ```

2. **Start Development Server:**
   ```bash
   npm run dev
   ```

3. **Log in** to the application with a test account

## Testing Checklist

### 1. Navigation & Access ✓

- [ ] Navigate to Community Picks from the sidebar menu
- [ ] Verify the page loads without errors
- [ ] Check that the "Users" icon appears next to the menu item
- [ ] Confirm the page is accessible at `/community-voting`

### 2. Empty State ✓

- [ ] With no picks submitted, verify empty state message appears
- [ ] Check "Submit First Pick" button is visible
- [ ] Ensure the message is clear and actionable

### 3. Pick Submission - Native Picks ✓

**NFL Pick:**
- [ ] Click "Submit Pick" button
- [ ] Select "NFL" from sport dropdown
- [ ] Choose "From Current Games"
- [ ] Verify games list loads (should show current NFL games)
- [ ] Select a game from dropdown
- [ ] Choose away team
- [ ] Select bet type (Moneyline/Spread/Over/Under)
- [ ] Verify pick details auto-populate
- [ ] Add optional reasoning
- [ ] Check live preview updates in real-time
- [ ] Submit pick
- [ ] Verify pick appears in Active Picks section

**CFB Pick:**
- [ ] Repeat above steps for CFB
- [ ] Verify CFB games load correctly
- [ ] Submit a CFB pick

### 4. Pick Submission - Custom Picks ✓

- [ ] Click "Submit Pick"
- [ ] Select any sport (NBA, MLB, MMA, etc.)
- [ ] Choose "Custom Pick"
- [ ] Enter team name (e.g., "Lakers")
- [ ] Enter opponent (optional) (e.g., "Celtics")
- [ ] Select bet type
- [ ] Enter pick details manually (e.g., "Lakers -5.5")
- [ ] Select future game date
- [ ] Add reasoning
- [ ] Check preview updates
- [ ] Submit pick
- [ ] Verify pick appears in Active Picks

### 5. Pick Display ✓

- [ ] Verify UserCircle shows correct first letter
- [ ] Check gradient color is based on letter
- [ ] Confirm sport badge displays correctly (NFL/CFB/etc.)
- [ ] Check pick type badge (ML/Spread/Over/Under)
- [ ] Verify game date formatted correctly
- [ ] Check reasoning text displays if provided
- [ ] Verify user info shows at bottom (avatar + name/email + timestamp)

### 6. Voting Functionality ✓

**Upvoting:**
- [ ] Click up arrow on another user's pick
- [ ] Verify vote count increases by 1
- [ ] Check up arrow highlights in green
- [ ] Click up arrow again to un-vote
- [ ] Verify vote count decreases by 1
- [ ] Check up arrow returns to normal state

**Downvoting:**
- [ ] Click down arrow on another user's pick
- [ ] Verify vote count decreases by 1
- [ ] Check down arrow highlights in red
- [ ] Click down arrow again to un-vote
- [ ] Verify vote count increases by 1

**Vote Changing:**
- [ ] Upvote a pick
- [ ] Click downvote on the same pick
- [ ] Verify vote changes from upvote to downvote (net -2 change)
- [ ] Click upvote again
- [ ] Verify vote changes back (net +2 change)

**Own Picks:**
- [ ] Try to vote on your own pick
- [ ] Verify vote buttons are disabled
- [ ] Confirm no vote is registered

### 7. Filtering & Sorting ✓

**Sport Filters:**
- [ ] Click "All Sports" tab - verify all picks show
- [ ] Click "NFL" tab - verify only NFL picks show
- [ ] Click "CFB" tab - verify only CFB picks show
- [ ] Test other sport tabs

**Sort Options:**
- [ ] Select "Most Votes" - verify picks sorted by net votes (descending)
- [ ] Select "Newest" - verify picks sorted by creation time (newest first)
- [ ] Select "Oldest" - verify picks sorted by creation time (oldest first)

**Grouping:**
- [ ] With multiple sports, verify picks grouped by sport
- [ ] Check sport headers (uppercase sport name)
- [ ] Verify grouping works with different filters

### 8. Active vs History Tabs ✓

**Active Picks:**
- [ ] Verify tab shows picks for upcoming games only
- [ ] Confirm past game picks don't appear
- [ ] Check locked picks don't appear here

**History:**
- [ ] Switch to History tab
- [ ] Verify shows completed/locked picks
- [ ] Test outcome filter (All/Wins/Losses/Pushes)
- [ ] Verify outcome badges display correctly (when outcomes exist)

### 9. Edit Functionality ✓

**Valid Edit Scenarios:**
- [ ] Find your own pick with 0 votes and not locked
- [ ] Click edit button (pencil icon)
- [ ] Verify modal opens with pick data
- [ ] Edit the pick
- [ ] Save changes
- [ ] Verify pick updates in list

**Invalid Edit Scenarios:**
- [ ] Try to edit your own pick after someone votes on it
- [ ] Verify edit button is hidden or disabled
- [ ] Try to edit someone else's pick (not admin)
- [ ] Verify no edit button appears

### 10. Delete Functionality ✓

**Own Picks:**
- [ ] Click delete button (trash icon) on your pick
- [ ] Confirm deletion dialog appears
- [ ] Click OK
- [ ] Verify pick is removed from list
- [ ] Verify toast notification shows "Pick deleted"

**Admin Delete:**
- [ ] Log in as admin
- [ ] Navigate to Community Picks
- [ ] Verify delete button appears on all picks
- [ ] Delete another user's pick
- [ ] Confirm it's removed

### 11. Lock Status ✓

**Manual Testing:**
- [ ] Create a pick for a game that has started
- [ ] Verify lock icon appears
- [ ] Check "Locked" badge displays
- [ ] Confirm edit button is hidden
- [ ] Verify pick is in History tab (not Active)

### 12. Responsive Design ✓

**Mobile View (< 768px):**
- [ ] Check page layout on mobile
- [ ] Verify vote sidebar still accessible
- [ ] Check pick cards stack properly
- [ ] Test submission modal on mobile
- [ ] Verify all buttons are tappable

**Tablet View (768px - 1024px):**
- [ ] Check layout at tablet size
- [ ] Verify proper spacing
- [ ] Test submission modal grid layout

**Desktop View (> 1024px):**
- [ ] Verify full layout with preview side-by-side
- [ ] Check proper spacing and alignment

### 13. Error Handling ✓

- [ ] Submit pick without required fields
- [ ] Verify validation prevents submission
- [ ] Try to submit duplicate pick
- [ ] Check network error handling (disconnect wifi)
- [ ] Verify error toasts display clearly

### 14. Performance ✓

- [ ] Load page with 50+ picks
- [ ] Check page load time is acceptable
- [ ] Test voting response time
- [ ] Verify filtering is instant
- [ ] Check sorting doesn't lag

### 15. Edge Cases ✓

**Long Text:**
- [ ] Submit pick with very long reasoning (500+ chars)
- [ ] Verify text displays properly
- [ ] Check no layout breaks

**Special Characters:**
- [ ] Submit pick with special characters in team name
- [ ] Verify proper encoding/display

**Date Boundaries:**
- [ ] Submit pick for today's date
- [ ] Submit pick for future date (next week)
- [ ] Verify filtering works correctly

**Multiple Users:**
- [ ] Have 2+ users submit picks simultaneously
- [ ] Verify all picks appear
- [ ] Test concurrent voting
- [ ] Check vote counts update correctly

### 16. Database Integrity ✓

**Query Console Tests:**
```sql
-- Verify picks are created
SELECT * FROM community_picks ORDER BY created_at DESC LIMIT 10;

-- Check vote counts match actual votes
SELECT 
  p.id,
  p.upvotes,
  p.downvotes,
  (SELECT COUNT(*) FROM community_pick_votes WHERE pick_id = p.id AND vote_type = 'upvote') as actual_upvotes,
  (SELECT COUNT(*) FROM community_pick_votes WHERE pick_id = p.id AND vote_type = 'downvote') as actual_downvotes
FROM community_picks p;

-- Verify no duplicate votes
SELECT pick_id, user_id, COUNT(*) 
FROM community_pick_votes 
GROUP BY pick_id, user_id 
HAVING COUNT(*) > 1;

-- Check RLS policies work
-- (Try querying as different users)
```

## Known Limitations (Phase 1)

1. **No Outcome Tracking:** Picks show "pending" outcome until Phase 2
2. **No Leaderboard:** User stats not calculated until Phase 2
3. **Team Logos:** TeamCircle shows initials, not actual logos (can be added later)
4. **Limited Sports:** Native picks only for NFL/CFB (NBA, MLB coming)
5. **No Comments:** Voting only, no discussion threads (future feature)

## Success Criteria

✅ All 16 testing sections pass
✅ No console errors
✅ No linter warnings
✅ Build completes successfully
✅ Database migrations apply cleanly
✅ RLS policies enforce correctly
✅ User experience is smooth and intuitive

## Reporting Issues

If you find any issues during testing:

1. **Document the issue:**
   - What were you doing?
   - What did you expect to happen?
   - What actually happened?
   - Can you reproduce it consistently?

2. **Check console:**
   - Any JavaScript errors?
   - Network errors?
   - Component warnings?

3. **Database state:**
   - Query the tables to see actual data
   - Check if triggers fired correctly
   - Verify RLS isn't blocking operations

4. **Browser info:**
   - Which browser/version?
   - Desktop or mobile?
   - Any extensions enabled?

## Next Steps After Testing

1. **Deploy Migration:** Apply to production database
2. **Monitor Usage:** Track pick submissions and votes
3. **Gather Feedback:** Survey users about the experience
4. **Plan Phase 2:** Begin CFB outcome tracking implementation
5. **Iterate:** Make improvements based on usage data

---

**Happy Testing! 🎉**



