import SwiftUI
import UIKit
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

/// Tickets, money, and the consensus line move for one sport. Percentages are
/// free. The category chip and the sentence are Premium Plus.
struct PublicBettingView: View {
    let sport: GamesStore.Sport

    @Environment(ProAccessStore.self) private var access
    @Environment(\.isFeatureGatePreview) private var isFeaturePreview
    @State private var games: [PublicBettingGame] = []
    @State private var market: PublicMarket = .spread
    @State private var sharpOnly = false
    @State private var sort: PublicBoardSort = .sharp
    @State private var query = ""
    @State private var loading = true
    @State private var failed = false
    @State private var showPaywall = false

    private var showRead: Bool {
        isFeaturePreview || access.hasAccess(to: .premium)
    }

    private var showLock: Bool {
        !isFeaturePreview && !access.isLoading && !access.hasAccess(to: .premium)
    }

    private var visible: [PublicBettingGame] {
        PublicBetting.ordered(
            games,
            sport: sport.rawValue,
            market: market,
            sharpOnly: sharpOnly,
            query: query,
            sort: sort
        )
    }

    private var capturedLabel: String {
        let newest = visible.compactMap(\.capturedAt).max()
        guard let newest else { return "Action Network" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return "Action Network · captured \(formatter.localizedString(for: newest, relativeTo: Date()))"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                filters
                howToRead
                HStack {
                    Text(capturedLabel)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.appTextMuted)
                    Spacer(minLength: 8)
                    Button("Refresh") { Task { await load() } }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.appPrimary)
                }
                content
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 32)
        }
        .background(Color.appSurface)
        .navigationTitle("Public Betting")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        .task { await load() }
        .sheet(isPresented: $showPaywall) {
            RevenueCatPaywallView(placementId: "tier_upgrade_premium", minimumTier: .premium)
        }
    }

    private var filters: some View {
        VStack(alignment: .leading, spacing: 10) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    filterMenu("Market", title: market.label) {
                        ForEach(PublicMarket.allCases, id: \.self) { item in
                            Button {
                                market = item
                            } label: {
                                menuRow(item.label, selected: item == market)
                            }
                        }
                    }
                    filterMenu("Reads", title: sharpOnly ? "Sharp money only" : "All") {
                        Button {
                            sharpOnly = false
                        } label: {
                            menuRow("All", selected: !sharpOnly)
                        }
                        Button {
                            sharpOnly = true
                        } label: {
                            menuRow("Sharp money only", selected: sharpOnly)
                        }
                    }
                    filterMenu("Sort", title: sort.label) {
                        ForEach(PublicBoardSort.allCases) { item in
                            Button {
                                sort = item
                            } label: {
                                menuRow(item.label, selected: item == sort)
                            }
                        }
                    }
                }
            }
            .frame(height: 36)

            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
                TextField("Search teams", text: $query)
                    .font(.system(size: 13, weight: .medium))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                if !query.isEmpty {
                    Button {
                        query = ""
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Color.appTextMuted)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear search")
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 36)
            .background(Color.appSurfaceMuted, in: Capsule())
        }
    }

    private func filterMenu<Content: View>(_ accessibility: String, title: String, @ViewBuilder content: () -> Content) -> some View {
        Menu(content: content) {
            HStack(spacing: 4) {
                Text(title)
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 10, weight: .bold))
            }
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(Color.appTextPrimary)
            .padding(.horizontal, 12)
            .frame(height: 36)
            .background(Color.appSurfaceMuted, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibility)
    }

    @ViewBuilder
    private func menuRow(_ title: String, selected: Bool) -> some View {
        if selected {
            Label(title, systemImage: "checkmark")
        } else {
            Text(title)
        }
    }

    private var howToRead: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("👀 How to read this")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
                .textCase(.uppercase)
            Text("🎟️ is the share of bets. 💵 is the share of dollars. The line between them is the gap, and ➡️ is the move from the open to the current number.")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextPrimary.opacity(0.9))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.appBorder, lineWidth: 1)
        )
    }

    @ViewBuilder
    private var content: some View {
        if loading && games.isEmpty {
            ProgressView("Loading \(sport.label) splits")
                .frame(maxWidth: .infinity)
                .padding(.top, 48)
        } else if failed && games.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Couldn’t load the public splits.")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                Button("Try again") { Task { await load() } }
                    .font(.system(size: 15, weight: .semibold))
            }
            .padding(.top, 24)
        } else if visible.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text(emptyTitle)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                Text(emptyBody)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 12)
        } else {
            VStack(spacing: 12) {
                ForEach(visible) { game in
                    if let read = game.reads[market] {
                        NavigationLink {
                            PublicBettingDetail(
                                game: game,
                                market: market,
                                showRead: showRead,
                                showLock: showLock,
                                unlock: { showPaywall = true }
                            )
                        } label: {
                            PublicBettingCard(
                                game: game,
                                market: market,
                                read: read,
                                showRead: showRead,
                                showLock: showLock
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var emptyTitle: String {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if !needle.isEmpty { return "No teams match that search." }
        if sharpOnly { return "No sharp-money reads on the \(market.label.lowercased())." }
        return "No usable \(market.label.lowercased()) splits for \(sport.label)."
    }

    private var emptyBody: String {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if !needle.isEmpty { return "Try a city, a nickname, or an abbreviation." }
        if sharpOnly {
            return "Sharp money needs heavy tickets one way, the dollars the other way, and the line moving with the dollars."
        }
        return "A 0/100 split and a thin ticket count stay off the feed."
    }

    private func load() async {
        failed = false
        if games.isEmpty { loading = true }
        do {
            games = try await PublicBettingService.loadBoard()
            failed = false
        } catch {
            failed = games.isEmpty
        }
        loading = false
    }
}

private struct PublicBettingCard: View {
    let game: PublicBettingGame
    let market: PublicMarket
    let read: PublicMarketRead
    let showRead: Bool
    let showLock: Bool
    var showsSentence = false

    private var colors: (away: Color, home: Color) {
        PublicBarPalette.sides(sport: game.sport, market: market, away: game.away, home: game.home)
    }

    private var confirmColor: Color {
        switch read.moneyTiltSide {
        case .away: return colors.away
        case .home: return colors.home
        case nil: return colors.away
        }
    }

    private var arrowColor: Color {
        switch read.movedToward {
        case .away: return colors.away
        case .home: return colors.home
        case nil: return Color.appTextSecondary
        }
    }

    private var railColor: Color {
        read.category == .sharpMoney ? confirmColor : arrowColor
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 8) {
                HStack(spacing: -9) {
                    TeamMark(sport: game.sport, name: game.away, size: 32)
                        .zIndex(1)
                    TeamMark(sport: game.sport, name: game.home, size: 32)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(publicStartLabel(game.startTime))
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.appTextMuted)
                        .lineLimit(1)
                    Text("\(game.away) @ \(game.home)")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                        .multilineTextAlignment(.leading)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
            }

            if showRead, read.emphasis != .none, !read.chip.isEmpty {
                PublicTierChip(read: read, ring: read.category == .sharpMoney ? confirmColor : nil)
            } else if showLock, read.emphasis != .none {
                Label("Unlock the read", systemImage: "lock.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
            }

            VStack(alignment: .leading, spacing: 8) {
                PublicDivergenceBars(
                    sport: game.sport,
                    market: market,
                    awayName: game.away,
                    homeName: game.home,
                    read: read,
                    awayColor: colors.away,
                    homeColor: colors.home
                )
                PublicLineRail(
                    market: market,
                    awayName: game.away,
                    homeName: game.home,
                    read: read,
                    color: railColor
                )
            }
            .padding(read.category == .sharpMoney ? 8 : 0)
            .overlay {
                if read.category == .sharpMoney {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(confirmColor, lineWidth: 1)
                }
            }

            if showsSentence, showRead, !read.sentence.isEmpty {
                Text(read.sentence)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if showsSentence, let tickets = read.tickets, tickets > 0 {
                Text("🎟️ \(groupedCount(tickets)) tickets on this market")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.appTextMuted)
                    .monospacedDigit()
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.appBorder, lineWidth: 1)
        )
    }
}

private struct PublicBettingDetail: View {
    let game: PublicBettingGame
    let market: PublicMarket
    let showRead: Bool
    let showLock: Bool
    let unlock: () -> Void

    private var markets: [PublicMarket] {
        let present = PublicMarket.allCases.filter { game.reads[$0] != nil }
        guard let selected = present.firstIndex(of: market) else { return present }
        var ordered = present
        ordered.remove(at: selected)
        ordered.insert(market, at: 0)
        return ordered
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("\(game.away) @ \(game.home)")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Text(publicStartLabel(game.startTime))
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.appTextMuted)

                if showLock {
                    Button(action: unlock) {
                        Text("Unlock the read")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Color.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.appPrimary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }

                ForEach(markets, id: \.self) { item in
                    if let read = game.reads[item] {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("\(marketMark(item)) \(item.label)")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(Color.appTextPrimary)
                            PublicBettingCard(
                                game: game,
                                market: item,
                                read: read,
                                showRead: showRead,
                                showLock: false,
                                showsSentence: true
                            )
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Color.appSurface)
        .navigationTitle(market.label)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func marketMark(_ market: PublicMarket) -> String {
        switch market {
        case .spread: return "📐"
        case .total: return "🎯"
        case .ml: return "💰"
        }
    }
}

private struct PublicTierChip: View {
    let read: PublicMarketRead
    let ring: Color?

    var body: some View {
        Text(read.chip)
            .font(.system(size: 11, weight: read.emphasis == .quiet ? .semibold : .bold))
            .foregroundStyle(foreground)
            .lineLimit(2)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(background, in: Capsule())
            .overlay {
                if read.emphasis == .medium || read.emphasis == .quiet {
                    Capsule().stroke(border, lineWidth: 1)
                } else if let ring, read.emphasis == .loud {
                    Capsule().stroke(ring, lineWidth: read.strong ? 2 : 1.5)
                }
            }
            .background {
                if let ring, read.emphasis == .loud {
                    Capsule().fill(ring.opacity(0.22)).padding(-3)
                }
            }
    }

    private var foreground: Color {
        switch read.emphasis {
        case .loud: return Color.appSurface
        case .medium: return Color.appTextPrimary
        case .quiet, .none: return Color.appTextMuted
        }
    }

    private var background: Color {
        switch read.emphasis {
        case .loud: return Color.appTextPrimary
        case .medium: return Color.appTextPrimary.opacity(0.10)
        case .quiet, .none: return Color.clear
        }
    }

    private var border: Color {
        read.emphasis == .medium ? Color.appTextPrimary.opacity(0.25) : Color.appBorder
    }
}

struct PublicDivergenceBars: View {
    let sport: String
    let market: PublicMarket
    let awayName: String
    let homeName: String
    let read: PublicMarketRead
    let awayColor: Color
    let homeColor: Color

    private var gap: PublicMoneyGap? { PublicBetting.moneyGap(for: read) }

    private var differenceColor: Color? {
        switch gap?.side {
        case .away: return awayColor
        case .home: return homeColor
        case nil: return nil
        }
    }

    var body: some View {
        HStack(alignment: .center, spacing: 6) {
            if market != .total {
                TeamMark(sport: sport, name: awayName, size: 22)
            }
            VStack(spacing: 4) {
                ends(left: read.betsAway, right: read.betsHome, label: "🎟️ Tickets")
                splitBar(share(read.betsAway, read.betsHome))
                if let gap, let differenceColor {
                    wedge(gap: gap, color: differenceColor)
                    differenceCaption(gap, color: differenceColor)
                        .frame(maxWidth: .infinity)
                        .multilineTextAlignment(.center)
                }
                splitBar(share(read.moneyAway, read.moneyHome))
                    .padding(.top, gap == nil ? 4 : 0)
                ends(left: read.moneyAway, right: read.moneyHome, label: "💵 Money")
            }
            if market != .total {
                TeamMark(sport: sport, name: homeName, size: 22)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(spoken)
    }

    private var spoken: String {
        let away = market == .total ? read.awaySideName : awayName
        let home = market == .total ? read.homeSideName : homeName
        var text = "Tickets \(Int(read.betsAway.rounded()))% \(away), \(Int(read.betsHome.rounded()))% \(home). Money \(Int(read.moneyAway.rounded()))% \(away), \(Int(read.moneyHome.rounded()))% \(home)."
        if let gap {
            text += " \(gap.points)% more money than tickets on \(gap.name)."
        }
        return text
    }

    private func ends(left: Double, right: Double, label: String) -> some View {
        HStack {
            Text("\(Int(left.rounded()))%")
                .foregroundStyle(awayColor)
            Spacer(minLength: 4)
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .tracking(0.6)
                .foregroundStyle(Color.appTextMuted)
                .textCase(.uppercase)
            Spacer(minLength: 4)
            Text("\(Int(right.rounded()))%")
                .foregroundStyle(homeColor)
        }
        .font(.system(size: 11, weight: .semibold))
        .monospacedDigit()
    }

    private func splitBar(_ leftPct: Double) -> some View {
        GeometryReader { proxy in
            let gap: CGFloat = 4
            let available = max(0, proxy.size.width - gap)
            let clamped = min(max(leftPct, 0), 100) / 100
            let leftWidth = available * clamped
            ZStack {
                HStack(spacing: gap) {
                    Capsule().fill(awayColor).frame(width: leftWidth)
                    Capsule().fill(homeColor).frame(width: available - leftWidth)
                }
                Rectangle()
                    .fill(Color.appTextPrimary.opacity(0.25))
                    .frame(width: 1, height: proxy.size.height)
            }
        }
        .frame(height: 12)
    }

    private func wedge(gap: PublicMoneyGap, color: Color) -> some View {
        let betSplit = share(read.betsAway, read.betsHome)
        let moneySplit = share(read.moneyAway, read.moneyHome)
        return GeometryReader { proxy in
            let start = min(betSplit, moneySplit) / 100 * proxy.size.width
            let width = abs(moneySplit - betSplit) / 100 * proxy.size.width
            DifferenceWedge(pointsRight: moneySplit >= betSplit)
                .fill(color.opacity(0.55))
                .frame(width: max(width, 0), height: 8)
                .offset(x: start)
        }
        .frame(height: 8)
    }

    private func differenceCaption(_ gap: PublicMoneyGap, color: Color) -> Text {
        var bolt = AttributedString("⚡ DIFFERENCE")
        bolt.font = .system(size: 10, weight: .bold)
        bolt.foregroundColor = Color.appTextMuted

        var points = AttributedString("  \(gap.points)%")
        points.font = .system(size: 11, weight: .semibold)
        points.foregroundColor = color

        var middle = AttributedString(" more money than tickets on ")
        middle.font = .system(size: 11, weight: .semibold)
        middle.foregroundColor = Color.appTextPrimary.opacity(0.8)

        var name = AttributedString(gap.name)
        name.font = .system(size: 11, weight: .semibold)
        name.foregroundColor = color

        return Text(bolt + points + middle + name)
    }

    private func share(_ left: Double, _ right: Double) -> Double {
        let sum = left + right
        if sum <= 0 { return 50 }
        return (left / sum) * 100
    }
}

private struct DifferenceWedge: Shape {
    var pointsRight: Bool

    func path(in rect: CGRect) -> Path {
        var path = Path()
        if pointsRight {
            path.move(to: CGPoint(x: rect.minX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        } else {
            path.move(to: CGPoint(x: rect.maxX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        }
        path.closeSubpath()
        return path
    }
}

struct PublicLineRail: View {
    let market: PublicMarket
    let awayName: String
    let homeName: String
    let read: PublicMarketRead
    let color: Color

    private var caption: PublicLineCaption? {
        PublicBetting.lineCaption(market: market, read: read)
    }

    var body: some View {
        if let caption {
            VStack(spacing: 8) {
                if caption.openerMissing {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("NOW")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(0.8)
                            .foregroundStyle(Color.appTextMuted)
                        Text(nowOnly)
                            .font(.system(size: 17, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                            .monospacedDigit()
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    HStack {
                        Text("OPEN")
                        Spacer()
                        Text("NOW")
                    }
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.8)
                    .foregroundStyle(Color.appTextMuted)

                    HStack(alignment: .center, spacing: 6) {
                        VStack(spacing: 6) {
                            openCells
                        }
                        Text(glyph)
                            .font(.system(size: 18))
                            .foregroundStyle(caption.flat ? Color.appTextMuted : color)
                            .frame(width: 28)
                        VStack(spacing: 6) {
                            nowCells
                        }
                    }
                }

                Text("\(caption.mark) \(caption.text)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(caption.flat ? Color.appTextSecondary : color)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            .padding(10)
            .background(Color.appTextPrimary.opacity(0.04), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.appBorder, lineWidth: 1)
            )
        }
    }

    private var glyph: String {
        guard read.current != nil, let caption else { return "" }
        return caption.flat ? "➖" : "➡️"
    }

    private var nowOnly: String {
        guard let current = read.current else { return "—" }
        let number = PublicBetting.formatLine(market, current)
        return market == .total ? number : "\(awayName) \(number)"
    }

    @ViewBuilder
    private var openCells: some View {
        if market == .total {
            cell(name: nil, value: read.open, emphasize: false, align: .center)
        } else {
            cell(name: awayName, value: read.open, emphasize: false, align: .leading)
            cell(name: homeName, value: read.homeOpen, emphasize: false, align: .leading)
        }
    }

    @ViewBuilder
    private var nowCells: some View {
        if market == .total {
            cell(
                name: nil,
                value: read.current,
                emphasize: caption?.flat == false && read.current != nil,
                align: .center
            )
        } else {
            cell(name: awayName, value: read.current, emphasize: !isFlat && read.movedToward == .away, align: .trailing)
            cell(name: homeName, value: read.homeCurrent, emphasize: !isFlat && read.movedToward == .home, align: .trailing)
        }
    }

    private var isFlat: Bool { caption?.flat ?? true }

    private func cell(name: String?, value: Double?, emphasize: Bool, align: CellAlign) -> some View {
        VStack(alignment: align.stack, spacing: 1) {
            if let name {
                Text(name.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(emphasize ? color.opacity(0.8) : Color.appTextMuted)
                    .lineLimit(1)
            }
            Text(value.map { PublicBetting.formatLine(market, $0) } ?? "—")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(emphasize ? color : Color.appTextPrimary)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: align.frame)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(emphasize ? color.opacity(0.16) : Color.clear)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(
                    emphasize ? color.opacity(0.7) : Color.appTextPrimary.opacity(0.18),
                    style: StrokeStyle(lineWidth: 1, dash: emphasize ? [] : [4, 3])
                )
        }
    }
}

private enum CellAlign {
    case leading, center, trailing

    var stack: HorizontalAlignment {
        switch self {
        case .leading: return .leading
        case .center: return .center
        case .trailing: return .trailing
        }
    }

    var frame: Alignment {
        switch self {
        case .leading: return .leading
        case .center: return .center
        case .trailing: return .trailing
        }
    }
}

private struct TeamMark: View {
    let sport: String
    let name: String
    var size: CGFloat = 28

    var body: some View {
        Group {
            if let url = logoURL {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFit()
                    } else {
                        initials
                    }
                }
            } else {
                initials
            }
        }
        .frame(width: size * 0.7, height: size * 0.7)
        .frame(width: size, height: size)
        .background(Color.white, in: Circle())
        .overlay(Circle().stroke(Color.black.opacity(0.1), lineWidth: 1))
    }

    private var initials: some View {
        Text(mark)
            .font(.system(size: max(8, size * 0.26), weight: .bold))
            .foregroundStyle(Color(hex: 0x171717))
            .lineLimit(1)
            .minimumScaleFactor(0.6)
    }

    private var mark: String {
        let parts = name.split(separator: " ").prefix(2)
        let letters = parts.compactMap(\.first)
        let text = String(letters).uppercased()
        return text.isEmpty ? "—" : text
    }

    private var logoURL: URL? {
        let raw: String?
        switch sport {
        case "nfl":
            raw = NFLTeamAssets.logo(for: name) ?? NFLTeams.logoUrl(for: name)
        case "nba":
            raw = OutlierTeamPalette.logoURL(for: name, sport: .nba) ?? nbaNicknameLogo(name)
        case "cfb", "ncaab":
            raw = CFBTeamAssets.logo(for: PublicBarPalette.canonicalCollege(name))
        default:
            raw = nil
        }
        guard let raw, let url = URL(string: raw) else { return nil }
        return url
    }

    private func nbaNicknameLogo(_ name: String) -> String? {
        let slug = Self.nbaSlugs[name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()]
        return slug.map { "https://a.espncdn.com/i/teamlogos/nba/500/\($0).png" }
    }

    private static let nbaSlugs: [String: String] = [
        "hawks": "atl", "celtics": "bos", "nets": "bkn", "hornets": "cha",
        "bulls": "chi", "cavaliers": "cle", "cavs": "cle", "mavericks": "dal", "mavs": "dal",
        "nuggets": "den", "pistons": "det", "warriors": "gs", "rockets": "hou",
        "pacers": "ind", "clippers": "lac", "lakers": "lal", "grizzlies": "mem",
        "heat": "mia", "bucks": "mil", "timberwolves": "min", "wolves": "min",
        "pelicans": "no", "knicks": "ny", "thunder": "okc", "magic": "orl",
        "76ers": "phi", "sixers": "phi", "suns": "phx", "trail blazers": "por", "blazers": "por",
        "kings": "sac", "spurs": "sa", "raptors": "tor", "jazz": "utah", "wizards": "wsh"
    ]
}

private func publicStartLabel(_ iso: String?) -> String {
    guard let iso else { return "Time TBD" }
    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let clock = ISO8601DateFormatter()
    clock.formatOptions = [.withInternetDateTime]
    guard let date = fractional.date(from: iso) ?? clock.date(from: iso) else { return "Time TBD" }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(identifier: "America/New_York")
    formatter.dateFormat = "EEE, MMM d, h:mm a"
    return "\(formatter.string(from: date)) ET"
}

private func groupedCount(_ value: Double) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    formatter.maximumFractionDigits = 0
    return formatter.string(from: NSNumber(value: value.rounded())) ?? "\(Int(value.rounded()))"
}

/// Spread and moneyline bars use team colors. Totals stay Over green and Under blue.
/// A navy or black primary is lifted until it reads on the dark card, matching the website.
@MainActor
private enum PublicBarPalette {
    static let over = Color(hex: 0x10B981)
    static let under = Color(hex: 0x3B82F6)
    private static let minSeparation = 72.0
    private static let minContrast = 4.0
    private static let card = (17.0, 23.0, 37.0)

    static func sides(sport: String, market: PublicMarket, away: String, home: String) -> (away: Color, home: Color) {
        if market == .total { return (over, under) }
        let awayChoices = choices(brand(sport: sport, name: away))
        let homeChoices = choices(brand(sport: sport, name: home))
        let primary = (away: awayChoices[0], home: homeChoices[0])
        if distance(primary.away, primary.home) >= minSeparation { return primary }

        var best = (away: primary.away, home: primary.home, score: distance(primary.away, primary.home), rank: 0)
        for (awayIndex, awayColor) in awayChoices.enumerated() {
            for (homeIndex, homeColor) in homeChoices.enumerated() {
                let score = distance(awayColor, homeColor)
                let rank = awayIndex + homeIndex
                let better = score > best.score + 6 || (score >= best.score - 6 && rank < best.rank)
                if better { best = (awayColor, homeColor, score, rank) }
            }
        }
        if best.score >= minSeparation { return (best.away, best.home) }
        return (best.away, lift(best.home))
    }

    static func canonicalCollege(_ name: String) -> String {
        let key = name
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: ".", with: "")
            .replacingOccurrences(of: "'", with: "")
            .replacingOccurrences(of: "  ", with: " ")
        return collegeAliases[key] ?? name
    }

    private static func brand(sport: String, name: String) -> (Color, Color) {
        let pair: TeamColorPair
        switch sport {
        case "nfl":
            pair = NFLTeamColors.colorPair(for: name)
        case "nba":
            pair = NBATeams.colorPair(for: name)
        default:
            pair = CFBTeamColors.colorPair(for: canonicalCollege(name))
        }
        return (pair.primary, pair.secondary)
    }

    private static func choices(_ pair: (Color, Color)) -> [Color] {
        var seen = Set<String>()
        var result: [Color] = []
        for color in [visible(pair.0), visible(pair.1)] {
            let key = fingerprint(color)
            if seen.insert(key).inserted { result.append(color) }
        }
        return result.isEmpty ? [Color(hex: 0x94A3B8)] : result
    }

    private static func visible(_ color: Color) -> Color {
        if contrast(color) >= minContrast { return color }
        var lo = 0.0
        var hi = 0.92
        for _ in 0..<14 {
            let mid = (lo + hi) / 2
            if contrast(mix(color, towardWhite: mid)) >= minContrast { hi = mid } else { lo = mid }
        }
        let lifted = mix(color, towardWhite: hi)
        if contrast(lifted) >= minContrast { return lifted }
        return mix(color, towardWhite: min(0.92, hi + 0.05))
    }

    private static func lift(_ color: Color) -> Color {
        visible(mix(color, towardWhite: 0.55))
    }

    private static func mix(_ color: Color, towardWhite amount: Double) -> Color {
        let rgb = channels(color)
        return Color(
            .sRGB,
            red: rgb.0 + (1 - rgb.0) * amount,
            green: rgb.1 + (1 - rgb.1) * amount,
            blue: rgb.2 + (1 - rgb.2) * amount,
            opacity: 1
        )
    }

    private static func distance(_ a: Color, _ b: Color) -> Double {
        let left = channels(a)
        let right = channels(b)
        let dr = (left.0 - right.0) * 255
        let dg = (left.1 - right.1) * 255
        let db = (left.2 - right.2) * 255
        return (dr * dr + dg * dg + db * db).squareRoot()
    }

    private static func contrast(_ color: Color) -> Double {
        let left = luminance(channels(color))
        let right = luminance((card.0 / 255, card.1 / 255, card.2 / 255))
        let lighter = max(left, right)
        let darker = min(left, right)
        return (lighter + 0.05) / (darker + 0.05)
    }

    private static func luminance(_ rgb: (Double, Double, Double)) -> Double {
        func linear(_ unit: Double) -> Double {
            unit <= 0.04045 ? unit / 12.92 : pow((unit + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * linear(rgb.0) + 0.7152 * linear(rgb.1) + 0.0722 * linear(rgb.2)
    }

    private static func channels(_ color: Color) -> (Double, Double, Double) {
        let ui = UIColor(color)
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        if ui.getRed(&r, green: &g, blue: &b, alpha: &a) {
            return (Double(r), Double(g), Double(b))
        }
        return (0.58, 0.64, 0.72)
    }

    private static func fingerprint(_ color: Color) -> String {
        let rgb = channels(color)
        return "\(Int((rgb.0 * 255).rounded()))-\(Int((rgb.1 * 255).rounded()))-\(Int((rgb.2 * 255).rounded()))"
    }

    private static let collegeAliases: [String: String] = [
        "middle tenn": "Middle Tennessee",
        "s alabama": "South Alabama",
        "n mexico state": "New Mexico State",
        "e carolina": "East Carolina",
        "umass": "Massachusetts",
        "fl atlantic": "Florida Atlantic",
        "w michigan": "Western Michigan",
        "miami (fl)": "Miami",
        "c michigan": "Central Michigan",
        "boston col": "Boston College",
        "ga tech": "Georgia Tech",
        "s carolina": "South Carolina",
        "n illinois": "Northern Illinois",
        "k state": "Kansas State",
        "e michigan": "Eastern Michigan",
        "la-monroe": "UL Monroe",
        "la tech": "Louisiana Tech",
        "ok state": "Oklahoma State",
        "va tech": "Virginia Tech",
        "nd state": "North Dakota State",
        "w kentucky": "Western Kentucky",
        "n texas": "North Texas",
        "s florida": "South Florida",
        "s miss": "Southern Miss",
        "c carolina": "Coastal Carolina",
        "n carolina": "North Carolina",
        "w virginia": "West Virginia"
    ]
}

/// Game-page public-betting card. Loads the Action Network board, finds this
/// matchup, and reuses the public-betting bars and line rail.
struct GamePublicBettingCard: View {
    let sport: String
    let awayTeam: String
    let homeTeam: String
    var gameDate: String? = nil
    let awayColor: Color
    let homeColor: Color

    @State private var matched: PublicBettingGame?
    @State private var phase: Phase = .loading
    @State private var market: PublicMarket = .spread

    private let markets: [PublicMarket] = [.spread, .ml, .total]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            switcher
            switch phase {
            case .loading:
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
            case .empty:
                Text("No public betting splits for this game yet.")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 8)
            case .ready:
                if let matched, let read = matched.reads[market] {
                    PublicDivergenceBars(
                        sport: matched.sport,
                        market: market,
                        awayName: matched.away,
                        homeName: matched.home,
                        read: read,
                        awayColor: awayColor,
                        homeColor: homeColor
                    )
                    PublicLineRail(
                        market: market,
                        awayName: matched.away,
                        homeName: matched.home,
                        read: read,
                        color: railColor(read)
                    )
                } else {
                    Text("No \(market.noun) splits for this game yet.")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 8)
                }
            }
        }
        .task(id: "\(sport)|\(awayTeam)|\(homeTeam)|\(gameDate ?? "")") {
            await load()
        }
    }

    private var switcher: some View {
        HStack(spacing: 4) {
            ForEach(markets, id: \.self) { item in
                Button {
                    market = item
                } label: {
                    Text(item.label)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(market == item ? Color.appSurface : Color.appTextSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 7)
                        .background(
                            market == item ? Color.appTextPrimary : Color.clear,
                            in: Capsule()
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(Color.appTextPrimary.opacity(0.06), in: Capsule())
    }

    private func railColor(_ read: PublicMarketRead) -> Color {
        let confirm = read.moneyTiltSide == .home ? homeColor : awayColor
        let arrow: Color = switch read.movedToward {
        case .away: awayColor
        case .home: homeColor
        case nil: Color.appTextSecondary
        }
        return read.category == .sharpMoney ? confirm : arrow
    }

    private func load() async {
        phase = .loading
        let board = (try? await PublicBettingService.loadBoard()) ?? []
        matched = PublicGameMatch.find(in: board, sport: sport, away: awayTeam, home: homeTeam, date: gameDate)
        phase = matched == nil ? .empty : .ready
        if let matched {
            market = markets.first { matched.reads[$0] != nil } ?? .spread
        }
    }

    private enum Phase { case loading, ready, empty }
}

@MainActor
enum PublicGameMatch {
    static func find(
        in games: [PublicBettingGame],
        sport: String,
        away: String,
        home: String,
        date: String?
    ) -> PublicBettingGame? {
        let sportKey = sport.lowercased()
        var best: (PublicBettingGame, Int)?
        for game in games where game.sport.lowercased() == sportKey {
            let awayDirect = teamScore(game.away, away, sportKey)
            let homeDirect = teamScore(game.home, home, sportKey)
            let awaySwap = teamScore(game.away, home, sportKey)
            let homeSwap = teamScore(game.home, away, sportKey)
            let directTotal = (awayDirect > 0 && homeDirect > 0) ? awayDirect + homeDirect : 0
            let swapTotal = (awaySwap > 0 && homeSwap > 0) ? awaySwap + homeSwap : 0
            var total = max(directTotal, swapTotal)
            guard total > 0 else { continue }
            if let date, let start = game.startTime, start.contains(date) {
                total += 30
            }
            if best == nil || total > best!.1 {
                best = (game, total)
            }
        }
        return best?.0
    }

    private static func teamScore(_ board: String, _ page: String, _ sport: String) -> Int {
        let left = normalize(board)
        let right = normalize(page)
        if left.isEmpty || right.isEmpty { return 0 }
        if left == right { return 100 }
        if sport == "nba",
           let code = NBATeams.knownAbbreviation(for: board),
           code == NBATeams.knownAbbreviation(for: page) {
            return 90
        }
        if sport == "nfl", NFLTeamAssets.abbr(for: board) == NFLTeamAssets.abbr(for: page) {
            return 90
        }
        if sport == "cfb" || sport == "ncaab",
           CFBTeamAssets.team(for: board) != nil,
           CFBTeamAssets.team(for: page) != nil,
           CFBTeamAssets.abbr(for: board) == CFBTeamAssets.abbr(for: page) {
            return 90
        }
        if left.count >= 5, right.contains(left) { return 70 }
        if right.count >= 5, left.contains(right) { return 70 }
        let leftLast = left.split(separator: " ").last.map(String.init) ?? ""
        let rightLast = right.split(separator: " ").last.map(String.init) ?? ""
        if leftLast.count >= 5, leftLast == rightLast { return 60 }
        return 0
    }

    private static func normalize(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: ".", with: "")
            .replacingOccurrences(of: "'", with: "")
            .replacingOccurrences(of: "&", with: "and")
    }
}
