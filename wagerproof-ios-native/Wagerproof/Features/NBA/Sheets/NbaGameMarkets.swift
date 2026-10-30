import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

struct NbaFirstHalfSection: View {
    let markets: [NBAFirstHalfMarket]
    var signals: [NBASlateSignal] = []
    var homeName: String = ""
    var awayName: String = ""

    var body: some View {
        if markets.isEmpty {
            EmptyView()
        } else {
            WidgetCollapsingSection(title: "First half", systemImage: "timer", iconTint: Color.appPrimary) {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(markets) { market in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(market.title).font(.system(size: 13, weight: .bold))
                                Spacer()
                                if let tier = market.tier {
                                    Text(tier.uppercased())
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundStyle(Color.appTextSecondary)
                                }
                            }
                            if market.id == "h1_spread", let pick = spreadPick(market) {
                                SpreadCoverBar(
                                    line: pick.line,
                                    modelMargin: pick.modelMargin,
                                    scale: .nba,
                                    pickAbbrev: pick.pick,
                                    opponentAbbrev: pick.opponent
                                )
                            } else {
                                HStack {
                                    number("Model", market.modelNumber, signed: false)
                                    number("Market", market.marketNumber, signed: false, accent: true)
                                }
                            }
                            if market.trackingOnly {
                                Text("Tracking only. The first-half total is never a bet.")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.appTextSecondary)
                            }
                            attachedSignals(for: market)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
            }
        }
    }

    private func number(_ label: String, _ value: Double?, signed: Bool, accent: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.system(size: 10, weight: .bold)).foregroundStyle(Color.appTextSecondary)
            Text(text(value, signed: signed))
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(accent ? Color(hex: 0x0EA5E9) : Color.appTextPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Same orientation as the full-game cover bar: line and margin are the picked team's.
    private func spreadPick(_ market: NBAFirstHalfMarket) -> (line: Double, modelMargin: Double, pick: String, opponent: String)? {
        guard let modelHome = market.modelNumber,
              let marketHome = market.marketNumber,
              let home = market.homeAbbr,
              let away = market.awayAbbr else { return nil }
        let pickIsHome = (marketHome - modelHome) > 0
        let line = pickIsHome ? marketHome : -marketHome
        let modelSpread = pickIsHome ? modelHome : -modelHome
        return (line, -modelSpread, pickIsHome ? home : away, pickIsHome ? away : home)
    }

    private func text(_ value: Double?, signed: Bool) -> String {
        guard let value else { return "—" }
        if signed { return String(format: "%@%.1f", value > 0 ? "+" : "", value) }
        return String(format: "%.1f", value)
    }

    @ViewBuilder
    private func attachedSignals(for market: NBAFirstHalfMarket) -> some View {
        let rows = signals.filter { $0.market == market.id }
        let likesOver: Bool? = market.id == "h1_total"
            ? (market.modelNumber != nil && market.marketNumber != nil ? (market.modelNumber! > market.marketNumber!) : nil)
            : nil
        let likesHome: Bool? = market.id == "h1_spread" ? spreadPick(market).map { $0.pick == (market.homeAbbr ?? "") } : nil
        NbaAttachedSignals(
            signals: rows,
            market: market.id,
            modelLikesHome: likesHome,
            modelLikesOver: likesOver,
            homeName: homeName,
            awayName: awayName,
            homeAbbr: market.homeAbbr ?? "",
            awayAbbr: market.awayAbbr ?? ""
        )
    }
}

/// Pick-signal row under one market card. Amber when the flag disagrees with the model.
struct NbaAttachedSignals: View {
    let signals: [NBASlateSignal]
    let market: String
    var modelLikesHome: Bool? = nil
    var modelLikesOver: Bool? = nil
    var homeName: String = ""
    var awayName: String = ""
    var homeAbbr: String = ""
    var awayAbbr: String = ""
    @State private var selected: NBASlateSignal?

    private var ordered: [NBASlateSignal] {
        BasketballSignalMarket.supportingFirst(signals) { signal in
            BasketballSignalMarket.contradicts(
                side: signal.side,
                market: market,
                modelLikesHome: modelLikesHome,
                modelLikesOver: modelLikesOver,
                homeName: homeName,
                awayName: awayName,
                homeAbbr: homeAbbr,
                awayAbbr: awayAbbr
            )
        }
    }

    var body: some View {
        if !ordered.isEmpty {
            PickSignalsSection(
                signals: ordered.map { signal in
                    PickSignalPillModel(
                        id: signal.id,
                        title: signal.title,
                        contradicts: BasketballSignalMarket.contradicts(
                            side: signal.side,
                            market: market,
                            modelLikesHome: modelLikesHome,
                            modelLikesOver: modelLikesOver,
                            homeName: homeName,
                            awayName: awayName,
                            homeAbbr: homeAbbr,
                            awayAbbr: awayAbbr
                        ),
                        tint: Color.appPrimary
                    )
                },
                onSelect: { pill in selected = ordered.first { $0.id == pill.id } }
            )
            .sheet(item: $selected) { signal in
                NavigationStack {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(signal.title).font(.system(size: 20, weight: .bold))
                            if let side = signal.side, !side.isEmpty {
                                Text(side).font(.system(size: 14, weight: .semibold))
                            }
                            if let definition = signal.definition {
                                Text(definition).font(.system(size: 14)).foregroundStyle(Color.appTextSecondary)
                            }
                            record("Back-test", signal.recordText)
                            record("This season", signal.seasonRecordText)
                        }
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .navigationTitle("Signal")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { selected = nil } } }
                }
                .presentationDetents([.medium, .large])
            }
        }
    }

    private func record(_ title: String, _ text: String?) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title.uppercased()).font(.system(size: 10, weight: .bold)).foregroundStyle(Color.appTextSecondary)
            Text(text ?? "—").font(.system(size: 13))
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
