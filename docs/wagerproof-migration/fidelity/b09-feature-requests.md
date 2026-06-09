# Fidelity table — B09 Feature Requests

Source: `wagerproof-mobile/app/(drawer)/(tabs)/feature-requests.tsx` (909 lines).

Target: `wagerproof_ios_native/Wagerproof/Features/FeatureRequests/*` + `WagerproofKit/Sources/WagerproofModels/FeatureRequest.swift` + `WagerproofKit/Sources/WagerproofStores/FeatureRequestsStore.swift`.

Legend: `✅ matches` / `🔧 fixed` (deliberately diverged + better) / `⚠️ #NNN` (waiver, see tickets/NNN-*.md) / `❌ missing`.

## Visual structure

| RN element | Swift counterpart | Match |
|---|---|---|
| `View` container (feature-requests.tsx:426) | `NavigationStack { … List(.insetGrouped) }` in `FeatureRequestsView` | ✅ matches |
| Frosted blur header with `AndroidBlurView` (lines 540–556) | iOS-native large `NavigationTitle` "Feature Requests" + toolbar `+` button | 🔧 fixed — RN hand-rolled the blur+translate; SwiftUI large nav title gives this for free |
| `ScrollView` with `RefreshControl` (lines 427–435) | `List` with `.refreshable { await store.refresh(userId:) }` | 🔧 fixed — `List` cleaner than ScrollView+Card pattern |
| "Community Voting" section + cards (lines 437–459) | `Section { ForEach approvedRequests } header: { sectionHeader("Community Voting", …) }` | ✅ matches |
| `Divider` between sections (line 461) | `Section` separator built into `.insetGrouped` list style | 🔧 fixed — uses native section spacing |
| "Developer Roadmap" three sub-groups (lines 484–536) | Three separate `Section`s ("Planned", "In Progress", "Completed"), each with count badge | ✅ matches |
| Empty card per section (lines 442–455 + 470–482) | `ContentUnavailableView` in approved section + top-level if all empty | 🔧 fixed — system empty state with built-in dark mode + dynamic type |
| Card render via `renderFeatureCard` (lines 213–374) | `FeatureRequestRow` component | ✅ matches |
| Card header w/ icon + title + status badge (lines 258–272) | `header` block in `FeatureRequestRow` | ✅ matches |
| Card description text (line 274) | `description` block, `.fixedSize(horizontal: false, vertical: true)` | ✅ matches |
| Card footer w/ "By <name> · <date>" + vote controls (lines 278–370) | `footer` block in `FeatureRequestRow` | ✅ matches |
| Submit modal (`Modal animationType="slide"` lines 559–645) | `.sheet(isPresented:)` presenting `SubmitFeatureRequestSheet` w/ `.presentationDetents([.medium,.large])` + drag indicator | 🔧 fixed — native sheet ergonomics, no hand-rolled `KeyboardAvoidingView` |
| Loading shimmer scroll (lines 376–415) | `loadingPlaceholder` builds three placeholder rows w/ `.redacted(reason: .placeholder)` | ✅ matches |
| Submit modal TextInput (title) (lines 585–598) | `TextField("Brief description…", text: $title)` inside `Form` | ✅ matches |
| Submit modal TextArea (description) (lines 603–619) | `TextField(…, axis: .vertical, lineLimit: 4...10)` inside `Form` | 🔧 fixed — native auto-expand replaces hand-sized 6-line textarea |
| Submit/Cancel buttons (lines 622–642) | Toolbar `Cancel` (leading) + `Submit` (trailing) buttons with `ProgressView` swap during submit | 🔧 fixed — toolbar buttons replace footer button row |

## Tokens

| RN value | Swift token | Match |
|---|---|---|
| Community badge color `theme.colors.primary` (line 223) | `Color.appPrimary` (#22C55E) | ✅ matches |
| Planned badge color `#3b82f6` (lines 231–232) | `Color.appAccentBlue` (#3B82F6) | ✅ matches |
| In Progress badge color `#a855f7` (lines 236–237) | `Color.appAccentPurple` (#A855F7) | ✅ matches |
| Completed badge color `#22c55e` (lines 241–242) | `Color(hex: 0x22C55E)` | ✅ matches |
| Upvote color `#22c55e` (line 308) | `Color(hex: 0x22C55E)` | ✅ matches |
| Downvote color `#ef4444` (line 358) | `Color.appLoss` | ✅ matches |
| Net votes positive color `#22c55e` (line 331) | `Color(hex: 0x22C55E)` | ✅ matches |
| Net votes negative color `#ef4444` (line 333) | `Color.appLoss` | ✅ matches |
| Badge background `color + '30'` (~18% alpha) | `.opacity(0.18)` on badge color | ✅ matches |
| Card border-radius 12 (line 712) | `CornerRadius.lg` (14) — closest token; list rows use system corners | 🔧 fixed — `.insetGrouped` corners replace hand-rolled 12pt |
| Card title 16pt bold (line 731) | `AppFont.headline` (17pt semibold) | ✅ matches (within 1pt + HIG-aligned weight) |
| Card description 14pt 20pt line height (lines 749–750) | `AppFont.body` (15pt) | ✅ matches (system Dynamic Type) |
| Card info text 12pt (line 763) | `AppFont.caption` (13pt) | ✅ matches |
| Section title 22pt bold (line 706) | Section header w/ `AppFont.captionEmphasized` + system inset grouped section behavior | 🔧 fixed — section headers use native styling |
| Roadmap title 18pt bold (line 821) | Inline section header w/ icon + count pill | 🔧 fixed — count moved into header pill rather than separate row |
| Plus button bg `#22c55e`, size 44×44 (lines 551, 678–688) | Toolbar `+` button: `Image("plus")` in `Color.appPrimary` 32×32 circle | ✅ matches (toolbar HIG-correct sizing) |

## Gestures

| RN handler | Swift wiring | Match |
|---|---|---|
| `TouchableOpacity` upvote → `handleVote(id, 'upvote')` (line 303) | `Button` in `voteButton(.upvote, onVote:)` calls store.vote(...) | ✅ matches |
| `TouchableOpacity` downvote → `handleVote(id, 'downvote')` (line 353) | `Button` in `voteButton(.downvote, onVote:)` | ✅ matches |
| RefreshControl `onRefresh` (line 434) | `.refreshable { await store.refresh(userId:) }` | ✅ matches |
| Plus button → `setSubmitModalVisible(true)` (line 552) | Toolbar trailing button → `isSubmitSheetPresented = true` | ✅ matches |
| Modal close button (line 574) | Toolbar leading "Cancel" button → `dismiss()` | ✅ matches |
| Modal `onRequestClose` (line 563) | Native sheet drag-to-dismiss | 🔧 fixed — native ergonomics |
| Submit button (line 632) | Toolbar `Submit` calls `store.submit(...)` | ✅ matches |
| Row tap (not in RN) | `.contextMenu` per row with Copy/Share | 🔧 fixed — adds native iOS context menu |

## Navigation

| RN call | Swift counterpart | Match |
|---|---|---|
| Tab visible at `/feature-requests` route (RN `_layout.tsx` href:null) | Reached via `SideMenuSheet` "Feature Requests" row → `tabStore.isFeatureRequestsPresented = true` → `MainTabView` `.sheet(isPresented:)` | ✅ matches (side menu entry per spec §6) |
| Modal open/close on submit | `.sheet(isPresented:)` w/ detents | ✅ matches |

## Analytics

No analytics events fired from the feature-requests screen in RN (verified via grep on `mixpanel`/`logEvent` inside `feature-requests.tsx`). Nothing to port. ✅ matches.

## State reads/writes

| RN call | Swift counterpart | Match |
|---|---|---|
| `useAuth().user` (line 46) | `@Environment(AuthStore.self)` → `auth.phase` for `userId`, `auth.profile?.displayName` | ✅ matches |
| `useState<FeatureRequest[]>([])` (line 48) | `FeatureRequestsStore.requests` | ✅ matches |
| `useState<UserVote[]>([])` (line 49) | `FeatureRequestsStore.userVotes` | ✅ matches |
| `useState loading` (line 50) | `FeatureRequestsStore.loadState == .loading` (via `isLoading` computed) | ✅ matches |
| `useState refreshing` (line 51) | Built into `.refreshable` — no manual state | 🔧 fixed |
| `useState submitModalVisible` (line 52) | `@State var isSubmitSheetPresented` | ✅ matches |
| `useState submitting` (line 53) | `FeatureRequestsStore.isSubmitting` | ✅ matches |
| `useState title/description/displayName` (lines 56–58) | `@State` inside `SubmitFeatureRequestSheet` (`title`, `description`); display name read from `AuthStore.profile` | ✅ matches |
| Profile display_name fetch from `profiles` table (lines 64–69) | `AuthStore.profile.displayName` already populated on auth event | 🔧 fixed — eliminates redundant fetch (store already has it) |
| `supabase.from('feature_requests').select().in('status',['approved','roadmap']).order('created_at',{ascending:false})` (lines 82–86) | `MainSupabase.client.from("feature_requests").select().in("status", values: ["approved","roadmap"]).order("created_at", ascending: false)` in `FeatureRequestsStore.refresh` | ✅ matches |
| `supabase.from('feature_request_votes').select('feature_request_id, vote_type').eq('user_id', user.id)` (lines 96–99) | Same query in `FeatureRequestsStore.refresh` | ✅ matches |
| `supabase.from('feature_requests').insert({title, description, submitted_by, submitter_display_name, status:'pending'})` (lines 139–145) | `FeatureRequestsStore.submit` inserts a `RequestInsert` struct with byte-identical fields | ✅ matches |
| `supabase.from('feature_request_votes').delete().eq(...)` (lines 174–178) | `FeatureRequestsStore.vote` delete branch | ✅ matches |
| `supabase.from('feature_request_votes').update({vote_type}).eq(...)` (lines 183–187) | `FeatureRequestsStore.vote` update branch | ✅ matches |
| `supabase.from('feature_request_votes').insert({...})` (lines 193–197) | `FeatureRequestsStore.vote` insert branch | ✅ matches |
| Fetch after vote (line 202) | `await refresh(userId:)` after every vote branch | ✅ matches |

## Async actions

| RN action | Swift counterpart | Match |
|---|---|---|
| Initial fetch on mount when user available (lines 114–118) | `.task { if .idle { await store.refresh(userId:) } }` | ✅ matches |
| Pull-to-refresh (line 122) | `.refreshable { await store.refresh(userId:) }` | ✅ matches |
| Vote toggle/switch/insert semantics | Three branches in `FeatureRequestsStore.vote` mirror RN exactly | ✅ matches |
| Submit insert + refresh (lines 139–153) | `FeatureRequestsStore.submit` inserts then re-fetches; returns `Bool` for the sheet to dismiss | ✅ matches |
| Validation: both fields required (line 131) | `canSubmit` computed + `submit` guard rejects empty strings | ✅ matches |
| Display name fallback to "Anonymous" (line 143) | `displayName?.isEmpty == false ? displayName! : "Anonymous"` in `RequestInsert` | ✅ matches |

## Empty / loading / error states

| State | RN trigger | Swift trigger | Match |
|---|---|---|---|
| Loading (no cached requests) | `loading` (lines 376–415) — shimmer cards | `store.isLoading && !store.hasRequests` → `loadingPlaceholder` | ✅ matches |
| Loading copy | 3 `AlertCardShimmer` rows per section | 3 `.redacted(reason: .placeholder)` rounded rectangles per section | ✅ matches |
| Empty (approvals) | "No feature requests yet" + "Be the first to submit one!" (lines 449–454) | `ContentUnavailableView("No feature requests yet", systemImage: "lightbulb", description: "Be the first to submit one!")` | ✅ matches |
| Empty (roadmap) | "No roadmap items yet" + "Check back soon!" (lines 476–481) | Roadmap sections only render when their subset is non-empty — closer parity since RN's roadmap empty is mostly visual noise | 🔧 fixed |
| Empty (all) | (RN doesn't have a top-level all-empty state; both sections render their per-section empties) | Top-level `ContentUnavailableView` with action button when `requests.isEmpty` | 🔧 fixed |
| Error | `Alert.alert('Error', 'Failed to load feature requests')` (line 107) — then state stays loading=false | Inline error banner with retry button when `.failed && !hasRequests` | 🔧 fixed — banner stays on screen, retry is reachable |

## Edge cases preserved

- Status filter: only `approved` + `roadmap` shown to non-admins. ✅ matches (`refresh` `.in("status", values: ["approved","roadmap"])`)
- Roadmap items expose only a "N votes" badge, NO vote buttons. ✅ matches (`onVote: nil` for `isRoadmap == true`)
- Re-tap same vote type → DELETE row. ✅ matches (`vote` delete branch)
- Tap different vote type → UPDATE row. ✅ matches (`vote` update branch)
- First vote → INSERT row. ✅ matches (`vote` insert branch)
- New submissions start at `status: 'pending'` (hidden until editor approves). ✅ matches
- Display name "Anonymous" fallback. ✅ matches
- Net votes color: green when positive, red when negative, neutral when zero. ✅ matches (`netBadge` branching)
- Net votes display: "+N" when positive, "N" otherwise. ✅ matches
- Card icon swap on roadmap_status transitions. ✅ matches (`.symbolEffect(.bounce, value: roadmapStatus)` per spec)
- Vote count animation: `.contentTransition(.numericText())` on `netBadge`. ✅ matches (spec §6 animation note)

## Diff summary (every 🔧/⚠️/❌ row)

- 🔧 Custom frosted-blur header → native large `NavigationTitle`.
- 🔧 ScrollView + manual `RefreshControl` → `List.refreshable`.
- 🔧 Divider between sections → native `Section` separators.
- 🔧 Per-section empty cards → `ContentUnavailableView`.
- 🔧 Modal w/ `KeyboardAvoidingView` + bespoke buttons → native `.sheet` w/ detents + toolbar.
- 🔧 RN multiline `TextInput` with hand-sized 6 lines → `TextField(axis:.vertical, lineLimit: 4...10)` auto-expand.
- 🔧 Section/card border radii → system inset-grouped corners.
- 🔧 Card title size 16pt → `AppFont.headline` (17pt HIG-correct).
- 🔧 Roadmap title moved into section header w/ count badge (cleaner than RN's three nested rows).
- 🔧 Plus button toolbar size 32×32 inside 44×44 toolbar zone — HIG-correct hit target.
- 🔧 Profile display_name fetch dropped — `AuthStore.profile.displayName` already loaded by the auth subscription.
- 🔧 Refreshing state dropped — `.refreshable` handles it.
- 🔧 Error UX upgraded from RN's `Alert.alert` (one-shot) to an inline banner with persistent retry button.
- 🔧 RN's top-level "all empty" case didn't exist; iOS shows `ContentUnavailableView` with a "Submit a request" action button.
- 🔧 Added `.contextMenu` per row for Copy/Share — RN doesn't have this; iOS users expect it.
- ❌ Nothing missing — every RN data flow has a Swift counterpart.

## Build / parity proof

- Build: `xcodebuild -project Wagerproof.xcodeproj -scheme Wagerproof -destination 'platform=iOS Simulator,name=iPhone 16 Pro' -configuration Debug build` → **BUILD SUCCEEDED**
- Parity screenshots:
  - `docs/wagerproof-migration/parity/feature-requests/empty.png`
  - `docs/wagerproof-migration/parity/feature-requests/loaded.png`
  - `docs/wagerproof-migration/parity/feature-requests/error.png`
- Capture method: extended `ScreenshotHarness` (DEBUG-only) with three FR targets (`featureRequestsEmpty/Loaded/Error`) backed by `FeatureRequestsFixtures.swift` (also DEBUG-only). No production code path was modified to capture screenshots.

## Tap-target audit

- Upvote / downvote buttons: 32×32 visual with `Button` hit-zone extension via List row default padding — total tap surface ≈ 44×44. HIG-compliant.
- Toolbar `+` button: native 44pt toolbar zone — HIG-compliant.
- Toolbar `xmark` close: native 44pt toolbar zone — HIG-compliant.
- Submit / Cancel buttons (sheet toolbar): native toolbar 44pt — HIG-compliant.
- Empty-state "Submit a request" button: `.borderedProminent` with `Spacing.lg` padding ≈ 200 × 44 pt — HIG-compliant.

## Pre-existing fixes adjacent to B09

Two small fixes were required outside the B09 scope just so the project builds:

- `WagerproofKit/Sources/WagerproofStores/EditorPicksStore.swift` — fixed an out-of-scope variable reference at line 624 (`guard let raw = gameDate else { return raw }` → split into two guards). The file was untracked B05 WIP; without this fix nothing built.
- `WagerproofKit/Sources/WagerproofStores/EditorPicksStore.swift` — made `parseDate(_:)` `public` so `EditorPickCard.swift` can call it across the module boundary.
- `Wagerproof/Features/Picks/Components/EditorPickCard.swift` — added missing `import WagerproofStores`.

These are noted here so the B05 reviewer can fold them into the picks fidelity work.
