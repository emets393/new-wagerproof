# B14 — Agent creation wizard + reusable inputs — Fidelity table

Source RN files (port targets):
- `wagerproof-mobile/app/(drawer)/(tabs)/agents/create.tsx` (628 lines — wizard host)
- `wagerproof-mobile/components/agents/creation/Screen1_SportArchetype.tsx`
- `wagerproof-mobile/components/agents/creation/Screen2_Identity.tsx`
- `wagerproof-mobile/components/agents/creation/Screen3_Personality.tsx`
- `wagerproof-mobile/components/agents/creation/Screen4_DataAndConditions.tsx`
- `wagerproof-mobile/components/agents/creation/Screen5_CustomInsights.tsx`
- `wagerproof-mobile/components/agents/creation/Screen6_Review.tsx`
- `wagerproof-mobile/components/agents/creation/AgentCreationGenerationIntro.tsx`
- `wagerproof-mobile/components/agents/creation/AgentBornCreationCelebration.tsx`
- `wagerproof-mobile/components/agents/creation/index.ts`
- `wagerproof-mobile/components/agents/inputs/{Archetype,Odds,Slider,SwipeableEmoji,TimePicker,TimezonePicker,Toggle}*.tsx`
- `wagerproof-mobile/hooks/usePresetArchetypes.ts`

Match legend:
- matches — same behavior / visuals
- 🔧 fixed — diverged from RN but more idiomatic in SwiftUI
- ⚠️ #NNN — waivered to ticket
- missing — fail

---

## 1. CreateAgentScreen (`create.tsx`) → `AgentCreationView.swift`

### Container / chrome

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Frosted blur header w/ insets.top + 56pt + close X + step "n/6" | `NavigationStack` toolbar (close X leading, step n/6 trailing, progress pills principal) | 🔧 native nav bar replaces custom frosted header |
| 2 | Progress dots strip (filled green to current step) | Per-step `Capsule` pills in toolbar principal slot | matches |
| 3 | `KeyboardAvoidingView` + ScrollView per step | `ScrollView` per step; SwiftUI handles keyboard avoidance natively | matches |
| 4 | Frosted footer w/ Back + Next buttons | `safeAreaInset(.bottom)` w/ same two-button row, hidden on Review step | matches |
| 5 | Discard-confirm `Alert.alert` on close | `.confirmationDialog("Discard Agent?")` w/ destructive Discard + cancel | matches |
| 6 | Step titles for each screen | `Self.stepTitles` array; rendered as nav-bar title | matches |
| 7 | Final-step (Review) hides footer; Create button lives inside step body | Same — `if store.step < totalSteps - 1` gates the footer | matches |

### State / data layer

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 8 | `useState<CreateAgentFormState>(INITIAL_FORM_STATE)` w/ helper setters | `AgentCreationStore.draft` w/ direct binding + helpers (`toggleSport`, `applyArchetype`, `clearArchetype`) | matches |
| 9 | `useCreateAgent()` React-Query mutation | `AgentService.create(input:)` invoked from `AgentCreationStore.submit()` | matches |
| 10 | `useUserAgents()` — duplicate-name validation | `existingAgentNames` seeded from `AgentsStore.agents` on `.task` and via `.onChange` | matches |
| 11 | `useAgentEntitlements()` — `canCreateAnotherAgent` + `autoModeForcedOff` | `AgentEntitlementsStore` env + computed `autoModeForcedOff` in `AgentCreationView` | matches |
| 12 | `usePresetArchetypes()` React-Query (30-min stale) | `AgentCreationStore.loadArchetypesIfNeeded()` w/ in-store cache | 🔧 simpler — no per-query stale-time machinery; reload is a Pull-To-Refresh away |
| 13 | `createMutation.mutateAsync(...)` payload — name trim, autopilot-forced-off respect | Same — `Draft.name.trimmingCharacters(...)` + `shouldStartAuto` gate in `submit()` | matches |
| 14 | Backend create — Supabase Edge Function `agent-authorized-action-v1` w/ explicit Bearer header | `AgentService.invokeAgentAuthorizedAction` w/ `FunctionInvokeOptions(headers: ["Authorization": ...])` | matches |
| 15 | Generation intro then born celebration full-screen modals | `.fullScreenCover` for both, chained on completion | matches |
| 16 | `setCreatedAgentSummary` snapshot then navigate to detail | `createdAgent` state + `finishAndExit(agent:)` which refreshes the agents grid and dismisses | 🔧 dismiss instead of push — agent grid will show the new agent on top |

### Validation

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 17 | `validateScreen(0)` — `preferred_sports.length > 0` | `canProceed(from: 0)` | matches |
| 18 | `validateScreen(1)` — name 1-50 chars + not duplicate + emoji + color | `canProceed(from: 1)` w/ same predicates | matches |
| 19 | `validateScreen(2..5)` — always pass | Same | matches |
| 20 | `getValidationError(...)` returns user-friendly message | `validationError(for:)` w/ same messages | matches |
| 21 | `Alert.alert('Required', error)` shown when blocked | (none — Next button disabled instead; cleaner iOS UX) | 🔧 |

---

## 2. Step 1: Sport + Archetype (`Screen1_SportArchetype.tsx`)

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Path picker (scratch / preset) w/ icon cards | `pathSelection` w/ matching two large cards | matches |
| 2 | "This Model Wins Across the Board" perf brag card | `performanceCard` w/ same three bars + copy | matches |
| 3 | Scratch path: sport rows w/ MaterialCommunityIcons | SF Symbols via `AgentSport.sfSymbol` | 🔧 RN MCI → SF Symbols |
| 4 | MLB exclusivity (selecting MLB clears others; selecting other clears MLB) | `AgentCreationStore.toggleSport(_:)` same logic | matches |
| 5 | MLB notice card (info icon + copy) | Same | matches |
| 6 | Preset path: archetype cards w/ usePresetArchetypes() query | `ArchetypeCard` rows backed by `store.archetypeRows` | matches |
| 7 | Loading + error states for archetypes | `archetypesLoadState` branching (loading / failed / loaded) | matches |
| 8 | Back-link "Change path" | `changePathButton` | matches |

---

## 3. Step 2: Identity (`Screen2_Identity.tsx`)

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Avatar preview card w/ gradient or solid bg, glow wrapper, emoji | `previewSection` w/ `LinearGradient` + emoji overlay (glow wrapper not needed — preview is static) | matches (glow simplified — see #071) |
| 2 | Name TextInput w/ char counter + duplicate detection | `TextField` + same counter + duplicate-name red border + helper | matches |
| 3 | SwipeableEmojiPicker — 6 pages of 10 emojis | `SwipeableEmojiPicker.swift` w/ `TabView(.page)` | matches |
| 4 | Color grid — 16 fixed gradient swatches | `colorGrid` w/ 4-col LazyVGrid of `LinearGradient` swatches | matches |
| 5 | Helper error: "Please select an emoji" | Same | matches |

---

## 4. Step 3: Personality (`Screen3_Personality.tsx`)

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Intro card w/ eyebrow + title + desc | `introCard` | matches |
| 2 | Core Personality section card w/ icon | `sectionCard` for "Core Personality" w/ brain.head.profile | matches |
| 3 | Sliders: risk_tolerance / underdog_lean / over_under_lean / confidence_threshold | `SliderInput` for each, same labels | matches |
| 4 | Toggle: chase_value | `ToggleInput` | matches |
| 5 | Bet Selection section card | Same — `target` SF Symbol | matches |
| 6 | `SegmentedButtons` for preferred_bet_type (Any/Spread/ML/Total) | `Picker(.segmented)` w/ same options | matches |
| 7 | Slider: max_picks_per_day | `SliderInput` w/ MAX_PICKS_LABELS | matches |
| 8 | Toggle: skip_weak_slates | `ToggleInput` | matches |

---

## 5. Step 4: Data & Conditions (`Screen4_DataAndConditions.tsx`)

Sport-conditional logic mirrors `getConditionalParams()` in RN line-for-line.

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Intro card | `introCard` | matches |
| 2 | Data Trust section — trust_model, trust_polymarket, polymarket_divergence_flag | Same | matches |
| 3 | Odds Limits — OddsInput x2 (favorite / underdog) | `OddsInput` w/ same valid ranges | matches |
| 4 | Football section (NFL or CFB): fade_public + public_threshold (conditional) + weather_impacts_totals + weather_sensitivity (conditional) | `footballSection`, gated by `hasFootball`, nested gates for threshold/sensitivity | matches |
| 5 | NFL/CFB badges in section header | `SportBadge` row | matches |
| 6 | Basketball section (NBA or NCAAB): trust_team_ratings + pace_affects_totals + fade_back_to_backs | `basketballSection` | matches |
| 7 | NBA-only section: weight_recent_form + ride/fade streaks + trust_ats_trends + regress_luck | `nbaTrendsSection` gated by `hasNBA` | matches |
| 8 | Situational section: home_court_boost (always) + upset_alert (NCAAB only) | Same — `home_court_boost` always shown, `upset_alert` gated | matches |
| 9 | `Bool?` optional fields — RN spreads w/ `??` default | Swift `boolBinding` + `intBinding` helpers wrap optional KeyPaths into non-optional bindings | 🔧 cleaner Swift idiom |

---

## 6. Step 5: Custom Insights (`Screen5_CustomInsights.tsx`)

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Header w/ section title + progress indicator ("N of 4 completed") | Same | matches |
| 2 | Four collapsible insight cards (philosophy / edges / avoid / target) | `InsightCard` x4 in a ForEach | matches |
| 3 | Card header: icon + title + "Filled" badge + chevron | Same | matches |
| 4 | Expanded body: description + textarea + char counter | `TextEditor` + counter; placeholder text overlaid since SwiftUI TextEditor has no native placeholder | 🔧 placeholder overlay (RN TextInput has native placeholder) |
| 5 | LayoutAnimation on expand/collapse | `withAnimation(.easeInOut)` on toggle | matches |
| 6 | Empty string → null in store | `optionalStringBinding` setter normalizes empty → nil | matches |
| 7 | Helper note at bottom | Same | matches |

---

## 7. Step 6: Review (`Screen6_Review.tsx`)

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Agent preview Card w/ gradient header bar + sport-based background gradient | `previewCard` w/ accent gradient (background-gradient simplified — single fill) | 🔧 RN uses 3-stop sport-mix gradient; we use single fill |
| 2 | Avatar (gradient/solid) + name + archetype label | Same | matches |
| 3 | Sport badges w/ per-sport color schemes | Same — `sportBadgeColors` map mirrors RN SPORT_CONFIG | matches |
| 4 | "This Agent Will..." description (archetype-aware or generated from params) | `generatedDescription` w/ fallback for empty sports list | matches |
| 5 | "Key Traits" bulleted list (≤7) | `personalityTraits` w/ `prefix(7)` | matches |
| 6 | Custom insights filled indicator | Same | matches |
| 7 | Auto-Generate toggle row + disabled when `autoModeForcedOff` | `autoGenerateCard` w/ same gating | matches |
| 8 | Time picker chip — opens TimePickerModal | Same — uses `.sheet` | matches |
| 9 | Auto-mode-full warning card (X/Y live auto agents) | `autoLimitCard` | matches |
| 10 | Notification permission request when toggling auto on | `NotificationService.shared.requestPermission()` triggered in `autoGenerateBinding` setter | matches |
| 11 | Create Agent button (loading state during submit) | Same — `ProgressView` swap during `.submitting` | matches |
| 12 | "You can edit later" footer note | Same | matches |

---

## 8. Reusable inputs

### `ArchetypeCard.tsx` → `ArchetypeCard.swift`

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Tappable card w/ emoji block + title + desc + selected check + sport badges | Same | matches |
| 2 | Per-sport badge colors (light + dark) | Single dark-mode-aware tint via `appTextSecondary` — RN's light-mode swatches dropped (iOS uses single dark theme convention) | 🔧 |

### `OddsInput.tsx` → `OddsInput.swift`

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | -500..-100 for favorite, +100..+500 for underdog | Same constants | matches |
| 2 | "No limit" chip toggles between value and nil | Same | matches |
| 3 | Validation messages on entry + clamp on blur | Same — `handleTextChange` + `handleBlur` | matches |
| 4 | Mode-pill in header reflects current value | Same | matches |

### `SliderInput.tsx` → `SliderInput.swift`

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | 5 discrete steps (Scale1To5) | Same | matches |
| 2 | Filled track + per-step dots (active scaled 1.3x) | Same | matches |
| 3 | Active label badge in header | Same | matches |
| 4 | Tap dot OR label to jump | Same | matches |
| 5 | Haptic on change | `.sensoryFeedback(.selection, trigger: value)` | matches |

### `SwipeableEmojiPicker.tsx` → `SwipeableEmojiPicker.swift`

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | 60 emojis in 6 pages of 10 (2x5 grid) | Same — `AGENT_EMOJIS` literal copied | matches |
| 2 | Horizontal paging scroll | `TabView(.page)` | matches |
| 3 | Page dots below | Same | matches |
| 4 | Selected emoji background tinted by avatar color | Same — `selectedColor.opacity(0.2)` | matches |

### `TimePickerModal.tsx` → `TimePickerModal.swift`

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | Hour + minute pickers (5-min increments) | `DatePicker(.wheel, .hourAndMinute)` — 1-min granularity | ⚠️ #079 |
| 2 | Timezone chip row (6 US zones) | Horizontal ScrollView of selectable Buttons | matches |
| 3 | Preview text "HH:MM AM/PM TZ" | Native picker shows preview inline | 🔧 |
| 4 | Cancel + Confirm actions | `.cancellationAction` + `.confirmationAction` toolbar items | matches |

### `TimezonePickerModal.tsx` → `TimezonePickerModal.swift`

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | Modal list of 6 US zones | Native `List` w/ searchable | matches (with search bonus) |
| 2 | Selected check + green-tinted row | Same | matches |

### `ToggleInput.tsx` → `ToggleInput.swift`

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | Tap-anywhere row toggles boolean | Button containing the whole row | matches |
| 2 | On/Off status pill | Same | matches |
| 3 | Description text below label | Same | matches |
| 4 | `autopilot` variant w/ white thumb + green track | Single tint via `tint(0x10B981)` — iOS Toggle always uses white thumb anyway | 🔧 visual variants collapse natively |

---

## 9. Generation intro + born celebration

### `AgentCreationGenerationIntro.tsx` → `AgentCreationGenerationIntroView.swift`

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | Two Lottie scenes (GalaxyPlanet → OrbitPlanet) | Two SF Symbols w/ `.symbolEffect(.pulse)` | ⚠️ #080 |
| 2 | Two-stage scale-in/scale-out timing (~6s total) | Same w/ `withAnimation` + Task.sleep | matches |
| 3 | Status-line cycle (3 lines per stage, 900ms cadence) | Same | matches |
| 4 | Newest-line slide-in animation | Single-pass insert; slide animation simplified | 🔧 |

### `AgentBornCreationCelebration.tsx` → `AgentBornCelebrationView.swift`

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | WaveLines Lottie background | (none) | ⚠️ #081 |
| 2 | FullscreenGreen reveal flash | `Color(0x00E676)` overlay w/ opacity transition | matches (no lottie polish) |
| 3 | Confetti Lottie burst on reveal | SF Symbol `sparkles` w/ `.symbolEffect(.bounce)` | ⚠️ #081 |
| 4 | Agent card (avatar / name / sport row / autopilot pill) | Same — uses `AgentColorPalette` helpers from B13 | matches |
| 5 | "View Agent" CTA, disabled until reveal completes | Same | matches |

---

## 10. Stores + services

### `AgentCreationStore.swift` (new)

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | `CreateAgentFormState` interface | `AgentCreationStore.Draft` struct | matches |
| 2 | `applyArchetypePreset()` | `applyArchetype(_:)` | matches |
| 3 | `validateScreen()` / `getValidationError()` | `canProceed(from:)` / `validationError(for:)` | matches |
| 4 | Existing-name duplicate detection | `existingAgentNames` array | matches |
| 5 | Submit w/ autopilot-forced-off | `submit(autoModeForcedOff:)` | matches |
| 6 | Archetype loading + caching | `loadArchetypesIfNeeded()` + cached `archetypeRows` | matches |

### `PresetArchetypeService.swift` (new)

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | `fetchPresetArchetypes()` | `PresetArchetypeService.fetchAll()` | matches |
| 2 | `PresetArchetype` interface (id/name/emoji/desc/color/recommended_sports/...) | `PresetArchetypeRow` struct | matches |
| 3 | Partial personality_params override | `AgentPersonalityParamsPartial` + `AgentPersonalityParams.applying(_:)` extension | matches |
| 4 | 30-min React-Query staleTime | (none — store-level cache, refreshes on next wizard open) | 🔧 |

### `AgentService.swift` extension

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | `createAgent(CreateAgentInput)` → edge fn `agent-authorized-action-v1` | `AgentService.create(input:)` w/ explicit Bearer header | matches |
| 2 | `invokeAgentAuthorizedAction` envelope (`{success, data, error}`) | `AgentAuthorizedActionResponse<T>` | matches |
| 3 | Zod schema validation client-side | (none — edge function validates server-side; same as B13 pattern) | 🔧 |

---

## 11. Routing

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | `router.push('/agents/create')` | `navPath.append(.createAgent)` → `AgentCreationView` (replaces B13 placeholder) | matches |
| 2 | Discard → `router.back()` | `dismiss()` from environment | matches |
| 3 | Successful create → `router.replace('/agents/[id]')` | `finishAndExit(agent:)` refreshes agents grid + dismisses (returns user to grid where new agent appears) | 🔧 |

Ticket #072 updated to mark the creation portion as resolved.

---

## 12. Inventory deltas

The following RN files flip from `missing` → `candidate` in `inventory.overrides.csv`:

- `wagerproof-mobile/app/(drawer)/(tabs)/agents/create.tsx`
- `wagerproof-mobile/components/agents/creation/Screen1_SportArchetype.tsx`
- `wagerproof-mobile/components/agents/creation/Screen2_Identity.tsx`
- `wagerproof-mobile/components/agents/creation/Screen3_Personality.tsx`
- `wagerproof-mobile/components/agents/creation/Screen4_DataAndConditions.tsx`
- `wagerproof-mobile/components/agents/creation/Screen5_CustomInsights.tsx`
- `wagerproof-mobile/components/agents/creation/Screen6_Review.tsx`
- `wagerproof-mobile/components/agents/creation/AgentCreationGenerationIntro.tsx`
- `wagerproof-mobile/components/agents/creation/AgentBornCreationCelebration.tsx`
- `wagerproof-mobile/components/agents/creation/index.ts`
- `wagerproof-mobile/components/agents/inputs/ArchetypeCard.tsx`
- `wagerproof-mobile/components/agents/inputs/OddsInput.tsx`
- `wagerproof-mobile/components/agents/inputs/SliderInput.tsx`
- `wagerproof-mobile/components/agents/inputs/SwipeableEmojiPicker.tsx`
- `wagerproof-mobile/components/agents/inputs/TimePickerModal.tsx`
- `wagerproof-mobile/components/agents/inputs/TimezonePickerModal.tsx`
- `wagerproof-mobile/components/agents/inputs/ToggleInput.tsx`
- `wagerproof-mobile/hooks/usePresetArchetypes.ts`

---

## 13. Open waivers

- ⚠️ #079 — Time picker uses native `DatePicker(.wheel)` (1-min instead of 5-min snap).
- ⚠️ #080 — Generation intro uses SF Symbol pulse instead of Lottie planet scenes.
- ⚠️ #081 — Born celebration uses SF Symbol bounce + plain green flash instead of Lottie confetti + wave lines.
- ⚠️ #072 — Detail + public-detail routes still placeholders (B15 / B16). Creation route resolved by B14.
