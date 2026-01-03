import Foundation

/// Service for fetching data directly from Supabase when App Group data is stale
/// This is a fallback mechanism to ensure widgets have data even if the main app hasn't been opened
actor SupabaseWidgetService {
    static let shared = SupabaseWidgetService()

    // Main Supabase instance (editors_picks, polymarket_markets)
    private let mainURL = "https://gnjrklxotmbvnxbnnqgq.supabase.co"
    private let mainKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ"

    // College Football Supabase instance
    private let cfbURL = "https://jpxnjuwglavsjbgbasnl.supabase.co"
    private let cfbKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo"

    private init() {}

    // MARK: - Editor Picks

    /// Fetch published editor picks from Supabase
    func fetchEditorPicks(limit: Int = 5) async throws -> [EditorPickWidgetData] {
        let urlString = "\(mainURL)/rest/v1/editors_picks?is_published=eq.true&order=created_at.desc&limit=\(limit)&select=id,game_id,game_type,pick_value,best_price,sportsbook,units,result,created_at,archived_game_data"

        guard let url = URL(string: urlString) else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(mainKey)", forHTTPHeaderField: "Authorization")
        request.setValue(mainKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }

        // Decode the raw Supabase response
        let rawPicks = try JSONDecoder().decode([RawEditorPick].self, from: data)

        // Transform to widget data format
        return rawPicks.compactMap { raw in
            // Extract team names from archived_game_data if available
            let awayTeam = raw.archived_game_data?["awayTeam"] as? String ?? "Away"
            let homeTeam = raw.archived_game_data?["homeTeam"] as? String ?? "Home"
            let gameDate = raw.archived_game_data?["gameDate"] as? String

            return EditorPickWidgetData(
                id: raw.id,
                gameType: raw.game_type,
                awayTeam: awayTeam,
                homeTeam: homeTeam,
                pickValue: raw.pick_value,
                bestPrice: raw.best_price,
                sportsbook: raw.sportsbook,
                units: raw.units,
                result: raw.result,
                gameDate: gameDate
            )
        }
    }

    // MARK: - Value Alerts (Polymarket)

    /// Fetch polymarket value alerts where consensus > threshold
    func fetchPolymarketValues(limit: Int = 5) async throws -> [PolymarketValueWidgetData] {
        // Fetch markets where one side has > 57% consensus (value threshold)
        let urlString = "\(mainURL)/rest/v1/polymarket_markets?or=(current_away_odds.gt.57,current_home_odds.gt.57)&order=last_updated.desc&limit=\(limit)&select=game_key,league,away_team,home_team,market_type,current_away_odds,current_home_odds"

        guard let url = URL(string: urlString) else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(mainKey)", forHTTPHeaderField: "Authorization")
        request.setValue(mainKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }

        let rawMarkets = try JSONDecoder().decode([RawPolymarketMarket].self, from: data)

        return rawMarkets.compactMap { raw in
            // Determine which side has the value
            let awayOdds = Int(raw.current_away_odds)
            let homeOdds = Int(raw.current_home_odds)

            let (side, percentage): (String, Int)
            if awayOdds > homeOdds {
                if raw.market_type == "total" {
                    side = "Over"
                } else {
                    side = raw.away_team
                }
                percentage = awayOdds
            } else {
                if raw.market_type == "total" {
                    side = "Under"
                } else {
                    side = raw.home_team
                }
                percentage = homeOdds
            }

            return PolymarketValueWidgetData(
                gameId: raw.game_key,
                sport: raw.league,
                awayTeam: raw.away_team,
                homeTeam: raw.home_team,
                marketType: raw.market_type,
                side: side,
                percentage: percentage
            )
        }
    }

    // MARK: - Fetch All Data

    /// Fetch all widget data from Supabase
    func fetchAllData() async -> WidgetDataContainer {
        async let picks = try? fetchEditorPicks()
        async let values = try? fetchPolymarketValues()

        // Note: Fade alerts require complex calculation from prediction tables
        // For the fallback, we'll return empty and rely on main app sync
        let fadeAlerts: [FadeAlertWidgetData] = []

        return WidgetDataContainer(
            editorPicks: await picks ?? [],
            fadeAlerts: fadeAlerts,
            polymarketValues: await values ?? [],
            lastUpdated: Date()
        )
    }
}

// MARK: - Raw Response Types

private struct RawEditorPick: Codable {
    let id: String
    let game_id: String
    let game_type: String
    let pick_value: String?
    let best_price: String?
    let sportsbook: String?
    let units: Double?
    let result: String?
    let created_at: String
    let archived_game_data: [String: Any]?

    enum CodingKeys: String, CodingKey {
        case id, game_id, game_type, pick_value, best_price, sportsbook, units, result, created_at, archived_game_data
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        game_id = try container.decode(String.self, forKey: .game_id)
        game_type = try container.decode(String.self, forKey: .game_type)
        pick_value = try container.decodeIfPresent(String.self, forKey: .pick_value)
        best_price = try container.decodeIfPresent(String.self, forKey: .best_price)
        sportsbook = try container.decodeIfPresent(String.self, forKey: .sportsbook)
        units = try container.decodeIfPresent(Double.self, forKey: .units)
        result = try container.decodeIfPresent(String.self, forKey: .result)
        created_at = try container.decode(String.self, forKey: .created_at)

        // Decode archived_game_data as a dictionary
        if let jsonData = try container.decodeIfPresent(Data.self, forKey: .archived_game_data),
           let dict = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
            archived_game_data = dict
        } else if let dict = try container.decodeIfPresent([String: AnyCodable].self, forKey: .archived_game_data) {
            archived_game_data = dict.mapValues { $0.value }
        } else {
            archived_game_data = nil
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(game_id, forKey: .game_id)
        try container.encode(game_type, forKey: .game_type)
        try container.encodeIfPresent(pick_value, forKey: .pick_value)
        try container.encodeIfPresent(best_price, forKey: .best_price)
        try container.encodeIfPresent(sportsbook, forKey: .sportsbook)
        try container.encodeIfPresent(units, forKey: .units)
        try container.encodeIfPresent(result, forKey: .result)
        try container.encode(created_at, forKey: .created_at)
    }
}

private struct RawPolymarketMarket: Codable {
    let game_key: String
    let league: String
    let away_team: String
    let home_team: String
    let market_type: String
    let current_away_odds: Double
    let current_home_odds: Double
}

// MARK: - AnyCodable Helper

private struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let intVal = try? container.decode(Int.self) {
            value = intVal
        } else if let doubleVal = try? container.decode(Double.self) {
            value = doubleVal
        } else if let boolVal = try? container.decode(Bool.self) {
            value = boolVal
        } else if let stringVal = try? container.decode(String.self) {
            value = stringVal
        } else if container.decodeNil() {
            value = NSNull()
        } else {
            value = ""
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        if let intVal = value as? Int {
            try container.encode(intVal)
        } else if let doubleVal = value as? Double {
            try container.encode(doubleVal)
        } else if let boolVal = value as? Bool {
            try container.encode(boolVal)
        } else if let stringVal = value as? String {
            try container.encode(stringVal)
        } else {
            try container.encodeNil()
        }
    }
}
