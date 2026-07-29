import Foundation

/// Helper that buckets the games feed into per-day sections so the home
/// list can render a date header above each group. Each sport supplies
/// closures for extracting a stable key (`yyyy-MM-dd` in ET) and the
/// human-readable display label.
///
/// Ordering rules:
///   - Date sections are emitted in chronological order (ascending
///     by `yyyy-MM-dd`). The user's chosen sort mode (time / spread /
///     O/U) is preserved as the *within-section* order — bucketing is
///     stable, so items keep the relative order they had after sorting.
enum GameDateGrouping {
    struct Section<Item> {
        let key: String
        let label: String
        let items: [Item]
    }

    static func group<Item>(
        _ items: [Item],
        key: (Item) -> String,
        label: (Item) -> String
    ) -> [Section<Item>] {
        var buckets: [String: (label: String, items: [Item])] = [:]
        var keyOrder: [String] = []
        for item in items {
            let k = key(item)
            if buckets[k] == nil {
                buckets[k] = (label(item), [])
                keyOrder.append(k)
            }
            buckets[k]?.items.append(item)
        }
        let sortedKeys = keyOrder.sorted()
        return sortedKeys.compactMap { k in
            guard let bucket = buckets[k] else { return nil }
            return Section(key: k, label: bucket.label, items: bucket.items)
        }
    }

    /// Parse the variety of date strings the predictions tables emit
    /// (ISO 8601 with/without fractional seconds, `yyyy-MM-dd`,
    /// `yyyy-MM-dd HH:mm:ss`) into a stable Eastern-Time `yyyy-MM-dd`
    /// key. ET matches the timezone the rest of the app formats dates
    /// in, so games near midnight UTC group on the same day a user
    /// would expect.
    static func dateKey(from raw: String) -> String {
        if raw.isEmpty { return raw }
        if let date = isoWithFractionalSeconds.date(from: raw) { return formatKey(date) }
        if let date = isoInternetDateTime.date(from: raw) { return formatKey(date) }
        for formatter in easternInputFormatters {
            if let date = formatter.date(from: raw) { return formatKey(date) }
        }
        return raw
    }

    private static let isoWithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoInternetDateTime: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let easternInputFormatters: [DateFormatter] = [
        "yyyy-MM-dd",
        "yyyy-MM-dd HH:mm:ss",
    ].map { format in
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "America/New_York")
        formatter.dateFormat = format
        return formatter
    }

    private static let keyFormatter: DateFormatter = {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt
    }()

    private static func formatKey(_ date: Date) -> String {
        keyFormatter.string(from: date)
    }
}
