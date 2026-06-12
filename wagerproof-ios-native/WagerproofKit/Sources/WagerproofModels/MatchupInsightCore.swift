import Foundation

// Shared vocabulary for the matchup insight widgets (trends / props / F5).
// Lives in Kit because both the app-target widgets and SearchStore's teaser
// chips must derive from the same summaries — one source of truth for every
// threshold (see InsightThresholds).

public enum MatchupSide: String, Sendable, Hashable { case away, home }

/// One verdict sentence rendered in a widget's verdict line.
public struct InsightVerdict: Hashable, Sendable, Identifiable {
    public enum Lean: Hashable, Sendable { case team(abbr: String, side: MatchupSide), over, under, none }
    public let text: String
    public let lean: Lean
    public let strength: Int            // 0 informational, 1...3 dots
    public var id: String { text }

    public init(text: String, lean: Lean, strength: Int) {
        self.text = text
        self.lean = lean
        self.strength = strength
    }
}

/// Categorical header badge ("3 SIGNALS" / "NYY EDGE" / "NO EDGE").
public struct InsightVerdictBadge: Hashable, Sendable {
    public let text: String
    public let tintHex: UInt32

    public init(text: String, tintHex: UInt32) {
        self.text = text
        self.tintHex = tintHex
    }
}

/// One search-chip teaser. `headline == nil` renders the neutral chip copy
/// (the chip still navigates — never hide the door).
public struct InsightTeaser: Hashable, Sendable {
    public enum Kind: String, Sendable, Hashable, CaseIterable { case trends, f5, props }
    public enum Signal: Hashable, Sendable { case positive, negative, neutral }
    public let kind: Kind
    public let headline: String?
    public let signal: Signal
    public let smallSample: Bool        // amber dot suffix

    public init(kind: Kind, headline: String?, signal: Signal, smallSample: Bool) {
        self.kind = kind
        self.headline = headline
        self.signal = signal
        self.smallSample = smallSample
    }
}

/// Single source of truth for every insight threshold (spec §1).
public enum InsightThresholds {
    public static let minGamesBasketball = 5
    public static let sideGap = 10.0, leaderFloor = 55.0, ouHigh = 55.0, ouLow = 45.0
    public static let propSampleMin = 5, propHot = 70.0, propCold = 30.0
    public static let f5Slight = 5.0, f5Edge = 10.0, f5Own = 15.0, f5DeltaMin = 0.5

    /// Strength → 0–3 dot scale shared by every verdict line.
    public static func dots(_ strength: Double) -> Int {
        if strength >= 25 { return 3 }
        if strength >= 15 { return 2 }
        if strength > 0 { return 1 }
        return 0
    }
}
