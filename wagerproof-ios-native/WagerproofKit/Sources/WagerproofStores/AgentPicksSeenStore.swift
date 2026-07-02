import Foundation

/// Device-local "have I seen this agent's latest picks?" ledger, backing the
/// unread badge on the agents list and the auto-play print cinematic on the
/// detail page. Deliberately NOT server state: read receipts are a per-device
/// UX affordance, and a UserDefaults timestamp avoids a write path entirely.
///
/// Comparison is lexicographic — valid because every timestamp here comes from
/// PostgREST's uniform ISO8601 encoding (pick `created_at`, agent
/// `last_generated_at`), which sorts correctly as a string.
public enum AgentPicksSeenStore {
    private static func key(_ agentId: String) -> String {
        "agent_picks_last_seen_\(agentId)"
    }

    public static func lastSeen(agentId: String) -> String? {
        UserDefaults.standard.string(forKey: key(agentId))
    }

    /// Record that everything up to `timestamp` has been seen. Monotonic —
    /// never moves backwards, so racing loaders can call this freely.
    public static func markSeen(agentId: String, upTo timestamp: String?) {
        guard let ts = timestamp, !ts.isEmpty else { return }
        let existing = lastSeen(agentId: agentId) ?? ""
        if ts > existing {
            UserDefaults.standard.set(ts, forKey: key(agentId))
        }
    }

    /// True when the agent has produced something newer than the last thing
    /// this device saw. A never-opened agent with any activity reads as unread.
    public static func hasUnread(agentId: String, latestActivity: String?) -> Bool {
        guard let latest = latestActivity, !latest.isEmpty else { return false }
        guard let seen = lastSeen(agentId: agentId) else { return true }
        return latest > seen
    }
}
