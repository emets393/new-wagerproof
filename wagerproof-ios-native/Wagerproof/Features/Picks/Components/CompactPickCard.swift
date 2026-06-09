import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Compact 1-row pick card. Mirrors RN `CompactPickCard.tsx`:
/// left accent bar (result-tinted) → team logos + abbreviations + time →
/// pick icon + pick value + units → result badge or "Pending" + chevron.
///
/// Result-state styling:
/// - WON   → green accent + border, "+x.xu" + WIN badge
/// - LOST  → red accent + border, "-1.0u" + LOSS badge
/// - PUSH  → amber accent + border, "0.0u" + PUSH badge
/// - else  → primary accent + neutral border, "Pending" badge
struct CompactPickCard: View {
    let pick: EditorPick
    let gameData: EditorPickGameData
    var onTap: () -> Void = {}

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 0) {
                // Left accent bar (4pt wide).
                Rectangle()
                    .fill(accentColor)
                    .frame(width: 4)

                VStack(alignment: .leading, spacing: 8) {
                    headerRow
                    pickRow
                    if !pick.isPublished || (pick.isFreePick ?? false) {
                        badgesRow
                    }
                }
                .padding(.vertical, 12)
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity, alignment: .leading)

                // Chevron indicator.
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
                    .padding(.trailing, 12)
            }
            .background(
                RoundedRectangle(cornerRadius: 16).fill(Color.appSurfaceElevated)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16).stroke(borderColor, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }

    // MARK: - Header row

    @ViewBuilder
    private var headerRow: some View {
        HStack(spacing: 6) {
            TeamLogoBubble(url: gameData.awayLogo, fallbackInitials: initials(gameData.awayTeam))
            Text(abbr(gameData.awayTeam))
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
            Text("@")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.appTextMuted)
                .padding(.horizontal, 1)
            TeamLogoBubble(url: gameData.homeLogo, fallbackInitials: initials(gameData.homeTeam))
            Text(abbr(gameData.homeTeam))
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)

            Spacer(minLength: 4)

            if let time = gameData.gameTime, !time.isEmpty {
                Text(time.replacingOccurrences(of: " EST", with: "").replacingOccurrences(of: " ET", with: ""))
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.appSurfaceMuted, in: Capsule())
            }
        }
    }

    // MARK: - Pick row

    @ViewBuilder
    private var pickRow: some View {
        HStack(spacing: 6) {
            Image(systemName: pickIconName)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(pickIconColor)
            Text(pick.pickValue ?? pick.selectedBetType)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
            if let units = pick.units {
                Image(systemName: "arrow.right")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.appTextMuted)
                Text("\(formatUnits(units))u")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            Spacer(minLength: 4)
            resultTrailing
        }
    }

    @ViewBuilder
    private var resultTrailing: some View {
        if let result = pick.result, result != .pending {
            HStack(spacing: 6) {
                Text(netUnitsText)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(netUnitsColor)
                HStack(spacing: 3) {
                    Image(systemName: resultIconName(result))
                        .font(.system(size: 9, weight: .bold))
                    Text(resultLabel(result))
                        .font(.system(size: 9, weight: .heavy))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(resultBadgeColor(result), in: RoundedRectangle(cornerRadius: 8))
            }
        } else {
            HStack(spacing: 4) {
                Image(systemName: "clock")
                    .font(.system(size: 11))
                Text("Pending")
                    .font(.system(size: 11, weight: .medium))
            }
            .foregroundStyle(Color.appTextSecondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.appSurfaceMuted, in: Capsule())
        }
    }

    @ViewBuilder
    private var badgesRow: some View {
        HStack(spacing: 6) {
            if !pick.isPublished {
                Text("DRAFT")
                    .font(.system(size: 9, weight: .heavy))
                    .foregroundStyle(Color.appAccentAmber)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.appAccentAmber.opacity(0.2), in: RoundedRectangle(cornerRadius: 6))
            }
            if pick.isFreePick == true {
                Text("FREE")
                    .font(.system(size: 9, weight: .heavy))
                    .foregroundStyle(Color.appPrimary)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.appPrimary.opacity(0.2), in: RoundedRectangle(cornerRadius: 6))
            }
        }
    }

    // MARK: - Computed styling

    private var accentColor: Color {
        switch pick.result {
        case .won: return Color.appWin
        case .lost: return Color.appLoss
        case .push: return Color.appAccentAmber
        default: return Color.appPrimary
        }
    }

    private var borderColor: Color {
        switch pick.result {
        case .won: return Color.appWin.opacity(0.4)
        case .lost: return Color.appLoss.opacity(0.4)
        case .push: return Color.appAccentAmber.opacity(0.4)
        default: return Color.appBorder
        }
    }

    private var netUnitsText: String {
        let calc = UnitsCalculation.calculate(result: pick.result, odds: pick.bestPrice, units: pick.units)
        let sign = calc.netUnits > 0 ? "+" : ""
        return "\(sign)\(String(format: "%.1f", calc.netUnits))u"
    }

    private var netUnitsColor: Color {
        let calc = UnitsCalculation.calculate(result: pick.result, odds: pick.bestPrice, units: pick.units)
        if calc.netUnits > 0 { return Color.appWin }
        if calc.netUnits < 0 { return Color.appLoss }
        return Color.appTextSecondary
    }

    private var pickIconName: String {
        // Mirrors RN `getPickTypeIcon` (matches against betType + pickValue text).
        let blob = (pick.selectedBetType + " " + (pick.pickValue ?? "")).lowercased()
        if blob.contains("spread") { return "plusminus" }
        if blob.contains("over") || blob.contains("under") || blob.contains("o/u") || blob.contains("total") {
            return "arrow.up.arrow.down"
        }
        if blob.contains("moneyline") || blob.contains(" ml") { return "dollarsign.circle" }
        return "arrow.up.arrow.down"
    }

    private var pickIconColor: Color {
        let blob = (pick.selectedBetType + " " + (pick.pickValue ?? "")).lowercased()
        if blob.contains("spread") { return Color.appAccentBlue }
        if blob.contains("over") || blob.contains("under") || blob.contains("o/u") || blob.contains("total") {
            return Color.appAccentPurple
        }
        if blob.contains("moneyline") || blob.contains(" ml") { return Color.appPrimary }
        return Color.appTextMuted
    }

    private func resultIconName(_ result: PickResult) -> String {
        switch result {
        case .won: return "checkmark"
        case .lost: return "xmark"
        case .push: return "minus"
        case .pending: return "clock"
        }
    }

    private func resultLabel(_ result: PickResult) -> String {
        switch result {
        case .won: return "WIN"
        case .lost: return "LOSS"
        case .push: return "PUSH"
        case .pending: return "PEND"
        }
    }

    private func resultBadgeColor(_ result: PickResult) -> Color {
        switch result {
        case .won: return Color.appWin
        case .lost: return Color.appLoss
        case .push: return Color.appAccentAmber
        case .pending: return Color.appTextSecondary
        }
    }

    private var accessibilityLabel: String {
        var parts = ["\(gameData.awayTeam) at \(gameData.homeTeam)"]
        if let v = pick.pickValue, !v.isEmpty { parts.append(v) }
        if let u = pick.units { parts.append("\(u) units") }
        if let r = pick.result, r != .pending { parts.append(resultLabel(r)) }
        return parts.joined(separator: ", ")
    }

    // MARK: - Helpers

    private func formatUnits(_ v: Double) -> String {
        if v == v.rounded() { return String(format: "%.0f", v) }
        return String(format: "%.1f", v)
    }

    private func abbr(_ name: String) -> String {
        if name.isEmpty { return "TBD" }
        let words = name.split(separator: " ").map(String.init)
        if words.count <= 1 { return String(name.prefix(3)).uppercased() }
        // Use last word, capped at 4 letters.
        return String(words.last!.prefix(4)).uppercased()
    }

    private func initials(_ name: String) -> String {
        if name.isEmpty { return "?" }
        return String(name.prefix(2)).uppercased()
    }
}

/// 28pt circle with an async-loaded team logo or 2-letter initials fallback.
struct TeamLogoBubble: View {
    let url: String?
    let fallbackInitials: String
    var size: CGFloat = 28

    var body: some View {
        Group {
            if let str = url, let u = URL(string: str), !str.isEmpty {
                AsyncImage(url: u) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFit()
                    default:
                        fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .background(Color.white)
        .clipShape(Circle())
        .overlay(Circle().stroke(Color.appBorder, lineWidth: 1))
    }

    private var fallback: some View {
        Text(fallbackInitials)
            .font(.system(size: size * 0.4, weight: .bold))
            .foregroundStyle(Color.appTextPrimary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.appSurfaceMuted)
    }
}
