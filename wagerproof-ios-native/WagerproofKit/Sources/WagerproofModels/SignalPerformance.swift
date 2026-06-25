import Foundation

/// Aggregated season-to-date record for one signal (`signal_performance` table).
public struct SignalPerformance: Codable, Hashable, Sendable {
    public let sport: String
    public let signalKey: String
    public let season: Int
    public let n: Int
    public let wins: Int
    public let losses: Int
    public let pushes: Int
    /// Fraction 0–1 (excludes pushes).
    public let hitRate: Double
    public let units: Double
    /// Fraction (0.064 = +6.4% ROI).
    public let roi: Double
    public let lastWeek: Int?
    public let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case sport
        case signalKey = "signal_key"
        case season
        case n, wins, losses, pushes
        case hitRate = "hit_rate"
        case units, roi
        case lastWeek = "last_week"
        case updatedAt = "updated_at"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        sport = try c.decode(String.self, forKey: .sport)
        signalKey = try c.decode(String.self, forKey: .signalKey)
        season = try SignalPerformance.flexInt(c, .season) ?? 0
        n = try SignalPerformance.flexInt(c, .n) ?? 0
        wins = try SignalPerformance.flexInt(c, .wins) ?? 0
        losses = try SignalPerformance.flexInt(c, .losses) ?? 0
        pushes = try SignalPerformance.flexInt(c, .pushes) ?? 0
        hitRate = SignalPerformance.flexDouble(c, .hitRate) ?? 0
        units = SignalPerformance.flexDouble(c, .units) ?? 0
        roi = SignalPerformance.flexDouble(c, .roi) ?? 0
        lastWeek = try SignalPerformance.flexInt(c, .lastWeek)
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt)
    }

    private static func flexInt<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) throws -> Int? {
        if let i = try c.decodeIfPresent(Int.self, forKey: key) { return i }
        if let s = try c.decodeIfPresent(String.self, forKey: key), let i = Int(s) { return i }
        if let d = try c.decodeIfPresent(Double.self, forKey: key) { return Int(d) }
        return nil
    }

    private static func flexDouble<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) -> Double? {
        if let d = try? c.decodeIfPresent(Double.self, forKey: key) { return d }
        if let s = try? c.decodeIfPresent(String.self, forKey: key) { return Double(s) }
        return nil
    }
}

/// Client-side formatting for the "This season" line on signal cards.
public struct SignalSeasonRecordDisplay: Sendable {
    public enum Tone: Sendable {
        case empty, neutral, positive, negative
    }

    public let detail: String
    public let tone: Tone
    public let isSmallSample: Bool

    public init(performance: SignalPerformance?) {
        guard let p = performance, p.n > 0 else {
            detail = "— (no graded picks yet)"
            tone = .empty
            isSmallSample = false
            return
        }

        isSmallSample = p.n < 10
        let record = p.pushes > 0
            ? "\(p.wins)-\(p.losses)-\(p.pushes)"
            : "\(p.wins)-\(p.losses)"
        let hitStr = String(format: "%.1f%%", p.hitRate * 100)
        let unitsStr = Self.signedUnits(p.units)
        detail = "\(record)  •  \(hitStr)  •  \(unitsStr)"

        if p.units > 0 { tone = .positive }
        else if p.units < 0 { tone = .negative }
        else { tone = .neutral }
    }

    private static func signedUnits(_ value: Double) -> String {
        let rounded = (value * 10).rounded() / 10
        if rounded > 0 { return String(format: "+%.1fu", rounded) }
        if rounded < 0 { return String(format: "-%.1fu", abs(rounded)) }
        return "0.0u"
    }
}
