import Foundation
import Observation

/// Local DEBUG tuning for the V3 agentic generation engine. This client is
/// V3-only — generation always runs on the Trigger.dev agentic engine — so this
/// store only carries the optional model + dry-run knobs (Secret Settings).
/// Everything persists to `UserDefaults`; no network involvement.
@Observable
@MainActor
public final class AgentV3SettingsStore {
    private enum Key {
        static let dryRun = "agent_v3.dry_run"
        static let model = "agent_v3.model"
    }

    /// Model ids the V3 worker understands (resolveProvider keys off the
    /// `deepseek` prefix → DeepSeek endpoint). Order = picker order. The old
    /// deepseek-reasoner/-chat aliases are retired by DeepSeek after 2026-07-24.
    public static let models = ["deepseek-v4-flash", "deepseek-v4-pro"]

    /// Dry run: server runs the full loop + records the trace but writes NO picks.
    public private(set) var dryRun: Bool
    public private(set) var model: String

    public init() {
        let d = UserDefaults.standard
        self.dryRun = d.bool(forKey: Key.dryRun)
        // Stored value may be a retired id (e.g. deepseek-reasoner) — snap back
        // to the current default rather than sending a dead model name.
        let stored = d.string(forKey: Key.model)
        self.model = (stored.flatMap { Self.models.contains($0) ? $0 : nil }) ?? Self.models[0]
    }

    public func setDryRun(_ value: Bool) {
        dryRun = value
        UserDefaults.standard.set(value, forKey: Key.dryRun)
    }

    public func setModel(_ value: String) {
        model = value
        UserDefaults.standard.set(value, forKey: Key.model)
    }

    public var snapshot: [String: String] {
        ["dry_run": dryRun ? "true" : "false", "model": model]
    }
}
