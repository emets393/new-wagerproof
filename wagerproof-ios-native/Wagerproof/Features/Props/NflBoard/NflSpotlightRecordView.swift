import SwiftUI
import WagerproofDesign
import WagerproofModels

struct NflSpotlightRecordView: View {
    let rows: [NflPropSpotlightRow]
    @Environment(\.dismiss) private var dismiss
    @State private var shown = 10

    private var summary: NflLedgerSummary { NflPropRecord.summarize(rows) }
    private var history: [NflPropSpotlightRow] { NflPropRecord.gradedHistory(rows) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    hero
                    tiles
                    if !summary.markets.isEmpty {
                        marketSection
                    }
                    historySection
                }
                .padding(16)
            }
            .background(Color.appSurface.ignoresSafeArea())
            .navigationTitle("🏆 Spotlight record")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    private var hero: some View {
        let record = summary.graded == 0 ? "—" : "\(plain(summary.wins))-\(plain(summary.losses))"
        return VStack(alignment: .leading, spacing: 6) {
            Text("🏆  SEASON RECORD")
                .font(.system(size: 12, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Color.appTextMuted)
            Text(record)
                .font(.system(size: 40, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(summary.graded == 0 ? Color.appTextMuted : moneyColor(summary.units))
            Text(heroCaption)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(heroFill, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(heroStroke, lineWidth: 1)
        )
    }

    private var heroCaption: String {
        var parts = ["\(plain(summary.graded)) graded", "\(plain(summary.pending)) pending"]
        if summary.pushes > 0 {
            parts.append("\(plain(summary.pushes)) push\(summary.pushes == 1 ? "" : "es")")
        }
        return parts.joined(separator: " · ")
    }

    private var heroFill: Color {
        guard summary.graded > 0 else { return cardFill }
        if summary.units > 0 { return NflCardInk.green.opacity(0.14) }
        if summary.units < 0 { return NflCardInk.red.opacity(0.14) }
        return cardFill
    }

    private var heroStroke: Color {
        guard summary.graded > 0 else { return cardStroke }
        if summary.units > 0 { return NflCardInk.green.opacity(0.35) }
        if summary.units < 0 { return NflCardInk.red.opacity(0.35) }
        return cardStroke
    }

    private var tiles: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
            kpi("🎯", "Win rate", summary.winRate.map { String(format: "%.1f%%", $0 * 100) } ?? "—", "Wins and losses", rateColor(summary.winRate))
            kpi("💰", "Units", summary.graded > 0 ? (NflPropRecord.formatUnits(summary.units) ?? "—") : "—", "Push counts as 0", summary.graded > 0 ? moneyColor(summary.units) : Color.appTextMuted)
            kpi("📈", "ROI", NflPropRecord.formatRoi(summary.roi) ?? "—", "Units ÷ graded", moneyColor(summary.roi ?? 0))
            kpi("🗂️", "Graded", plain(summary.graded), "\(plain(summary.pending)) still out", Color.appTextPrimary)
        }
    }

    private func kpi(_ emoji: String, _ label: String, _ value: String, _ sub: String, _ tone: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(emoji)  \(label.uppercased())")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(Color.appTextMuted)
            Text(value)
                .font(.system(size: 26, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(tone)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(sub)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(cardFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(cardStroke, lineWidth: 1))
    }

    private var marketSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("📊  By market")
                .font(.system(size: 16, weight: .bold))
            VStack(spacing: 0) {
                ForEach(Array(summary.markets.enumerated()), id: \.element.id) { index, market in
                    marketRow(market)
                    if index < summary.markets.count - 1 {
                        Divider().padding(.leading, 44)
                    }
                }
            }
            .background(cardFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(cardStroke, lineWidth: 1))
        }
    }

    private func marketRow(_ market: NflMarketRecord) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Text(marketEmoji(market.label))
                .font(.system(size: 18))
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 3) {
                Text(market.label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                HStack(spacing: 0) {
                    recordText(wins: market.wins, losses: market.losses, pushes: market.pushes)
                    Text("  ·  ")
                        .foregroundStyle(Color.appTextMuted)
                    Text(market.winRate.map { String(format: "%.1f%% win", $0 * 100) } ?? "—")
                        .foregroundStyle(rateColor(market.winRate))
                    Text("  ·  ")
                        .foregroundStyle(Color.appTextMuted)
                    Text(NflPropRecord.formatRoi(market.roi) ?? "—")
                        .foregroundStyle(moneyColor(market.units))
                }
                .font(.system(size: 12, weight: .semibold))
                .monospacedDigit()
            }
            Spacer(minLength: 8)
            Text(NflPropRecord.formatUnits(market.units) ?? "—")
                .font(.system(size: 15, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(moneyColor(market.units))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 11)
    }

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("🗂️  Past picks")
                .font(.system(size: 16, weight: .bold))
            if history.isEmpty {
                Text("No graded picks yet.")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 28)
                    .background(cardFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(cardStroke, lineWidth: 1))
            } else {
                ForEach(history.prefix(shown)) { row in
                    historyCard(row)
                }
                if history.count > shown {
                    Button("Load more") { shown += 10 }
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 9)
                        .background(cardFill, in: Capsule())
                        .overlay(Capsule().strokeBorder(cardStroke, lineWidth: 1))
                }
            }
        }
    }

    private func historyCard(_ row: NflPropSpotlightRow) -> some View {
        let mark = resultMark(row.result)
        return HStack(alignment: .top, spacing: 10) {
            Text(mark.emoji)
                .font(.system(size: 18))
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 3) {
                Text(row.playerName)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                Text(pickLine(row))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(2)
                Text(pickMeta(row))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 4) {
                Text(mark.label)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(mark.color)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(mark.color.opacity(0.16), in: Capsule())
                Text(unitsLabel(row.units))
                    .font(.system(size: 13, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(moneyColor(row.units ?? 0))
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(cardFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(cardStroke, lineWidth: 1))
    }

    /// SwiftUI formats an interpolated `Int` with grouping, so `2026` renders as `2,026`.
    private func plain(_ value: Int) -> String { String(value) }

    private func pickLine(_ row: NflPropSpotlightRow) -> String {
        let label = row.marketLabel ?? row.market
        let side = (row.side ?? "").capitalized
        let number = row.line.map { " \(NflPropBoardCopy.formatLine($0))" } ?? ""
        return "\(marketEmoji(label))  Week \(plain(row.week)) · \(label) \(side)\(number)"
            .replacingOccurrences(of: "  ", with: " ")
            .trimmingCharacters(in: .whitespaces)
    }

    private func pickMeta(_ row: NflPropSpotlightRow) -> String {
        var parts: [String] = []
        if let price = NflPropRecord.formatAmerican(row.price) {
            parts.append(price)
        } else {
            parts.append("No price")
        }
        if let book = row.bookName, !book.isEmpty { parts.append(book) }
        if let actual = row.actualValue {
            parts.append("finished \(NflPropBoardCopy.formatLine(actual))")
        }
        return parts.joined(separator: " · ")
    }

    private func unitsLabel(_ units: Double?) -> String {
        guard let text = NflPropRecord.formatUnits(units) else { return "—" }
        return "\(text)u"
    }

    private func recordText(wins: Int, losses: Int, pushes: Int) -> Text {
        Text(plain(wins)).foregroundStyle(NflCardInk.green)
            + Text("-").foregroundStyle(Color.appTextMuted)
            + Text(plain(losses)).foregroundStyle(NflCardInk.red)
            + Text("-\(plain(pushes))").foregroundStyle(Color.appTextMuted)
    }

    private func marketEmoji(_ label: String) -> String {
        let text = label.lowercased()
        if text.contains("touchdown") || text.contains(" td") { return "🏈" }
        if text.contains("pass") { return "🎯" }
        if text.contains("rush") { return "🏃" }
        if text.contains("receiv") || text.contains("reception") || text.contains("catch") { return "🙌" }
        return "📌"
    }

    private func resultMark(_ result: String?) -> (emoji: String, label: String, color: Color) {
        switch (result ?? "").lowercased() {
        case "win": return ("✅", "Win", NflCardInk.green)
        case "loss": return ("❌", "Loss", NflCardInk.red)
        default: return ("➖", "Push", Color.appTextMuted)
        }
    }

    private func moneyColor(_ value: Double) -> Color {
        if value > 0 { return NflCardInk.green }
        if value < 0 { return NflCardInk.red }
        return Color.appTextMuted
    }

    private func rateColor(_ rate: Double?) -> Color {
        guard let rate else { return Color.appTextMuted }
        if rate > 0.5 { return NflCardInk.green }
        if rate < 0.5 { return NflCardInk.red }
        return Color.appTextPrimary
    }

    private var cardFill: Color { Color.appSurfaceElevated }
    private var cardStroke: Color { Color.primary.opacity(0.08) }
}
