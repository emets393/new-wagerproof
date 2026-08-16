import SwiftUI
import WagerproofModels
import WagerproofDesign

/// WagerProof Projection widget body — the native `ModelStrip`. The verdict
/// sentence lives in the section headline; this body renders the status chip
/// plus the projection-vs-Vegas number line (probability space for ATD).
struct NFLProjectionStrip: View {
    let projection: NFLPropProjection?
    let rookie: Bool
    let marketKey: String
    /// Today's chart line (posted close, else best over-board line).
    let line: Double?
    /// Best over-board price, for the Vegas marker caption / ATD implied %.
    let vegasOdds: Double?

    var body: some View {
        if rookie || projection == nil {
            Text("Projection coming soon")
                .font(.system(size: 13))
                .italic()
                .foregroundStyle(Color.appTextMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else if case .point(let value, _, _) = projection {
            VStack(alignment: .leading, spacing: 4) {
                statusRow
                pointLine(value: value)
            }
        } else if case .rate(let scoreRate, _, _) = projection {
            VStack(alignment: .leading, spacing: 4) {
                statusRow
                probabilityLine(scoreRate: scoreRate)
            }
        }
    }

    private var statusRow: some View {
        HStack {
            Text("Projection comparison".uppercased())
                .font(.system(size: 9, weight: .black))
                .tracking(0.6)
                .foregroundStyle(Color.appTextMuted)
            Spacer()
            statusChip
        }
    }

    @ViewBuilder
    private var statusChip: some View {
        let isModel = projection?.isModel == true
        Text(isModel ? "Model" : "Preview")
            .font(.system(size: 9, weight: .black))
            .tracking(0.5)
            .textCase(.uppercase)
            .foregroundStyle(isModel ? Color.appWin : Color(hex: 0xF59E0B))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background((isModel ? Color.appWin : Color(hex: 0xF59E0B)).opacity(0.14), in: Capsule())
    }

    // MARK: Point projection vs Vegas line

    private func pointLine(value: Double) -> some View {
        // Web PointStrip scale: padding = max(span*0.18, 1 for yardage / 0.25).
        let span = line.map { abs(value - $0) } ?? 1
        let unitFloor = marketKey.contains("yds") ? 1.0 : 0.25
        let padding = max(max(span, 1) * 0.18, unitFloor)
        let fractions = PropNumberLine.fractions(primary: value, secondary: line, padding: padding)
        let delta = line.map { value - $0 }
        let tone: PropNumberLine.Tone = delta.map { $0 > 0 ? .up : ($0 < 0 ? .down : .neutral) } ?? .neutral
        let unit = NFLPropVerdicts.shortUnit(marketKey)

        return PropNumberLine(
            primary: PropNumberLineMarker(
                label: "WagerProof",
                value: NFLPropFormat.perGame(value),
                unit: unit.isEmpty ? nil : unit
            ),
            primaryFraction: fractions.primary,
            secondary: line.map { l in
                PropNumberLineMarker(
                    label: "Vegas line",
                    value: NFLPropFormat.perGame(l),
                    caption: vegasOdds.map(NFLPropFormat.american)
                )
            },
            secondaryFraction: fractions.secondary,
            tone: tone,
            deltaText: delta.flatMap { d in
                guard d != 0 else { return nil }
                let digits = abs(d) < 1 ? 2 : 1
                let unitSuffix = unit.isEmpty ? "" : " \(unit)"
                return "\(d > 0 ? "+" : "-")\(NFLPropFormat.perGame(abs(d), digits: digits))\(unitSuffix)"
            },
            leadingCaption: "Lower total",
            trailingCaption: "Higher total"
        )
    }

    // MARK: ATD probability vs Vegas implied

    private func probabilityLine(scoreRate: Double) -> some View {
        let modelPct = scoreRate * 100
        let fairOdds = NFLPropFormat.probabilityToAmerican(scoreRate)
        let vegasPct = vegasOdds.flatMap(NFLPropFormat.americanToProbability).map { $0 * 100 }
        // Web TouchdownOddsComparison scale: padding = max(0.5, gap*0.5); the
        // no-Vegas domain runs 0…max(20, model rounded up to 5s).
        let padding = vegasPct.map { max(0.5, abs(modelPct - $0) * 0.5) }
            ?? max(20, (modelPct / 5).rounded(.up) * 5) - modelPct
        let fractions = PropNumberLine.fractions(primary: modelPct, secondary: vegasPct, padding: max(padding, 0.5))
        let delta = vegasPct.map { modelPct - $0 }
        let tone: PropNumberLine.Tone = delta.map { $0 > 0.05 ? .up : ($0 < -0.05 ? .down : .neutral) } ?? .neutral

        return PropNumberLine(
            primary: PropNumberLineMarker(
                label: "WagerProof",
                value: "\(NFLPropFormat.perGame(modelPct))%",
                caption: fairOdds.map(NFLPropFormat.american)
            ),
            primaryFraction: fractions.primary,
            secondary: vegasPct.map { pct in
                PropNumberLineMarker(
                    label: "Vegas",
                    value: "\(NFLPropFormat.perGame(pct))%",
                    caption: vegasOdds.map(NFLPropFormat.american)
                )
            },
            secondaryFraction: fractions.secondary,
            tone: tone,
            deltaText: delta.map { "\($0 > 0 ? "+" : "")\(NFLPropFormat.perGame($0)) pts" },
            leadingCaption: "No score",
            trailingCaption: "Scores TD",
            primaryValueSize: 20
        )
    }
}
