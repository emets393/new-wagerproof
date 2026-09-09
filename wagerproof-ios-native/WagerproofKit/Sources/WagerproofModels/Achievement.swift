import Foundation

public enum AchievementGroup: String, CaseIterable, Identifiable, Sendable {
    case gettingStarted, experience, streaks, performance, leaderboard, exploration
    public var id: String { rawValue }
    public var title: String {
        switch self {
        case .gettingStarted: return "Getting Started"
        case .experience: return "Experience"
        case .streaks: return "Win Streaks"
        case .performance: return "Performance"
        case .leaderboard: return "Leaderboard"
        case .exploration: return "Exploration"
        }
    }
    public var asset: String { self == .gettingStarted ? "getting-started" : rawValue }
}

public struct AchievementDefinition: Identifiable, Sendable, Equatable {
    public let id: String
    public let title: String
    public let group: AchievementGroup
    public let variantRoot: String
    public let target: Double
    public let requirement: String
    public var thumbnail: String { "achievement_" + variantRoot }
}

public enum AchievementCatalog {
    public static let definitions: [AchievementDefinition] = [
        .init(id: "first-agent", title: "First Agent", group: .gettingStarted, variantRoot: "FirstAgent", target: 1, requirement: "Create your first agent."),
        .init(id: "first-follow", title: "First Follow", group: .gettingStarted, variantRoot: "FirstFollow", target: 1, requirement: "Follow a public agent."),
        .init(id: "first-picks", title: "First Picks", group: .gettingStarted, variantRoot: "FirstPicks", target: 1, requirement: "Generate picks with your own agent."),
        .init(id: "experience-10", title: "10 Graded Picks", group: .experience, variantRoot: "Experience10", target: 10, requirement: "Have one of your agents reach 10 graded picks."),
        .init(id: "experience-50", title: "50 Graded Picks", group: .experience, variantRoot: "Experience50", target: 50, requirement: "Have one of your agents reach 50 graded picks."),
        .init(id: "experience-100", title: "100 Graded Picks", group: .experience, variantRoot: "Experience100", target: 100, requirement: "Have one of your agents reach 100 graded picks."),
        .init(id: "experience-500", title: "500 Graded Picks", group: .experience, variantRoot: "Experience500", target: 500, requirement: "Have one of your agents reach 500 graded picks."),
        .init(id: "streak-3", title: "3 Win Streak", group: .streaks, variantRoot: "Streak3", target: 3, requirement: "Have one agent win 3 consecutive straight picks."),
        .init(id: "streak-5", title: "5 Win Streak", group: .streaks, variantRoot: "Streak5", target: 5, requirement: "Have one agent win 5 consecutive straight picks."),
        .init(id: "streak-10", title: "10 Win Streak", group: .streaks, variantRoot: "Streak10", target: 10, requirement: "Have one agent win 10 consecutive straight picks."),
        .init(id: "streak-15", title: "15 Win Streak", group: .streaks, variantRoot: "Streak15", target: 15, requirement: "Have one agent win 15 consecutive straight picks."),
        .init(id: "first-win", title: "First Win", group: .performance, variantRoot: "FirstWin", target: 1, requirement: "Have an agent record its first winning pick."),
        .init(id: "plus-10-units", title: "+10 Units", group: .performance, variantRoot: "Plus10Units", target: 10, requirement: "Have one agent reach +10 net units."),
        .init(id: "plus-25-units", title: "+25 Units", group: .performance, variantRoot: "Plus25Units", target: 25, requirement: "Have one agent reach +25 net units."),
        .init(id: "consistent", title: "Consistent", group: .performance, variantRoot: "Consistent", target: 55, requirement: "Reach a 55% win rate with at least 100 decided picks on one agent."),
        .init(id: "top-100", title: "Top 100", group: .leaderboard, variantRoot: "Top100", target: 100, requirement: "Place a public agent in the all-time top 100 with at least 10 graded picks."),
        .init(id: "top-10", title: "Top 10", group: .leaderboard, variantRoot: "Top10", target: 10, requirement: "Place a public agent in the all-time top 10 with at least 10 graded picks."),
        .init(id: "number-one", title: "Number One", group: .leaderboard, variantRoot: "NumberOne", target: 1, requirement: "Reach first place on the all-time public agent leaderboard with at least 10 graded picks."),
        .init(id: "game-analyst", title: "Game Analyst", group: .exploration, variantRoot: "GameAnalyst", target: 1, requirement: "Explore the analysis for a game."),
        .init(id: "props-scout", title: "Props Scout", group: .exploration, variantRoot: "PropsScout", target: 1, requirement: "Explore a player prop."),
        .init(id: "trend-explorer", title: "Trend Explorer", group: .exploration, variantRoot: "TrendExplorer", target: 1, requirement: "Explore historical betting analysis."),
        .init(id: "system-builder", title: "System Builder", group: .exploration, variantRoot: "SystemBuilder", target: 1, requirement: "Save a betting system with its analysis."),
        .init(id: "wagerbot-partner", title: "WagerBot Partner", group: .exploration, variantRoot: "WagerbotPartner", target: 1, requirement: "Complete a conversation turn with WagerBot."),
        .init(id: "connected-researcher", title: "Connected Researcher", group: .exploration, variantRoot: "ConnectedResearcher", target: 1, requirement: "Complete a research tool request through your connected WagerProof account."),
    ]
}

/// Unlock dates are server persisted facts. Display progress never grants an award.
public struct AchievementStatus: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let progress: Double
    public let currentValue: Double
    public let targetValue: Double
    public let earnedAt: Date?
    public let isBackfilled: Bool
    public let creditedAgentId: UUID?
    public init(id: String, progress: Double = 0, currentValue: Double = 0,
                targetValue: Double = 1, earnedAt: Date? = nil, isBackfilled: Bool = false,
                creditedAgentId: UUID? = nil) {
        self.id = id; self.progress = progress; self.currentValue = currentValue
        self.targetValue = targetValue; self.earnedAt = earnedAt
        self.isBackfilled = isBackfilled; self.creditedAgentId = creditedAgentId
    }
    enum CodingKeys: String, CodingKey {
        case id, progress
        case currentValue = "current_value", targetValue = "target_value"
        case earnedAt = "earned_at", isBackfilled = "is_backfilled", creditedAgentId = "credited_agent_id"
    }
}

public struct AchievementSnapshot: Codable, Sendable {
    public let catalogVersion: Int
    public let initializedAt: Date
    public let generatedAt: Date
    public let achievements: [AchievementStatus]
    public let newlyUnlockedIds: [String]
    public init(catalogVersion: Int = 1, initializedAt: Date, generatedAt: Date,
                achievements: [AchievementStatus], newlyUnlockedIds: [String] = []) {
        self.catalogVersion = catalogVersion; self.initializedAt = initializedAt
        self.generatedAt = generatedAt; self.achievements = achievements
        self.newlyUnlockedIds = newlyUnlockedIds
    }
    enum CodingKeys: String, CodingKey {
        case catalogVersion = "catalog_version", initializedAt = "initialized_at", generatedAt = "generated_at"
        case achievements, newlyUnlockedIds = "newly_unlocked_ids"
    }
}

public struct Achievement: Identifiable, Sendable, Equatable {
    public let definition: AchievementDefinition
    public let status: AchievementStatus
    public var id: String { definition.id }
    public var earned: Bool { status.earnedAt != nil }
    public var fraction: Double { earned ? 1 : min(1, max(0, status.progress.isFinite ? status.progress : 0)) }
    public init(definition: AchievementDefinition, status: AchievementStatus? = nil) {
        self.definition = definition
        self.status = status ?? AchievementStatus(id: definition.id, targetValue: definition.target)
    }
}

public enum AchievementActivity: String, Codable, Sendable {
    case gameAnalysis = "game_analysis"
    case props
    case historicalAnalysis = "historical_analysis"
}
