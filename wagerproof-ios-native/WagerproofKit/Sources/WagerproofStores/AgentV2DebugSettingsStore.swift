import Foundation
import Observation

/// Local debug toggles for the V2 generation pipeline. Mirrors
/// `services/agentV2DebugSettings.ts`. Used only by the dev settings sheet
/// (B14) — surfaced here so the AgentDetailView can read the current toggle
/// state when assembling the request payload for `request_generation`.
///
/// Everything persists to `UserDefaults`; no network involvement.
@Observable
@MainActor
public final class AgentV2DebugSettingsStore {
    private enum Key {
        static let forceWeakSlate = "agent_v2_debug.force_weak_slate"
        static let forceNoGames = "agent_v2_debug.force_no_games"
        static let verboseLogs = "agent_v2_debug.verbose_logs"
        static let dryRun = "agent_v2_debug.dry_run"
    }

    public private(set) var forceWeakSlate: Bool
    public private(set) var forceNoGames: Bool
    public private(set) var verboseLogs: Bool
    public private(set) var dryRun: Bool

    public init() {
        let d = UserDefaults.standard
        self.forceWeakSlate = d.bool(forKey: Key.forceWeakSlate)
        self.forceNoGames = d.bool(forKey: Key.forceNoGames)
        self.verboseLogs = d.bool(forKey: Key.verboseLogs)
        self.dryRun = d.bool(forKey: Key.dryRun)
    }

    public func setForceWeakSlate(_ value: Bool) {
        forceWeakSlate = value
        UserDefaults.standard.set(value, forKey: Key.forceWeakSlate)
    }

    public func setForceNoGames(_ value: Bool) {
        forceNoGames = value
        UserDefaults.standard.set(value, forKey: Key.forceNoGames)
    }

    public func setVerboseLogs(_ value: Bool) {
        verboseLogs = value
        UserDefaults.standard.set(value, forKey: Key.verboseLogs)
    }

    public func setDryRun(_ value: Bool) {
        dryRun = value
        UserDefaults.standard.set(value, forKey: Key.dryRun)
    }

    /// Snapshot of all flags, useful for dumping in dev tools.
    public var snapshot: [String: Bool] {
        [
            "force_weak_slate": forceWeakSlate,
            "force_no_games": forceNoGames,
            "verbose_logs": verboseLogs,
            "dry_run": dryRun
        ]
    }
}
