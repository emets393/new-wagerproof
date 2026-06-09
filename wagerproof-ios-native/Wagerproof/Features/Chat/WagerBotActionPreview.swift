import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Renders a `present_analysis` widget block as a rich inline card.
/// Wagerproof's analogue of Honeydew's `AssistantV2ActionPreview` — same
/// "full-width tile inside the assistant bubble" layout, but the
/// content is sport-specific analysis (matchup overview, model
/// projections, polymarket odds, public betting splits, injuries,
/// betting trends, weather) instead of recipe / meal-plan / grocery
/// previews.
///
/// One widget per `WagerBotChatWidget` block; multiple widgets render
/// stacked. Tapping anywhere on the tile fires `onTap` which opens the
/// sport game sheet for the parent game.
struct WagerBotActionPreview: View {
    let widget: WagerBotChatWidget
    let ui: WagerBotUiTokens
    var onTap: (() -> Void)?

    var body: some View {
        Button {
            onTap?()
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                header
                if let analysis = widget.analysis, !analysis.isEmpty {
                    WagerBotMarkdownText(
                        analysis,
                        baseFont: .system(size: 13, weight: .medium),
                        primaryColor: ui.primaryText,
                        secondaryColor: ui.mutedText
                    )
                }
                widgetBody
                footer
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(ui.hintChipBackground)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(ui.borderColor, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 8) {
            Image(systemName: headerIcon)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(ui.accent)
            Text(headerLabel)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(ui.accent)
            Spacer(minLength: 0)
            Text(widget.sport.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(ui.mutedText)
        }
    }

    private var headerLabel: String {
        if let title = widget.title, !title.isEmpty { return title }
        switch widget.widgetType {
        case "matchup":          return "Matchup overview"
        case "model_projection": return "Model projection"
        case "polymarket":       return "Polymarket"
        case "public_betting":   return "Public betting"
        case "injuries":         return "Injuries"
        case "betting_trends":   return "Betting trends"
        case "weather":          return "Weather"
        default:                 return widget.widgetType
            .replacingOccurrences(of: "_", with: " ")
            .capitalized
        }
    }

    private var headerIcon: String {
        switch widget.widgetType {
        case "matchup":          return "rectangle.split.2x1.fill"
        case "model_projection": return "wand.and.stars"
        case "polymarket":       return "chart.line.uptrend.xyaxis"
        case "public_betting":   return "person.2.fill"
        case "injuries":         return "cross.fill"
        case "betting_trends":   return "chart.bar.fill"
        case "weather":          return "cloud.sun.fill"
        default:                 return "chart.bar.doc.horizontal.fill"
        }
    }

    // MARK: - Body (widget-specific KV grid)

    /// Decode the widget's `data` envelope and render the most relevant
    /// rows for the widget kind. Falls back to a generic top-level k/v
    /// scan when the type is unknown so new widget kinds at least render
    /// something useful while the iOS side catches up.
    @ViewBuilder
    private var widgetBody: some View {
        if let data = widget.dataJSON,
           let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            switch widget.widgetType {
            case "model_projection":
                modelProjectionRows(obj)
            case "polymarket":
                polymarketRows(obj)
            case "public_betting":
                publicBettingRows(obj)
            case "injuries":
                injuriesRows(obj)
            case "betting_trends":
                trendsRows(obj)
            case "weather":
                weatherRows(obj)
            case "matchup":
                matchupRows(obj)
            default:
                genericRows(obj)
            }
        }
    }

    // MARK: - Rendering helpers (per widget kind)

    @ViewBuilder
    private func modelProjectionRows(_ obj: [String: Any]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let pick = obj["spread_pick"] as? String {
                kvRow("Spread pick", pick)
            }
            if let prob = obj["ml_prob"] as? Double {
                kvRow("Moneyline", String(format: "%.1f%%", prob * 100))
            }
            if let ouPick = obj["ou_pick"] as? String {
                let ouLine = obj["over_under"] as? Double
                kvRow("Total", ouLine.map { "\(ouPick) \(String(format: "%.1f", $0))" } ?? ouPick.capitalized)
            }
            if let edge = obj["spread_edge"] as? Double {
                kvRow("Edge", String(format: "%+.1f pts", edge))
            }
        }
    }

    @ViewBuilder
    private func polymarketRows(_ obj: [String: Any]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let home = obj["home_implied_prob"] as? Double {
                kvRow("Home implied", String(format: "%.1f%%", home * 100))
            }
            if let away = obj["away_implied_prob"] as? Double {
                kvRow("Away implied", String(format: "%.1f%%", away * 100))
            }
            if let volume = obj["volume_usd"] as? Double {
                kvRow("Volume", String(format: "$%.0fK", volume / 1000))
            }
        }
    }

    @ViewBuilder
    private func publicBettingRows(_ obj: [String: Any]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let pct = obj["home_bet_pct"] as? Double {
                kvRow("Home bet %", String(format: "%.0f%%", pct))
            }
            if let pct = obj["away_bet_pct"] as? Double {
                kvRow("Away bet %", String(format: "%.0f%%", pct))
            }
            if let pct = obj["home_money_pct"] as? Double {
                kvRow("Home $", String(format: "%.0f%%", pct))
            }
        }
    }

    @ViewBuilder
    private func injuriesRows(_ obj: [String: Any]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let list = obj["players"] as? [[String: Any]] {
                ForEach(Array(list.prefix(4).enumerated()), id: \.offset) { _, p in
                    let name = (p["name"] as? String) ?? ""
                    let status = (p["status"] as? String) ?? ""
                    kvRow(name, status)
                }
            }
        }
    }

    @ViewBuilder
    private func trendsRows(_ obj: [String: Any]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(obj.prefix(5)), id: \.key) { (key, value) in
                kvRow(humanize(key), stringify(value))
            }
        }
    }

    @ViewBuilder
    private func weatherRows(_ obj: [String: Any]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let temp = obj["temperature"] as? Double {
                kvRow("Temperature", "\(Int(temp))°F")
            }
            if let wind = obj["wind_speed"] as? Double {
                kvRow("Wind", "\(Int(wind)) mph")
            }
            if let cond = obj["conditions"] as? String {
                kvRow("Conditions", cond)
            }
        }
    }

    @ViewBuilder
    private func matchupRows(_ obj: [String: Any]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let away = obj["away_team"] as? String,
               let home = obj["home_team"] as? String {
                kvRow("Matchup", "\(away) @ \(home)")
            }
            if let time = obj["game_time"] as? String {
                kvRow("Time", time)
            }
            if let venue = obj["venue"] as? String {
                kvRow("Venue", venue)
            }
        }
    }

    @ViewBuilder
    private func genericRows(_ obj: [String: Any]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(obj.prefix(5)), id: \.key) { (key, value) in
                kvRow(humanize(key), stringify(value))
            }
        }
    }

    private func kvRow(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(ui.mutedText)
            Spacer(minLength: 8)
            Text(value)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(ui.primaryText)
                .multilineTextAlignment(.trailing)
                .lineLimit(2)
        }
    }

    private var footer: some View {
        HStack(spacing: 6) {
            Spacer(minLength: 0)
            Text("View game details")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(ui.accent)
            Image(systemName: "arrow.up.right")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(ui.accent)
        }
    }

    // MARK: - Helpers

    private func humanize(_ key: String) -> String {
        key.replacingOccurrences(of: "_", with: " ").capitalized
    }

    private func stringify(_ value: Any) -> String {
        if let s = value as? String { return s }
        if let n = value as? NSNumber { return n.stringValue }
        if let b = value as? Bool { return b ? "Yes" : "No" }
        if let arr = value as? [Any] { return "\(arr.count) items" }
        if let _ = value as? [String: Any] { return "..." }
        return String(describing: value)
    }
}
