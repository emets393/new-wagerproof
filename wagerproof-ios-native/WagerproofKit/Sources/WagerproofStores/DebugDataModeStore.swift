#if DEBUG
import Foundation
import Observation
import WagerproofServices

/// DEBUG-only app-level store backing the "Dummy Data Mode" toggle in Secret
/// Settings. Mirrors `AdminModeStore`'s persisted-toggle pattern: the property
/// is the single source of truth for the UI binding, and its `didSet` writes
/// through to the shared `DummyDataMode` flag (App Group defaults) that every
/// data store reads before fetching.
///
/// Lives behind `#if DEBUG` so neither the store nor the fixtures it gates
/// exist in Release builds. See `DummyDataMode` for why the read-path is a
/// static flag rather than this injected store.
@Observable
@MainActor
public final class DebugDataModeStore {
    public var enabled: Bool {
        didSet { DummyDataMode.isEnabled = enabled }
    }

    public init() {
        self.enabled = DummyDataMode.isEnabled
    }
}
#endif
