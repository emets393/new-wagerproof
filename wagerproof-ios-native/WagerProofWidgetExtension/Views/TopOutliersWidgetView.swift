import WidgetKit
import SwiftUI
import WagerproofDesign
import WagerproofModels

struct TopOutliersWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TopOutliersEntry

    var body: some View {
        if entry.alerts.isEmpty {
            EmptyOutliersView(compact: family == .systemSmall)
        } else {
            switch family {
            case .systemSmall:
                SmallOutliersView(alert: entry.alerts[0])
            case .systemLarge:
                OutliersListView(alerts: Array(entry.alerts.prefix(5)), maxRows: 5)
            default:
                OutliersListView(alerts: Array(entry.alerts.prefix(2)), maxRows: 2)
            }
        }
    }
}

private struct EmptyOutliersView: View {
    let compact: Bool

    var body: some View {
        VStack(spacing: Spacing.xs) {
            Image(systemName: "bell.badge.fill")
                .font(.system(size: compact ? 20 : 24))
                .foregroundStyle(WidgetPalette.accent)
            Text(compact ? "Outliers" : "Open WagerProof to load today's outliers")
                .font(AppFont.caption)
                .foregroundStyle(WidgetPalette.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct SmallOutliersView: View {
    let alert: OutlierAlertForWidget

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack {
                sportBadge
                Spacer()
                Image(systemName: alert.kind == .fade ? "bolt.fill" : "chart.line.uptrend.xyaxis")
                    .font(.system(size: 11))
                    .foregroundStyle(WidgetPalette.accent)
            }
            Spacer(minLength: 0)
            Text(alert.matchup)
                .font(.system(size: 10))
                .foregroundStyle(WidgetPalette.textMuted)
                .lineLimit(1)
            Text(alert.displayLabel)
                .font(AppFont.bodyEmphasized)
                .foregroundStyle(WidgetPalette.textPrimary)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
            Text(alert.confidenceDisplay)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(WidgetPalette.accent)
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(WidgetPalette.background)
    }

    private var sportBadge: some View {
        Text(alert.sport.uppercased())
            .font(.system(size: 9, weight: .heavy))
            .foregroundStyle(.white)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(WidgetSportBadge.color(for: alert.sport))
            .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}

private struct OutliersListView: View {
    let alerts: [OutlierAlertForWidget]
    let maxRows: Int

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack {
                Image(systemName: "bell.badge.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(WidgetPalette.accent)
                Text("Top Outliers")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(WidgetPalette.textPrimary)
                Spacer()
                Text("WagerProof")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(WidgetPalette.textMuted)
            }
            ForEach(alerts) { alert in
                OutlierRow(alert: alert)
            }
            if maxRows > alerts.count {
                Spacer(minLength: 0)
            }
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(WidgetPalette.background)
    }
}

private struct OutlierRow: View {
    let alert: OutlierAlertForWidget

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Text(alert.sport.uppercased())
                .font(.system(size: 9, weight: .heavy))
                .foregroundStyle(.white)
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(WidgetSportBadge.color(for: alert.sport))
                .clipShape(RoundedRectangle(cornerRadius: 4))

            VStack(alignment: .leading, spacing: 1) {
                Text(alert.matchup)
                    .font(.system(size: 9))
                    .foregroundStyle(WidgetPalette.textMuted)
                    .lineLimit(1)
                Text(alert.displayLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(WidgetPalette.textPrimary)
                    .lineLimit(1)
            }

            Spacer()

            Text(alert.confidenceDisplay)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(WidgetPalette.accent)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(WidgetPalette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - Display helpers

private extension OutlierAlertForWidget {
    var matchup: String { "\(awayTeam) @ \(homeTeam)" }

    /// Fade alerts store the model's *favored* side in `side` — the actual
    /// recommendation is to bet the opposite. Value alerts store the side
    /// the market money is actually on, so `side` is used as-is.
    var displaySide: String {
        guard kind == .fade else { return side }
        if marketType == "Total" {
            return side == "Over" ? "Under" : "Over"
        }
        return side == awayTeam ? homeTeam : awayTeam
    }

    var displayLabel: String {
        kind == .fade ? "Fade to \(displaySide)" : "\(displaySide) value"
    }

    /// NFL fade alerts are probability-based (0-100%); CFB/NBA/NCAAB fade
    /// alerts are point-deltas. Value alerts are always a market percentage.
    /// Mirrors `FadeAlertWidgetData.confidenceDisplay` from the RN widget.
    var confidenceDisplay: String {
        if kind == .value { return "\(confidence)%" }
        return sport.lowercased() == "nfl" ? "\(confidence)%" : "\(confidence)pt"
    }
}

#Preview("Small", as: .systemSmall) {
    TopOutliersWidget()
} timeline: {
    TopOutliersEntry(date: .now, alerts: WidgetSampleData.outlierAlerts, lastUpdated: .now)
}

#Preview("Medium", as: .systemMedium) {
    TopOutliersWidget()
} timeline: {
    TopOutliersEntry(date: .now, alerts: WidgetSampleData.outlierAlerts, lastUpdated: .now)
}

#Preview("Large", as: .systemLarge) {
    TopOutliersWidget()
} timeline: {
    TopOutliersEntry(date: .now, alerts: WidgetSampleData.outlierAlerts, lastUpdated: .now)
}
