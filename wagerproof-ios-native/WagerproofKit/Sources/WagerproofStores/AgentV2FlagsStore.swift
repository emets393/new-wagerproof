import Foundation
import Observation

/// Local feature-flag store for the V2 generation pipeline. Ports
/// `services/agentV2Flags.ts` + `hooks/useAgentV2Flags.ts`.
///
/// In RN, V2 flags are read from AsyncStorage and a remote config endpoint.
/// We back them with `UserDefaults` for now — the remote-config story lands
/// when we hoist the same fetch in B17. The default values match RN's
/// "enabled in prod, opt-out in debug" behavior.
@Observable
@MainActor
public final class AgentV2FlagsStore {
    private enum Key {
        static let enabled = "agent_v2_flags.enabled"
        static let debugMode = "agent_v2_flags.debug_mode"
    }

    public private(set) var v2Enabled: Bool
    public private(set) var debugMode: Bool

    public init() {
        let defaults = UserDefaults.standard
        // Default to enabled unless the dev settings sheet has explicitly
        // opted out (matches the RN default).
        if defaults.object(forKey: Key.enabled) == nil {
            self.v2Enabled = true
        } else {
            self.v2Enabled = defaults.bool(forKey: Key.enabled)
        }
        self.debugMode = defaults.bool(forKey: Key.debugMode)
    }

    public func setV2Enabled(_ value: Bool) {
        v2Enabled = value
        UserDefaults.standard.set(value, forKey: Key.enabled)
    }

    public func setDebugMode(_ value: Bool) {
        debugMode = value
        UserDefaults.standard.set(value, forKey: Key.debugMode)
    }
}
