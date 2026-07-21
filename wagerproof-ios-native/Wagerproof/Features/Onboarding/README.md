# Onboarding v2 — flow, value arc, and the post-onboarding paywall

25-step flow: 22 carousel pages (`OnboardingStore.Step` 1–22, one shared
shell in `OnboardingCarouselContainer`) + 3 full-screen cinematic phases
(generation 23, reveal 24, value summary + fist bump 25). Page 13
(`agentLeaderboard`, `Pages/OnboardingLeaderboardPage.swift`) is the
animated leaderboard pitch: rows deal in, the #1 agent's streak chip counts
up to W7, and a "7 in a row" callout pops with a success haptic (SAMPLE
data; Reduce Motion renders the finished board). Order lives in the `Step` enum
(`WagerproofKit/Sources/WagerproofStores/OnboardingStore.swift`); page views
map in `OnboardingCarouselContainer.pageContent(for:)`; per-page CTA copy +
gating in `OnboardingPageSpec`. Completion → `RootView` presents
`PostOnboardingPaywall` as a `fullScreenCover` for non-Pro users.

## The value arc (steps 6–9)

Personalized persuasion, replacing the old `personalizedValue` pitch page
(deleted — its "2× value / +30% hit rate / +40 units" copy was unsupported).
Modelled on Orbital Focus's screen-time arc. Two self-reported inputs — daily
sports-app-checking **time** and weekly bet **amount** — drive two parallel
threads on the same reveals: time framed as **"years of your life"** and money
framed as **"in play / at risk"** (turnover, never returns).

| Step | Page | What it does |
|---|---|---|
| 6 `researchTime` | `Pages/OnboardingResearchTimePage.swift` | Seven daily time buckets + branched reply. Writes `survey.researchTimeBucket` (raw `ResearchTimeBucket` id — stable strings, never rename; synced to `profiles.onboarding_data.researchTimeBucket`; old weekly values resolve to `.unknown`). |
| 7 `weeklyStakes` | same file (`OnboardingStakesPage`) | Six weekly bet-amount buckets ("Under $50"…"$1,000+"/"Prefer not to say") + branched reply. Writes `survey.weeklyStakesBucket` (raw `StakesBucket` id). Sizes risk only; "Prefer not to say" resolves to a median. |
| 8 `researchCost` | `Pages/OnboardingResearchRevealPages.swift` | Staged "bad news", two beats: this year → **N days** + **risk $X**; across your life → **N years** + **risk $Y**. CTA "Fix this" (`hasSeenCostReveal`). |
| 9 `researchReclaim` | same file | Staged "good news": "WagerProof researches for you" → reclaimed-years floor+"+" + weekly-hours anchor → "**Protect your $X** and spend more time enjoying the games" + disclosure. CTA "Show me how" (`hasSeenReclaimReveal`). |

**All math and copy live in one place: `ResearchTime.swift`** —
`ResearchTimeBucket`/`ResearchTimeEstimates` (time) and
`StakesBucket`/`StakesEstimates` (money). Assumptions (owner-approved): a
betting lifetime of ~46 years at ~16 waking hours/day (the "years of your
life" basis); 75% of the repetitive checking is what an agent automates;
yearly action = weekly × 52, lifetime action = yearly × 46. The cost reveal
is just the user's own reported time/money projected; the reclaim's time is
scoped to the automatable checking. **Money is quantified as turnover only
(total wagered), never winnings, losses, or returns** — disclosure always on
screen. No profit/win language anywhere in the arc.

The arc's numbers reprise three more times: the `agentValueIntro`
carousel's first slide (`OnboardingAgentPitchPages.swift`,
`valueMarkerSlide` — highlighter-marker rows with the user's reclaim years +
weekly-hours anchor; slide 2 is the win-rate bell-curve comparison, tagged
ILLUSTRATIVE; slide 3 the Outliers example), the step-25 summary, and the
paywall's before/after page (bullet 1 becomes **"Protect your $X in
projected bets this year"** — `stakesBucketRaw` threads from
`PostOnboardingPaywall` → `CustomPaywallView` → `CustomPaywallFeaturePages`).

**Step 25 (`timeSummary`)** — `Cinematic/OnboardingTimeSummaryView.swift`:
"WagerProof will get you back N+ years of your life" + three value cards (the
third now the money card, **"Protect your $X this year"**),
then the fist-bump confirmation (`WagerFistBumpExplosion`, ported from
Orbital Focus: fly-in, wind-up wiggle, punch, 52-emoji radial burst with
haptic choreography). The fist bump calls `markComplete()`, which is what
surfaces the paywall — the reveal's CTA now advances here instead of
completing.

Reduce Motion: reveal pages render everything immediately, post a VoiceOver
announcement, and unlock the CTA at once.

## Post-onboarding paywall

`PostOnboardingPaywall` (host: gating, `onboarding`-placement offering
fetch, retry/timeout/skip escapes, post-purchase finalize + Meta events)
chooses its renderer from the offering's **metadata** — dashboard-editable,
no release needed:

| Metadata key | Default | Meaning |
|---|---|---|
| `custom_paywall_enabled` | `true` | `false` = kill switch back to the legacy `RevenueCatUI.PaywallView` dashboard template |
| `paywall_close_enabled` | `false` (hard) | Onboarding ships HARD — no X on either renderer. Set `true` to soften (e.g. App Review builds). The error/timeout "Continue without subscription" escape survives both modes. The Secret-Settings debug preview (`isDebugPreview`) overrides this with a red DEBUG close button |
| `entry_offer` | `"monthly"` | `"intro_annual"` swaps the second (entry) plan card from the standard monthly plan to the pay-up-front intro annual (`yearly_intro` package = `rc_ios_pro_yearly_intro`, $19.99 first month then $99.99/yr). Requires the `yearly_intro` package in the served offering; returning customers RevenueCat flags ineligible fall back to Monthly |

**`CustomPaywallView`** (`Features/Paywall/`) is the default renderer —
fully custom SwiftUI; RevenueCat is data + transactions only (`import
RevenueCat`, never `RevenueCatUI`):

- Plans displayed: Monthly + Yearly ONLY (owner decision; weekly and
  lifetime intentionally hidden even if the offering contains them).
  Identifier preference: `$rc_monthly` (else `$rc_monthly_discount`),
  and the non-trial `$rc_yearly_discount` yearly package. Another annual
  package is only accepted when it also has no free trial.
- Prices always from `storeProduct.localizedPriceString`; annual per-month
  subline via the product's own `priceFormatter`. Nothing hardcoded.
- Plans are direct side-by-side cards. Yearly leads with a live savings badge
  calculated against Monthly; it does not advertise or use a free trial.
- Purchases via `Purchases.shared.purchase(package:)`; restore only
  collapses the paywall when the `WagerProof Pro` entitlement is active.
  Both hand off to the host's `finalize` (customer-info refresh + Meta).
- Layout: compact WagerProof PRO header → unboxed product carousel:
  1 value summary, 2 verified App Store proof, 3 live Agent HQ,
  4 leaderboard with streak chips, 5 reasoned picks with a high-upside parlay,
  6 stacked value/fade outliers, 7 private Discord plus a multi-AI connector → Yearly /
  Monthly plans → no-commitment reassurance → branded CTA → compact links.
  Copy rule: plain sentences, no em dashes.
- Mixpanel funnel events fire here: `paywall_presented`,
  `paywall_feature_page_viewed`, `paywall_plan_selected`,
  `paywall_checkout_started`, `paywall_converted`,
  `paywall_purchase_cancelled/failed`, `paywall_restore_*`,
  `paywall_dismissed` (`variant: custom_v2_product_hero`).

Compliance notes: one accent CTA, plans above the fold, icon-led "No
commitment - Cancel anytime" reassurance, Restore/Terms/Privacy links, no
trial toggle, no delayed X. Production onboarding runs HARD (no X) by default;
ship App Review builds with `paywall_close_enabled: true` (soft) if review
requires a visible dismiss control.
