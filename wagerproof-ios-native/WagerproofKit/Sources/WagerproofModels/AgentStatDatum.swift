import Foundation

/// One agent's aggregate performance as returned by the
/// `get_agent_performance_distribution` RPC — the whole-population row set the
/// Agents "Platform Statistics" histograms + normal fit are built from.
///
/// Deliberately PII-free: no name / user_id (those only appear in the public
/// drill-down via `BinAgent`). `winRate` is the RPC's recomputed
/// wins/(wins+losses) in 0…1 (pushes excluded); `statsBySport` carries the same
/// per-sport `{wins,losses,pushes,total}` blob as `AgentPerformance` so the
/// client can slice per-sport distributions without a refetch.
public struct AgentStatDatum: Codable, Sendable, Hashable, Identifiable {
    public let avatarId: String
    public let archetype: String?
    public let isPublic: Bool
    public let wins: Int
    public let losses: Int
    public let pushes: Int
    public let decided: Int
    public let winRate: Double?
    public let netUnits: Double
    public let statsBySport: [String: AgentPerformance.SportStats]
    public let lastCalculatedAt: String?

    public var id: String { avatarId }

    enum CodingKeys: String, CodingKey {
        case avatarId = "avatar_id"
        case archetype
        case isPublic = "is_public"
        case wins
        case losses
        case pushes
        case decided
        case winRate = "win_rate"
        case netUnits = "net_units"
        case statsBySport = "stats_by_sport"
        case lastCalculatedAt = "last_calculated_at"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.avatarId = try c.decode(String.self, forKey: .avatarId)
        self.archetype = try? c.decodeIfPresent(String.self, forKey: .archetype)
        self.isPublic = (try? c.decode(Bool.self, forKey: .isPublic)) ?? false
        self.wins = (try? c.decode(Int.self, forKey: .wins)) ?? 0
        self.losses = (try? c.decode(Int.self, forKey: .losses)) ?? 0
        self.pushes = (try? c.decode(Int.self, forKey: .pushes)) ?? 0
        self.decided = (try? c.decode(Int.self, forKey: .decided)) ?? (self.wins + self.losses)
        // Postgres NUMERIC arrives as a JSON number or string depending on the
        // driver — decode both, same as AgentPerformance.
        self.winRate = AgentStatDatum.decodeNumeric(c, .winRate)
        self.netUnits = AgentStatDatum.decodeNumeric(c, .netUnits) ?? 0
        self.statsBySport = (try? c.decode([String: AgentPerformance.SportStats].self, forKey: .statsBySport)) ?? [:]
        self.lastCalculatedAt = try? c.decodeIfPresent(String.self, forKey: .lastCalculatedAt)
    }

    public init(
        avatarId: String,
        archetype: String? = nil,
        isPublic: Bool = false,
        wins: Int = 0,
        losses: Int = 0,
        pushes: Int = 0,
        decided: Int? = nil,
        winRate: Double? = nil,
        netUnits: Double = 0,
        statsBySport: [String: AgentPerformance.SportStats] = [:],
        lastCalculatedAt: String? = nil
    ) {
        self.avatarId = avatarId
        self.archetype = archetype
        self.isPublic = isPublic
        self.wins = wins
        self.losses = losses
        self.pushes = pushes
        self.decided = decided ?? (wins + losses)
        self.winRate = winRate
        self.netUnits = netUnits
        self.statsBySport = statsBySport
        self.lastCalculatedAt = lastCalculatedAt
    }

    private static func decodeNumeric(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Double? {
        if let d = try? c.decode(Double.self, forKey: key) { return d }
        if let s = try? c.decode(String.self, forKey: key), let d = Double(s) { return d }
        return nil
    }
}

public extension AgentStatDatum {
    /// Settled picks (wins + losses) for `sportKey` (lowercase, e.g. "mlb").
    func decided(forSport sportKey: String) -> Int {
        guard let s = statsBySport[sportKey] else { return 0 }
        return s.wins + s.losses
    }

    /// Win rate (0…1, pushes excluded) for `sportKey`, or nil when that sport
    /// has no settled picks for this agent.
    func winRate(forSport sportKey: String) -> Double? {
        guard let s = statsBySport[sportKey] else { return nil }
        let decided = s.wins + s.losses
        guard decided > 0 else { return nil }
        return Double(s.wins) / Double(decided)
    }
}

/// A public agent surfaced in the tap-a-bar drill-down, from the
/// `get_distribution_bin_agents` RPC: identity + record + this agent's
/// currently-open (pending) picks. Only public agents are ever returned; the
/// RPC enforces that server-side.
public struct BinAgent: Codable, Sendable, Hashable, Identifiable {
    public let avatarId: String
    public let name: String
    public let avatarEmoji: String
    public let avatarColor: String
    public let archetype: String?
    public let wins: Int
    public let losses: Int
    public let pushes: Int
    public let winRate: Double?
    public let netUnits: Double
    public let pendingPicks: [AgentPick]

    public var id: String { avatarId }

    enum CodingKeys: String, CodingKey {
        case avatarId = "avatar_id"
        case name
        case avatarEmoji = "avatar_emoji"
        case avatarColor = "avatar_color"
        case archetype
        case wins
        case losses
        case pushes
        case winRate = "win_rate"
        case netUnits = "net_units"
        case pendingPicks = "pending_picks"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.avatarId = try c.decode(String.self, forKey: .avatarId)
        self.name = (try? c.decode(String.self, forKey: .name)) ?? "Agent"
        self.avatarEmoji = (try? c.decode(String.self, forKey: .avatarEmoji)) ?? "\u{1F916}"
        self.avatarColor = (try? c.decode(String.self, forKey: .avatarColor)) ?? "#6366f1"
        self.archetype = try? c.decodeIfPresent(String.self, forKey: .archetype)
        self.wins = (try? c.decode(Int.self, forKey: .wins)) ?? 0
        self.losses = (try? c.decode(Int.self, forKey: .losses)) ?? 0
        self.pushes = (try? c.decode(Int.self, forKey: .pushes)) ?? 0
        if let d = try? c.decode(Double.self, forKey: .winRate) {
            self.winRate = d
        } else if let s = try? c.decode(String.self, forKey: .winRate), let d = Double(s) {
            self.winRate = d
        } else {
            self.winRate = nil
        }
        if let d = try? c.decode(Double.self, forKey: .netUnits) {
            self.netUnits = d
        } else if let s = try? c.decode(String.self, forKey: .netUnits), let d = Double(s) {
            self.netUnits = d
        } else {
            self.netUnits = 0
        }
        self.pendingPicks = AgentStatsDecoding.picks(from: c, forKey: .pendingPicks)
    }

    public init(
        avatarId: String,
        name: String,
        avatarEmoji: String = "\u{1F916}",
        avatarColor: String = "#6366f1",
        archetype: String? = nil,
        wins: Int = 0,
        losses: Int = 0,
        pushes: Int = 0,
        winRate: Double? = nil,
        netUnits: Double = 0,
        pendingPicks: [AgentPick] = []
    ) {
        self.avatarId = avatarId
        self.name = name
        self.avatarEmoji = avatarEmoji
        self.avatarColor = avatarColor
        self.archetype = archetype
        self.wins = wins
        self.losses = losses
        self.pushes = pushes
        self.winRate = winRate
        self.netUnits = netUnits
        self.pendingPicks = pendingPicks
    }

    /// "W-L" / "W-L-P" record string, mirroring `AgentPerformance.recordLabel`.
    public var recordLabel: String {
        var parts = [String(wins), String(losses)]
        if pushes > 0 { parts.append(String(pushes)) }
        return parts.joined(separator: "-")
    }
}

/// Lossy pick-array decode shared by `BinAgent` — one malformed pick shouldn't
/// blank the whole drill-down list.
private enum AgentStatsDecoding {
    static func picks(from c: KeyedDecodingContainer<BinAgent.CodingKeys>, forKey key: BinAgent.CodingKeys) -> [AgentPick] {
        guard var nested = try? c.nestedUnkeyedContainer(forKey: key) else { return [] }
        var picks: [AgentPick] = []
        while !nested.isAtEnd {
            if let pick = try? nested.decode(AgentPick.self) {
                picks.append(pick)
            } else {
                _ = try? nested.decode(JSONValue.self)
            }
        }
        return picks
    }
}
