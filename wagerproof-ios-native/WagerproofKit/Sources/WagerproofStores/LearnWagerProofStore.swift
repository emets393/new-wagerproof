import Foundation
import Observation
import WagerproofSharedKit

/// `LearnWagerProofStore` mirrors RN `contexts/LearnWagerProofContext.tsx`.
///
/// The RN context exposes:
///   - `isOpen` / `openLearnSheet()` / `closeLearnSheet()`
///   - `currentSlide` / `nextSlide()` / `prevSlide()` / `goToSlide(_:)`
///   - `markAsSeen()` / `checkIfSeen()` backed by AsyncStorage key
///     `@wagerproof_has_seen_learn_sheet`
///
/// In Swift we collapse this into a single `@Observable` store that drives a
/// native `.sheet(item: $store.activeTopic)` presentation from `MainTabView`.
/// The sheet is invoked from multiple screens (game cards, agents, side menu,
/// analytics tabs); routing through one global store keeps the surface stable.
///
/// Persistence: the "seen" flag is stored in the app group defaults so the
/// widget + extensions can read it later if needed — same storage strategy as
/// `ThemeStore`. The RN key string is preserved verbatim for symmetry, but the
/// rebuild plan does NOT auto-present the sheet on first launch (see spec §1
/// ambiguity note line 279 — RN's auto-open is commented out).
@Observable
@MainActor
public final class LearnWagerProofStore {

    // MARK: - Topic / slide model

    /// The six on-screen walkthrough slides, matching the RN `SLIDES` array in
    /// `LearnWagerProofBottomSheet.tsx`. `Identifiable` so it can drive
    /// `.sheet(item:)` directly.
    public enum Topic: String, CaseIterable, Identifiable, Sendable {
        case createAgent
        case gameCards
        case gameDetails
        case wagerBot
        case outliers
        case moreFeatures

        public var id: String { rawValue }

        /// Default landing slide index when a caller doesn't specify one. Maps
        /// to the slide carousel start position.
        public var slideIndex: Int {
            switch self {
            case .createAgent: 0
            case .gameCards: 1
            case .gameDetails: 2
            case .wagerBot: 3
            case .outliers: 4
            case .moreFeatures: 5
            }
        }
    }

    /// Total slide count — kept in sync with the RN `TOTAL_SLIDES` constant.
    public static let totalSlides: Int = Topic.allCases.count

    // MARK: - State

    /// Drives `.sheet(item:)` on `MainTabView`. `nil` = closed.
    public var activeTopic: Topic? = nil

    /// Current slide index inside the sheet. The view binds to this so the
    /// `TabView(.page)` can drive paging both ways.
    public var currentSlide: Int = 0

    // MARK: - Persistence

    /// RN AsyncStorage key — preserved verbatim so a future migration can read
    /// the existing user-defaults flag if we ever piggy-back on it.
    private let seenStorageKey = "@wagerproof_has_seen_learn_sheet"

    public init() {}

    // MARK: - Sheet lifecycle

    /// Open the sheet at a specific topic. The slide index is seeded from
    /// `topic.slideIndex` so deep-linking jumps straight to the requested
    /// walkthrough instead of always starting at slide 0.
    public func openSheet(_ topic: Topic = .createAgent) {
        currentSlide = topic.slideIndex
        activeTopic = topic
    }

    /// Close the sheet. Mirrors RN `closeLearnSheet()`.
    public func closeSheet() {
        activeTopic = nil
    }

    // MARK: - Slide navigation

    public func nextSlide() {
        currentSlide = min(currentSlide + 1, Self.totalSlides - 1)
    }

    public func prevSlide() {
        currentSlide = max(currentSlide - 1, 0)
    }

    public func goToSlide(_ index: Int) {
        guard index >= 0, index < Self.totalSlides else { return }
        currentSlide = index
    }

    /// True when the user is on the last slide — drives the "Done" vs "Next"
    /// label on the trailing toolbar button (parity with RN `isLastSlide`).
    public var isLastSlide: Bool {
        currentSlide == Self.totalSlides - 1
    }

    // MARK: - "Seen" persistence (RN markAsSeen / checkIfSeen)

    /// Persist the "user has finished the walkthrough" flag. Stored in the app
    /// group defaults via the shared `AppGroup` helper used by `ThemeStore`.
    public func markAsSeen() {
        AppGroup.defaults.set(true, forKey: seenStorageKey)
    }

    public func hasBeenSeen() -> Bool {
        AppGroup.defaults.bool(forKey: seenStorageKey)
    }
}
