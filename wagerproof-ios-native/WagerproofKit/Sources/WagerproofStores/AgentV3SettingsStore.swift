import Foundation
import Observation

/// Local debug toggle for the V3 agentic generation engine (opt-in, new-client
/// only). Sibling of `AgentV2DebugSettingsStore`. When `useV3Engine` is off, the
/// request payload omits `engine_version` entirely so the server takes the
/// byte-for-byte V2 path — V3 is strictly additive and never the default.
///
/// See `.claude/plans/use-this-prompt-to-agile-valley.md` §"Parallel build".
/// Everything persists to `UserDefaults`; no network involvement.
@Observable
@MainActor
public final class AgentV3SettingsStore {
    private enum Key {
        static let useV3Engine = "agent_v3.use_engine"
        static let dryRun = "agent_v3.dry_run"
        static let model = "agent_v3.model"
    }

    /// Model ids the V3 worker understands (resolveProvider in index.ts keys off
    /// the `deepseek` prefix → DeepSeek endpoint). Order = picker order. The old
    /// deepseek-reasoner/-chat aliases are retired by DeepSeek after 2026-07-24.
    public static let models = ["deepseek-v4-flash", "deepseek-v4-pro"]

    public private(set) var useV3Engine: Bool
    /// Dry run: server runs the full loop + records the trace but writes NO picks.
    public private(set) var dryRun: Bool
    public private(set) var model: String

    public init() {
        let d = UserDefaults.standard
        self.useV3Engine = d.bool(forKey: Key.useV3Engine)
        self.dryRun = d.bool(forKey: Key.dryRun)
        // Stored value may be a retired id (e.g. deepseek-reasoner) — snap back
        // to the current default rather than sending a dead model name.
        let stored = d.string(forKey: Key.model)
        self.model = (stored.flatMap { Self.models.contains($0) ? $0 : nil }) ?? Self.models[0]
    }

    public func setUseV3Engine(_ value: Bool) {
        useV3Engine = value
        UserDefaults.standard.set(value, forKey: Key.useV3Engine)
    }

    public func setDryRun(_ value: Bool) {
        dryRun = value
        UserDefaults.standard.set(value, forKey: Key.dryRun)
    }

    public func setModel(_ value: String) {
        model = value
        UserDefaults.standard.set(value, forKey: Key.model)
    }

    /// The `engine_version` to send, or nil to omit (→ server defaults to V2).
    public var engineVersionForRequest: String? { useV3Engine ? "v3" : nil }

    public var snapshot: [String: String] {
        [
            "use_v3_engine": useV3Engine ? "true" : "false",
            "dry_run": dryRun ? "true" : "false",
            "model": model
        ]
    }
}
