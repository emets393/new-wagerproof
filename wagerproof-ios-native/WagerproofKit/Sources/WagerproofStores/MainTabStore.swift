import Foundation
import Observation

/// Holds the currently-selected bottom tab and the open/closed state of the
/// side menu sheet. Mirrors the RN tab bar state in `app/(drawer)/(tabs)/_layout.tsx`
/// plus the drawer open state in `app/(drawer)/_layout.tsx`.
///
/// RN renders the system `Tabs` (hidden via `tabBarStyle.display = 'none'`) plus
/// a custom `FloatingTabBar` overlay; in SwiftUI we lean on the native `TabView`
/// and replace the RN side drawer with a `.sheet` opened from the toolbar
/// hamburger.
@Observable
@MainActor
public final class MainTabStore {
    /// The four visible content tabs in iPhone parity order:
    /// Games → Agents → Outliers → Scoreboard.
    ///
    /// Search lives as iOS 18's detached `Tab(role: .search)` slot (rendered
    /// outside the visible bar by the system on iOS 26+; falls back to a
    /// standard tab cell on earlier 18.x). Settings is no longer a tab — it is
    /// pushed onto the active tab's `NavigationStack` via `isSettingsPresented`,
    /// triggered by tapping the WagerProof wordmark in the top-leading slot.
    ///
    /// `.settings` is retained for the
    /// SideMenuSheet's still-present "Settings" row (sheet-driven now).
    /// `.search` is the value for the iOS 18+ detached `Tab(role: .search)`
    /// slot — required because `TabView(selection:)` enforces a common
    /// value type across every `Tab` in its builder.
    public enum Tab: String, Hashable, CaseIterable, Sendable {
        case games
        case props
        case agents
        case outliers
        case scoreboard
        case settings
        case search
    }

    /// Active tab selection. Driven by user taps + deep-link consumption.
    public var selected: Tab = .games

    /// `true` when the hamburger-opened side menu sheet should be presented.
    public var isSideMenuPresented: Bool = false

    /// `true` when the Feature Requests screen should be presented as a sheet
    /// from the tab shell. The side menu (itself a sheet) dismisses first
    /// and then asks the tab shell to flip this flag — chaining sheets
    /// directly inside the menu sheet would orphan presentations.
    public var isFeatureRequestsPresented: Bool = false

    /// `true` when the Roast (B19) screen should be presented as a full-screen
    /// cover from the tab shell. Same chained-sheet-avoidance pattern as
    /// `isFeatureRequestsPresented` — the side menu dismisses itself first
    /// and then flips this flag so the tab shell can present the cover
    /// cleanly.
    public var isRoastPresented: Bool = false

    /// `true` when the Settings screen should be pushed onto the active tab's
    /// `NavigationStack`. Settings used to be a bottom-bar tab; it's now reached
    /// by tapping the WagerProof wordmark in each tab's top-leading toolbar slot
    /// (the side menu's Settings row and the WagerBot Pro upsell flip this same
    /// flag). Each tab's `.wagerProofSettingsDestination` consumes the flag,
    /// guarded by `selected == tab` so only the on-screen tab pushes Settings.
    public var isSettingsPresented: Bool = false

    /// `true` when the WagerBot chat sheet should be presented from the tab
    /// shell. The sparkles icon in each tab's top-trailing toolbar slot
    /// flips this flag; MainTabView mounts the chat sheet centrally so the
    /// presentation works identically from every tab and so closing the
    /// sheet on one tab also dismisses it if the user pivots tabs.
    public var isChatPresented: Bool = false

    /// Bumped when the user re-taps the active tab. Each tab's root view can
    /// observe this and scroll-to-top + reset internal state. Matches RN's
    /// "tap-current-tab" hook in the FloatingTabBar.
    public private(set) var scrollToTopTrigger: UUID = UUID()

    public init() {}

    /// Select a tab. If the user taps the already-active tab we bump
    /// `scrollToTopTrigger` instead so individual tab roots can react.
    public func select(_ tab: Tab) {
        if tab == selected {
            scrollToTopTrigger = UUID()
        } else {
            selected = tab
        }
    }

    /// Apply a deep-link route to the tab shell. Returns the tab the route
    /// resolved to (or `nil` for routes the tab shell doesn't own, like
    /// `.resetPassword`).
    @discardableResult
    public func apply(deepLink route: DeepLinkRoute) -> Tab? {
        switch route {
        case .agents:
            // B13 — Agents now lives in the bottom tab bar as a first-class
            // destination, so a deep link routes straight to it instead of
            // popping the side menu open.
            selected = .agents
            return .agents
        case .outliers:
            selected = .outliers
            return .outliers
        case .feed:
            selected = .games
            return .games
        case .resetPassword:
            // Not a tab shell concern — auth router handles it.
            return nil
        }
    }
}
