import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Canonical display config per Perfect Storm tier — keeps iOS in lockstep
/// with web/RN `TIER_DISPLAY`. Unknown tiers fall back to watch styling.
enum PerfectStormTierDisplay {
    struct Config {
        let badge: String
        let cardLabel: String
        let color: Color
    }

    static func config(for tier: MLBPerfectStormTier) -> Config {
        switch tier {
        case .hammer: return .init(badge: "PERFECT STORM HAMMER", cardLabel: "Hammer Record", color: Regression.hammerPurple)
        case .ps: return .init(badge: "PERFECT STORM", cardLabel: "Perfect Storm Record", color: Regression.winGreen)
        case .lean: return .init(badge: "STRONG LEAN", cardLabel: "Lean Record", color: Regression.accentBlue)
        case .watch: return .init(badge: "WATCH", cardLabel: "Watch Record", color: Regression.warnAmber)
        }
    }

    static func config(forRaw raw: String?) -> Config {
        config(for: raw.flatMap(MLBPerfectStormTier.init(rawValue:)) ?? .watch)
    }
}

// MARK: - Tier records grid (2x2, always shown above the pick cards)

/// Season-to-date record card per tier — visible even on days with zero
/// qualifying picks so the track record is always on screen.
struct PerfectStormTierRecordsGrid: View {
    let records: MLBPerfectStormRecords

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            ForEach(MLBPerfectStormTier.allCases, id: \.self) { tier in
                card(records.record(for: tier), config: PerfectStormTierDisplay.config(for: tier))
            }
        }
    }

    private func card(_ record: MLBPerfectStormRecord, config: PerfectStormTierDisplay.Config) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(config.cardLabel.uppercased())
                .font(.system(size: 9, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(config.color)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(record.recordString)
                    .font(.system(size: 15, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Color.appTextPrimary)
                Text(record.winPct.map { Regression.trimmed($0) + "%" } ?? "—")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.appTextSecondary)
            }
            Text(record.roiPct.map { Regression.signed($0, decimals: 1) + "% ROI" } ?? "—")
                .font(.system(size: 10))
                .foregroundStyle((record.roiPct ?? 0) >= 0 ? Regression.winGreen : Regression.lossRed)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 6)
        .padding(.horizontal, 10)
        .background(config.color.opacity(0.05), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(config.color.opacity(0.33), lineWidth: 1))
    }
}

// MARK: - Pick card (one suggested pick)

/// One Regression Report suggested pick: tier badge, matchup with logos,
/// edge/bucket stats, per-pick model-alignment context, reasoning quote.
/// Tier color is the only conviction signal — the legacy HIGH/MODERATE
/// confidence badge was removed because it could contradict the tier.
struct PerfectStormPickCard: View {
    let pick: MLBSuggestedPick
    let reportDate: String
    let breakdownRows: [MLBModelBreakdownRow]

    private var tier: PerfectStormTierDisplay.Config {
        PerfectStormTierDisplay.config(forRaw: pick.perfectStormTier)
    }

    var body: some View {
        RegressionAccentRow(color: tier.color, dim: pick.locked ?? false) {
            VStack(alignment: .leading, spacing: 0) {
                tierPill
                headerRow.padding(.top, 6)
                matchupRow.padding(.top, 3)

                HStack(spacing: 10) {
                    RegressionStat(label: "EDGE", value: edgeText)
                    RegressionStat(label: "BUCKET", value: pick.edgeBucket)
                }
                .padding(.top, 10)

                if let box = alignmentBox {
                    box.padding(.top, 10)
                }

                if let reasoning = pick.reasoning, !reasoning.isEmpty {
                    reasoningQuote(reasoning).padding(.top, 10)
                }

                footer.padding(.top, 10)
            }
        }
    }

    private var tierPill: some View {
        HStack(spacing: 4) {
            Image(systemName: "bolt.fill")
                .font(.system(size: 9, weight: .bold))
            Text(tier.badge)
                .font(.system(size: 9, weight: .heavy))
                .tracking(0.6)
        }
        .foregroundStyle(Color(hex: 0x0A0A0A))
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(tier.color, in: Capsule())
    }

    private var headerRow: some View {
        HStack(alignment: .top, spacing: 8) {
            Text(pick.pick)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(2)
            Spacer(minLength: 0)
            if let time = Regression.gameTimeET(pick.gameTimeEt) {
                HStack(spacing: 3) {
                    Image(systemName: "clock")
                        .font(.system(size: 10, weight: .semibold))
                    Text(time)
                        .font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(Color.appTextSecondary)
            }
        }
    }

    private var matchupRow: some View {
        HStack(spacing: 6) {
            teamBadge(pick.awayTeam)
            Text("@")
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
            teamBadge(pick.homeTeam)

            // Badge BOTH games of a doubleheader; game_number >= 2 is the
            // fallback for picks generated before is_doubleheader existed.
            if pick.isDoubleheader == true || (pick.gameNumber ?? 1) >= 2 {
                Text("GAME \(pick.gameNumber ?? 1) of DH")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.4)
                    .foregroundStyle(Regression.warnAmber)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .background(Regression.warnAmber.opacity(0.18), in: RoundedRectangle(cornerRadius: 4))
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Regression.warnAmber.opacity(0.4), lineWidth: 1))
            }
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private func teamBadge(_ teamName: String) -> some View {
        let abbr = MLBPickAlignment.teamNameToGameLogAbbr(teamName)
        HStack(spacing: 5) {
            if let urlString = MLBAbbrLogo.url(forAbbr: abbr), let url = URL(string: urlString) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFit()
                } placeholder: {
                    Color.clear
                }
                .frame(width: 16, height: 16)
            }
            Text(abbr ?? teamName)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
        }
    }

    private var edgeText: String {
        let sign = pick.edgeAtSuggestion > 0 ? "+" : ""
        let suffix = pick.betType.contains("ml") ? "%" : ""
        return sign + Regression.trimmed(pick.edgeAtSuggestion) + suffix
    }

    // MARK: Alignment context

    private var alignmentBox: AnyView? {
        // Older picks lack game_time_et — fall back to the report date so
        // the day-of-week lookup still works.
        let align = MLBPickAlignment.compute(
            betType: pick.betType,
            pick: pick.pick,
            homeTeam: pick.homeTeam,
            awayTeam: pick.awayTeam,
            gameTimeEt: pick.gameTimeEt ?? reportDate,
            rows: breakdownRows
        )
        if align.level == .neutral && align.dow == nil && align.teams.isEmpty { return nil }

        let display = alignmentDisplay(align.level)
        // RN always reads "{dowLabel} data unavailable"; dowLabel is only nil
        // when both game_time_et and report_date fail to parse (edge case).
        let dowLine = formatAlignmentRow(label: "Day trend", row: align.dow,
                                         fallback: "\(align.dowLabel.map { "\($0) " } ?? "")data unavailable")
        let teamLines = align.teams.map {
            formatAlignmentRow(label: "Team", row: $0, fallback: "Unavailable")
                .replacingOccurrences(of: "Team: ", with: "")
        }

        return AnyView(
            VStack(alignment: .leading, spacing: 4) {
                Text("\(display.emoji) \(display.label)")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(display.color)
                Text("Model context: this compares this pick to historical win rate and ROI for the same bet type.")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.appTextSecondary)
                Text(dowLine)
                    .font(.system(size: 11))
                    .foregroundStyle(Color.appTextSecondary)
                Text("Team Trends")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
                if teamLines.isEmpty {
                    Text("No team trend data available for this pick")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.appTextSecondary)
                } else {
                    ForEach(Array(teamLines.enumerated()), id: \.offset) { _, line in
                        Text(line)
                            .font(.system(size: 11))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }
                Text("Higher Win% and positive ROI strengthen alignment; weak trends lower confidence.")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.appTextSecondary)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(display.color.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(display.color.opacity(0.33), lineWidth: 1))
        )
    }

    private func alignmentDisplay(_ level: MLBPickAlignmentLevel) -> (label: String, emoji: String, color: Color) {
        switch level {
        case .strong: return ("Strong alignment", "★", Color(hex: 0x22C55E))
        case .aligned: return ("Aligned", "✓", Color(hex: 0x86EFAC))
        case .neutral: return ("Neutral", "·", Color(hex: 0x94A3B8))
        case .mixed: return ("Mixed signals", "~", Color(hex: 0xFACC15))
        case .concern: return ("Concerning trends", "⚠", Color(hex: 0xEF4444))
        }
    }

    private func formatAlignmentRow(label: String, row: MLBModelBreakdownRow?, fallback: String) -> String {
        guard let row else { return "\(label): \(fallback)" }
        let record = "\(row.wins)-\(row.losses)" + (row.pushes > 0 ? "-\(row.pushes)" : "")
        let roi = (row.roiPct > 0 ? "+" : "") + Regression.trimmed(row.roiPct) + "%"
        return "\(label): \(row.breakdownValue) • \(record) • \(Regression.trimmed(row.winPct))% W • \(roi) ROI"
    }

    // MARK: Reasoning + footer

    private func reasoningQuote(_ reasoning: String) -> some View {
        Text(reasoning)
            .font(.system(size: 12))
            .lineSpacing(3)
            .foregroundStyle(Color.appTextPrimary)
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.appSurfaceMuted.opacity(0.5))
            .overlay(alignment: .leading) {
                Rectangle().fill(tier.color).frame(width: 2)
            }
            .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    private var footer: some View {
        HStack(spacing: 6) {
            Text(Regression.betTypeLabel(pick.betType))
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(tier.color)
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(tier.color.opacity(0.1), in: RoundedRectangle(cornerRadius: 5))
            if pick.locked == true {
                HStack(spacing: 3) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 9))
                    Text("LOCKED")
                        .font(.system(size: 9, weight: .bold))
                        .tracking(0.5)
                }
                .foregroundStyle(Color.appTextSecondary)
            }
            Spacer(minLength: 0)
        }
    }
}
