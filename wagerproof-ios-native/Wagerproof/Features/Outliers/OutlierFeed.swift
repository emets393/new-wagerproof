import SwiftUI
import WagerproofModels
import WagerproofStores

/// One game that fired one or more outlier signals, plus the payloads its
/// detail page needs to render each signal as a glass widget.
///
/// This is the merged, per-game unit behind the redesigned Outliers hub: every
/// source (MLB Betting Trends, F5 Splits today; Value/Fade/Accuracy/Pitcher in
/// later phases) contributes `OutlierSignal`s keyed by `gamePk`, so a game with
/// several signals shows up once with several badges. Built by
/// `OutlierAggregator`.
struct OutlierFeedItem: Identifiable, Hashable {
    struct Team: Hashable {
        let name: String
        let abbr: String
        let logoURL: String?
        let primary: Color
        let secondary: Color
    }

    let id: String            // "mlb-<gamePk>" — string so other sports slot in later
    let sport: String         // "mlb" for now
    let gamePk: Int
    let gameTimeEt: String?
    let away: Team
    let home: Team
    let signals: [OutlierSignal]

    // Detail-page payloads (one per signal source that fired).
    let trends: MLBGameTrends?
    let f5: MLBF5Game?
    /// Just this game's two F5 split rows, keyed the way `F5GameCardView`
    /// looks them up — kept tiny so the nav value stays cheap.
    let f5Lookup: [String: MLBF5SplitRow]

    /// Combined severity used to rank the merged list.
    let severity: Double

    // Identity is the game key — the payloads don't participate in equality.
    static func == (l: OutlierFeedItem, r: OutlierFeedItem) -> Bool { l.id == r.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

/// A single reason a game was flagged. The `badge` shows on the list tile; the
/// `headline` explains it on the detail page.
struct OutlierSignal: Hashable {
    enum Kind: String, Hashable {
        case value, fade, trends, f5, accuracy, pitcher
    }
    let kind: Kind
    let badge: String
    let tintHex: UInt32
    let headline: String
    let severity: Double

    var tint: Color { Color(hex: Int(tintHex)) }
}

/// Merges per-sport outlier sources into a single ranked, per-game feed.
///
/// Phase 1 wires MLB Betting Trends + MLB F5 Splits. Each `add*` step is
/// self-contained, so adding Value/Fade/Accuracy/Pitcher later is just another
/// bucket-merge keyed by `gamePk` — no change to the tile or detail.
enum OutlierAggregator {
    // MainActor-isolated because it reads from the @MainActor F5 store
    // (`split(for:side:)`); it's only ever called from the view body.
    @MainActor
    static func build(
        trends: [MLBGameTrends],
        f5Games: [MLBF5Game],
        f5Store: MLBF5SplitsStore
    ) -> [OutlierFeedItem] {
        // Bucket both sources by game key.
        var buckets: [Int: (trends: MLBGameTrends?, f5: MLBF5Game?)] = [:]
        for t in trends { buckets[t.gamePk, default: (nil, nil)].trends = t }
        for f in f5Games { buckets[f.gamePk, default: (nil, nil)].f5 = f }

        var items: [OutlierFeedItem] = []
        for (pk, pair) in buckets {
            var signals: [OutlierSignal] = []
            var severity: Double = 0

            if let t = pair.trends, let sig = trendsSignal(t) {
                signals.append(sig); severity += sig.severity
            }
            if let f = pair.f5, let sig = f5Signal(f, store: f5Store) {
                signals.append(sig); severity += sig.severity
            }
            guard !signals.isEmpty else { continue }

            let (away, home, timeEt) = resolveTeams(pair)

            // Carry just this game's two F5 split rows under the keys
            // `F5GameCardView` will recompute, so the widget renders standalone.
            var f5Lookup: [String: MLBF5SplitRow] = [:]
            if let f = pair.f5 {
                if let row = f5Store.split(for: f, side: "away"),
                   let key = MLBF5.splitLookupKey(teamAbbr: f.awayAbbr, homeAway: "away", oppSpHand: f.homeSpHand) {
                    f5Lookup[key] = row
                }
                if let row = f5Store.split(for: f, side: "home"),
                   let key = MLBF5.splitLookupKey(teamAbbr: f.homeAbbr, homeAway: "home", oppSpHand: f.awaySpHand) {
                    f5Lookup[key] = row
                }
            }

            items.append(OutlierFeedItem(
                id: "mlb-\(pk)", sport: "mlb", gamePk: pk, gameTimeEt: timeEt,
                away: away, home: home,
                signals: signals.sorted { $0.severity > $1.severity },
                trends: pair.trends, f5: pair.f5, f5Lookup: f5Lookup,
                severity: severity
            ))
        }
        return items.sorted { $0.severity > $1.severity }
    }

    // MARK: - Per-source signal extraction

    /// Flags a game when its situational splits line up — a strong moneyline
    /// edge across spots, or both teams' over/under splits leaning the same way.
    private static func trendsSignal(_ t: MLBGameTrends) -> OutlierSignal? {
        let ou = t.ouConsensusScore
        let ml = t.mlDominanceScore
        // Moderate gate: surface games with a real lean, not every matchup.
        guard ou >= 50 || ml >= 10 else { return nil }
        let leansOU = ou * 0.25 >= ml
        let headline = leansOU
            ? "Both sides' situational over/under splits lean the same direction on the total."
            : "A consistent moneyline edge shows up across this game's situational splits."
        return OutlierSignal(
            kind: .trends, badge: "TRENDS", tintHex: 0x0EA5E9,
            headline: headline, severity: ou * 0.25 + ml
        )
    }

    /// Flags a game when first-five run production diverges from the posted F5
    /// line, judged off each team's home/away splits vs the opposing starter.
    @MainActor
    private static func f5Signal(_ f: MLBF5Game, store: MLBF5SplitsStore) -> OutlierSignal? {
        let away = store.split(for: f, side: "away")
        let home = store.split(for: f, side: "home")
        guard MLBF5.isShowable(away?.games) || MLBF5.isShowable(home?.games) else { return nil }
        let magnitudes = [away?.f5LineEdge, home?.f5LineEdge, away?.rsDiffVsSeason, home?.rsDiffVsSeason]
            .compactMap { $0 }
            .map { abs($0) }
        let peak = magnitudes.max() ?? 0
        guard peak > 0 else { return nil }
        return OutlierSignal(
            kind: .f5, badge: "F5", tintHex: 0xF97316,
            headline: "First-five run production is running off its season line for this matchup.",
            severity: peak * 10
        )
    }

    // MARK: - Team resolution

    private static func resolveTeams(
        _ pair: (trends: MLBGameTrends?, f5: MLBF5Game?)
    ) -> (OutlierFeedItem.Team, OutlierFeedItem.Team, String?) {
        if let f = pair.f5 {
            return (
                team(name: f.awayTeamName, abbr: f.awayAbbr, id: nil),
                team(name: f.homeTeamName, abbr: f.homeAbbr, id: nil),
                f.gameTimeEt ?? pair.trends?.gameTimeEt
            )
        }
        let t = pair.trends!
        return (
            team(name: t.awayTeam.teamName, abbr: nil, id: t.awayTeam.teamId),
            team(name: t.homeTeam.teamName, abbr: nil, id: t.homeTeam.teamId),
            t.gameTimeEt
        )
    }

    /// Resolve a team's logo/abbr/colors from the shared `MLBTeams` table,
    /// using whichever identifier the source carries (name, abbr, or team id).
    private static func team(name: String, abbr: String?, id: Int?) -> OutlierFeedItem.Team {
        let info = MLBTeams.info(for: name)
        let byId = id.flatMap { MLBTeams.displayById($0) }
        let logo = info?.logoUrl ?? byId?.logoUrl
        let resolvedAbbr = abbr ?? info?.team ?? byId?.abbrev ?? String(name.prefix(3)).uppercased()
        let c = MLBTeams.colors(for: name)
        return OutlierFeedItem.Team(
            name: name, abbr: resolvedAbbr, logoURL: logo,
            primary: Color(hex: Int(c.primary)), secondary: Color(hex: Int(c.secondary))
        )
    }
}
