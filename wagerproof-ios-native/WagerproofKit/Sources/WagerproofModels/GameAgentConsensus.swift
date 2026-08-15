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
    /// Internal plumbing — never shown to a user. See `verdict`.
    public let threshold: Int
    /// True when the side clears both the scaled count bar and the agreement bar.
    public let flagged: Bool
    /// The SECOND-most-backed selection in the same market as `side`, verbatim.
    /// Nil when the market was unanimous, or when the RPC predates the runner-up
    /// migration. NOT "the other side": `pick_selection` is unnormalized, so a
    /// market can hold more than two distinct strings.
    public let runnerUpSide: String?
    /// Distinct agents on `runnerUpSide`.
    public let runnerUpAgents: Int?
    /// Where this game ranks on its own date by agreement (1 = strongest),
    /// flagged games first. Nil on pre-migration rows.
    public let slateRank: Int?
    /// Games on that date with at least one agent pick — the rank's denominator.
    public let slateGames: Int?
    /// Up to 4 agents from the winning side, for the overlap stack.
    public let avatars: [ConsensusAvatar]

    public var id: String { gameId }

    /// Agreement as a whole-number percentage.
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
        runnerUpSide: String? = nil,
        runnerUpAgents: Int? = nil,
        slateRank: Int? = nil,
        slateGames: Int? = nil,
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
        self.runnerUpSide = runnerUpSide
        self.runnerUpAgents = runnerUpAgents
        self.slateRank = slateRank
        self.slateGames = slateGames
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
        case runnerUpSide = "runner_up_side"
        case runnerUpAgents = "runner_up_agents"
        case slateRank = "slate_rank"
        case slateGames = "slate_games"
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
        // All four are OPTIONAL, unlike the counts above: they arrived with the
        // runner-up/rank migration, and a client shipped ahead of it must still
        // render the card (minus the second bar segment and the rank line)
        // rather than failing the whole slate fetch.
        runnerUpSide = try c.decodeIfPresent(String.self, forKey: .runnerUpSide)
        runnerUpAgents = try c.decodeIfPresent(Int.self, forKey: .runnerUpAgents)
        slateRank = try c.decodeIfPresent(Int.self, forKey: .slateRank)
        slateGames = try c.decodeIfPresent(Int.self, forKey: .slateGames)
        // Only the avatar stack is optional — it is decoration, and a row that
        // loses its faces should still produce a working count/flag.
        avatars = (try? c.decode([ConsensusAvatar].self, forKey: .avatars)) ?? []
    }
}

// MARK: - Copy

/// What the card actually claims. This is the whole point of the widget: a
/// percentage alone makes the reader do the judging, and most of a slate is
/// noise (see the calibration in `.claude/docs/18_agent_consensus.md`).
public enum ConsensusVerdict: String, Sendable, Hashable {
    /// Clears both server gates — the rare game worth pointing at.
    case consensus
    /// Lopsided enough, but too few agents bet the market to trust it.
    case lean
    /// Most games. The agents disagree.
    case split
    /// Not a sample. Suppresses the percentage entirely.
    case tooFew
}

extension GameAgentConsensus {
    /// Mirrors the RPC's `p_min_share` default. It is duplicated here ONLY to
    /// tell `lean` from `split` — `flagged` itself is always the server's call,
    /// never recomputed. If the SQL default moves, move this with it.
    private static let leanShare = 0.55
    /// Below this a percentage is theatre: 1 of 2 is "50% agreement" and means
    /// nothing.
    private static let minMeaningfulMarket = 3

    public var verdict: ConsensusVerdict {
        if marketAgents < Self.minMeaningfulMarket { return .tooFew }
        if flagged { return .consensus }
        return agreement >= Self.leanShare ? .lean : .split
    }

    /// `nil` when the deployed RPC predates market labelling, which is exactly
    /// when every sentence below has to drop its "betting the spread" clause
    /// rather than say "side" and imply a two-way market that may not exist.
    private var market: String? {
        marketLabel.isEmpty ? nil : marketLabel
    }

    private func agentsWord(_ n: Int) -> String { n == 1 ? "agent" : "agents" }

    /// One sentence, verdict first, answering "what do the agents think?".
    /// Deliberately quotes no threshold: the user is told the conclusion, not
    /// the rule that produced it.
    public var headline: String {
        switch verdict {
        case .consensus:
            return market.map { "Agents are on \(side) — \(sideAgents) of the \(marketAgents) betting the \($0)." }
                ?? "Agents are on \(side) — \(sideAgents) of \(marketAgents) agents."
        case .lean:
            return market.map { "Agents lean \(side), but only \(marketAgents) bet the \($0)." }
                ?? "Agents lean \(side), but only \(marketAgents) agents bet it."
        case .split:
            return market.map { "Agents are split on the \($0) — \(side) leads with \(sideAgents) of \(marketAgents)." }
                ?? "Agents are split — \(side) leads with \(sideAgents) of \(marketAgents) agents."
        case .tooFew:
            let noun = agentsWord(marketAgents)
            return market.map { "Only \(marketAgents) \(noun) bet the \($0) on this game." }
                ?? "Only \(marketAgents) \(noun) bet this game."
        }
    }

    /// The label under the big percentage. Replaces the old bare "agree", which
    /// never said agree with *whom* or over *what* population.
    public var sharePopulationLabel: String {
        market.map { "of \($0) bets" } ?? "of agent bets"
    }

    public var mostBackedLabel: String {
        // Never "side" — a market with alt lines or odds-suffixed selections is
        // not necessarily two-way.
        market.map { "Most-backed \($0)" } ?? "Most backed"
    }

    /// Feed-strip / Outliers-tile line. Carries the denominator, which the old
    /// strip omitted entirely ("39 agents on OVER 7.5" over an invisible base).
    public var leaderLine: String {
        "\(sideAgents) of \(marketAgents) on \(side)"
    }

    /// Agents in this market who took neither the leader nor the runner-up.
    /// Not "the other side" — see `runnerUpSide`.
    public var otherAgents: Int {
        max(0, marketAgents - sideAgents - (runnerUpAgents ?? 0))
    }

    /// Legend beneath the divided bar, one segment per real group.
    public var barLegend: [String] {
        guard marketAgents > 0 else { return [] }
        if sideAgents >= marketAgents { return ["\(sideAgents) \(side)", "unanimous"] }
        var parts = ["\(sideAgents) \(side)"]
        if let r = runnerUpSide, let n = runnerUpAgents, n > 0 { parts.append("\(n) \(r)") }
        if otherAgents > 0 { parts.append("\(otherAgents) other") }
        return parts
    }

    /// "#3 of 14 today" — turns an abstract 51% into a comparison against the
    /// board the user is looking at. Absent on pre-migration rows.
    public var slateRankLabel: String? {
        guard let slateRank, let slateGames, slateGames > 1 else { return nil }
        return "#\(slateRank) of \(slateGames) today"
    }
}
