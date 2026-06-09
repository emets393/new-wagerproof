import Foundation

/// Codable mirror of `avatar_performance_cache` rows in main Supabase. Field
/// names match the table columns byte-for-byte. Cache is refreshed by the
/// `recalculate_avatar_performance` RPC after picks are graded.
///
/// Ports RN `AgentPerformance` from `types/agent.ts:218-233`. The nested
/// `stats_by_sport` / `stats_by_bet_type` JSONB blobs are decoded loosely as
/// `[String: SportStats]` so an unknown sport key doesn't blow up decoding.
public struct AgentPerformance: Codable, Sendable, Hashable {
    public let avatarId: String
    public var totalPicks: Int
    public var wins: Int
    public var losses: Int
    public var pushes: Int
    public var pending: Int
    public var winRate: Double?
    public var netUnits: Double
    public var currentStreak: Int
    public var bestStreak: Int
    public var worstStreak: Int
    public var statsBySport: [String: SportStats]
    public var statsByBetType: [String: SportStats]
    public var lastCalculatedAt: String?

    public struct SportStats: Codable, Sendable, Hashable {
        public var wins: Int
        public var losses: Int
        public var pushes: Int
        public var total: Int

        public init(wins: Int = 0, losses: Int = 0, pushes: Int = 0, total: Int = 0) {
            self.wins = wins
            self.losses = losses
            self.pushes = pushes
            self.total = total
        }
    }

    enum CodingKeys: String, CodingKey {
        case avatarId = "avatar_id"
        case totalPicks = "total_picks"
        case wins
        case losses
        case pushes
        case pending
        case winRate = "win_rate"
        case netUnits = "net_units"
        case currentStreak = "current_streak"
        case bestStreak = "best_streak"
        case worstStreak = "worst_streak"
        case statsBySport = "stats_by_sport"
        case statsByBetType = "stats_by_bet_type"
        case lastCalculatedAt = "last_calculated_at"
    }

    public init(
        avatarId: String,
        totalPicks: Int = 0,
        wins: Int = 0,
        losses: Int = 0,
        pushes: Int = 0,
        pending: Int = 0,
        winRate: Double? = nil,
        netUnits: Double = 0,
        currentStreak: Int = 0,
        bestStreak: Int = 0,
        worstStreak: Int = 0,
        statsBySport: [String: SportStats] = [:],
        statsByBetType: [String: SportStats] = [:],
        lastCalculatedAt: String? = nil
    ) {
        self.avatarId = avatarId
        self.totalPicks = totalPicks
        self.wins = wins
        self.losses = losses
        self.pushes = pushes
        self.pending = pending
        self.winRate = winRate
        self.netUnits = netUnits
        self.currentStreak = currentStreak
        self.bestStreak = bestStreak
        self.worstStreak = worstStreak
        self.statsBySport = statsBySport
        self.statsByBetType = statsByBetType
        self.lastCalculatedAt = lastCalculatedAt
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.avatarId = try c.decode(String.self, forKey: .avatarId)
        self.totalPicks = (try? c.decode(Int.self, forKey: .totalPicks)) ?? 0
        self.wins = (try? c.decode(Int.self, forKey: .wins)) ?? 0
        self.losses = (try? c.decode(Int.self, forKey: .losses)) ?? 0
        self.pushes = (try? c.decode(Int.self, forKey: .pushes)) ?? 0
        self.pending = (try? c.decode(Int.self, forKey: .pending)) ?? 0
        self.winRate = try? c.decodeIfPresent(Double.self, forKey: .winRate)
        // net_units may arrive as Number or String (Postgres NUMERIC).
        if let d = try? c.decode(Double.self, forKey: .netUnits) {
            self.netUnits = d
        } else if let s = try? c.decode(String.self, forKey: .netUnits), let d = Double(s) {
            self.netUnits = d
        } else {
            self.netUnits = 0
        }
        self.currentStreak = (try? c.decode(Int.self, forKey: .currentStreak)) ?? 0
        self.bestStreak = (try? c.decode(Int.self, forKey: .bestStreak)) ?? 0
        self.worstStreak = (try? c.decode(Int.self, forKey: .worstStreak)) ?? 0
        self.statsBySport = (try? c.decode([String: SportStats].self, forKey: .statsBySport)) ?? [:]
        self.statsByBetType = (try? c.decode([String: SportStats].self, forKey: .statsByBetType)) ?? [:]
        self.lastCalculatedAt = try? c.decodeIfPresent(String.self, forKey: .lastCalculatedAt)
    }
}

// MARK: - Formatting helpers (port of helpers in types/agent.ts:520-543)

public extension AgentPerformance {
    /// "W-L" or "W-L-P" record string. Mirrors `formatRecord`.
    var recordLabel: String {
        var parts = [String(wins), String(losses)]
        if pushes > 0 { parts.append(String(pushes)) }
        return parts.joined(separator: "-")
    }

    /// "+1.23u" / "-0.50u". Mirrors `formatNetUnits`.
    var netUnitsLabel: String {
        let sign = netUnits >= 0 ? "+" : ""
        return String(format: "%@%.2fu", sign, netUnits)
    }

    /// "W3" / "L2" / "-". Mirrors `formatStreak`.
    var currentStreakLabel: String {
        if currentStreak == 0 { return "-" }
        if currentStreak > 0 { return "W\(currentStreak)" }
        return "L\(abs(currentStreak))"
    }
}

/// Leaderboard row as returned by the `get_leaderboard_v2` RPC. Mirrors RN
/// `LeaderboardEntry` (`services/agentPerformanceService.ts:9-24`).
public struct AgentLeaderboardEntry: Codable, Identifiable, Sendable, Hashable {
    public let avatarId: String
    public let name: String
    public let avatarEmoji: String
    public let avatarColor: String
    public let userId: String
    public let preferredSports: [AgentSport]
    public let totalPicks: Int
    public let wins: Int
    public let losses: Int
    public let pushes: Int
    public let winRate: Double?
    public let netUnits: Double
    public let currentStreak: Int
    public let bestStreak: Int

    public var id: String { avatarId }

    /// Stable pixel-office character index (0…7) — see `AgentSpriteIndex`.
    /// Same derivation as `Agent.spriteIndex` so a leaderboard row and the
    /// agent's own card show the identical character.
    public var spriteIndex: Int { AgentSpriteIndex.forSeed(avatarId) }

    enum CodingKeys: String, CodingKey {
        case avatarId = "avatar_id"
        case name
        case avatarEmoji = "avatar_emoji"
        case avatarColor = "avatar_color"
        case userId = "user_id"
        case preferredSports = "preferred_sports"
        case totalPicks = "total_picks"
        case wins
        case losses
        case pushes
        case winRate = "win_rate"
        case netUnits = "net_units"
        case currentStreak = "current_streak"
        case bestStreak = "best_streak"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.avatarId = try c.decode(String.self, forKey: .avatarId)
        self.name = try c.decode(String.self, forKey: .name)
        self.avatarEmoji = (try? c.decode(String.self, forKey: .avatarEmoji)) ?? "\u{1F916}"
        self.avatarColor = (try? c.decode(String.self, forKey: .avatarColor)) ?? "#6366f1"
        self.userId = try c.decode(String.self, forKey: .userId)
        self.preferredSports = (try? c.decode([AgentSport].self, forKey: .preferredSports)) ?? []
        self.totalPicks = (try? c.decode(Int.self, forKey: .totalPicks)) ?? 0
        self.wins = (try? c.decode(Int.self, forKey: .wins)) ?? 0
        self.losses = (try? c.decode(Int.self, forKey: .losses)) ?? 0
        self.pushes = (try? c.decode(Int.self, forKey: .pushes)) ?? 0
        self.winRate = try? c.decodeIfPresent(Double.self, forKey: .winRate)
        if let d = try? c.decode(Double.self, forKey: .netUnits) {
            self.netUnits = d
        } else if let s = try? c.decode(String.self, forKey: .netUnits), let d = Double(s) {
            self.netUnits = d
        } else {
            self.netUnits = 0
        }
        self.currentStreak = (try? c.decode(Int.self, forKey: .currentStreak)) ?? 0
        self.bestStreak = (try? c.decode(Int.self, forKey: .bestStreak)) ?? 0
    }

    public init(
        avatarId: String,
        name: String,
        avatarEmoji: String,
        avatarColor: String,
        userId: String,
        preferredSports: [AgentSport],
        totalPicks: Int,
        wins: Int,
        losses: Int,
        pushes: Int,
        winRate: Double?,
        netUnits: Double,
        currentStreak: Int,
        bestStreak: Int
    ) {
        self.avatarId = avatarId
        self.name = name
        self.avatarEmoji = avatarEmoji
        self.avatarColor = avatarColor
        self.userId = userId
        self.preferredSports = preferredSports
        self.totalPicks = totalPicks
        self.wins = wins
        self.losses = losses
        self.pushes = pushes
        self.winRate = winRate
        self.netUnits = netUnits
        self.currentStreak = currentStreak
        self.bestStreak = bestStreak
    }
}
