import SwiftUI
import WagerproofStores

/// View-side enum that wraps `OnboardingStore.Step`. Kept as a thin alias so
/// view files can reference steps without dragging the store dependency into
/// every component file.
typealias OnboardingStep = OnboardingStore.Step

extension OnboardingStep {
    /// PagerView index used by `TabView(selection:).tabViewStyle(.page)`. Steps
    /// 15..19 collapse onto a single page (index 14) where the AgentBuilder
    /// owns its own sub-flow — same logic as RN `stepToPageIndex` in
    /// `app/(onboarding)/index.tsx`.
    ///
    /// Precondition: cinematic steps (`.agentGeneration`, `.agentBorn`) render
    /// outside the pager and MUST NOT be passed here. Callers must guard with
    /// `isCinematic` before reading this property. Returns `nil` for cinematic
    /// steps so misuse is loud rather than silently snapping the pager to 14.
    var pagerIndex: Int? {
        if isCinematic { return nil }
        if rawValue <= 14 { return rawValue - 1 }
        return 14   // steps 15..19 collapse to the AgentBuilder page
    }

    /// Total ordered page slots in the orchestrator pager (1..15 surface as
    /// distinct pages; cinematic steps 20/21 render outside the pager).
    static var pagerPageCount: Int { 15 }
}
