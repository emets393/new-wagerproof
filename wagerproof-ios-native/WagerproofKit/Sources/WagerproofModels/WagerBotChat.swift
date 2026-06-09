import Foundation

/// WagerBot chat domain model. ContentBlock-based message shape — mirrors
/// RN `wagerproof-mobile/types/chatTypes.ts` byte-for-byte so the edge
/// function contract is unchanged.
///
/// The edge function streams two flavors of SSE event:
///   1. Raw OpenAI deltas (parsed as `.contentDelta`)
///   2. Custom `wagerbot.*` events (tool_start / tool_end / thread / etc.)
///
/// The view consumes a typed stream of `WagerBotStreamEvent` values; the
/// `WagerBotChatStore` translates each event into block mutations on the
/// current assistant message.

// MARK: - Tool status (running / done)

public enum WagerBotToolStatus: Equatable, Sendable, Hashable {
    case running
    case done(ms: Int, ok: Bool, summary: String)
}

// MARK: - Inline chat widgets / game cards (server-side payloads)

/// Inline chat game card (`wagerbot.game_cards` block). The full game
/// object lives under `rawGame` so the parent can hand it to the
/// sport-specific game sheet on tap. We keep the raw JSON as an
/// `AnyCodable`-style dictionary because every sport has a different
/// shape and the iOS sport sheets read the raw RN game shape directly.
public struct WagerBotChatGameCard: Codable, Equatable, Sendable, Hashable {
    public let sport: String
    public let gameId: String
    public let awayTeam: String
    public let homeTeam: String
    public let awayAbbr: String
    public let homeAbbr: String
    public let gameDate: String
    public let gameTime: String
    public let homeSpread: Double?
    public let awaySpread: Double?
    public let homeMl: Int?
    public let awayMl: Int?
    public let overUnder: Double?
    public let spreadPick: String?
    public let spreadConfidence: Double?
    public let spreadEdge: Double?
    public let ouPick: String?
    public let ouEdge: Double?
    public let mlPickTeam: String?
    public let mlProb: Double?
    public let analysis: String?
    /// Opaque JSON envelope for the original game object. Retained as
    /// `Data` so the iOS sport sheets can re-decode into their own model
    /// without us pulling all five game schemas into Models.
    public let rawGameJSON: Data?

    enum CodingKeys: String, CodingKey {
        case sport
        case gameId = "game_id"
        case awayTeam = "away_team"
        case homeTeam = "home_team"
        case awayAbbr = "away_abbr"
        case homeAbbr = "home_abbr"
        case gameDate = "game_date"
        case gameTime = "game_time"
        case homeSpread = "home_spread"
        case awaySpread = "away_spread"
        case homeMl = "home_ml"
        case awayMl = "away_ml"
        case overUnder = "over_under"
        case spreadPick = "spread_pick"
        case spreadConfidence = "spread_confidence"
        case spreadEdge = "spread_edge"
        case ouPick = "ou_pick"
        case ouEdge = "ou_edge"
        case mlPickTeam = "ml_pick_team"
        case mlProb = "ml_prob"
        case analysis
        case rawGame = "raw_game"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.sport = try c.decode(String.self, forKey: .sport)
        self.gameId = try c.decode(String.self, forKey: .gameId)
        self.awayTeam = try c.decode(String.self, forKey: .awayTeam)
        self.homeTeam = try c.decode(String.self, forKey: .homeTeam)
        self.awayAbbr = try c.decode(String.self, forKey: .awayAbbr)
        self.homeAbbr = try c.decode(String.self, forKey: .homeAbbr)
        self.gameDate = try c.decode(String.self, forKey: .gameDate)
        self.gameTime = try c.decode(String.self, forKey: .gameTime)
        self.homeSpread = try c.decodeIfPresent(Double.self, forKey: .homeSpread)
        self.awaySpread = try c.decodeIfPresent(Double.self, forKey: .awaySpread)
        self.homeMl = try c.decodeIfPresent(Int.self, forKey: .homeMl)
        self.awayMl = try c.decodeIfPresent(Int.self, forKey: .awayMl)
        self.overUnder = try c.decodeIfPresent(Double.self, forKey: .overUnder)
        self.spreadPick = try c.decodeIfPresent(String.self, forKey: .spreadPick)
        self.spreadConfidence = try c.decodeIfPresent(Double.self, forKey: .spreadConfidence)
        self.spreadEdge = try c.decodeIfPresent(Double.self, forKey: .spreadEdge)
        self.ouPick = try c.decodeIfPresent(String.self, forKey: .ouPick)
        self.ouEdge = try c.decodeIfPresent(Double.self, forKey: .ouEdge)
        self.mlPickTeam = try c.decodeIfPresent(String.self, forKey: .mlPickTeam)
        self.mlProb = try c.decodeIfPresent(Double.self, forKey: .mlProb)
        self.analysis = try c.decodeIfPresent(String.self, forKey: .analysis)
        // Re-encode the raw game subtree so we can hand it back out as
        // JSON to the sport sheet stores without depending on every
        // sport's Codable here.
        if c.contains(.rawGame) {
            if let any = try? c.decode(JSONValue.self, forKey: .rawGame) {
                self.rawGameJSON = try? JSONEncoder().encode(any)
            } else {
                self.rawGameJSON = nil
            }
        } else {
            self.rawGameJSON = nil
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(sport, forKey: .sport)
        try c.encode(gameId, forKey: .gameId)
        try c.encode(awayTeam, forKey: .awayTeam)
        try c.encode(homeTeam, forKey: .homeTeam)
        try c.encode(awayAbbr, forKey: .awayAbbr)
        try c.encode(homeAbbr, forKey: .homeAbbr)
        try c.encode(gameDate, forKey: .gameDate)
        try c.encode(gameTime, forKey: .gameTime)
        try c.encodeIfPresent(homeSpread, forKey: .homeSpread)
        try c.encodeIfPresent(awaySpread, forKey: .awaySpread)
        try c.encodeIfPresent(homeMl, forKey: .homeMl)
        try c.encodeIfPresent(awayMl, forKey: .awayMl)
        try c.encodeIfPresent(overUnder, forKey: .overUnder)
        try c.encodeIfPresent(spreadPick, forKey: .spreadPick)
        try c.encodeIfPresent(spreadConfidence, forKey: .spreadConfidence)
        try c.encodeIfPresent(spreadEdge, forKey: .spreadEdge)
        try c.encodeIfPresent(ouPick, forKey: .ouPick)
        try c.encodeIfPresent(ouEdge, forKey: .ouEdge)
        try c.encodeIfPresent(mlPickTeam, forKey: .mlPickTeam)
        try c.encodeIfPresent(mlProb, forKey: .mlProb)
        try c.encodeIfPresent(analysis, forKey: .analysis)
        if let data = rawGameJSON,
           let any = try? JSONDecoder().decode(JSONValue.self, from: data) {
            try c.encode(any, forKey: .rawGame)
        }
    }
}

/// Inline chat widget block (`wagerbot.chat_widgets`). Each widget is one
/// of seven kinds (matchup, model_projection, polymarket, public_betting,
/// injuries, betting_trends, weather). The payload is sport- and
/// widget-specific; we preserve the JSON subtree under `dataJSON` for
/// downstream renderers.
public struct WagerBotChatWidget: Codable, Equatable, Sendable, Hashable {
    public let widgetType: String
    public let sport: String
    public let gameId: String
    public let title: String?
    public let analysis: String?
    public let dataJSON: Data?
    public let rawGameJSON: Data?

    enum CodingKeys: String, CodingKey {
        case widgetType = "widget_type"
        case sport
        case gameId = "game_id"
        case title
        case analysis
        case data
        case rawGame = "raw_game"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.widgetType = try c.decode(String.self, forKey: .widgetType)
        self.sport = try c.decode(String.self, forKey: .sport)
        self.gameId = try c.decode(String.self, forKey: .gameId)
        self.title = try c.decodeIfPresent(String.self, forKey: .title)
        self.analysis = try c.decodeIfPresent(String.self, forKey: .analysis)
        if c.contains(.data), let any = try? c.decode(JSONValue.self, forKey: .data) {
            self.dataJSON = try? JSONEncoder().encode(any)
        } else {
            self.dataJSON = nil
        }
        if c.contains(.rawGame), let any = try? c.decode(JSONValue.self, forKey: .rawGame) {
            self.rawGameJSON = try? JSONEncoder().encode(any)
        } else {
            self.rawGameJSON = nil
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(widgetType, forKey: .widgetType)
        try c.encode(sport, forKey: .sport)
        try c.encode(gameId, forKey: .gameId)
        try c.encodeIfPresent(title, forKey: .title)
        try c.encodeIfPresent(analysis, forKey: .analysis)
        if let data = dataJSON,
           let any = try? JSONDecoder().decode(JSONValue.self, from: data) {
            try c.encode(any, forKey: .data)
        }
        if let data = rawGameJSON,
           let any = try? JSONDecoder().decode(JSONValue.self, from: data) {
            try c.encode(any, forKey: .rawGame)
        }
    }
}

// MARK: - ContentBlock

/// Block-based message body. Mirrors RN `ContentBlock` (chatTypes.ts) — the
/// shapes here MUST match the persisted JSON in `chat_messages.blocks` and
/// the SSE event payloads from the wagerbot-chat edge function.
public enum WagerBotContentBlock: Equatable, Sendable, Hashable, Identifiable {
    case text(id: String, text: String)
    case thinking(id: String, text: String)
    case toolUse(id: String, name: String, argumentsJSON: String, status: WagerBotToolStatus)
    case followUps(id: String, questions: [String])
    case gameCards(id: String, cards: [WagerBotChatGameCard])
    case chatWidgets(id: String, widgets: [WagerBotChatWidget])
    /// V2 chat ONLY (wagerbot-agent): rich, tappable components that mirror the
    /// app's real list items / widgets. Emitted as `wagerbot.app_components`.
    /// The legacy `gameCards`/`chatWidgets` path is left untouched for V1.
    case appComponents(id: String, summary: String?, components: [WagerBotAppComponent])

    public var id: String {
        switch self {
        case .text(let id, _),
             .thinking(let id, _),
             .toolUse(let id, _, _, _),
             .followUps(let id, _),
             .gameCards(let id, _),
             .chatWidgets(let id, _),
             .appComponents(let id, _, _):
            return id
        }
    }
}

// MARK: - WagerBotMessage

public struct WagerBotMessage: Identifiable, Equatable, Sendable, Hashable {
    public enum Role: String, Sendable, Hashable {
        case user
        case assistant
    }

    public let id: String
    public let role: Role
    public var blocks: [WagerBotContentBlock]
    public let timestamp: String

    public init(id: String, role: Role, blocks: [WagerBotContentBlock], timestamp: String) {
        self.id = id
        self.role = role
        self.blocks = blocks
        self.timestamp = timestamp
    }

    public static func user(_ text: String, timestamp: String = WagerBotMessage.nowISO()) -> WagerBotMessage {
        WagerBotMessage(
            id: "user_\(UUID().uuidString)",
            role: .user,
            blocks: [.text(id: "u_\(UUID().uuidString)", text: text)],
            timestamp: timestamp
        )
    }

    public static func assistantPlaceholder(timestamp: String = WagerBotMessage.nowISO()) -> WagerBotMessage {
        WagerBotMessage(
            id: "assistant_\(UUID().uuidString)",
            role: .assistant,
            blocks: [],
            timestamp: timestamp
        )
    }

    public static func nowISO() -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: Date())
    }
}

// MARK: - Thread summary (history list)

public struct WagerBotThreadSummary: Identifiable, Codable, Equatable, Sendable, Hashable {
    public let id: String
    public let title: String?
    public let createdAt: String
    public let updatedAt: String?
    public let messageCount: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case messageCount = "message_count"
    }

    public init(id: String, title: String?, createdAt: String, updatedAt: String?, messageCount: Int?) {
        self.id = id
        self.title = title
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.messageCount = messageCount
    }
}

// MARK: - SSE event stream

/// Typed event emitted by the SSE parser. The store applies each event to
/// the in-flight assistant message. Names mirror the RN `WagerBotSSEEvent`
/// union members.
public enum WagerBotStreamEvent: Sendable {
    case thread(id: String, created: Bool)
    case contentDelta(text: String)
    case thinkingDelta(text: String)
    case thinkingDone(summary: String)
    case toolStart(id: String, name: String, argumentsJSON: String)
    case toolEnd(id: String, name: String, ms: Int, ok: Bool, summary: String)
    case gameCards(cards: [WagerBotChatGameCard])
    case chatWidgets(widgets: [WagerBotChatWidget])
    case appComponents(summary: String?, components: [WagerBotAppComponent])
    case followUps(questions: [String])
    case threadTitled(id: String, title: String)
    case messagePersisted(role: String)
    case error(code: String, message: String)
    case done
}

// MARK: - JSONValue (private helper)

/// Tiny JSON sum type for round-tripping arbitrary subtrees through
/// Codable without dragging in a runtime library. Used for rawGame
/// envelopes on game cards / widgets.
enum JSONValue: Codable, Equatable, Sendable, Hashable {
    case null
    case bool(Bool)
    case int(Int)
    case double(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null; return }
        if let v = try? c.decode(Bool.self) { self = .bool(v); return }
        if let v = try? c.decode(Int.self) { self = .int(v); return }
        if let v = try? c.decode(Double.self) { self = .double(v); return }
        if let v = try? c.decode(String.self) { self = .string(v); return }
        if let v = try? c.decode([JSONValue].self) { self = .array(v); return }
        if let v = try? c.decode([String: JSONValue].self) { self = .object(v); return }
        throw DecodingError.dataCorruptedError(in: c, debugDescription: "Unsupported JSON value")
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let v): try c.encode(v)
        case .int(let v): try c.encode(v)
        case .double(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        }
    }
}

// MARK: - Tool catalog metadata

/// Display names + SF Symbol icons for each WagerBot tool. Used by the
/// chip and the consolidated tool pill. Falls back to a title-cased
/// version of the raw tool name + a wrench symbol so new server-side
/// tools render reasonably without an iOS update.
public enum WagerBotToolCatalog {
    public static func label(for toolName: String) -> String {
        switch toolName {
        case "get_nba_predictions":   return "NBA Predictions"
        case "get_nfl_predictions":   return "NFL Predictions"
        case "get_cfb_predictions":   return "CFB Predictions"
        case "get_ncaab_predictions": return "NCAAB Predictions"
        case "get_mlb_predictions":   return "MLB Predictions"
        case "get_polymarket_odds":   return "Polymarket Odds"
        case "get_game_detail":       return "Game Detail"
        case "search_games":          return "Searching Games"
        case "get_editor_picks":      return "Editor Picks"
        case "suggest_follow_ups":    return "Follow-ups"
        case "present_analysis":      return "Analysis"
        case "web_search":            return "Searching the web"
        case "google_search":         return "Searching the web"
        default:
            return toolName
                .replacingOccurrences(of: "_", with: " ")
                .capitalized
        }
    }

    public static func icon(for toolName: String) -> String {
        switch toolName {
        case "get_nba_predictions",
             "get_ncaab_predictions":   return "basketball.fill"
        case "get_nfl_predictions",
             "get_cfb_predictions":     return "football.fill"
        case "get_mlb_predictions":     return "baseball.fill"
        case "get_polymarket_odds":     return "chart.line.uptrend.xyaxis"
        case "get_game_detail":         return "doc.text.magnifyingglass"
        case "search_games":            return "magnifyingglass"
        case "get_editor_picks":        return "star.fill"
        case "suggest_follow_ups":      return "questionmark.bubble.fill"
        case "present_analysis":        return "chart.bar.doc.horizontal.fill"
        case "web_search", "google_search":
            return "globe"
        default:                        return "wrench.and.screwdriver.fill"
        }
    }
}
