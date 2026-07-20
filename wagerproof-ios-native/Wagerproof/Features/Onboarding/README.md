# Onboarding v2 — flow, research-time arc, and the post-onboarding paywall

24-step flow: 21 carousel pages (`OnboardingStore.Step` 1–21, one shared
shell in `OnboardingCarouselContainer`) + 3 full-screen cinematic phases
(generation 22, reveal 23, time-value summary + fist bump 24). Page 12
(`agentLeaderboard`, `Pages/OnboardingLeaderboardPage.swift`) is the
animated leaderboard pitch: rows deal in, the #1 agent's streak chip counts
up to W7, and a "7 in a row" callout pops with a success haptic (SAMPLE
data; Reduce Motion renders the finished board). Order lives in the `Step` enum
(`WagerproofKit/Sources/WagerproofStores/OnboardingStore.swift`); page views
map in `OnboardingCarouselContainer.pageContent(for:)`; per-page CTA copy +
gating in `OnboardingPageSpec`. Completion → `RootView` presents
`PostOnboardingPaywall` as a `fullScreenCover` for non-Pro users.

## The research-time arc (steps 6–8)

Personalized time-value persuasion, replacing the old `personalizedValue`
pitch page (deleted — its "2× value / +30% hit rate / +40 units" copy was
unsupported). The user self-reports weekly research hours; everything else
is derived from that answer.

| Step | Page | What it does |
|---|---|---|
| 6 `researchTime` | `Pages/OnboardingResearchTimePage.swift` | Six weekly buckets + branched conversational reply. Writes `survey.researchTimeBucket` (raw `ResearchTimeBucket` id — stable strings, never rename; synced to `profiles.onboarding_data.researchTimeBucket`). |
| 7 `researchCost` | `Pages/OnboardingResearchRevealPages.swift` | Staged "bad news": hours/month count-up → hours/year roll → full-days reframe. CTA "Fix this" unlocks when the sequence lands (`hasSeenCostReveal`). |
| 8 `researchReclaim` | same file | Staged "good news": conservative reclaimed-hours figure (floor+"+"), weekly range, goal-branched close, always-visible disclosure. CTA "Show me how" (`hasSeenReclaimReveal`). |

**All math and copy live in one place: `ResearchTime.swift`** (buckets,
`ResearchTimeEstimates`, disclosures). Assumptions (owner-approved):
40 active betting weeks/year; 40–60% of research time is automatable
scanning. Estimates render only as ranges or floor+"+" figures with the
disclosure on screen — never point claims, never profit/win language.

The arc's numbers reprise three more times: the `agentValueIntro`
carousel's first slide (`OnboardingAgentPitchPages.swift`,
`valueMarkerSlide` — highlighter-marker rows with the user's reclaim range;
slide 2 is the win-rate bell-curve comparison, tagged ILLUSTRATIVE; slide 3
the Outliers example), the step-23 summary, and the paywall's agent card.

**Step 23 (`timeSummary`)** — `Cinematic/OnboardingTimeSummaryView.swift`:
"WagerProof will get you back N+ hours every year" + three value cards,
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
| `paywall_close_enabled` | `true` (soft) | `false` = hard paywall: no X on either renderer. The error/timeout "Continue without subscription" escape survives both modes |

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
trial toggle, no delayed X. Ship App Review builds with
`paywall_close_enabled` soft.
