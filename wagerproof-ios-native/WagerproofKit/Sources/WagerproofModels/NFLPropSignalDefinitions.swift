import Foundation

/// Static P1–P10 and P12–P18 prop-rule definitions (PROPS_BRIEF1). Player props are
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
        "P12": NFLPropSignalDefinition(
            id: "P12",
            displayName: "Featured Receiver Yds Over",
            oneLiner: "High-usage receiver whose posted line lags his recent form.",
            definition: "Fires on receiving-yards when the player is a top-quintile NGS separator and the posted line sits below his own recent production.",
            whyItWorks: "Books under-price usage for featured receivers when the line hasn't caught up to separation-driven volume.",
            betDirection: "Receiving yards Over",
            typicalHit: "70.6% / +32% ROI (2 seasons)"
        ),
        "P13": NFLPropSignalDefinition(
            id: "P13",
            displayName: "Featured Rusher Yds Over",
            oneLiner: "Workhorse back whose line lags his recent rushing form.",
            definition: "Fires on rush-yards when the player ranks in the top quintile for NGS rushing efficiency and the posted line is below his recent yardage trend.",
            whyItWorks: "Elite-efficiency backs with soft lines vs form tend to clear the Over — sample is thinner.",
            betDirection: "Rushing yards Over",
            typicalHit: "80% / +50% ROI (thin sample)"
        ),
        "P14": NFLPropSignalDefinition(
            id: "P14",
            displayName: "Volume Model — Attempts Under",
            oneLiner: "Volume model projects fewer attempts than the posted line.",
            definition: "Fires on pass- or rush-attempts when our volume model lands below the consensus close — volume overs are shaded, so an inflated attempts line is the Under.",
            whyItWorks: "When projected volume is light and the market prices high attempt totals, the Under has cashed consistently.",
            betDirection: "Attempts Under",
            typicalHit: "rush 59% / pass 56% (both seasons)"
        ),
        "P15": NFLPropSignalDefinition(
            id: "P15",
            displayName: "Attempts Steam Under",
            oneLiner: "Attempts line steamed up into the close — fade the move.",
            definition: "Fires on pass- or rush-attempts when the close is materially higher than the open — late steam into an attempts Over has been a fade spot.",
            whyItWorks: "Over-reaction to attempt volume into kickoff tends to leave value on the Under at the closing number.",
            betDirection: "Attempts Under",
            typicalHit: "rush 60% / pass 57% (both seasons)"
        ),
        "P16": NFLPropSignalDefinition(
            id: "P16",
            displayName: "Attempts Under — Model + Steam Confluence",
            oneLiner: "Premium: volume model and line steam both point Under.",
            definition: "Fires on pass- or rush-attempts when the volume model projects below the line AND the attempts price steamed up into the close — two independent reads agreeing on the Under.",
            whyItWorks: "Model-vs-line disagreement plus late steam into the wrong side is the highest-conviction attempts Under setup in the catalog.",
            betDirection: "Attempts Under",
            typicalHit: "~65% / +19% ROI (thinner)"
        ),
        "P17": NFLPropSignalDefinition(
            id: "P17",
            displayName: "Volume Model — Rush Yds Under",
            oneLiner: "Volume model projects rush yards well below the posted line.",
            definition: "Fires on rush-yards when the volume model lands materially below the consensus close — the market is pricing an inflated rushing over.",
            whyItWorks: "Projected carry/yards volume below a soft rush line has been a steady Under edge across backtest seasons.",
            betDirection: "Rushing yards Under",
            typicalHit: "58.5% / +10% ROI (both seasons)"
        ),
        "P18": NFLPropSignalDefinition(
            id: "P18",
            displayName: "Volume Model — Pass TDs Over",
            oneLiner: "Volume model is high on QB passing TDs — take the Over.",
            definition: "Fires on pass-TD props when the volume model is confidently above the posted line while passing-TD unders are shaded — the one validated over-side model edge.",
            whyItWorks: "When the model sees TD upside the market hasn't fully priced, the Over clears more often than implied.",
            betDirection: "Passing TDs Over",
            typicalHit: "63–69% / +5–9% ROI (both seasons)"
        ),
    ]

    public static func definition(for flag: String) -> NFLPropSignalDefinition? {
        catalog[flag.uppercased()]
    }

    public static func resolve(_ flags: [String]) -> [NFLPropSignalDefinition] {
        flags.compactMap { definition(for: $0) }
    }
}
