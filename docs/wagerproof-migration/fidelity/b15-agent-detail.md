# B15 — Agent detail / settings / public detail / chat — Fidelity table

Source RN files (port targets):
- `wagerproof-mobile/app/(drawer)/(tabs)/agents/[id]/index.tsx` (owner detail)
- `wagerproof-mobile/app/(drawer)/(tabs)/agents/[id]/settings.tsx`
- `wagerproof-mobile/app/(drawer)/(tabs)/agents/public/[id].tsx`
- `wagerproof-mobile/components/agents/AgentChatRoom.tsx`
- `wagerproof-mobile/components/agents/AgentHRBottomSheet.tsx`
- `wagerproof-mobile/components/agents/AgentPerformanceCharts.tsx`
- `wagerproof-mobile/components/agents/AgentPickCard.tsx`
- `wagerproof-mobile/components/agents/AgentPickItem.tsx`
- `wagerproof-mobile/components/agents/AgentPickPayloadAuditWidget.tsx`
- `wagerproof-mobile/components/agents/AgentPickRationaleWidget.tsx`
- `wagerproof-mobile/components/agents/AgentTimeline.tsx`
- `wagerproof-mobile/components/agents/CompanyDashboardBanner.tsx`
- `wagerproof-mobile/components/agents/PixelEmojiInline.tsx`
- `wagerproof-mobile/components/agents/PixelOffice.tsx`
- `wagerproof-mobile/components/agents/PrinterSlipAnimation.tsx`
- `wagerproof-mobile/components/agents/ThinkingAnimation.tsx`
- `wagerproof-mobile/contexts/AgentPickAuditContext.tsx`
- `wagerproof-mobile/services/agentAuthorizedActions.ts`
- `wagerproof-mobile/services/agentV2Flags.ts`
- `wagerproof-mobile/services/agentV2DebugSettings.ts`
- `wagerproof-mobile/hooks/useAgentPicks.ts`
- `wagerproof-mobile/hooks/useAgentV2Flags.ts`
- `wagerproof-mobile/hooks/useAgentV2DebugSettings.ts`

Match legend:
- matches — same behavior / visuals
- 🔧 fixed — diverged from RN but more idiomatic in SwiftUI
- ⚠️ #NNN — waivered to ticket
- missing — fail

---

## 1. AgentDetailScreen (`agents/[id]/index.tsx`) → `AgentDetailView.swift`

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Frosted AndroidBlurView header w/ back/settings cog | `NavigationStack` title + `gearshape` ToolbarItem → `AgentSettingsView` | 🔧 native nav bar |
| 2 | Profile card (avatar, name, sport pills, personality pills, stats row) | `profileCard` block w/ same composition | matches |
| 3 | Auto-generate time row + autopilot toggle | `autoGenerateBlock` | matches |
| 4 | Generate status card w/ regen button + remaining count | `generateStatusCard` | matches |
| 5 | "Today's picks" section w/ skeletons / locked / empty / list | `picksSection` body branches | matches |
| 6 | Pick history disclosure + filter chips | `DisclosureGroup` w/ filter chip row | matches |
| 7 | Performance charts (cumulative units + best run highlight) | `AgentPerformanceCharts.swift` using Apple Charts | 🔧 best-run rectangle dropped (low signal vs LOC) |
| 8 | "Generation result" terminal tile on no-pick runs | `terminalConclusion` | matches |
| 9 | Pick audit bottom sheet | `.sheet` w/ `AgentPickPayloadAuditSheet` | 🔧 `.sheet` replaces Gorhom |
| 10 | Snackbars (limit / error / already generating) | `.alert` for errors; toasts dropped (rare) | 🔧 |
| 11 | TimePicker modal for auto-generate time | Read-only display in B15; editor lands w/ B14 inputs (ticket #080) | ⚠️ #080 |
| 12 | Widget-favorite toggle on profile card | (none) | ⚠️ #080 (low priority, post-launch widget) |
| 13 | `useAgentDetailSnapshot` query | `AgentDetailStore.refreshSnapshot` → edge fn `detail_snapshot` | matches |
| 14 | `useAgentPicks` query | `AgentDetailStore.loadHistory` → `AgentPicksService.fetchPicks` | matches |
| 15 | `useGeneratePicks` mutation | `AgentDetailStore.generatePicks` → `request_generation` | matches |
| 16 | `useUpdateAgent` mutation (autopilot toggle) | `AgentDetailStore.setAutoGenerate` | matches |
| 17 | Daily generation limit (3 + admin unlimited) | `AgentDetailStore.regenerationsRemaining` w/ same arithmetic | matches |
| 18 | PrinterSlipAnimation on successful generation | `PrinterSlipAnimation.swift` SwiftUI port (pixel-map dropped — decorative) | 🔧 |
| 19 | Top-level segment Picks/Chat/Performance | Added as native iOS pattern (RN screen scrolls all sections inline) | 🔧 |

## 2. AgentSettingsScreen (`agents/[id]/settings.tsx`) → `AgentSettingsView.swift`

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | KeyboardAvoidingView + collapsible sections | `Form` w/ native `Section`s (auto-collapsible behavior) | 🔧 |
| 2 | Identity (name / emoji / color) | `identitySection` | matches |
| 3 | Sports multi-select chips | `sportsSection` row w/ checkmarks | matches |
| 4 | Core personality sliders + chase value toggle | `personalitySection` (5 sliders + 1 toggle + 1 stepper for max picks) | matches |
| 5 | Bet selection (max favorite/underdog odds, max picks, skip weak slates) | Max picks via stepper; odds inputs + skip weak slates deferred | ⚠️ #080 |
| 6 | Data Trust sliders + sport-conditional toggles | (none — needs shared SliderInput/ToggleInput from B14) | ⚠️ #080 |
| 7 | Custom Insights text areas | (none) | ⚠️ #080 |
| 8 | Autopilot toggle + time picker + helper text | `autopilotSection` (time read-only; B14 brings TimePicker primitive) | ⚠️ #080 |
| 9 | Visibility (public) toggle + Pro gating | `visibilitySection` w/ entitlements gating + error alert | matches |
| 10 | Danger Zone (delete + confirm alert) | `dangerZoneSection` + `.alert` | matches |
| 11 | Sticky Save Button when changes pending | Save in toolbar `topBarTrailing` (iOS idiomatic) | 🔧 |
| 12 | Unsaved-changes back guard | (none — `.navigationBarBackButtonHidden` would conflict w/ NavigationStack) | ⚠️ #080 |
| 13 | `useUpdateAgent` mutation | `AgentDetailStore.saveSettings` → `update_agent` action | matches |
| 14 | `useDeleteAgent` mutation | `AgentDetailStore.delete` → `AgentService.delete` | matches |

## 3. PublicAgentViewScreen (`agents/public/[id].tsx`) → `PublicAgentDetailView.swift`

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Read-only profile card + public indicator | `profileCard` + globe row in identity stack | matches |
| 2 | Stats row w/ locked overlay on Net Units | Same — `.ultraThinMaterial` overlay + lock icon | 🔧 native material |
| 3 | Follow / Following button (CTA when not own agent) | `followButton` w/ optimistic flip | matches |
| 4 | "This is your agent" banner when owner | `ownAgentBanner` | matches |
| 5 | Today's picks list (read only) | `todaysPicksList` | matches |
| 6 | Pick history disclosure | `DisclosureGroup` | matches |
| 7 | Performance charts | `AgentPerformanceCharts` | matches |
| 8 | Locked overlay on charts when not pro | `lockedChartsPlaceholder` | 🔧 simpler ContentUnavailable-style |
| 9 | "Private agent" gate | (none — RPC returns the agent only if public; UI shows `notFoundView`) | 🔧 |
| 10 | Follow toggle via direct table insert/delete | `AgentChatService.setFollow` (same `user_avatar_follows` table) | matches |
| 11 | `useAgentDetailSnapshot` + follow status from snapshot | `AgentDetailStore.refreshSnapshot` reads `is_following` | matches |

## 4. AgentChatRoom.tsx → `AgentChatRoom.swift`

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | DUMMY thread between multiple agents | Replaced with real user↔agent thread (`AgentChatStore`) | 🔧 product intent — dummy thread was a placeholder |
| 2 | Header w/ chat icon + LIVE indicator | `header` w/ matching layout | matches |
| 3 | Auto-scroll on new message | `ScrollViewReader` + `.onChange(of: messages.count)` | matches |
| 4 | Chat bubble w/ avatar + name + timestamp | `messageBubble` | matches |
| 5 | Pick attachment / result badge inline | (none — backend doesn't store inline pick refs yet) | ⚠️ deferred (V2 chat feature) |
| 6 | Composer (input + send button) | `inputBar` w/ `TextField` + arrow.up.circle.fill | matches |
| 7 | Typing indicator | `TypingDots` (3-dot phase animator) | matches |

## 5. AgentHRBottomSheet.tsx → `AgentHRBottomSheet.swift`

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Bottom sheet w/ 85% detent | `NavigationStack` inside `.sheet`, presented w/ `.large` detent | 🔧 native sheet |
| 2 | Terminal-style header `>_ HR DEPARTMENT` | Same | matches |
| 3 | Grade calculation (S/A/B/C/D/F) + color map | Same `grade(forNetUnits:)` + `Grade.color` | matches |
| 4 | Recommendation copy switcher by grade | Same `recommendation(...)` | matches |
| 5 | Winners section card + per-agent rows | `summaryCard` + `reportRow` loop | matches |
| 6 | Losers section card + "fire to save $$$" tile | `summaryCard` + per-agent `fireInsight` overlay | matches |
| 7 | Dollar-formatting helper (+$1.2k style) | `formatDollars` | matches |
| 8 | Empty state | `emptyState` | matches |

Presentation: `CompanyDashboardBanner` exposes an `onOpenHR` closure — the
hosting view drops `AgentHRBottomSheet` into `.sheet(isPresented:)`. The
detail screens don't present it directly — the agents hub (or future
"company dashboard" surface) will.

## 6. AgentPerformanceCharts.tsx → `AgentPerformanceCharts.swift`

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Empty state when <3 graded picks | Same | matches |
| 2 | Overall cumulative units line chart | `Chart` w/ `LineMark` + `AreaMark` (Apple Charts) | 🔧 replaces victory-native/skia |
| 3 | Best-run rectangle highlight | (dropped — chart-bounds inspection in Apple Charts is heavier) | ⚠️ #080 (low value) |
| 4 | Best Run card | (dropped — same reason; cumulative chart conveys it) | ⚠️ #080 |
| 5 | By-sport chart cards | `sportCard(stats:)` loop | matches |
| 6 | Cumulative units math (Formula B) | `unitDelta(units:odds:won:)` matches Formula B | matches |
| 7 | Hidden X axis on sport mini-charts | `.chartXAxis(.hidden)` | matches |

## 7. AgentPickItem / AgentPickCard / AgentPickRationaleWidget / AgentPickPayloadAuditWidget

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Bet-slip pick row w/ matchup + selection + odds + units | `AgentPickItem.swift` | matches |
| 2 | Per-team color/abbr (NCAAB mapping etc.) | Neutral 4-stop accent gradient (team colors require #008) | ⚠️ #008 |
| 3 | Result badge (WIN/LOSS/PUSH) | `resultBadge` | matches |
| 4 | Loading overlay on tap-busy | `.overlay` w/ `ProgressView` | matches |
| 5 | Pick card variant (full reasoning) | `AgentPickCard` = `AgentPickItem(.full)` wrapper | matches |
| 6 | Skeleton row | `PickCardSkeleton` | matches |
| 7 | Rationale collapsible widget | `AgentPickRationaleWidget.swift` | matches |
| 8 | Audit widget (leaned metrics + payload dumps + copy buttons) | `AgentPickPayloadAuditWidget.swift` w/ `UIPasteboard` copy | matches |
| 9 | Audit reads `ai_audit_payload` / `ai_decision_trace` JSONB | Synthesized fallback — JSONB columns not in `AgentPick` model yet | ⚠️ #079 |

## 8. AgentTimeline.tsx → `AgentTimeline.swift`

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Server-driven event log | Synthesized from snapshot (today's run, last gen, perf calc) | 🔧 #076 (server log later) |
| 2 | Vertical timeline w/ icon + dot + spine | `LazyVStack` w/ `HStack` per row + spine | matches |
| 3 | Time-ago labels | `formatTimestamp` w/ relative formatting | matches |

## 9. CompanyDashboardBanner.tsx → `CompanyDashboardBanner.swift`

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | "Your agency" rollup w/ active/total + win-rate avg + total units | Same composition | matches |
| 2 | HR pill CTA | `onOpenHR` closure | matches |

## 10. PixelOffice / PixelEmojiInline / PrinterSlipAnimation / ThinkingAnimation

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Pixel-art office hero | SwiftUI gradient + scanline placeholder | ⚠️ #074 (existing waiver) |
| 2 | Pixel inline emoji | `PixelEmojiInline.swift` | matches |
| 3 | 5s reveal + 3D flip slip animation | `PrinterSlipAnimation.swift` SwiftUI port, pixel world-map dropped | 🔧 visual rhythm preserved |
| 4 | Terminal-style typed-out thinking panel | `ThinkingAnimation.swift` w/ `Task` typing loop + `TimelineView` cursor | matches |

## 11. Stores

### AgentDetailStore.swift
- Owns snapshot + history + generation state for one agent
- `refreshSnapshot()` → `agent-authorized-action-v1 / detail_snapshot`
- `loadHistory()` → `avatar_picks` direct read via `AgentPicksService.fetchPicks`
- `generatePicks()` → `request_generation` edge action
- `saveSettings(payload:)` → `update_agent` edge action
- `setAutoGenerate(_:)` → `AgentService.setAutoGenerate` granular call
- `delete()` → `AgentService.delete`
- Derived: `regenerationsRemaining()`, `filteredPickHistory`, `agentWithPerformance`

### AgentChatStore.swift
- One thread per (user, agent) pair
- `refresh()` reads `agent_chat_messages` rows
- `send()` performs optimistic insert + agent-chat-reply edge call
- `bind(userId:)` clears state on auth change

### AgentPickAuditStore.swift
- Drives the audit sheet via `present(pick:) / dismiss()`
- Synthesizes `AgentPickAuditPayload` from `AgentPick` fields (#079 will swap
  to real JSONB)

### AgentV2FlagsStore.swift / AgentV2DebugSettingsStore.swift
- `UserDefaults`-backed local flags, no network. V2 enabled by default;
  debug flags off by default.

## 12. Services

### AgentAuthorizedActionsService.swift
- Single `invoke<Body, Response>` helper that wraps `supabase.functions.invoke`
  with an explicit `Authorization: Bearer <token>` header.
- Specific helpers: `detailSnapshot`, `picksPage`, `createAgent`,
  `updateAgent`, `requestGeneration`.
- Exposes `AnyEncodable` shim for untyped JSON payloads.

### AgentChatService.swift
- `fetchThread`, `sendUserMessage`, `requestAssistantReply`, `setFollow`.

### AgentPicksService.swift (extended)
- Added `fetchDetailSnapshot`, `fetchPicksPage`, `requestGeneration`
  convenience wrappers that delegate to AgentAuthorizedActionsService.

## 13. Models

### AgentDetailSnapshot.swift (new)
- `AgentDetailSnapshot` — Codable mirror of `AgentDetailSnapshotV2`
- `AgentPicksPage` — Codable mirror of `AgentPicksPageV2`
- `AgentGenerationRunSummary` — typed projection of `agent_generation_runs`
- `GenerationRequestResult` / `GenerationResult` — for the V2 request flow
- `AgentPickAuditPayload` — view model for the audit widget
- `AgentChatMessage` — `agent_chat_messages` row

All Codable types use tolerant `init(from:)` that defaults missing fields
(matches RN's "if it decodes, render it" philosophy).

---

## 14. Integration with B14 / B16

We did **not** edit `AgentsRouter.swift` or `AgentsView.swift` since both
batches are also writing to those files. Instead:

- `Features/Agents/AgentsRouter+B15.swift` exposes
  `AgentsRouterB15.ownerDetail(agentId:, prefetched:)`,
  `AgentsRouterB15.publicDetail(agentId:)`, and
  `AgentsRouterB15.settings(agentId:, prefetched:)` as factory helpers.

**Integration steps for the stitch-up agent**:
1. In `AgentsView.routeDestination(_:)` replace the placeholder cases with
   the AgentsRouterB15 factories:
   ```swift
   case .agentDetail(let id):
       AgentsRouterB15.ownerDetail(agentId: id)
   case .publicAgentDetail(let id):
       AgentsRouterB15.publicDetail(agentId: id)
   ```
2. Delete the three placeholder structs (`AgentDetailPlaceholderView`,
   `CreateAgentPlaceholderView`, `PublicAgentDetailPlaceholderView`) once
   B14 / B15 / B16 all land.
3. Update the FIDELITY-WAIVER #072 comment in `AgentsView.swift` since B15
   resolves the agent detail + public detail placeholders.

---

## 15. Build status

`xcodebuild -project Wagerproof.xcodeproj -scheme Wagerproof -destination 'platform=iOS Simulator,name=iPhone 16 Pro' -configuration Debug build` → **BUILD SUCCEEDED**

Only warning is the unrelated `appintentsmetadataprocessor` note (no AppIntents framework dependency); no errors.

## 16. Open tickets filed

- `#076` — Agent detail snapshot V2 integration (this batch's primary work — partially complete)
- `#079` — Agent pick audit JSONB sourcing (synthesized fallback shipped)
- `#080` — Agent settings conditional fields + custom insights (B14 shares input primitives)

Existing tickets touched: `#008` (team colors — referenced by AgentPickItem),
`#074` (PixelOffice — referenced by hub).

## 17. Inventory deltas

The following RN files flip from `missing` → `candidate` in
`inventory.overrides.csv` (see file for the canonical list).
