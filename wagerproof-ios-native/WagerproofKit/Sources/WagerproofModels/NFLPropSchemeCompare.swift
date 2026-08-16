import Foundation

// MARK: - Scheme-compare resolution
//
// Port of `src/features/propBreakdown/schemeCompare.ts` +
// `ComparisonBlock.tsx`'s defense-tile / game-split / look-hit-rate pickers.
// Pure field selection so both native platforms and the tests share one
// source of truth with the web.

public enum NFLSchemeCompareMode: String, Sendable {
    case receiving, qb, rush
}

/// One "career overall vs this look" comparison row.
public struct NFLCompareLookRow: Hashable, Sendable {
    public let key: String
    public let label: String
    /// Primary display value (ypt / epa_db / epa_rush).
    public let value: Double
    public let unit: String
    /// Served delta vs career overall; nil → compute `value - overall`.
    public let delta: Double?
    /// Threshold for coloring the delta as meaningful.
    public let deltaThreshold: Double
    public let sample: String?
    public let pctile: Double?
    /// Sample-size caption (targets / dropbacks / carries).
    public let detail: String
    /// Support metrics line (QB: YPA/cmp/sack; RB: YPC/TD rate).
    public let support: String?
}

public struct NFLSchemeCompareResolved: Hashable, Sendable {
    public enum EmptyReason: String, Sendable { case none, rookie, thin, missing }

    public let mode: NFLSchemeCompareMode
    public let overallLabel: String
    public let overallValue: Double?
    public let overallUnit: String
    public let overallDetail: String
    public let overallSupport: String?
    public let sample: String?
    public let lookRows: [NFLCompareLookRow]
    public let emptyReason: EmptyReason

    public var hasCompare: Bool { overallValue != nil && !lookRows.isEmpty }
}

/// One "What {opp} actually plays" tile.
public struct NFLPropDefenseTile: Hashable, Sendable {
    public let key: String
    public let label: String
    public let rate: Double
    public let pctile: Double
}

/// One "Did he clear the line vs defenses like {opp}?" row.
public struct NFLPropLookHitEntry: Hashable, Sendable, Identifiable {
    public let bucket: String
    public let record: NFLPropHitRate
    public var id: String { bucket }
}

public enum NFLPropSchemeCompare {
    // MARK: Label maps (ported from marketMap.ts)

    public static let coverageLabels: [String: String] = [
        "zone": "vs Zone", "man": "vs Man", "two_high": "vs Two-high",
        "one_high": "vs One-high", "pressure": "vs Pressure", "blitz": "vs Blitz",
    ]

    public static let rushLookLabels: [String: String] = [
        "heavy_box": "vs Heavy box", "neutral": "vs Neutral box", "light_box": "vs Light box",
    ]

    public static let defenseLabels: [String: String] = [
        "man": "Man coverage", "zone": "Zone coverage", "two_high": "Two-high shell",
        "pressure": "Pressure", "blitz": "Blitz", "heavy_box": "Heavy box", "light_box": "Light box",
    ]

    public static let lookBucketLabels: [String: String] = [
        "zone_heavy": "vs zone-heavy Ds", "man_heavy": "vs man-heavy Ds",
        "two_high": "vs two-high Ds", "two_high_heavy": "vs two-high Ds",
        "single_high": "vs single-high Ds", "heavy_box": "vs heavy-box Ds",
        "light_box": "vs light-box Ds", "blitz_heavy": "vs blitz-heavy Ds",
    ]

    public static let gameSplitBucketLabels: [String: String] = [
        "zone_heavy": "zone-heavy", "man_heavy": "man-heavy",
        "two_high_heavy": "two-high", "single_high": "single-high",
        "heavy_box": "heavy box", "light_box": "light box", "blitz_heavy": "blitz-heavy",
    ]

    /// scheme_game_splits stat key per market (markets without one show no
    /// per-game splits block — pass TDs and completions, per web).
    public static let gameSplitStatForMarket: [String: String] = [
        "player_receptions": "receptions",
        "player_reception_yds": "rec_yds",
        "player_rush_yds": "rush_yds",
        "player_rush_attempts": "rush_att",
        "player_pass_yds": "pass_yds",
        "player_pass_attempts": "pass_att",
    ]

    // MARK: Mode resolution

    static func isRushMarket(_ key: String) -> Bool {
        key == "player_rush_yds" || key == "player_rush_attempts"
    }

    static func isPassMarket(_ key: String) -> Bool {
        key == "player_pass_yds" || key == "player_pass_tds"
            || key == "player_pass_attempts" || key == "player_pass_completions"
    }

    static func isReceivingMarket(_ key: String) -> Bool {
        key == "player_receptions" || key == "player_reception_yds"
    }

    /// Pick the layer from scheme.kind + market family. Order matters: the
    /// rush-market check runs BEFORE the QB check, and ATD falls qb → rush →
    /// receiving (mirrors `resolveCompareMode`).
    public static func resolveMode(page: NFLPropPlayerPage, marketKey: String) -> NFLSchemeCompareMode? {
        let kind = page.scheme?.kind
        if isRushMarket(marketKey), kind == "rb" || page.scheme?.rushOverall != nil { return .rush }
        if isPassMarket(marketKey), kind == "qb" || page.position == "QB" { return .qb }
        if marketKey == "player_anytime_td" {
            if kind == "qb" || page.position == "QB" { return .qb }
            if kind == "rb" || page.scheme?.rushOverall != nil { return .rush }
            return .receiving
        }
        if isReceivingMarket(marketKey) { return .receiving }
        // Fallback: position-native layer when the market is odd.
        if kind == "qb" { return .qb }
        if kind == "rb", page.scheme?.rushOverall != nil { return .rush }
        if page.scheme?.playerOverall?.ypt != nil { return .receiving }
        return nil
    }

    // MARK: Compare resolution

    public static func resolve(page: NFLPropPlayerPage, marketKey: String) -> NFLSchemeCompareResolved? {
        guard let mode = resolveMode(page: page, marketKey: marketKey) else { return nil }
        guard let scheme = page.scheme else {
            return NFLSchemeCompareResolved(
                mode: mode, overallLabel: "Career", overallValue: nil, overallUnit: "",
                overallDetail: "", overallSupport: nil, sample: nil, lookRows: [],
                emptyReason: page.rookie ? .rookie : .missing
            )
        }

        switch mode {
        case .qb:
            // QB overall must carry both epa_db and dropbacks (mirrors isQbOverall).
            let overall = (scheme.playerOverall?.epaDb != nil && scheme.playerOverall?.dropbacks != nil)
                ? scheme.playerOverall : nil
            let focus = scheme.lookFocus.isEmpty ? ["zone", "pressure"] : scheme.lookFocus
            let rows: [NFLCompareLookRow] = focus.compactMap { key in
                guard let raw = scheme.playerSplits[key],
                      let dropbacks = raw.dropbacks, dropbacks >= 1,
                      !raw.insufficient,
                      let value = raw.epaDb else { return nil }
                return NFLCompareLookRow(
                    key: key,
                    label: coverageLabels[key] ?? "vs \(key)",
                    value: value,
                    unit: "EPA/db",
                    delta: raw.deltaEpaDb,
                    deltaThreshold: 0.04,
                    sample: raw.sample,
                    pctile: raw.pctile,
                    detail: "\(dropbacks) db",
                    support: qbSupport(ypa: raw.ypa, compPct: raw.compPct, sackRate: raw.sackRate)
                )
            }
            let emptyReason: NFLSchemeCompareResolved.EmptyReason = rows.isEmpty
                ? (overall == nil ? (page.rookie ? .rookie : .missing)
                    : (overall?.sample == "thin" ? .thin : .missing))
                : .none
            return NFLSchemeCompareResolved(
                mode: mode,
                overallLabel: "Career EPA/db",
                overallValue: overall?.epaDb,
                overallUnit: "EPA/db",
                overallDetail: overall?.dropbacks.map { "\($0) dropbacks" } ?? "",
                overallSupport: overall.flatMap { qbSupport(ypa: $0.ypa, compPct: $0.compPct, sackRate: $0.sackRate) },
                sample: overall?.sample,
                lookRows: rows,
                emptyReason: emptyReason
            )

        case .rush:
            let overall = (scheme.rushOverall?.ypc != nil && scheme.rushOverall?.carries != nil)
                ? scheme.rushOverall : nil
            let focus = scheme.rushLookFocus.isEmpty ? ["neutral"] : scheme.rushLookFocus
            let rows: [NFLCompareLookRow] = focus.compactMap { key in
                guard let raw = scheme.rushSplits[key],
                      let carries = raw.carries, carries >= 1,
                      !raw.insufficient,
                      let value = raw.epaRush else { return nil }
                return NFLCompareLookRow(
                    key: key,
                    label: rushLookLabels[key] ?? "vs \(key)",
                    value: value,
                    unit: "EPA/rush",
                    delta: raw.deltaEpaRush,
                    deltaThreshold: 0.04,
                    sample: raw.sample,
                    pctile: raw.pctile,
                    detail: "\(carries) att",
                    support: rushSupport(ypc: raw.ypc, tdRate: raw.tdRate)
                )
            }
            let emptyReason: NFLSchemeCompareResolved.EmptyReason = rows.isEmpty
                ? (overall == nil ? (page.rookie ? .rookie : .missing)
                    : (overall?.sample == "thin" ? .thin : .missing))
                : .none
            return NFLSchemeCompareResolved(
                mode: mode,
                overallLabel: "Career EPA/rush",
                overallValue: overall?.epaRush,
                overallUnit: "EPA/rush",
                overallDetail: overall?.carries.map { "\($0) att" } ?? "",
                overallSupport: overall.flatMap { rushSupport(ypc: $0.ypc, tdRate: $0.tdRate) },
                sample: overall?.sample,
                lookRows: rows,
                emptyReason: emptyReason
            )

        case .receiving:
            let overall = (scheme.playerOverall?.ypt != nil) ? scheme.playerOverall : nil
            let focusSource = scheme.lookFocus.isEmpty ? ["zone", "man"] : scheme.lookFocus
            let focus = focusSource.filter { ["zone", "man", "two_high", "one_high"].contains($0) }
            let rows: [NFLCompareLookRow] = focus.compactMap { key in
                guard let raw = scheme.playerSplits[key],
                      let targets = raw.targets, targets >= 1,
                      !raw.insufficient,
                      let ypt = raw.ypt, ypt.isFinite else { return nil }
                return NFLCompareLookRow(
                    key: key,
                    label: coverageLabels[key] ?? "vs \(key)",
                    value: ypt,
                    unit: "ypt",
                    delta: raw.deltaYpt,
                    deltaThreshold: 0.35,
                    sample: raw.sample,
                    pctile: raw.pctile,
                    detail: "\(targets) tgt",
                    support: nil
                )
            }
            let emptyReason: NFLSchemeCompareResolved.EmptyReason = rows.isEmpty
                ? (overall == nil ? (page.rookie ? .rookie : .thin) : .thin)
                : .none
            return NFLSchemeCompareResolved(
                mode: mode,
                overallLabel: "Career ypt",
                overallValue: overall?.ypt,
                overallUnit: "ypt",
                overallDetail: overall?.targets.map { "all coverages · \($0) tgt" } ?? "",
                overallSupport: nil,
                sample: overall?.sample,
                lookRows: rows,
                emptyReason: emptyReason
            )
        }
    }

    private static func qbSupport(ypa: Double?, compPct: Double?, sackRate: Double?) -> String {
        "YPA \(NFLPropFormat.perGame(ypa, digits: 1)) · \(NFLPropFormat.ratePct(compPct)) cmp · \(NFLPropFormat.ratePct(sackRate)) sack"
    }

    private static func rushSupport(ypc: Double?, tdRate: Double?) -> String {
        var out = "YPC \(NFLPropFormat.perGame(ypc, digits: 1))"
        if let tdRate { out += " · TD \(NFLPropFormat.ratePct(tdRate))" }
        return out
    }

    // MARK: Defense tiles ("What {opp} actually plays")

    /// Tiles mirror the opponent's look_focus, NOT a static per-market list.
    /// `zone` is synthesized as the complement of the served man rate; `one_high`
    /// reuses the two-high axis relabeled "Single-high shell"; `neutral` yields
    /// nothing. Empty focus falls back to extreme dims (pctile ≥60 or ≤40).
    public static func defenseTiles(page: NFLPropPlayerPage, mode: NFLSchemeCompareMode?) -> [NFLPropDefenseTile] {
        guard let scheme = page.scheme, let defense = scheme.defense else { return [] }

        let focusKeys: [String]
        if mode == .rush {
            focusKeys = scheme.rushLookFocus.isEmpty ? ["neutral"] : scheme.rushLookFocus
        } else {
            focusKeys = scheme.lookFocus
        }

        var ordered: [NFLPropDefenseTile] = []
        func push(_ key: String, label: String? = nil, rate: Double? = nil, pctile: Double? = nil) {
            let resolvedLabel = label ?? defenseLabels[key] ?? key
            guard !ordered.contains(where: { $0.key == key && $0.label == resolvedLabel }) else { return }
            let dim = defense.dims[key]
            guard let r = rate ?? dim?.rate, let p = pctile ?? dim?.pctile else { return }
            ordered.append(NFLPropDefenseTile(key: key, label: resolvedLabel, rate: r, pctile: p))
        }

        for look in focusKeys {
            switch look {
            case "zone":
                if let man = defense.dims["man"] {
                    push("zone", rate: min(1, max(0, 1 - man.rate)), pctile: min(100, max(0, 100 - man.pctile)))
                }
            case "one_high":
                if defense.dims["two_high"] != nil {
                    push("two_high", label: "Single-high shell")
                }
            case "neutral":
                break
            default:
                push(look)
            }
        }

        if ordered.isEmpty {
            for key in ["man", "two_high", "pressure", "blitz", "heavy_box", "light_box"] {
                guard let dim = defense.dims[key] else { continue }
                if dim.pctile >= 60 || dim.pctile <= 40 {
                    ordered.append(NFLPropDefenseTile(key: key, label: defenseLabels[key] ?? key, rate: dim.rate, pctile: dim.pctile))
                }
            }
        }
        return ordered
    }

    // MARK: Game splits + look hit rates

    /// The one applicable game-split entry worth showing: first bucket in
    /// `applicable` order that is not insufficient with n ≥ 3, plus the
    /// qualified bucket labels for the caption.
    public static func gameSplit(page: NFLPropPlayerPage, marketKey: String)
        -> (entry: NFLPropGameSplitEntry, overall: NFLPropGameSplitEntry, statKey: String, bucketLabels: [String])? {
        guard let statKey = gameSplitStatForMarket[marketKey],
              let gs = page.schemeGameSplits,
              let overall = gs.overall,
              !gs.applicable.isEmpty else { return nil }
        let qualified = gs.applicable.filter { bucket in
            guard let e = gs.splits[bucket] else { return false }
            return !e.insufficient && (e.n ?? 0) >= 3
        }
        guard let firstBucket = qualified.first, let entry = gs.splits[firstBucket],
              entry.stats[statKey] != nil else { return nil }
        let labels = qualified.map { gameSplitBucketLabels[$0] ?? $0 }
        return (entry, overall, statKey, labels)
    }

    /// "Did he clear the line vs defenses like {opp}?" rows, gated n ≥ 3.
    public static func lookHitEntries(page: NFLPropPlayerPage, marketKey: String) -> [NFLPropLookHitEntry] {
        guard let rates = page.scheme?.lookHitRates else { return [] }
        return rates
            .compactMap { bucket, byMarket -> NFLPropLookHitEntry? in
                guard let rec = byMarket[marketKey], rec.n >= 3 else { return nil }
                return NFLPropLookHitEntry(bucket: bucket, record: rec)
            }
            .sorted { $0.bucket < $1.bucket }
    }
}
