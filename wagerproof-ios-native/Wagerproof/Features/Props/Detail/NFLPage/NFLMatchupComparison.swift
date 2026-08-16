import SwiftUI
import WagerproofModels
import WagerproofDesign

/// Matchup widget body — the native `ComparisonBlock`: the player's career
/// production vs his production against the look this opponent plays, then
/// per-game splits vs similar defenses, look hit-rates, and the opponent's
/// defense-usage tiles. All resolution logic lives in `NFLPropSchemeCompare`.
struct NFLMatchupComparison: View {
    let page: NFLPropPlayerPage
    let marketKey: String

    private var opponent: String {
        page.scheme?.opponent ?? page.opponent ?? ""
    }

    private var compare: NFLSchemeCompareResolved? {
        NFLPropSchemeCompare.resolve(page: page, marketKey: marketKey)
    }

    var body: some View {
        let compare = compare
        VStack(alignment: .leading, spacing: 14) {
            if let compare, compare.hasCompare, let overall = compare.overallValue {
                VStack(alignment: .leading, spacing: 18) {
                    ForEach(compare.lookRows, id: \.key) { row in
                        lookRowView(row, compare: compare, overall: overall)
                    }
                }
            } else {
                emptyCompareBox(reason: compare?.emptyReason ?? .missing)
            }

            if let split = NFLPropSchemeCompare.gameSplit(page: page, marketKey: marketKey) {
                gameSplitsBlock(split)
            }

            let hitEntries = NFLPropSchemeCompare.lookHitEntries(page: page, marketKey: marketKey)
            if !hitEntries.isEmpty {
                lookHitRatesBlock(hitEntries)
            }

            let tiles = NFLPropSchemeCompare.defenseTiles(page: page, mode: compare?.mode)
            if !tiles.isEmpty {
                defenseTilesBlock(tiles)
            }
        }
    }

    // MARK: Career vs look rows

    @ViewBuilder
    private func lookRowView(_ row: NFLCompareLookRow, compare: NFLSchemeCompareResolved, overall: Double) -> some View {
        let digits = compare.mode == .receiving ? 1 : 2
        let delta = row.delta ?? (row.value - overall)
        let tone: PropNumberLine.Tone = delta >= row.deltaThreshold ? .up
            : (delta <= -row.deltaThreshold ? .down : .neutral)
        let metricName = compare.mode == .qb ? "EPA per dropback"
            : compare.mode == .rush ? "EPA per rush" : "yards per target"
        let direction = delta > 0 ? "higher" : (delta < 0 ? "lower" : "the same")
        let lookLabel = row.label.replacingOccurrences(of: "vs ", with: "").lowercased()
        // Comparison values sit close together; half the gap keeps both
        // markers on the rail (web SchemeLinearComparison padding).
        let padding = max(compare.mode == .receiving ? 0.1 : 0.01, abs(row.value - overall) * 0.5)
        let fractions = PropNumberLine.fractions(
            primary: row.value, secondary: overall, padding: padding, floorAtZero: false
        )
        let deltaDigits = abs(delta) < 1 ? 2 : 1

        VStack(alignment: .leading, spacing: 6) {
            Text("He produces \(NFLPropFormat.perGame(row.value, digits: digits)) \(metricName) against \(lookLabel), compared with \(NFLPropFormat.perGame(overall, digits: digits)) across his career — \(NFLPropFormat.perGame(abs(delta), digits: deltaDigits)) \(row.unit) \(direction) against the look \(opponent) prefers.")
                .font(.system(size: 13, weight: .semibold))
                .lineSpacing(3)
                .foregroundStyle(Color.appTextPrimary)
                .fixedSize(horizontal: false, vertical: true)

            PropNumberLine(
                primary: PropNumberLineMarker(
                    label: "Vs \(opponent)'s look",
                    value: NFLPropFormat.perGame(row.value, digits: digits),
                    caption: row.unit
                ),
                primaryFraction: fractions.primary,
                secondary: PropNumberLineMarker(
                    label: "Career avg",
                    value: NFLPropFormat.perGame(overall, digits: digits),
                    caption: compare.overallUnit
                ),
                secondaryFraction: fractions.secondary,
                tone: tone,
                deltaText: "\(delta > 0 ? "+" : (delta < 0 ? "-" : ""))\(NFLPropFormat.perGame(abs(delta), digits: deltaDigits)) \(row.unit)",
                leadingCaption: "Lower production",
                trailingCaption: "Higher production",
                primaryValueSize: 15
            )

            HStack(spacing: 8) {
                Text(row.detail)
                if let support = row.support {
                    Text(support)
                }
                if row.sample == "thin" {
                    Text("THIN SAMPLE")
                        .font(.system(size: 8, weight: .black))
                        .foregroundStyle(Color(hex: 0xF59E0B))
                }
            }
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(Color.appTextMuted)
        }
    }

    private func emptyCompareBox(reason: NFLSchemeCompareResolved.EmptyReason) -> some View {
        let title = switch reason {
        case .thin: "Thin sample vs this look"
        case .rookie: "No career scheme split yet"
        default: "No scheme production split for this player yet"
        }
        let lastName = page.playerName.split(separator: " ").last.map(String.init) ?? page.playerName
        let body = switch reason {
        case .rookie: "No NFL sample yet — \(lastName) is listed as a rookie."
        case .thin: "Sample is too thin to compare him to \(opponent)'s scheme yet. Defense mix below is still useful context."
        default: "We need career production vs the looks \(opponent) plays to compare him to that scheme. Below is how often that defense uses each look."
        }
        return VStack(spacing: 4) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            Text(body)
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 16)
        .padding(.vertical, 18)
        .background(Color(hex: 0xF59E0B).opacity(0.05), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color(hex: 0xF59E0B).opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
        )
    }

    // MARK: Per-game splits

    private func gameSplitsBlock(
        _ split: (entry: NFLPropGameSplitEntry, overall: NFLPropGameSplitEntry, statKey: String, bucketLabels: [String])
    ) -> some View {
        let overallV = split.overall.stats[split.statKey]
        let lookV = split.entry.stats[split.statKey]
        let delta = split.entry.delta[split.statKey]
        let tone: Color = delta.map { $0 > 0 ? Color.appWin : ($0 < 0 ? Color.appLoss : Color.appTextPrimary) } ?? Color.appTextPrimary

        return subBlock(title: "Per-game avg vs defenses like \(opponent)") {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                if let overallV {
                    Text("\(NFLPropFormat.perGame(overallV)) overall")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.appTextSecondary)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.appTextMuted)
                }
                Text(NFLPropFormat.perGame(lookV))
                    .font(.system(size: 15, weight: .black, design: .monospaced))
                    .foregroundStyle(tone)
                Text("vs \(split.bucketLabels.joined(separator: " / "))\(split.entry.n.map { " · n=\($0)" } ?? "")")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
                if let delta {
                    Text("\(delta > 0 ? "+" : "")\(NFLPropFormat.perGame(delta))")
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundStyle(tone)
                }
            }
        }
    }

    // MARK: Look hit-rates

    private func lookHitRatesBlock(_ entries: [NFLPropLookHitEntry]) -> some View {
        subBlock(title: "Did he clear the line vs defenses like \(opponent)?") {
            VStack(spacing: 6) {
                ForEach(entries) { entry in
                    let pct = entry.record.pct
                    let good = pct.map { $0 >= 0.6 } ?? false
                    let bad = pct.map { $0 <= 0.4 } ?? false
                    HStack {
                        Text(NFLPropSchemeCompare.lookBucketLabels[entry.bucket] ?? entry.bucket)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.appTextPrimary)
                        Spacer()
                        Text("\(entry.record.h)/\(entry.record.n)\(pct.map { " · \(Int(($0 * 100).rounded()))%" } ?? "")")
                            .font(.system(size: 14, weight: .black, design: .monospaced))
                            .foregroundStyle(good ? Color.appWin : (bad ? Color.appLoss : Color.appTextPrimary))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.appSurfaceMuted.opacity(0.5), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            }
        }
    }

    // MARK: Defense tiles

    private func defenseTilesBlock(_ tiles: [NFLPropDefenseTile]) -> some View {
        subBlock(title: "What \(opponent) actually plays") {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(tiles, id: \.label) { tile in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 3) {
                            Text(tile.label.uppercased())
                                .font(.system(size: 8, weight: .bold))
                                .tracking(0.3)
                                .foregroundStyle(Color.appTextMuted)
                                .lineLimit(2)
                                .minimumScaleFactor(0.8)
                            Text("KEY")
                                .font(.system(size: 7, weight: .black))
                                .foregroundStyle(Color(hex: 0xF59E0B))
                                .padding(.horizontal, 3)
                                .padding(.vertical, 1)
                                .background(Color(hex: 0xF59E0B).opacity(0.18), in: RoundedRectangle(cornerRadius: 3))
                        }
                        Text(NFLPropFormat.ratePct(tile.rate))
                            .font(.system(size: 17, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.appTextPrimary)
                        Text("\(NFLPropFormat.pctileOrdinal(tile.pctile)) %ile")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.appTextMuted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(Color(hex: 0xF59E0B).opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(Color(hex: 0xF59E0B).opacity(0.3), lineWidth: 0.6)
                    )
                }
            }
        }
    }

    // MARK: Shared sub-block chrome

    private func subBlock<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.5)
                .foregroundStyle(Color.appTextMuted)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.appSurfaceMuted.opacity(0.35), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.appBorder.opacity(0.45), lineWidth: 0.5)
        )
    }
}
