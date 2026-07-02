import Foundation

/// Sport tag on a parlay TICKET (`avatar_parlays.sport`). Deliberately a
/// separate enum from `AgentSport`: tickets can be `'multi'` (cross-sport),
/// but `AgentSport` is exhaustively switched across the creation wizard,
/// settings, and leaderboard where "multi" is never a selectable sport.
/// Individual legs always carry a concrete `AgentSport`.
public enum AgentParlaySport: String, Codable, CaseIterable, Sendable, Hashable {
    case nfl
    case cfb
    case nba
    case ncaab
    case mlb
    case multi

    public var label: String {
        switch self {
        case .nfl: return "NFL"
        case .cfb: return "CFB"
        case .nba: return "NBA"
        case .ncaab: return "NCAAB"
        case .mlb: return "MLB"
        case .multi: return "Multi"
        }
    }

    public var sfSymbol: String {
        switch self {
        case .multi: return "link"
        default: return asAgentSport?.sfSymbol ?? "link"
        }
    }

    /// The concrete sport when the ticket is single-sport; nil for `'multi'`.
    /// Used by sport filters that only understand `AgentSport`.
    public var asAgentSport: AgentSport? {
        AgentSport(rawValue: rawValue)
    }
}

/// Mirror of an `avatar_parlay_legs` row — one leg of a parlay ticket. Legs
/// are graded individually with the same result vocabulary as straight picks
/// (`AgentPick.PickResultStatus`); the ticket's roll-up lives on `AgentParlay`.
public struct AgentParlayLeg: Codable, Identifiable, Sendable, Hashable {
    public let id: String
    public let parlayId: String
    public let gameId: String
    public let sport: AgentSport
    public let matchup: String
    public let gameDate: String
    public let betType: String
    public let period: String
    public let pickSelection: String
    public let odds: String?
    public let propPlayer: String?
    public let propMarket: String?
    public let propLine: Double?
    public let propDirection: String?
    public let legResult: AgentPick.PickResultStatus
    public let gradedAt: String?
    public let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case parlayId = "parlay_id"
        case gameId = "game_id"
        case sport
        case matchup
        case gameDate = "game_date"
        case betType = "bet_type"
        case period
        case pickSelection = "pick_selection"
        case odds
        case propPlayer = "prop_player"
        case propMarket = "prop_market"
        case propLine = "prop_line"
        case propDirection = "prop_direction"
        case legResult = "leg_result"
        case gradedAt = "graded_at"
        case createdAt = "created_at"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decode(String.self, forKey: .id)
        self.parlayId = (try? c.decode(String.self, forKey: .parlayId)) ?? ""
        self.gameId = (try? c.decode(String.self, forKey: .gameId)) ?? ""
        self.sport = (try? c.decode(AgentSport.self, forKey: .sport)) ?? .nfl
        self.matchup = (try? c.decode(String.self, forKey: .matchup)) ?? ""
        self.gameDate = (try? c.decode(String.self, forKey: .gameDate)) ?? ""
        self.betType = (try? c.decode(String.self, forKey: .betType)) ?? ""
        self.period = (try? c.decode(String.self, forKey: .period)) ?? "full"
        self.pickSelection = (try? c.decode(String.self, forKey: .pickSelection)) ?? ""
        self.odds = try? c.decodeIfPresent(String.self, forKey: .odds)
        self.propPlayer = try? c.decodeIfPresent(String.self, forKey: .propPlayer)
        self.propMarket = try? c.decodeIfPresent(String.self, forKey: .propMarket)
        if let d = try? c.decode(Double.self, forKey: .propLine) {
            self.propLine = d
        } else if let s = try? c.decode(String.self, forKey: .propLine), let d = Double(s) {
            self.propLine = d
        } else {
            self.propLine = nil
        }
        self.propDirection = try? c.decodeIfPresent(String.self, forKey: .propDirection)
        self.legResult = (try? c.decode(AgentPick.PickResultStatus.self, forKey: .legResult)) ?? .pending
        self.gradedAt = try? c.decodeIfPresent(String.self, forKey: .gradedAt)
        self.createdAt = (try? c.decode(String.self, forKey: .createdAt)) ?? ""
    }

    public init(
        id: String,
        parlayId: String,
        gameId: String,
        sport: AgentSport,
        matchup: String,
        gameDate: String,
        betType: String,
        period: String = "full",
        pickSelection: String,
        odds: String?,
        propPlayer: String? = nil,
        propMarket: String? = nil,
        propLine: Double? = nil,
        propDirection: String? = nil,
        legResult: AgentPick.PickResultStatus,
        gradedAt: String? = nil,
        createdAt: String
    ) {
        self.id = id
        self.parlayId = parlayId
        self.gameId = gameId
        self.sport = sport
        self.matchup = matchup
        self.gameDate = gameDate
        self.betType = betType
        self.period = period
        self.pickSelection = pickSelection
        self.odds = odds
        self.propPlayer = propPlayer
        self.propMarket = propMarket
        self.propLine = propLine
        self.propDirection = propDirection
        self.legResult = legResult
        self.gradedAt = gradedAt
        self.createdAt = createdAt
    }
}

/// Mirror of an `avatar_parlays` row — one staked multi-leg ticket. Legs come
/// embedded under a `legs` key: direct client reads alias the PostgREST embed
/// (`legs:avatar_parlay_legs(*)`) and the v3 read RPCs jsonb_set the same key,
/// so both paths decode identically.
public struct AgentParlay: Codable, Identifiable, Sendable, Hashable {
    public let id: String
    public let avatarId: String
    public let sport: AgentParlaySport
    public let legsCount: Int
    public let combinedOdds: String?
    public let units: Double
    public let confidence: Int
    public let reasoningText: String
    public let keyFactors: [String]?
    public let aiDecisionTrace: JSONValue?
    public let aiAuditPayload: JSONValue?
    public let archivedPersonality: AgentPersonalityParams?
    public let result: AgentPick.PickResultStatus
    public let actualResult: String?
    public let gradedAt: String?
    public let targetDate: String
    public let isAutoGenerated: Bool
    public let createdAt: String
    public let legs: [AgentParlayLeg]

    enum CodingKeys: String, CodingKey {
        case id
        case avatarId = "avatar_id"
        case sport
        case legsCount = "legs_count"
        case combinedOdds = "combined_odds"
        case units
        case confidence
        case reasoningText = "reasoning_text"
        case keyFactors = "key_factors"
        case aiDecisionTrace = "ai_decision_trace"
        case aiAuditPayload = "ai_audit_payload"
        case archivedPersonality = "archived_personality"
        case result
        case actualResult = "actual_result"
        case gradedAt = "graded_at"
        case targetDate = "target_date"
        case isAutoGenerated = "is_auto_generated"
        case createdAt = "created_at"
        case legs
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decode(String.self, forKey: .id)
        self.avatarId = try c.decode(String.self, forKey: .avatarId)
        self.sport = (try? c.decode(AgentParlaySport.self, forKey: .sport)) ?? .multi
        self.legsCount = (try? c.decode(Int.self, forKey: .legsCount)) ?? 0
        self.combinedOdds = try? c.decodeIfPresent(String.self, forKey: .combinedOdds)
        if let d = try? c.decode(Double.self, forKey: .units) {
            self.units = d
        } else if let s = try? c.decode(String.self, forKey: .units), let d = Double(s) {
            self.units = d
        } else {
            self.units = 1.0
        }
        self.confidence = (try? c.decode(Int.self, forKey: .confidence)) ?? 3
        self.reasoningText = (try? c.decode(String.self, forKey: .reasoningText)) ?? ""
        self.keyFactors = try? c.decodeIfPresent([String].self, forKey: .keyFactors)
        self.aiDecisionTrace = try? c.decodeIfPresent(JSONValue.self, forKey: .aiDecisionTrace)
        self.aiAuditPayload = try? c.decodeIfPresent(JSONValue.self, forKey: .aiAuditPayload)
        self.archivedPersonality = try? c.decodeIfPresent(AgentPersonalityParams.self, forKey: .archivedPersonality)
        self.result = (try? c.decode(AgentPick.PickResultStatus.self, forKey: .result)) ?? .pending
        self.actualResult = try? c.decodeIfPresent(String.self, forKey: .actualResult)
        self.gradedAt = try? c.decodeIfPresent(String.self, forKey: .gradedAt)
        self.targetDate = (try? c.decode(String.self, forKey: .targetDate)) ?? ""
        self.isAutoGenerated = (try? c.decode(Bool.self, forKey: .isAutoGenerated)) ?? false
        self.createdAt = (try? c.decode(String.self, forKey: .createdAt)) ?? ""
        // Lossy nested decode — one malformed leg drops out instead of
        // blanking the ticket (parity with AgentPick.decodeLossyArray).
        if var nested = try? c.nestedUnkeyedContainer(forKey: .legs) {
            var legs: [AgentParlayLeg] = []
            while !nested.isAtEnd {
                if let leg = try? nested.decode(AgentParlayLeg.self) {
                    legs.append(leg)
                } else {
                    _ = try? nested.decode(JSONValue.self)
                }
            }
            self.legs = legs
        } else {
            self.legs = []
        }
    }

    public init(
        id: String,
        avatarId: String,
        sport: AgentParlaySport,
        legsCount: Int,
        combinedOdds: String?,
        units: Double,
        confidence: Int,
        reasoningText: String,
        keyFactors: [String]? = nil,
        aiDecisionTrace: JSONValue? = nil,
        aiAuditPayload: JSONValue? = nil,
        archivedPersonality: AgentPersonalityParams? = nil,
        result: AgentPick.PickResultStatus,
        actualResult: String? = nil,
        gradedAt: String? = nil,
        targetDate: String,
        isAutoGenerated: Bool = false,
        createdAt: String,
        legs: [AgentParlayLeg]
    ) {
        self.id = id
        self.avatarId = avatarId
        self.sport = sport
        self.legsCount = legsCount
        self.combinedOdds = combinedOdds
        self.units = units
        self.confidence = confidence
        self.reasoningText = reasoningText
        self.keyFactors = keyFactors
        self.aiDecisionTrace = aiDecisionTrace
        self.aiAuditPayload = aiAuditPayload
        self.archivedPersonality = archivedPersonality
        self.result = result
        self.actualResult = actualResult
        self.gradedAt = gradedAt
        self.targetDate = targetDate
        self.isAutoGenerated = isAutoGenerated
        self.createdAt = createdAt
        self.legs = legs
    }
}

public extension AgentParlay {
    /// Legs count with a fallback to the embedded array (older rows or
    /// partially-decoded payloads may miss the column).
    var displayLegsCount: Int { max(legsCount, legs.count) }

    /// The settled decimal odds the grader stashed in `ai_audit_payload` at
    /// finalize time (drop-and-reprice: a pushed leg falls out and the ticket
    /// re-prices on the surviving won legs, so this may differ from
    /// `combined_odds`). Nil until graded or when the payload is absent.
    var settledDecimalOdds: Double? {
        guard let v = aiAuditPayload?["settled_decimal"] else { return nil }
        switch v {
        case .double(let d): return d
        case .int(let i): return Double(i)
        default: return nil
        }
    }

    /// The ticket's earliest leg date — used when `target_date` is missing.
    var earliestLegDate: String? {
        legs.map(\.gameDate).filter { !$0.isEmpty }.min()
    }

    /// Date used for "today / history" bucketing, mirroring `AgentPick.gameDate`.
    var displayDate: String {
        if !targetDate.isEmpty { return targetDate }
        return earliestLegDate ?? ""
    }

    static func decodeLossyArray(from data: Data) -> [AgentParlay] {
        guard let raw = try? JSONSerialization.jsonObject(with: data) else { return [] }
        guard let rows = raw as? [Any] else { return [] }
        let decoder = JSONDecoder()
        return rows.compactMap { element in
            guard let elementData = try? JSONSerialization.data(withJSONObject: element) else { return nil }
            return try? decoder.decode(AgentParlay.self, from: elementData)
        }
    }

    static func decodeLossyArray<K: CodingKey>(
        from container: KeyedDecodingContainer<K>,
        forKey key: K
    ) -> [AgentParlay] {
        guard var nested = try? container.nestedUnkeyedContainer(forKey: key) else { return [] }
        var parlays: [AgentParlay] = []
        while !nested.isAtEnd {
            if let parlay = try? nested.decode(AgentParlay.self) {
                parlays.append(parlay)
            } else {
                _ = try? nested.decode(JSONValue.self)
            }
        }
        return parlays
    }
}
