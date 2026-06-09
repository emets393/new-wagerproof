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
            // Matchup as plain text — sport-aware team logos arrive with #008.
            Text(pick.matchup)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)

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

            Text(pick.pickSelection)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)

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
