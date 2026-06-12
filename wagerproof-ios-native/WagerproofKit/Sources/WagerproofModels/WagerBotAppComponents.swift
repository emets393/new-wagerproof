import Foundation

/// V2 chat rich components (wagerbot-agent only). Each component mirrors a real
/// app surface — a game card, a prop row, an agent card, a mini game-detail
/// widget, etc. — and carries a `nav` descriptor so tapping it lands the user on
/// the same screen the rest of the app would open.
///
/// Wire shape (emitted as `wagerbot.app_components`):
/// ```
/// { "summary": "…", "components": [
///     { "id": "c1", "type": "game",
///       "nav": { "kind": "game", "sport": "nba", "game_id": "123" },
///       "fields": { "away_abbr": "LAL", "home_abbr": "BOS", ... },
///       "raw_game": { …original game object… } }
/// ] }
/// ```
/// The legacy `gameCards`/`chatWidgets` path is untouched — this is additive and
/// only the V2 function emits it, so existing chat infra is unaffected.

/// Where tapping a component should take the user. The client maps `kind` onto
/// the app's existing navigation stores (sport game-sheet stores, PropsStore,
/// agent routes, ToolRouter) via the cross-tab handoff pattern.
public struct WagerBotChatNav: Codable, Equatable, Sendable, Hashable {
    /// "game" | "prop" | "agent" | "agent_pick" | "editor_picks" | "tool" | "none"
    public let kind: String
    public let sport: String?
    public let gameId: String?
    public let agentId: String?
    public let propId: String?
    /// ToolRouter category id (e.g. "nbaAccuracy", "mlbRegression").
    public let toolCategory: String?

    enum CodingKeys: String, CodingKey {
        case kind
        case sport
        case gameId = "game_id"
        case agentId = "agent_id"
        case propId = "prop_id"
        case toolCategory = "tool_category"
    }

    public init(
        kind: String,
        sport: String? = nil,
        gameId: String? = nil,
        agentId: String? = nil,
        propId: String? = nil,
        toolCategory: String? = nil
    ) {
        self.kind = kind
        self.sport = sport
        self.gameId = gameId
        self.agentId = agentId
        self.propId = propId
        self.toolCategory = toolCategory
    }
}

/// A single rich chat component. The renderer dispatches on `type`; `fields`
/// carries the per-type display payload (kept as opaque JSON so adding/altering
/// a component's fields never requires a model change). `rawGameJSON` carries the
/// original game object for game-linked components so the tap can open the real
/// sport detail sheet.
public struct WagerBotAppComponent: Codable, Equatable, Sendable, Hashable, Identifiable {
    /// One of: game, prop, agent, agent_pick, editor_pick, value, tool,
    /// model_projection, polymarket, betting_trends, model_accuracy, injury,
    /// weather, public_betting.
    public let type: String
    public let componentId: String
    public let nav: WagerBotChatNav?
    /// Per-type display fields, JSON-encoded. Read via `fieldsDict`.
    public let fieldsJSON: Data?
    /// Original game object (game-linked components), for opening the sport sheet.
    public let rawGameJSON: Data?

    public var id: String { componentId }

    enum CodingKeys: String, CodingKey {
        case type
        case componentId = "id"
        case nav
        case fields
        case rawGame = "raw_game"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.type = try c.decode(String.self, forKey: .type)
        self.componentId = (try? c.decode(String.self, forKey: .componentId)) ?? "c_\(UUID().uuidString)"
        self.nav = try? c.decodeIfPresent(WagerBotChatNav.self, forKey: .nav)
        if c.contains(.fields), let any = try? c.decode(JSONValue.self, forKey: .fields) {
            self.fieldsJSON = try? JSONEncoder().encode(any)
        } else {
            self.fieldsJSON = nil
        }
        if c.contains(.rawGame), let any = try? c.decode(JSONValue.self, forKey: .rawGame) {
            self.rawGameJSON = try? JSONEncoder().encode(any)
        } else {
            self.rawGameJSON = nil
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(type, forKey: .type)
        try c.encode(componentId, forKey: .componentId)
        try c.encodeIfPresent(nav, forKey: .nav)
        if let data = fieldsJSON, let any = try? JSONDecoder().decode(JSONValue.self, from: data) {
            try c.encode(any, forKey: .fields)
        }
        if let data = rawGameJSON, let any = try? JSONDecoder().decode(JSONValue.self, from: data) {
            try c.encode(any, forKey: .rawGame)
        }
    }

    public init(
        type: String,
        componentId: String,
        nav: WagerBotChatNav?,
        fieldsJSON: Data?,
        rawGameJSON: Data?
    ) {
        self.type = type
        self.componentId = componentId
        self.nav = nav
        self.fieldsJSON = fieldsJSON
        self.rawGameJSON = rawGameJSON
    }

    /// Decoded display fields as a plain dictionary for renderers.
    public var fieldsDict: [String: Any] {
        guard let data = fieldsJSON,
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return [:] }
        return obj
    }

    // Typed convenience accessors over `fieldsDict`.
    public func string(_ key: String) -> String? {
        if let s = fieldsDict[key] as? String { return s }
        if let n = fieldsDict[key] as? NSNumber { return n.stringValue }
        return nil
    }
    public func double(_ key: String) -> Double? {
        if let d = fieldsDict[key] as? Double { return d }
        if let n = fieldsDict[key] as? NSNumber { return n.doubleValue }
        if let s = fieldsDict[key] as? String { return Double(s) }
        return nil
    }
    public func int(_ key: String) -> Int? {
        if let i = fieldsDict[key] as? Int { return i }
        if let n = fieldsDict[key] as? NSNumber { return n.intValue }
        if let s = fieldsDict[key] as? String { return Int(s) }
        return nil
    }
    public func bool(_ key: String) -> Bool? {
        if let b = fieldsDict[key] as? Bool { return b }
        if let n = fieldsDict[key] as? NSNumber { return n.boolValue }
        return nil
    }
    public func rows(_ key: String) -> [[String: Any]] {
        (fieldsDict[key] as? [[String: Any]]) ?? []
    }
    public func strings(_ key: String) -> [String] {
        (fieldsDict[key] as? [String]) ?? []
    }
}
