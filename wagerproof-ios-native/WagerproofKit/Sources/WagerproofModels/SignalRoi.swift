import Foundation

/// ROI pulled out of a free-text record, in percentage points.
///
/// `typical_hit` and `season_record_text` are prose. Real values include
/// `+52.7% ROI`, `+11-16% ROI`, and `3-1 (75.0%) in 2026-27, +43.2% ROI`.
/// A range averages. A hit-rate percent that is not labeled ROI is ignored.
public enum SignalRoi {
    public static func percent(in raw: String?) -> Double? {
        guard let raw, !raw.isEmpty else { return nil }
        let pattern = #"([+\u2212\-−])?\s*([0-9]+(?:\.[0-9]+)?)(?:\s*[-–—]\s*([0-9]+(?:\.[0-9]+)?))?\s*%\s*ROI\b"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
              let hit = regex.firstMatch(in: raw, range: NSRange(raw.startIndex..., in: raw))
        else { return nil }

        func group(_ index: Int) -> String? {
            let range = hit.range(at: index)
            guard range.location != NSNotFound, let swift = Range(range, in: raw) else { return nil }
            return String(raw[swift])
        }

        guard let first = group(2).flatMap(Double.init) else { return nil }
        let second = group(3).flatMap(Double.init)
        var value = second.map { (first + $0) / 2 } ?? first
        if let sign = group(1), sign != "+" { value = -value }
        guard value.isFinite else { return nil }
        return value
    }
}
