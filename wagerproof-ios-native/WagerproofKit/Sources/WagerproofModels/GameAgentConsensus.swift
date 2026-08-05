import Foundation

/// One agent shown in the consensus overlap stack. Drawn from the agents on the
/// WINNING side only, so the faces match the claim the strip makes.
public struct ConsensusAvatar: Decodable, Sendable, Hashable, Identifiable {
    public let avatarId: String
    public let name: String
    /// Owner-picked pixel character, straight off `avatar_profiles.sprite_index`
    /// — RAW and usually NULL (96% of public agents have never set one).
    /// Resolve through `spriteIndex`, never read this directly.
    public let spriteIndexOverride: Int?
    /// Either a hex string ("#6366f1") or a gradient pair
    /// ("gradient:#6366f1,#ec4899") — same encoding as `avatar_profiles.avatar_color`.
    /// Halo/background tint behind the sprite only.
    public let color: String?

    public var id: String { avatarId }

    /// Pixel-person character (0…7), resolved exactly like `Agent.spriteIndex`:
    /// the owner's override when set, else FNV-1a of the agent id. Coalescing a
    /// null override to 0 instead would draw nearly every stack as four
    /// identical characters AND disagree with the same agent's face on its card,
    /// the leaderboard, and the office. Agent avatars are never emoji.
    public var spriteIndex: Int {
        if let idx = spriteIndexOverride, (0...7).contains(idx) { return idx }
        return AgentSpriteIndex.forSeed(avatarId)
    }

    // The RPC builds these objects with jsonb_build_object using camelCase keys,
    // so no snake_case remapping here (unlike the row fields below).
    public init(avatarId: String, name: String, spriteIndexOverride: Int?, color: String?) {
        self.avatarId = avatarId
        self.name = name
        self.spriteIndexOverride = spriteIndexOverride
        self.color = color
    }

    enum CodingKeys: String, CodingKey {
        case avatarId, name, color
        case spriteIndexOverride = "spriteIndex"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // Strict: a blank avatarId would seed the sprite hash with "" and draw
        // every face as the same character. The caller decodes the whole
        // `avatars` array with `try?`, so a bad face drops the stack, not the
        // counts.
        avatarId = try c.decode(String.self, forKey: .avatarId)
        name = try c.decode(String.self, forKey: .name)
        spriteIndexOverride = (try? c.decodeIfPresent(Int.self, forKey: .spriteIndexOverride)) ?? nil
        color = (try? c.decodeIfPresent(String.self, forKey: .color)) ?? nil
    }
}

/// Public-agent betting consensus for a single game on a slate: how many
/// public+active agents bet it, which side they most agree on, and whether that
/// agreement is strong enough to earn the green BET flag.
///
/// Rows come from the `get_game_agent_consensus` RPC on **MAIN** Supabase.
/// See `.claude/docs/18_agent_consensus.md` for the calibration behind `flagged`.
public struct GameAgentConsensus: Decodable, Sendable, Hashable, Identifiable {
    public let gameId: String
    public let gameDate: String
    /// Distinct public+active agents with a pick on this game, across every market.
    public let agents: Int
    /// The single most-backed selection, verbatim (e.g. "Over 7.5").
    public let side: String
    /// Distinct agents on that side.
    public let sideAgents: Int
    /// Distinct agents who bet the same market as `side` (bet type × period).
    /// This is the agreement denominator; `agents` spans the whole game.
    public let marketAgents: Int
    /// Human-readable market for `side` (e.g. "F5 run line").
    public let marketLabel: String
    /// `sideAgents` over the agents who bet the SAME market (bet_type × period),
    /// 0–1 — not over `agents`, which pools every market on the game and so
    /// makes a plurality read as disagreement.
    public let agreement: Double
    /// Agents-on-one-side needed to flag today; scales with the slate's volume.
    public let threshold: Int
    /// True when the side clears both the scaled count bar and the agreement bar.
    public let flagged: Bool
    /// Up to 4 agents from the winning side, for the overlap stack.
    public let avatars: [ConsensusAvatar]

    public var id: String { gameId }

    /// Agreement as a whole-number percentage, for the "100% agree" label.
    public var agreementPercent: Int { Int((agreement * 100).rounded()) }

    public init(
        gameId: String,
        gameDate: String,
        agents: Int,
        side: String,
        sideAgents: Int,
        marketAgents: Int? = nil,
        marketLabel: String = "",
        agreement: Double,
        threshold: Int,
        flagged: Bool,
        avatars: [ConsensusAvatar]
    ) {
        self.gameId = gameId
        self.gameDate = gameDate
        self.agents = agents
        self.side = side
        self.sideAgents = sideAgents
        self.marketAgents = marketAgents ?? agents
        self.marketLabel = marketLabel
        self.agreement = agreement
        self.threshold = threshold
        self.flagged = flagged
        self.avatars = avatars
    }

    enum CodingKeys: String, CodingKey {
        case gameId = "game_id"
        case gameDate = "game_date"
        case agents
        case side
        case sideAgents = "side_agents"
        case marketAgents = "market_agents"
        case marketLabel = "market_label"
        case agreement
        case threshold
        case flagged
        case avatars
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // These decode STRICTLY on purpose. Swallowing them with `try?` made a
        // renamed RPC column indistinguishable from "no agents bet this game":
        // every row silently became agents=0 and the feature vanished app-wide
        // with zero logging. A throw here fails the fetch instead, which
        // `AgentConsensusService` prints and does NOT cache, so breakage is
        // visible and self-retrying.
        gameId = try c.decode(String.self, forKey: .gameId)
        gameDate = try c.decode(String.self, forKey: .gameDate)
        agents = try c.decode(Int.self, forKey: .agents)
        side = try c.decode(String.self, forKey: .side)
        sideAgents = try c.decode(Int.self, forKey: .sideAgents)
        // Keep clients deployed ahead of the market-scoped RPC migration able
        // to decode legacy rows. Falling back to the whole-game population
        // reproduces the old display rather than yielding a zero-width bar.
        marketAgents = try c.decodeIfPresent(Int.self, forKey: .marketAgents) ?? agents
        marketLabel = try c.decodeIfPresent(String.self, forKey: .marketLabel) ?? ""
        // `agreement` is a Postgres numeric. PostgREST normally serializes it as
        // a bare JSON number, but numerics can also arrive quoted depending on
        // the connection's extended-types setting — accept both rather than
        // failing the whole row over a formatting detail. Neither form present
        // is still an error.
        if let d = try? c.decode(Double.self, forKey: .agreement) {
            agreement = d
        } else {
            let s = try c.decode(String.self, forKey: .agreement)
            guard let parsed = Double(s) else {
                throw DecodingError.dataCorruptedError(
                    forKey: .agreement, in: c,
                    debugDescription: "agreement is neither a number nor a numeric string: \(s)"
                )
            }
            agreement = parsed
        }
        threshold = try c.decode(Int.self, forKey: .threshold)
        flagged = try c.decode(Bool.self, forKey: .flagged)
        // Only the avatar stack is optional — it is decoration, and a row that
        // loses its faces should still produce a working count/flag.
        avatars = (try? c.decode([ConsensusAvatar].self, forKey: .avatars)) ?? []
    }
}
