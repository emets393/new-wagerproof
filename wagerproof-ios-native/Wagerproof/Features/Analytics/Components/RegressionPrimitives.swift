import SwiftUI
import WagerproofDesign

/// Shared visual + formatting vocabulary for the MLB Regression Report
/// primitives. One source of truth so every extracted card colors win%,
/// severity, and ROI the same way RN does.
enum Regression {
    // RN color tokens (mlb-regression-report.tsx).
    static let winGreen = Color(hex: 0x22C55E)
    static let lossRed = Color(hex: 0xEF4444)
    static let warnAmber = Color(hex: 0xF59E0B)
    static let neutralGray = Color(hex: 0x6B7280)
    static let accentBlue = Color(hex: 0x3B82F6)
    static let accentPurple = Color(hex: 0xA855F7)
    static let accentIndigo = Color(hex: 0x6366F1)
    static let accentCyan = Color(hex: 0x06B6D4)
    static let accentYellow = Color(hex: 0xEAB308)
    static let accentOrange = Color(hex: 0xF97316)
    static let hammerPurple = Color(hex: 0xA78BFA)

    static func winPctColor(_ pct: Double) -> Color {
        if pct >= 65 { return winGreen }
        if pct >= 55 { return accentYellow }
        if pct >= 50 { return accentOrange }
        return lossRed
    }

    static func severityColor(_ severity: String?) -> Color {
        switch severity {
        case "severe": return lossRed
        case "moderate": return warnAmber
        default: return winGreen
        }
    }

    static func roiColor(_ value: Double) -> Color {
        value >= 0 ? winGreen : lossRed
    }

    static func betTypeLabel(_ bt: String) -> String {
        switch bt {
        case "full_ml": return "Full ML"
        case "full_ou": return "Full O/U"
        case "f5_ml": return "F5 ML"
        case "f5_ou": return "F5 O/U"
        default: return bt.uppercased()
        }
    }

    static let betTypes: [(key: String, label: String)] = [
        ("full_ml", "Full ML"), ("full_ou", "Full O/U"),
        ("f5_ml", "F5 ML"), ("f5_ou", "F5 O/U"),
    ]

    /// JS-style number printing: "55.6", "4", "-1.25" — no trailing zeros.
    static func trimmed(_ value: Double) -> String {
        if value == value.rounded() { return String(format: "%.0f", value) }
        var s = String(format: "%.2f", value)
        while s.hasSuffix("0") { s.removeLast() }
        if s.hasSuffix(".") { s.removeLast() }
        return s
    }

    static func signed(_ value: Double, decimals: Int) -> String {
        (value > 0 ? "+" : "") + String(format: "%.\(decimals)f", value)
    }

    /// "+55.6%" style for raw-numeric pcts (no fixed decimals, RN parity).
    static func signedTrimmedPct(_ value: Double) -> String {
        (value > 0 ? "+" : "") + trimmed(value) + "%"
    }

    /// RN `timeAgo`: "just now", "{m}m ago", "{h}h {m}m ago".
    static func timeAgo(fromISO raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = iso.date(from: raw)
        if date == nil {
            iso.formatOptions = [.withInternetDateTime]
            date = iso.date(from: raw)
        }
        guard let date else { return nil }
        let minutes = Int(Date().timeIntervalSince(date) / 60)
        if minutes < 1 { return "just now" }
        if minutes < 60 { return "\(minutes)m ago" }
        return "\(minutes / 60)h \(minutes % 60)m ago"
    }

    /// "7:05 PM ET" from an ISO timestamp, rendered in America/New_York.
    static func gameTimeET(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = iso.date(from: raw)
        if date == nil {
            iso.formatOptions = [.withInternetDateTime]
            date = iso.date(from: raw)
        }
        guard let date else { return nil }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        fmt.dateFormat = "h:mm a"
        return fmt.string(from: date) + " ET"
    }
}

// MARK: - AccentBarRow

/// Elevated-surface card with a color-tinted border — the report's dominant
/// row chrome (RN `AccentBarRow`). Severity/tier is already communicated by
/// each card's `RegressionPill` badge, so the border tint is enough context;
/// no separate colored left bar needed.
struct RegressionAccentRow<Content: View>: View {
    let color: Color
    var dim: Bool = false
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(color.opacity(0.28), lineWidth: 1))
            .opacity(dim ? 0.6 : 1)
    }
}

// MARK: - Small atoms

/// 10pt uppercase label over a bold tabular value (RN `Stat`).
struct RegressionStat: View {
    let label: String
    let value: String
    var color: Color? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Color.appTextSecondary)
            Text(value)
                .font(.system(size: 14, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(color ?? Color.appTextPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct RegressionPill: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .bold))
            .tracking(0.4)
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .overlay(Capsule().stroke(color.opacity(0.55), lineWidth: 1))
            .clipShape(Capsule())
    }
}

/// Big record tile used by the recap hero row (RN `HeroTile`).
struct RegressionHeroTile: View {
    let label: String
    let primary: String
    let secondary: Text

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .tracking(1)
                .foregroundStyle(Color.appTextSecondary)
            Text(primary)
                .font(.system(size: 24, weight: .heavy))
                .tracking(-0.5)
                .foregroundStyle(Color.appTextPrimary)
            secondary
                .font(.system(size: 12, weight: .semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.appSurfaceMuted.opacity(0.4), in: RoundedRectangle(cornerRadius: 14))
    }
}

/// Group divider inside a section ("DUE FOR NEGATIVE REGRESSION" etc.).
struct RegressionGroupLabel: View {
    let label: String
    let count: Int
    var color: Color? = nil
    var note: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                if let color {
                    Circle().fill(color).frame(width: 6, height: 6)
                }
                Text(label)
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.8)
                    .foregroundStyle(color ?? Color.appTextSecondary)
                Spacer()
                Text("\(count)")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            if let note {
                Text(note)
                    .font(.system(size: 11)).italic()
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
    }
}

/// iOS-style segmented control used by accuracy + breakdown sections.
struct RegressionSegmentedTabs: View {
    let options: [(key: String, label: String)]
    @Binding var selection: String

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.key) { option in
                let active = selection == option.key
                Button {
                    selection = option.key
                } label: {
                    Text(option.label)
                        .font(.system(size: 12, weight: active ? .bold : .medium))
                        .padding(.vertical, 7)
                        .frame(maxWidth: .infinity)
                        .background(active ? Color.appSurface : .clear, in: RoundedRectangle(cornerRadius: 8))
                        .foregroundStyle(active ? Color.appTextPrimary : Color.appTextSecondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - FlowLayout

/// Wrapping layout for flag chips — SwiftUI's HStack truncates instead of
/// wrapping. Minimal implementation tuned for short pill rows.
struct RegressionFlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rows: [[CGSize]] = [[]]
        var currentRowWidth: CGFloat = 0
        var totalHeight: CGFloat = 0
        var rowHeight: CGFloat = 0

        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if currentRowWidth + size.width + spacing > maxWidth && !rows[rows.count - 1].isEmpty {
                rows.append([])
                totalHeight += rowHeight + spacing
                rowHeight = 0
                currentRowWidth = 0
            }
            rows[rows.count - 1].append(size)
            currentRowWidth += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        totalHeight += rowHeight
        return CGSize(width: maxWidth.isFinite ? maxWidth : currentRowWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var rowHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX && x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
