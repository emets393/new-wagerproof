import Foundation
import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Compact, "bet slip" style row used in lists (today's picks, history,
/// generation results). Ports `components/agents/AgentPickItem.tsx`.
///
/// The RN component pulls in per-sport team-color/team-abbreviation helpers
/// (`teamColors.ts` + NCAAB mapping hooks). The Swift app doesn't yet have a
/// centralized team-color library (tracked by ticket #008), so we fall back
/// to neutral gradient borders here — the rest of the visual rhythm matches.
struct AgentPickItem: View {
    let pick: AgentPick
    var showReasoning: ReasoningMode = .none
    var loading: Bool = false
    var onTap: (() -> Void)? = nil

    enum ReasoningMode {
        case none
        case summary
        case full
    }

    var body: some View {
        Button(action: { onTap?() }) {
            VStack(spacing: 0) {
                accentTopBorder
                content
            }
            .background(Color.appBorder.opacity(0.2))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                if loading {
                    ZStack {
                        Color.black.opacity(0.35)
                        ProgressView()
                            .tint(.white)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(loading || onTap == nil)
    }

    // MARK: - Top accent border

    private var accentTopBorder: some View {
        LinearGradient(
            colors: pickAccentColors,
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(height: 3)
    }

    /// Neutral 4-stop gradient when the team-color library isn't wired yet.
    /// Once ticket #008 lands, swap with per-team brand colors.
    private var pickAccentColors: [Color] {
        [
            Color(hex: 0x4F46E5),
            Color(hex: 0x06B6D4),
            Color(hex: 0x10B981),
            Color(hex: 0xF59E0B)
        ]
    }

    // MARK: - Content

    private var content: some View {
        VStack(alignment: .leading, spacing: 10) {
            headerRow
            pickPill
            if showReasoning != .none, !pick.reasoningText.isEmpty {
                reasoningSection
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }

    private var headerRow: some View {
        HStack(spacing: 8) {
            matchupTitle

            Spacer(minLength: 0)

            HStack(spacing: 6) {
                dateBadge
                if let badge = resultBadge {
                    badgeView(badge)
                }
            }
        }
    }

    private var dateBadge: some View {
        HStack(spacing: 3) {
            Image(systemName: "clock")
                .font(.system(size: 10))
            Text(Self.formatGameDate(pick.gameDate))
                .font(.system(size: 10, weight: .semibold))
        }
        .foregroundStyle(Color.appTextSecondary)
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(
            Capsule().fill(Color.appBorder.opacity(0.5))
        )
    }

    private var pickPill: some View {
        HStack(spacing: 10) {
            // Icon: arrow for over/under, default chevron otherwise.
            ZStack {
                Circle().fill(pickPillIcon.bg)
                Image(systemName: pickPillIcon.symbol)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 30, height: 30)

            pickSelectionDisplay

            Spacer(minLength: 4)

            if let odds = pick.odds, !odds.isEmpty {
                Text(odds)
                    .font(.system(size: 13, weight: .heavy, design: .monospaced))
                    .foregroundStyle(Color.appTextPrimary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule().fill(Color.appBorder.opacity(0.6))
                    )
            }

            Text(String(format: "%.0fu", pick.units))
                .font(.system(size: 13, weight: .heavy, design: .monospaced))
                .foregroundStyle(Color(hex: 0x3B82F6))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    Capsule().fill(Color(hex: 0x3B82F6).opacity(0.12))
                )
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.appBorder.opacity(0.35))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 1)
        )
    }

    @ViewBuilder
    private var matchupTitle: some View {
        if let teams = parsedMLBMatchup {
            HStack(spacing: 5) {
                compactTeam(team: teams.away, logoSize: 20, textSize: 13)
                Text("@")
                    .font(.system(size: 12, weight: .black))
                    .foregroundStyle(Color.appTextMuted)
                compactTeam(team: teams.home, logoSize: 20, textSize: 13)
            }
            .lineLimit(1)
        } else {
            Text(pick.matchup)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
        }
    }

    @ViewBuilder
    private var pickSelectionDisplay: some View {
        if let compact = compactMLBPick {
            HStack(spacing: 7) {
                compactTeam(team: compact.team, logoSize: 24, textSize: 15)
                Text(compact.label)
                    .font(.system(size: 15, weight: .black, design: .rounded))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
            }
        } else {
            Text(pick.pickSelection)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.78)
        }
    }

    @ViewBuilder
    private func compactTeam(team: MLBPickTeam, logoSize: CGFloat, textSize: CGFloat) -> some View {
        HStack(spacing: 4) {
            MLBTeamLogo(logoUrl: team.logoUrl, abbrev: team.abbr, name: team.name, size: logoSize)
            Text(team.abbr)
                .font(.system(size: textSize, weight: .black))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.82)
        }
        .fixedSize(horizontal: true, vertical: false)
    }

    @ViewBuilder
    private var reasoningSection: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("SUMMARY")
                .font(.system(size: 11, weight: .heavy))
                .tracking(1)
                .foregroundStyle(Color.appTextSecondary)
            Text(pick.reasoningText)
                .font(.system(size: 14))
                .lineLimit(showReasoning == .summary ? 2 : nil)
                .foregroundStyle(Color.appTextSecondary)
            if showReasoning == .full, let factors = pick.keyFactors, !factors.isEmpty {
                Text("KEY FACTORS")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(1)
                    .foregroundStyle(Color.appTextSecondary)
                    .padding(.top, 8)
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(factors.enumerated()), id: \.offset) { _, factor in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Circle().fill(Color(hex: 0x3B82F6)).frame(width: 5, height: 5)
                                .alignmentGuide(.firstTextBaseline) { d in d[.bottom] - 4 }
                            Text(factor)
                                .font(.system(size: 14))
                                .foregroundStyle(Color.appTextSecondary)
                        }
                    }
                }
            }
        }
        .padding(.top, 6)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.appBorder.opacity(0.4)).frame(height: 1)
        }
    }

    // MARK: - Result badge

    private struct ResultBadge {
        let symbol: String
        let label: String
        let color: Color
    }

    private var resultBadge: ResultBadge? {
        switch pick.result {
        case .won:
            return ResultBadge(symbol: "checkmark", label: "WIN", color: Color(hex: 0x22C55E))
        case .lost:
            return ResultBadge(symbol: "xmark", label: "LOSS", color: Color(hex: 0xEF4444))
        case .push:
            return ResultBadge(symbol: "minus", label: "PUSH", color: Color(hex: 0xEAB308))
        case .pending:
            return nil
        }
    }

    private func badgeView(_ badge: ResultBadge) -> some View {
        HStack(spacing: 3) {
            Image(systemName: badge.symbol)
                .font(.system(size: 10, weight: .bold))
            Text(badge.label)
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.3)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(
            Capsule().fill(badge.color)
        )
    }

    // MARK: - Pick pill icon

    private struct PickIcon {
        let symbol: String
        let bg: Color
    }

    private var pickPillIcon: PickIcon {
        let bt = pick.betType.lowercased()
        let sel = pick.pickSelection.lowercased()
        if bt.contains("total") || bt.contains("over") || bt.contains("under") {
            let isOver = sel.contains("over")
            return PickIcon(
                symbol: isOver ? "arrow.up" : "arrow.down",
                bg: isOver ? Color(hex: 0x22C55E) : Color(hex: 0xEF4444)
            )
        }
        if bt.contains("spread") {
            return PickIcon(symbol: "plusminus", bg: Color(hex: 0x3B82F6))
        }
        if bt.contains("moneyline") || bt.contains("ml") {
            return PickIcon(symbol: "dollarsign", bg: Color(hex: 0x10B981))
        }
        return PickIcon(symbol: "arrow.up.arrow.down", bg: Color.appTextSecondary)
    }

    // MARK: - Helpers

    private static func formatGameDate(_ s: String) -> String {
        if s.isEmpty { return "Pending" }
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        guard let date = df.date(from: s) else { return s }
        let cal = Calendar.current
        if cal.isDateInToday(date) { return "Today" }
        if cal.isDateInTomorrow(date) { return "Tomorrow" }
        let out = DateFormatter()
        out.dateFormat = "MMM d"
        return out.string(from: date)
    }

    // MARK: - Compact MLB labels

    private struct MLBPickTeam {
        let name: String
        let abbr: String
        let logoUrl: String?
    }

    private struct MLBPickMatchup {
        let away: MLBPickTeam
        let home: MLBPickTeam
    }

    private struct CompactMLBPick {
        let team: MLBPickTeam
        let label: String
    }

    private var parsedMLBMatchup: MLBPickMatchup? {
        guard pick.sport == .mlb else { return nil }
        let parts = splitMatchup(pick.matchup)
        guard parts.count == 2 else { return nil }
        return MLBPickMatchup(
            away: mlbPickTeam(named: parts[0]),
            home: mlbPickTeam(named: parts[1])
        )
    }

    private var compactMLBPick: CompactMLBPick? {
        guard pick.sport == .mlb,
              !isTotalPick,
              let matchup = parsedMLBMatchup,
              let team = selectedMLBTeam(from: matchup)
        else { return nil }

        return CompactMLBPick(team: team, label: compactMLBMarketLabel)
    }

    private var isTotalPick: Bool {
        let haystack = "\(pick.betType) \(pick.pickSelection)".lowercased()
        return haystack.contains("total") || haystack.contains("over") || haystack.contains("under")
    }

    private var compactMLBMarketLabel: String {
        let haystack = "\(pick.betType) \(pick.pickSelection)".lowercased()
        let isF5 = haystack.contains("f5") || haystack.contains("first 5") || haystack.contains("first-five")
        let isML = haystack.contains("moneyline") || haystack.contains(" ml")

        if isML {
            return isF5 ? "F5 ML" : "ML"
        }

        if haystack.contains("runline") || haystack.contains("run line") || haystack.contains("spread") {
            let line = extractLine(from: pick.pickSelection) ?? extractLine(from: pick.betType)
            if let line {
                return isF5 ? "\(line) F5" : "\(line) Runline"
            }
            return isF5 ? "F5 RL" : "Runline"
        }

        return pick.pickSelection
    }

    private func selectedMLBTeam(from matchup: MLBPickMatchup) -> MLBPickTeam? {
        let selection = normalized(pick.pickSelection)
        let betType = normalized(pick.betType)
        for team in [matchup.away, matchup.home] where selectionMatches(team, in: selection) || selectionMatches(team, in: betType) {
            return team
        }
        return nil
    }

    private func selectionMatches(_ team: MLBPickTeam, in text: String) -> Bool {
        guard !text.isEmpty else { return false }
        let name = normalized(team.name)
        let abbr = normalized(team.abbr)
        let tokens = name.split(separator: " ").map(String.init)
        let nickname = tokens.last ?? name
        let city = tokens.dropLast().joined(separator: " ")

        return text.contains(name)
            || (!abbr.isEmpty && text.contains(abbr))
            || (!nickname.isEmpty && text.contains(nickname))
            || (!city.isEmpty && text.contains(city))
    }

    private func mlbPickTeam(named raw: String) -> MLBPickTeam {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if let info = MLBTeams.info(for: trimmed) {
            return MLBPickTeam(name: trimmed, abbr: info.team, logoUrl: info.logoUrl)
        }
        return MLBPickTeam(name: trimmed, abbr: fallbackAbbr(trimmed), logoUrl: nil)
    }

    private func splitMatchup(_ matchup: String) -> [String] {
        let separators = [" @ ", " at ", " vs. ", " vs ", " v. ", " v "]
        for separator in separators {
            let parts = matchup.components(separatedBy: separator)
            if parts.count == 2 {
                return parts.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            }
        }
        return []
    }

    private func extractLine(from raw: String) -> String? {
        let pattern = #"([+-]\d+(?:\.\d+)?)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(raw.startIndex..<raw.endIndex, in: raw)
        guard let match = regex.firstMatch(in: raw, range: range),
              let swiftRange = Range(match.range(at: 1), in: raw)
        else { return nil }
        return String(raw[swiftRange])
    }

    private func normalized(_ raw: String) -> String {
        raw.lowercased()
            .replacingOccurrences(of: ".", with: "")
            .replacingOccurrences(of: "-", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func fallbackAbbr(_ name: String) -> String {
        let words = name.split(separator: " ").map(String.init)
        if words.count >= 2 {
            return words.compactMap(\.first).map(String.init).joined().uppercased()
        }
        return String(name.prefix(3)).uppercased()
    }
}

/// Bet-slip skeleton for the pick lists (today's picks + history), shared by
/// the owner and public agent detail screens. Mirrors `AgentPickItem`'s
/// footprint exactly: solid 3pt accent stripe, header row (matchup + date
/// badge), then the pick pill (icon disc + selection + odds/units chips) on its
/// own muted sub-surface. The inner content carries the unified `.shimmering()`
/// sweep; the card chrome stays solid (applied after the shimmer).
struct PickCardSkeleton: View {
    var body: some View {
        VStack(spacing: 0) {
            // Muted accent stripe — same 3pt top border the real card draws.
            LinearGradient(
                colors: [Color(hex: 0x4F46E5), Color(hex: 0x06B6D4),
                         Color(hex: 0x10B981), Color(hex: 0xF59E0B)],
                startPoint: .leading, endPoint: .trailing
            )
            .frame(height: 3)
            .opacity(0.5)

            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    SkeletonBlock(width: 130, height: 14)   // matchup
                    Spacer(minLength: 0)
                    SkeletonCapsule(width: 58, height: 18)  // date badge
                }
                HStack(spacing: 10) {
                    SkeletonCircle(30)                      // pick icon disc
                    SkeletonBlock(width: 110, height: 15)   // selection
                    Spacer(minLength: 4)
                    SkeletonCapsule(width: 44, height: 22)  // odds chip
                    SkeletonCapsule(width: 34, height: 22)  // units chip
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color.appBorder.opacity(0.25))
                )
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .shimmering()
        }
        .background(Color.appBorder.opacity(0.2))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
