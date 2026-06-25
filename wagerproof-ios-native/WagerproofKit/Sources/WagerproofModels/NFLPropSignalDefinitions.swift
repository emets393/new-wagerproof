import Foundation

/// Static P1–P10 prop-rule definitions (PROPS_BRIEF1). Player props are
/// signal-only — no projection model — so these are the contract's explain layer.
public struct NFLPropSignalDefinition: Identifiable, Hashable, Sendable {
    public let id: String
    public let displayName: String
    public let oneLiner: String
    public let definition: String
    public let whyItWorks: String
    public let betDirection: String
    public let typicalHit: String?
    /// P6 and similar rules that tell the bettor to avoid the market.
    public let isAntiSignal: Bool

    public init(
        id: String,
        displayName: String,
        oneLiner: String,
        definition: String,
        whyItWorks: String,
        betDirection: String,
        typicalHit: String? = nil,
        isAntiSignal: Bool = false
    ) {
        self.id = id
        self.displayName = displayName
        self.oneLiner = oneLiner
        self.definition = definition
        self.whyItWorks = whyItWorks
        self.betDirection = betDirection
        self.typicalHit = typicalHit
        self.isAntiSignal = isAntiSignal
    }
}

public enum NFLPropSignalDefinitions {
    private static let catalog: [String: NFLPropSignalDefinition] = [
        "P1": NFLPropSignalDefinition(
            id: "P1",
            displayName: "Line Above Form",
            oneLiner: "Posted line sits more than 5% above the QB's L5 passing average.",
            definition: "Fires on QB pass-yards when the consensus close is more than 5% above the player's last-five average and they have at least four prior games.",
            whyItWorks: "Books shade QBs off recent hot streaks; when the line is still above form, the Over has historically cleared at a useful clip.",
            betDirection: "OVER",
            typicalHit: "~58%"
        ),
        "P2": NFLPropSignalDefinition(
            id: "P2",
            displayName: "Line Below Form",
            oneLiner: "Pass-yards line is 5–20% below the QB's L5 average.",
            definition: "Fires on QB pass-yards when the close line is between 5% and 20% below the last-five average (not a full blowout discount).",
            whyItWorks: "A modest discount vs recent production often means the market is over-fading a still-productive passer.",
            betDirection: "UNDER",
            typicalHit: "~57%"
        ),
        "P3": NFLPropSignalDefinition(
            id: "P3",
            displayName: "TD Line Inflated",
            oneLiner: "Pass-TD line is at least 40% above L5 form.",
            definition: "Fires on QB pass-touchdown props when the posted line is 40%+ above the player's last-five TD average.",
            whyItWorks: "Extreme TD inflation vs recent scoring tends to mean the Over is the side with edge.",
            betDirection: "OVER",
            typicalHit: "~56%"
        ),
        "P4": NFLPropSignalDefinition(
            id: "P4",
            displayName: "No QB History",
            oneLiner: "Quarterback has zero prior regular-season games this year.",
            definition: "Fires on QB pass-yards or pass-TD markets when `gp_prior` is zero — a first-time or newly promoted starter spot.",
            whyItWorks: "Without a season body of work, books lean optimistic; the Under on pass volume has been the validated side.",
            betDirection: "UNDER",
            typicalHit: "~55%"
        ),
        "P5": NFLPropSignalDefinition(
            id: "P5",
            displayName: "ATD Drift Down",
            oneLiner: "Anytime-TD yes implied probability fell ≥5 pts from open to close.",
            definition: "Fires on anytime-TD when close yes-implied is at least five percentage points below the open.",
            whyItWorks: "Late money fading the TD price often leaves value on Yes at the closing number.",
            betDirection: "YES",
            typicalHit: "~57%"
        ),
        "P6": NFLPropSignalDefinition(
            id: "P6",
            displayName: "ATD Steam Up",
            oneLiner: "Anytime-TD yes implied probability rose ≥5 pts open→close.",
            definition: "Anti-signal on anytime-TD when the yes price steamed up at least five points — a validated do-not-bet spot.",
            whyItWorks: "Chasing a steamed-up TD price has been a consistent loser in the backtest.",
            betDirection: "AVOID",
            typicalHit: nil,
            isAntiSignal: true
        ),
        "P7": NFLPropSignalDefinition(
            id: "P7",
            displayName: "Tough Run Defense",
            oneLiner: "Opponent allows fewer than 80% of league-average rush yards to the position.",
            definition: "Fires on rush-yards from Week 5 onward when the opponent's position matchup index is ≤0.8.",
            whyItWorks: "Elite run defenses vs a posted rush line have tended to land Under more often than the market implies.",
            betDirection: "UNDER",
            typicalHit: "~56%"
        ),
        "P8": NFLPropSignalDefinition(
            id: "P8",
            displayName: "Shop Rush Under",
            oneLiner: "Rush-yards close lines disagree by 3+ points across books.",
            definition: "Fires when the cross-book spread on rush-yards is at least three points — shop the Under at the highest posted line.",
            whyItWorks: "Wide dispersion means the softest number is often still too high; the top-of-market Under has edge.",
            betDirection: "UNDER (highest book)",
            typicalHit: "~55%"
        ),
        "P9": NFLPropSignalDefinition(
            id: "P9",
            displayName: "TD Regression",
            oneLiner: "QB went Under the pass-TD line two straight prop weeks.",
            definition: "Fires on QB pass-TD when the player cleared Under the posted line in each of the prior two prop weeks.",
            whyItWorks: "Back-to-back TD unders often mean the next number is still a touch high — Over has been the bounce side.",
            betDirection: "OVER",
            typicalHit: "~56%"
        ),
        "P10": NFLPropSignalDefinition(
            id: "P10",
            displayName: "Receptions Creep",
            oneLiner: "Receptions line raised two straight prop weeks.",
            definition: "Fires on receptions when the consensus close is higher than each of the prior two weeks' closes for that player.",
            whyItWorks: "Sequential line raises without matching usage tend to stall — the Under has been the validated play.",
            betDirection: "UNDER",
            typicalHit: "~57%"
        ),
    ]

    public static func definition(for flag: String) -> NFLPropSignalDefinition? {
        catalog[flag.uppercased()]
    }

    public static func resolve(_ flags: [String]) -> [NFLPropSignalDefinition] {
        flags.compactMap { definition(for: $0) }
    }
}
