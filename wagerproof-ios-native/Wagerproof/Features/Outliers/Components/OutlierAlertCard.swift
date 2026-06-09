import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Full-width alert card used inside the detail views (Value Alerts, Fade
/// Alerts). Ports the inline `renderValueAlertCard` / `renderFadeAlertCard`
/// from `wagerproof-mobile/app/(drawer)/(tabs)/outliers.tsx` lines 885–1067.
///
/// Header row: sport pill, optional time pill, market-type pill, percentage
/// pill. Below: matchup row (avatars + abbrevs). Body: descriptive text.
/// Fade variant adds a "Consider the Fade" inset box.
struct OutlierAlertCard: View {
    enum Kind {
        case value(OutlierValueAlert)
        case fade(OutlierFadeAlert)
    }

    let kind: Kind
    var onTap: () -> Void = {}

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 10) {
                headerPills
                matchupRow
                bodyText
                if case .fade(let alert) = kind {
                    fadeBox(for: alert)
                    fadeReason(for: alert)
                }
            }
            .padding(14)
            .background(backgroundColor)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(borderColor, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    // MARK: Header

    private var headerPills: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                sportPill
                if let timeText = gameTimeText { timePill(timeText) }
                marketPill
                accentPill
            }
            linesRow
        }
    }

    private var sportPill: some View {
        HStack(spacing: 4) {
            Image(systemName: sportSymbol)
                .font(.system(size: 11, weight: .semibold))
            Text(sport.rawValue.uppercased())
                .font(.system(size: 11, weight: .bold))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(sportColor.opacity(0.15))
        .foregroundStyle(sportColor)
        .clipShape(Capsule())
    }

    private func timePill(_ text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: "clock")
                .font(.system(size: 10, weight: .semibold))
            Text(text)
                .font(.system(size: 11, weight: .semibold))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.appSurfaceMuted)
        .foregroundStyle(Color.appTextSecondary)
        .clipShape(Capsule())
    }

    private var marketPill: some View {
        Text(marketLabel)
            .font(.system(size: 11, weight: .bold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(accent.opacity(0.2))
            .foregroundStyle(accent)
            .clipShape(Capsule())
    }

    private var accentPill: some View {
        HStack(spacing: 4) {
            Image(systemName: accentPillIcon)
                .font(.system(size: 10, weight: .bold))
            Text(accentPillText)
                .font(.system(size: 11, weight: .bold))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(accent)
        .foregroundStyle(.white)
        .clipShape(Capsule())
    }

    @ViewBuilder
    private var linesRow: some View {
        let g = game
        let pills: [(String, String)] = {
            var out: [(String, String)] = []
            if let s = g.homeSpread { out.append(("Spread", formatSpread(s))) }
            if let t = g.totalLine { out.append(("O/U", String(format: "%g", t))) }
            if g.awayMl != nil || g.homeMl != nil {
                let aml = g.awayMl.map(formatMoneyline) ?? "-"
                let hml = g.homeMl.map(formatMoneyline) ?? "-"
                out.append(("ML", "\(aml)/\(hml)"))
            }
            return out
        }()
        if !pills.isEmpty {
            HStack(spacing: 6) {
                ForEach(pills, id: \.0) { p in
                    Text("\(p.0): \(p.1)")
                        .font(.system(size: 11, weight: .semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.appSurfaceMuted)
                        .foregroundStyle(Color.appTextSecondary)
                        .clipShape(Capsule())
                }
            }
        }
    }

    // MARK: Body

    private var matchupRow: some View {
        HStack(spacing: 8) {
            teamCell(name: game.awayTeam, logo: game.awayTeamLogo, abbrev: game.awayTeamAbbrev)
            Text("@")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
            teamCell(name: game.homeTeam, logo: game.homeTeamLogo, abbrev: game.homeTeamAbbrev)
            Spacer()
        }
    }

    private func teamCell(name: String, logo: String?, abbrev: String?) -> some View {
        HStack(spacing: 6) {
            ZStack {
                Circle().fill(Color.appSurfaceMuted)
                if let urlString = logo, let url = URL(string: urlString) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let img): img.resizable().scaledToFit().padding(2)
                        default: Text(OutlierTeamPalette.initials(for: name))
                            .font(.system(size: 11, weight: .bold))
                        }
                    }
                } else {
                    Text(abbrev ?? OutlierTeamPalette.initials(for: name))
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                }
            }
            .frame(width: 28, height: 28)

            Text(abbrev ?? OutlierTeamPalette.initials(for: name))
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
        }
    }

    @ViewBuilder
    private var bodyText: some View {
        switch kind {
        case .value(let alert):
            (
                Text(alert.side).bold().foregroundColor(Color.appTextPrimary)
                + Text(alert.marketType == .moneyline
                       ? " - Strong \(Int(alert.percentage))% consensus"
                       : " - \(Int(alert.percentage))% suggests line hasn't adjusted")
            )
            .font(.system(size: 13))
            .foregroundStyle(Color.appTextSecondary)
        case .fade(let alert):
            (
                Text(alert.predictedTeam).bold().foregroundColor(Color.appTextPrimary)
                + Text(" — Model confidence \(alert.confidence)\(alert.sport == .nfl ? "%" : "pt") on \(alert.pickType.rawValue)")
            )
            .font(.system(size: 13))
            .foregroundStyle(Color.appTextSecondary)
        }
    }

    private func fadeBox(for alert: OutlierFadeAlert) -> some View {
        let (fadePick, fadeSpread) = computeFadePick(for: alert)
        return VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: "arrow.left.arrow.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color(hex: 0x22C55E))
                Text("Consider the Fade")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color(hex: 0x22C55E))
            }
            HStack(spacing: 4) {
                Text("Bet ")
                    .foregroundStyle(Color.appTextSecondary)
                Text("\(fadePick) \(fadeSpread)")
                    .foregroundStyle(Color(hex: 0x22C55E))
                    .fontWeight(.bold)
            }
            .font(.system(size: 13))
        }
        .padding(10)
        .background(Color(hex: 0x22C55E).opacity(0.1))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(Color(hex: 0x22C55E).opacity(0.3), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func fadeReason(for alert: OutlierFadeAlert) -> some View {
        Text("Model shows \(alert.confidence)\(alert.sport == .nfl ? "%" : "pt edge") on \(alert.predictedTeam) — historically profitable to fade")
            .font(.system(size: 12))
            .foregroundStyle(Color.appTextSecondary)
    }

    // MARK: Derived

    private var game: OutlierGame {
        switch kind {
        case .value(let v): return v.game
        case .fade(let f): return f.game
        }
    }

    private var sport: SportLeague {
        switch kind {
        case .value(let v): return v.sport
        case .fade(let f): return f.sport
        }
    }

    private var sportSymbol: String {
        switch sport {
        case .nfl: return "football.fill"
        case .cfb: return "graduationcap.fill"
        case .nba: return "basketball.fill"
        case .ncaab: return "basketball.fill"
        case .mlb: return "baseball.fill"
        }
    }

    private var sportColor: Color {
        switch sport {
        case .nfl: return Color(hex: 0x013369)
        case .cfb: return Color(hex: 0xC8102E)
        case .nba: return Color(hex: 0x1D428A)
        case .ncaab: return Color(hex: 0xF58426)
        case .mlb: return Color(hex: 0x002D72)
        }
    }

    private var marketLabel: String {
        switch kind {
        case .value(let v): return v.marketType.rawValue
        case .fade(let f): return f.pickType.rawValue
        }
    }

    private var accent: Color {
        switch kind {
        case .value: return Color(hex: 0x22C55E)
        case .fade: return Color(hex: 0xF59E0B)
        }
    }

    private var accentPillIcon: String {
        switch kind {
        case .value: return "percent"
        case .fade: return "bolt.fill"
        }
    }

    private var accentPillText: String {
        switch kind {
        case .value(let v): return "\(Int(v.percentage))%"
        case .fade: return "FADE"
        }
    }

    private var backgroundColor: Color {
        accent.opacity(0.1)
    }

    private var borderColor: Color {
        accent.opacity(0.3)
    }

    private var gameTimeText: String? {
        Self.formatGameTime(game.gameTime)
    }

    private static func formatGameTime(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = iso.date(from: raw)
        if date == nil {
            iso.formatOptions = [.withInternetDateTime]
            date = iso.date(from: raw)
        }
        guard let d = date else { return nil }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "EEE h:mm a"
        return f.string(from: d)
    }

    private func formatSpread(_ s: Double) -> String {
        s > 0 ? "+\(String(format: "%g", s))" : String(format: "%g", s)
    }

    private func formatMoneyline(_ m: Int) -> String {
        m > 0 ? "+\(m)" : "\(m)"
    }

    private func computeFadePick(for alert: OutlierFadeAlert) -> (String, String) {
        switch alert.pickType {
        case .spread:
            let isModelOnHome = alert.predictedTeam == alert.homeTeam
            let fadeTeam = isModelOnHome ? alert.awayTeam : alert.homeTeam
            let fadeSpread = isModelOnHome ? alert.game.awaySpread : alert.game.homeSpread
            return (fadeTeam, fadeSpread.map { formatSpread($0) } ?? "")
        case .total:
            let pick = alert.predictedTeam == "Over" ? "Under" : "Over"
            let total = alert.game.totalLine.map { String(format: "%g", $0) } ?? ""
            return (pick, total)
        }
    }
}
