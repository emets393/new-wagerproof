import Foundation

// MARK: - Content Type Enum

enum WidgetContentType: String, Codable, CaseIterable {
    case editorPicks = "editor_picks"
    case fadeAlerts = "fade_alerts"
    case polymarketValue = "polymarket_value"
    case topAgentsPicks = "top_agents_picks"

    var displayName: String {
        switch self {
        case .editorPicks: return "Editor Picks"
        case .fadeAlerts: return "Fade Alerts"
        case .polymarketValue: return "Market Value"
        case .topAgentsPicks: return "Top Agents"
        }
    }

    var deepLinkPath: String {
        switch self {
        case .editorPicks: return "picks"
        case .fadeAlerts: return "outliers"
        case .polymarketValue: return "outliers"
        case .topAgentsPicks: return "agents"
        }
    }

    var iconName: String {
        switch self {
        case .editorPicks: return "star.fill"
        case .fadeAlerts: return "bolt.fill"
        case .polymarketValue: return "chart.line.uptrend.xyaxis"
        case .topAgentsPicks: return "person.3.fill"
        }
    }
}

// MARK: - Editor Pick Data

struct EditorPickWidgetData: Codable, Identifiable {
    let id: String
    let gameType: String
    let awayTeam: String
    let homeTeam: String
    let pickValue: String?
    let bestPrice: String?
    let sportsbook: String?
    let units: Double?
    let result: String?
    let gameDate: String?

    var sportBadge: String {
        gameType.uppercased()
    }

    var formattedMatchup: String {
        "\(awayTeam) @ \(homeTeam)"
    }

    var resultColor: String {
        switch result?.lowercased() {
        case "won": return "22c55e"  // Green
        case "lost": return "ef4444" // Red
        case "push": return "eab308" // Yellow
        default: return "9ca3af"     // Gray
        }
    }
}

// MARK: - Fade Alert Data

struct FadeAlertWidgetData: Codable, Identifiable {
    var id: String { gameId + pickType }
    let gameId: String
    let sport: String
    let awayTeam: String
    let homeTeam: String
    let pickType: String
    let predictedTeam: String
    let confidence: Int
    let gameTime: String?

    // Memberwise initializer for sample data
    init(gameId: String, sport: String, awayTeam: String, homeTeam: String,
         pickType: String, predictedTeam: String, confidence: Int, gameTime: String?) {
        self.gameId = gameId
        self.sport = sport
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.pickType = pickType
        self.predictedTeam = predictedTeam
        self.confidence = confidence
        self.gameTime = gameTime
    }

    // Custom decoder to handle gameId as either String or Int
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Handle gameId as either String or Int
        if let stringId = try? container.decode(String.self, forKey: .gameId) {
            gameId = stringId
        } else if let intId = try? container.decode(Int.self, forKey: .gameId) {
            gameId = String(intId)
        } else {
            gameId = "unknown"
        }

        sport = try container.decode(String.self, forKey: .sport)
        awayTeam = try container.decode(String.self, forKey: .awayTeam)
        homeTeam = try container.decode(String.self, forKey: .homeTeam)
        pickType = try container.decode(String.self, forKey: .pickType)
        predictedTeam = try container.decode(String.self, forKey: .predictedTeam)
        confidence = try container.decode(Int.self, forKey: .confidence)
        gameTime = try container.decodeIfPresent(String.self, forKey: .gameTime)
    }

    var sportBadge: String {
        sport.uppercased()
    }

    var formattedMatchup: String {
        "\(awayTeam) @ \(homeTeam)"
    }

    var fadeRecommendation: String {
        if pickType == "Spread" {
            // Recommend fading (betting opposite)
            let oppositeTeam = predictedTeam == homeTeam ? awayTeam : homeTeam
            return "Fade to \(oppositeTeam)"
        } else if pickType == "Total" {
            let opposite = predictedTeam == "Over" ? "Under" : "Over"
            return "Fade to \(opposite)"
        }
        return "Fade \(predictedTeam)"
    }

    var confidenceDisplay: String {
        // NFL uses percentage (80-100%), other sports use point deltas
        switch sport.lowercased() {
        case "nfl":
            return "\(confidence)%"
        default:
            // CFB, NBA, NCAAB use point deltas (e.g., "12pt")
            return "\(confidence)pt"
        }
    }
}

// MARK: - Polymarket Value Data

struct PolymarketValueWidgetData: Codable, Identifiable {
    var id: String { "\(gameId)_\(marketType)" }
    let gameId: String
    let sport: String
    let awayTeam: String
    let homeTeam: String
    let marketType: String
    let side: String
    let percentage: Int

    // Memberwise initializer for sample data
    init(gameId: String, sport: String, awayTeam: String, homeTeam: String,
         marketType: String, side: String, percentage: Int) {
        self.gameId = gameId
        self.sport = sport
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.marketType = marketType
        self.side = side
        self.percentage = percentage
    }

    // Custom decoder to handle gameId as either String or Int
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Handle gameId as either String or Int
        if let stringId = try? container.decode(String.self, forKey: .gameId) {
            gameId = stringId
        } else if let intId = try? container.decode(Int.self, forKey: .gameId) {
            gameId = String(intId)
        } else {
            gameId = "unknown"
        }

        sport = try container.decode(String.self, forKey: .sport)
        awayTeam = try container.decode(String.self, forKey: .awayTeam)
        homeTeam = try container.decode(String.self, forKey: .homeTeam)
        marketType = try container.decode(String.self, forKey: .marketType)
        side = try container.decode(String.self, forKey: .side)
        percentage = try container.decode(Int.self, forKey: .percentage)
    }

    var sportBadge: String {
        sport.uppercased()
    }

    var formattedMatchup: String {
        "\(awayTeam) @ \(homeTeam)"
    }

    var marketTypeDisplay: String {
        switch marketType.lowercased() {
        case "spread": return "Spread"
        case "total": return "Total"
        case "moneyline": return "ML"
        default: return marketType
        }
    }

    var valueDisplay: String {
        "\(percentage)% on \(side)"
    }
}

// MARK: - Top Agent Data

struct AgentPickWidgetData: Codable, Identifiable {
    let id: String
    let sport: String
    let matchup: String
    let pickSelection: String
    let odds: String?
    let result: String?
    let gameDate: String?
}

struct TopAgentWidgetData: Codable, Identifiable {
    var id: String { agentId }
    let agentId: String
    let agentName: String
    let agentEmoji: String
    let agentColor: String
    let isFavorite: Bool
    let netUnits: Double
    let winRate: Double?
    let currentStreak: Int
    let record: String
    let picks: [AgentPickWidgetData]
}

// MARK: - Widget Data Container

struct WidgetDataContainer: Codable {
    let editorPicks: [EditorPickWidgetData]
    let fadeAlerts: [FadeAlertWidgetData]
    let polymarketValues: [PolymarketValueWidgetData]
    let topAgentPicks: [TopAgentWidgetData]
    let lastUpdated: Date

    enum CodingKeys: String, CodingKey {
        case editorPicks, fadeAlerts, polymarketValues, topAgentPicks, lastUpdated
    }

    init(
        editorPicks: [EditorPickWidgetData],
        fadeAlerts: [FadeAlertWidgetData],
        polymarketValues: [PolymarketValueWidgetData],
        topAgentPicks: [TopAgentWidgetData],
        lastUpdated: Date
    ) {
        self.editorPicks = editorPicks
        self.fadeAlerts = fadeAlerts
        self.polymarketValues = polymarketValues
        self.topAgentPicks = topAgentPicks
        self.lastUpdated = lastUpdated
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        editorPicks = try container.decodeIfPresent([EditorPickWidgetData].self, forKey: .editorPicks) ?? []
        fadeAlerts = try container.decodeIfPresent([FadeAlertWidgetData].self, forKey: .fadeAlerts) ?? []
        polymarketValues = try container.decodeIfPresent([PolymarketValueWidgetData].self, forKey: .polymarketValues) ?? []
        topAgentPicks = try container.decodeIfPresent([TopAgentWidgetData].self, forKey: .topAgentPicks) ?? []
        lastUpdated = try container.decode(Date.self, forKey: .lastUpdated)
    }

    static var empty: WidgetDataContainer {
        WidgetDataContainer(
            editorPicks: [],
            fadeAlerts: [],
            polymarketValues: [],
            topAgentPicks: [],
            lastUpdated: Date()
        )
    }
}

// MARK: - Sample Data for Previews

extension EditorPickWidgetData {
    static var sample: EditorPickWidgetData {
        EditorPickWidgetData(
            id: "1",
            gameType: "nfl",
            awayTeam: "Ravens",
            homeTeam: "Chiefs",
            pickValue: "Ravens -3.5",
            bestPrice: "-110",
            sportsbook: "DraftKings",
            units: 1.0,
            result: nil,
            gameDate: "2024-01-15T20:00:00Z"
        )
    }

    static var sampleArray: [EditorPickWidgetData] {
        [
            EditorPickWidgetData(
                id: "1",
                gameType: "nfl",
                awayTeam: "Ravens",
                homeTeam: "Chiefs",
                pickValue: "Ravens -3.5",
                bestPrice: "-110",
                sportsbook: "DraftKings",
                units: 1.0,
                result: nil,
                gameDate: nil
            ),
            EditorPickWidgetData(
                id: "2",
                gameType: "nba",
                awayTeam: "Lakers",
                homeTeam: "Celtics",
                pickValue: "Over 224.5",
                bestPrice: "-105",
                sportsbook: "FanDuel",
                units: 0.5,
                result: "won",
                gameDate: nil
            ),
            EditorPickWidgetData(
                id: "3",
                gameType: "cfb",
                awayTeam: "Alabama",
                homeTeam: "Georgia",
                pickValue: "Georgia -7",
                bestPrice: "-115",
                sportsbook: "BetMGM",
                units: 1.5,
                result: nil,
                gameDate: nil
            ),
            EditorPickWidgetData(
                id: "4",
                gameType: "ncaab",
                awayTeam: "Duke",
                homeTeam: "UNC",
                pickValue: "Duke +2.5",
                bestPrice: "-108",
                sportsbook: "Caesars",
                units: 1.0,
                result: nil,
                gameDate: nil
            ),
            EditorPickWidgetData(
                id: "5",
                gameType: "nfl",
                awayTeam: "Bills",
                homeTeam: "Dolphins",
                pickValue: "Under 48.5",
                bestPrice: "-112",
                sportsbook: "DraftKings",
                units: 0.75,
                result: nil,
                gameDate: nil
            )
        ]
    }
}

extension FadeAlertWidgetData {
    static var sample: FadeAlertWidgetData {
        FadeAlertWidgetData(
            gameId: "1",
            sport: "nfl",
            awayTeam: "49ers",
            homeTeam: "Cowboys",
            pickType: "Spread",
            predictedTeam: "49ers",
            confidence: 85,
            gameTime: "8:20 PM ET"
        )
    }

    static var sampleArray: [FadeAlertWidgetData] {
        [
            FadeAlertWidgetData(
                gameId: "1",
                sport: "nfl",
                awayTeam: "49ers",
                homeTeam: "Cowboys",
                pickType: "Spread",
                predictedTeam: "49ers",
                confidence: 85,
                gameTime: "8:20 PM ET"
            ),
            FadeAlertWidgetData(
                gameId: "2",
                sport: "cfb",
                awayTeam: "Ohio State",
                homeTeam: "Michigan",
                pickType: "Total",
                predictedTeam: "Over",
                confidence: 82,
                gameTime: "12:00 PM ET"
            ),
            FadeAlertWidgetData(
                gameId: "3",
                sport: "nba",
                awayTeam: "Warriors",
                homeTeam: "Suns",
                pickType: "Spread",
                predictedTeam: "Warriors",
                confidence: 88,
                gameTime: "10:00 PM ET"
            ),
            FadeAlertWidgetData(
                gameId: "4",
                sport: "ncaab",
                awayTeam: "Kansas",
                homeTeam: "Kentucky",
                pickType: "Spread",
                predictedTeam: "Kentucky",
                confidence: 81,
                gameTime: "7:00 PM ET"
            ),
            FadeAlertWidgetData(
                gameId: "5",
                sport: "nfl",
                awayTeam: "Eagles",
                homeTeam: "Giants",
                pickType: "Total",
                predictedTeam: "Under",
                confidence: 83,
                gameTime: "1:00 PM ET"
            )
        ]
    }
}

extension PolymarketValueWidgetData {
    static var sample: PolymarketValueWidgetData {
        PolymarketValueWidgetData(
            gameId: "1",
            sport: "nfl",
            awayTeam: "Packers",
            homeTeam: "Bears",
            marketType: "spread",
            side: "Packers",
            percentage: 62
        )
    }

    static var sampleArray: [PolymarketValueWidgetData] {
        [
            PolymarketValueWidgetData(
                gameId: "1",
                sport: "nfl",
                awayTeam: "Packers",
                homeTeam: "Bears",
                marketType: "spread",
                side: "Packers",
                percentage: 62
            ),
            PolymarketValueWidgetData(
                gameId: "2",
                sport: "nba",
                awayTeam: "Nuggets",
                homeTeam: "Heat",
                marketType: "moneyline",
                side: "Nuggets",
                percentage: 87
            ),
            PolymarketValueWidgetData(
                gameId: "3",
                sport: "cfb",
                awayTeam: "Texas",
                homeTeam: "Oklahoma",
                marketType: "total",
                side: "Over",
                percentage: 59
            ),
            PolymarketValueWidgetData(
                gameId: "4",
                sport: "ncaab",
                awayTeam: "Gonzaga",
                homeTeam: "UCLA",
                marketType: "spread",
                side: "Gonzaga",
                percentage: 64
            ),
            PolymarketValueWidgetData(
                gameId: "5",
                sport: "nfl",
                awayTeam: "Bengals",
                homeTeam: "Steelers",
                marketType: "total",
                side: "Under",
                percentage: 58
            )
        ]
    }
}

extension TopAgentWidgetData {
    static var sampleArray: [TopAgentWidgetData] {
        [
            TopAgentWidgetData(
                agentId: "agent-1",
                agentName: "Sharp Edge",
                agentEmoji: "🎯",
                agentColor: "#22c55e",
                isFavorite: true,
                netUnits: 8.4,
                winRate: 0.61,
                currentStreak: 4,
                record: "28-18",
                picks: [
                    AgentPickWidgetData(
                        id: "pick-a1-1",
                        sport: "nfl",
                        matchup: "Ravens @ Chiefs",
                        pickSelection: "Ravens -3.5",
                        odds: "-110",
                        result: nil,
                        gameDate: nil
                    ),
                    AgentPickWidgetData(
                        id: "pick-a1-2",
                        sport: "nba",
                        matchup: "Lakers @ Celtics",
                        pickSelection: "Over 224.5",
                        odds: "-105",
                        result: nil,
                        gameDate: nil
                    )
                ]
            ),
            TopAgentWidgetData(
                agentId: "agent-2",
                agentName: "Line Hunter",
                agentEmoji: "🧠",
                agentColor: "#3b82f6",
                isFavorite: false,
                netUnits: 6.1,
                winRate: 0.57,
                currentStreak: 2,
                record: "24-18",
                picks: [
                    AgentPickWidgetData(
                        id: "pick-a2-1",
                        sport: "cfb",
                        matchup: "Alabama @ Georgia",
                        pickSelection: "Georgia -7",
                        odds: "-115",
                        result: nil,
                        gameDate: nil
                    )
                ]
            ),
            TopAgentWidgetData(
                agentId: "agent-3",
                agentName: "Market Fade",
                agentEmoji: "⚡",
                agentColor: "#f59e0b",
                isFavorite: true,
                netUnits: 4.2,
                winRate: 0.54,
                currentStreak: 1,
                record: "20-17",
                picks: [
                    AgentPickWidgetData(
                        id: "pick-a3-1",
                        sport: "ncaab",
                        matchup: "Duke @ UNC",
                        pickSelection: "Duke +2.5",
                        odds: "-108",
                        result: nil,
                        gameDate: nil
                    ),
                    AgentPickWidgetData(
                        id: "pick-a3-2",
                        sport: "nfl",
                        matchup: "Bills @ Dolphins",
                        pickSelection: "Under 48.5",
                        odds: "-112",
                        result: nil,
                        gameDate: nil
                    )
                ]
            )
        ]
    }
}
