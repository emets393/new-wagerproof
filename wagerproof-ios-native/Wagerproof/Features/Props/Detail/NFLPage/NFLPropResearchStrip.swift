import SwiftUI
import WagerproofModels

/// Fantasy-Points prop model + Player Prop Report for one market.
///
/// ADDITIVE to `NFLProjectionStrip`, never a replacement. The two cover different ground: the
/// projection runs on nearly every player and market, this runs on roughly a third of players
/// across five markets, because the rest were backtested and killed. The caller must therefore
/// be prepared for this to render nothing — see `hasContent`.
struct NFLPropResearchStrip: View {
    let research: NFLPropResearch?

    private var model: NFLPropFPModel? { research?.model }
    private var report: NFLPropReport? { research?.report }

    static func hasContent(_ research: NFLPropResearch?) -> Bool {
        research?.model != nil || research?.report != nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let model { modelBlock(model) }
            if let report {
                if model != nil { Divider().opacity(0.4) }
                reportBlock(report)
            }
        }
    }

    // MARK: model

    @ViewBuilder
    private func modelBlock(_ m: NFLPropFPModel) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(m.fires ? "EDGE LIVE" : "NO EDGE")
                    .font(.system(size: 10, weight: .black))
                    .tracking(0.8)
                    .foregroundStyle(m.fires ? Color.green : Color.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(
                        Capsule().fill((m.fires ? Color.green : Color.gray).opacity(0.15))
                    )
                // `tier` is a backtested hit rate like "61.0%", or the word "robust" where no
                // single rate was pinned — only show it when it reads as a rate.
                if m.fires, m.tier.rangeOfCharacter(from: .decimalDigits) != nil {
                    Text(m.tier)
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(.green)
                }
                Spacer(minLength: 0)
            }

            Text(sentence(m))
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 6) {
                chip(text: "\(m.edge > 0 ? "+" : "")\(fmt(m.edge)) edge",
                     tint: m.edge > 0 ? .green : .red)
                chip(text: "needs \(fmt(m.threshold))", tint: .secondary)
            }
        }
    }

    private func sentence(_ m: NFLPropFPModel) -> String {
        guard let line = m.line else { return "Projects \(fmt(m.pred))." }
        let side = m.edge > 0 ? "over" : "under"
        return "Projects \(fmt(m.pred)) against a \(fmt(line)) line — \(fmt(abs(m.edge))) \(side)."
    }

    // MARK: report

    @ViewBuilder
    private func reportBlock(_ r: NFLPropReport) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text("PLAYER PROP REPORT")
                    .font(.system(size: 9, weight: .black))
                    .tracking(1.0)
                    .foregroundStyle(.secondary)
                Text(r.line.map { "\(r.read.uppercased()) \(fmt($0))" } ?? r.read.uppercased())
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(r.read.lowercased() == "under" ? Color.red : Color.green)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(
                        Capsule().fill((r.read.lowercased() == "under" ? Color.red : Color.green)
                            .opacity(0.15))
                    )
                Spacer(minLength: 0)
                // n_for / n_against count INDEPENDENT tells, so the split is the confidence read
                Text("\(r.nFor) for · \(r.nAgainst) against")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(.secondary)
            }

            if let summary = r.summary, !summary.isEmpty {
                Text(summary)
                    .font(.system(size: 13))
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            ForEach(Array(r.tells.enumerated()), id: \.offset) { _, tell in
                HStack(alignment: .top, spacing: 8) {
                    Circle()
                        .fill(tell.dir.lowercased() == r.read.lowercased() ? Color.green : Color.red)
                        .frame(width: 6, height: 6)
                        .padding(.top, 6)
                    (Text(tell.src.uppercased()).font(.system(size: 11, weight: .bold))
                        + Text(" \(tell.text)").font(.system(size: 12)))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    // MARK: bits

    @ViewBuilder
    private func chip(text: String, tint: Color) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .bold, design: .monospaced))
            .foregroundStyle(tint == .secondary ? Color.secondary : tint)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Capsule().fill(tint.opacity(tint == .secondary ? 0.12 : 0.15)))
    }

    private func fmt(_ v: Double) -> String {
        abs(v) < 1 && v != 0 ? String(format: "%.2f", v) : String(format: "%.1f", v)
    }
}
