#if DEBUG
import Foundation
import WagerproofSharedKit

/// DEBUG-only flag that switches the app's data layer from live Supabase
/// fetches to bundled real-data fixtures (`DummyData`).
///
/// Why this exists: it's the sports offseason, so the current-week input
/// views the Games tab joins through are empty and every card / detail /
/// widget renders blank — there's nothing to develop the UI against. Flipping
/// this on (Settings → Secret Settings) makes each store short-circuit its
/// fetch and serve a captured slate of real historical games instead.
///
/// Read from a static accessor rather than the SwiftUI environment because the
/// per-sport widget stores (`NBABettingTrendsStore`, `NBAModelAccuracyStore`,
/// `NBAMatchupOverviewStore`, the NCAAB equivalents) are created ad-hoc inside
/// the bottom sheets and never receive injected stores — they need a flag they
/// can read from anywhere. Persistence lives in the same App Group defaults as
/// `AdminModeStore` so the toggle survives relaunch.
///
/// Entirely compiled out of Release builds via `#if DEBUG`.
public enum DummyDataMode {
    public static var isEnabled: Bool {
        get { AppGroup.defaults.bool(forKey: AppGroupKey.dummyDataMode) }
        set { AppGroup.defaults.set(newValue, forKey: AppGroupKey.dummyDataMode) }
    }
}
#endif
