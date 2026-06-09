import SwiftUI
import WagerproofDesign
import WagerproofModels

/// One game's player-prop matchup card. Ports the RN `PropMatchupCard`
/// (Scope A): both starting pitchers (archetype + K/GB/FB), then each team's
/// batting order with the batter's headline posted prop + L10 hit rate.
/// Tapping any player opens the existing `PlayerPropDetailView` (deep splits +
/// line scrubber). Restyled to the MLB feed card shell (cornerRadius-26 glass).
struct PropMatchupCardView: View {
    let matchup: MLBPropMatchup
    /// Precomputed per-player feed items (headline prop + detail selection),
    /// keyed by playerId — built once for the whole slate by the parent.
    let itemsByPlayer: [Int: PlayerPropFeedItem]
    let onSelect: (PlayerPropSelection) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header
            startersRow
            Divider().overlay(Color.appBorder.opacity(0.5))
            lineupSection(title: "\(matchup.awayAbbr) Lineup", rows: matchup.awayLineup)
            lineupSection(title: "\(matchup.homeAbbr) Lineup", rows: matchup.homeLineup)
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(.ultraThinMaterial))
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text("\(MLBFormatting.dateLabel(matchup.officialDate)) · \(MLBFormatting.gameTime(matchup.gameTimeEt))".uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
                Text("\(matchup.awayAbbr) @ \(matchup.homeAbbr)")
                    .font(.system(size: 18, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
            }
            Spacer(minLength: 8)
            Label(matchup.gameIsDay ? "Day" : "Night", systemImage: matchup.gameIsDay ? "sun.max.fill" : "moon.stars.fill")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(matchup.gameIsDay ? Color.appAccentAmber : Color.appAccentBlue)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background((matchup.gameIsDay ? Color.appAccentAmber : Color.appAccentBlue).opacity(0.12), in: Capsule())
        }
    }

    // MARK: - Starters

    private var startersRow: some View {
        HStack(alignment: .top, spacing: 8) {
            starterColumn(matchup.awayStarter, teamName: matchup.awayTeamName, alignment: .leading)
            Text("VS")
                .font(.system(size: 11, weight: .heavy))
                .foregroundStyle(Color.appTextMuted)
                .padding(.top, 18)
            starterColumn(matchup.homeStarter, teamName: matchup.homeTeamName, alignment: .trailing)
        }
    }

    private func starterColumn(_ starter: MLBPropStarter, teamName: String, alignment: HorizontalAlignment) -> some View {
        let item = itemsByPlayer[starter.pitcherId]
        let meta = MLBPitcherArchetypes.displayMeta(starter.archetype?.archetype)
        return Button {
            if let sel = item?.selection { onSelect(sel) }
        } label: {
            VStack(alignment: alignment, spacing: 4) {
                PlayerHeadshot(playerId: starter.pitcherId, size: 40)
                Text("\(starter.name) (\(starter.hand)HP)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                if let meta {
                    Text("\(meta.icon) \(meta.label)")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color(hex: Int(meta.colorHex)))
                        .lineLimit(1)
                }
                if let arch = starter.archetype {
                    Text(starterStats(arch))
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.appTextSecondary)
                }
                if let item {
                    propPill(item.headline)
                }
            }
            .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(item == nil)
    }

    private func starterStats(_ arch: MLBPitcherArchetypeProfile) -> String {
        var parts: [String] = []
        if let k = arch.kPct { parts.append("K \(Int(k.rounded()))%") }
        if let gb = arch.gbPct { parts.append("GB \(Int(gb.rounded()))%") }
        if let fb = arch.fbPct { parts.append("FB \(Int(fb.rounded()))%") }
        return parts.joined(separator: " · ")
    }

    // MARK: - Lineups

    @ViewBuilder
    private func lineupSection(title: String, rows: [MLBLineupRow]) -> some View {
        if !rows.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text(title.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.6)
                    .foregroundStyle(Color.appTextSecondary)
                ForEach(rows.sorted { ($0.battingOrder ?? 99) < ($1.battingOrder ?? 99) }) { row in
                    lineupRow(row)
                }
            }
        }
    }

    private func lineupRow(_ row: MLBLineupRow) -> some View {
        let item = itemsByPlayer[row.playerId]
        return Button {
            if let sel = item?.selection { onSelect(sel) }
        } label: {
            HStack(spacing: 8) {
                Text(row.battingOrder.map { "\($0)." } ?? "•")
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.appTextMuted)
                    .frame(width: 20, alignment: .leading)
                VStack(alignment: .leading, spacing: 1) {
                    Text(row.playerName)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                    if let pos = row.position {
                        Text("\(pos)\(row.batSide.map { " · \($0)HB" } ?? "")")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(Color.appTextMuted)
                    }
                }
                Spacer(minLength: 4)
                if let item {
                    propPill(item.headline)
                } else {
                    Text("—")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.appTextMuted)
                }
            }
            .padding(.vertical, 5)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(item == nil)
    }

    // MARK: - Prop pill

    private func propPill(_ headline: MLBHeadlineProp) -> some View {
        let l10 = headline.computed.l10
        let pct = l10.games > 0 ? Double(l10.over) / Double(l10.games) : 0
        let tint: Color = l10.games == 0 ? .appTextMuted : (pct >= 0.6 ? .appWin : (pct <= 0.4 ? .appLoss : .appTextSecondary))
        return HStack(spacing: 4) {
            Text("\(MLBPlayerProps.marketLabel(headline.row.market)) O \(MLBPlayerProps.formatLine(headline.computed.line))")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
            Text(l10.fractionLabel)
                .font(.system(size: 10, weight: .heavy, design: .monospaced))
                .foregroundStyle(tint)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(tint.opacity(0.12), in: Capsule())
        .overlay(Capsule().stroke(Color.appBorder.opacity(0.5), lineWidth: 0.5))
    }
}
