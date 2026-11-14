import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

struct NflPropLiveCardView: View {
    let playerId: String
    let board: NflPropBoardStore
    @State private var marketKey: String
    @State private var trends: NFLPropTrendsDetail?
    @State private var fetchedPage: NFLPropPlayerPage?

    init(selection: NflBoardSelection, board: NflPropBoardStore) {
        self.playerId = selection.playerId
        self.board = board
        _marketKey = State(initialValue: selection.market)
    }

    private var page: NFLPropPlayerPage? { board.page(id: playerId) ?? fetchedPage }

    var body: some View {
        ScrollView(.vertical) {
            if let page {
                VStack(alignment: .leading, spacing: 14) {
                    marketChips(page)
                    if let spot = board.spotlight(playerId: playerId, market: marketKey) {
                        spotlightCard(spot)
                    }
                    contextBlock(page)
                    trenchesBlock(page)
                    coverageBlock(page)
                    numberBlock(page)
                    if wheel(page) != nil { usageBlock(page) }
                    gameLogBlock(page)
                    matchupBlock(page)
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 110)
            } else {
                ProgressView("Loading the card")
                    .frame(maxWidth: .infinity)
                    .padding(.top, 40)
            }
        }
        .background(Color.appSurface.ignoresSafeArea())
        .navigationTitle(page?.playerName ?? "Player")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: playerId) {
            let bundle = await NFLPropPageService.shared.detail(playerId: playerId)
            fetchedPage = bundle.page
            trends = bundle.trends
            if marketKey.isEmpty, let first = (bundle.page ?? page)?.markets.first(where: \.isPosted)?.key {
                marketKey = first
            }
        }
    }

    private func marketChips(_ page: NFLPropPlayerPage) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(page.markets) { market in
                    let on = market.key == marketKey
                    let quote = board.quote(playerId: page.playerId, market: market.key)
                    Button {
                        marketKey = market.key
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(NflPropBoardCopy.compactMarket(market.label))
                                .font(.system(size: 12, weight: .bold))
                            HStack(spacing: 4) {
                                if let book = heroBook(market, quote) {
                                    SportsbookLogoView(logoURL: nil, bookKey: book, bookName: book, style: .compact)
                                        .frame(width: 14, height: 14)
                                }
                                if let line = market.line {
                                    Text(NflPropBoardCopy.formatLine(line))
                                        .foregroundStyle(NflCardInk.line)
                                }
                                if let over = market.overPrice {
                                    Text("O \(american(over))")
                                }
                                if let under = market.underPrice {
                                    Text("U \(american(under))")
                                }
                            }
                            .font(.system(size: 11, weight: .semibold))
                        }
                        .foregroundStyle(on ? Color.appPrimary : Color.appTextPrimary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .liquidGlassBackground(in: Capsule(), interactive: true)
                        .overlay(Capsule().stroke(on ? Color.appPrimary : Color.appBorder.opacity(0.35), lineWidth: on ? 1.5 : 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(!market.isPosted)
                }
            }
        }
    }

    @ViewBuilder
    private func spotlightCard(_ spot: NflPropSpotlightRow) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("🔦 Spotlight · #\(spot.boardRank ?? 0)")
                    .font(.system(size: 13, weight: .bold))
                Spacer()
                resultBadge(spot.result)
            }
            if let narrative = spot.narrative, !narrative.isEmpty {
                Text(sentenceCase(narrative))
                    .font(.system(size: 15))
                    .foregroundStyle(Color.appTextPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !spot.tells.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(spot.tells.enumerated()), id: \.offset) { _, tell in
                        tellRow(tell)
                    }
                }
            }
        }
        .padding(14)
        .background(Color.appSurface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(NflCardInk.green, lineWidth: 1.5))
    }

    private func contextBlock(_ page: NFLPropPlayerPage) -> some View {
        let facts = contextFacts(page)
        return card("Context") {
            HStack(spacing: 8) {
                GameCardTeamAvatar(teamName: page.team ?? "", sport: "nfl", size: 28)
                Text(matchupTitle(page))
                    .font(.system(size: 15, weight: .bold))
                GameCardTeamAvatar(teamName: page.opponent ?? "", sport: "nfl", size: 28)
            }
            if let kick = NflPropBoardCopy.kickoffLabel(page.kickoff) {
                Text(kick).font(.system(size: 12, weight: .medium)).foregroundStyle(Color.appTextMuted)
            }
            if facts.isEmpty {
                Text("Spread, total, and weather are not charted.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextMuted)
            } else {
                ForEach(facts, id: \.label) { fact in
                    HStack {
                        Text(fact.label).foregroundStyle(Color.appTextMuted)
                        Spacer()
                        Text(fact.value).fontWeight(.semibold)
                    }
                    .font(.system(size: 13))
                }
            }
        }
    }

    @ViewBuilder
    private func trenchesBlock(_ page: NFLPropPlayerPage) -> some View {
        let sentence = trenchSentence(page)
        let traits = rankedTraits(page)
        if sentence != nil || !traits.isEmpty {
            card("The trenches") {
                if let sentence {
                    Text("The line and the front")
                        .font(.system(size: 13, weight: .bold))
                    Text(sentence)
                        .font(.system(size: 14))
                        .fixedSize(horizontal: false, vertical: true)
                }
                if !traits.isEmpty {
                    Text("Where \(page.opponent ?? "the defense") sits against the league")
                        .font(.system(size: 13, weight: .bold))
                    ForEach(traits, id: \.key) { trait in
                        traitBar(trait, page: page)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func coverageBlock(_ page: NFLPropPlayerPage) -> some View {
        let identity = page.scheme?.defense?.identity
        let slices = wheel(page)
        let looks = lookRows(page)
        if identity != nil || slices != nil || !looks.isEmpty {
            card("Coverage") {
                if let identity {
                    Text(identity)
                        .font(.system(size: 14))
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let slices {
                    CoverageWheel(slices: slices)
                        .frame(height: 180)
                } else if looks.isEmpty {
                    Text("Coverage is not charted.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.appTextMuted)
                } else {
                    ForEach(looks, id: \.name) { look in
                        Text(look.sentence)
                            .font(.system(size: 13))
                            .foregroundStyle(look.above ? NflCardInk.green : NflCardInk.red)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
    }

    private func numberBlock(_ page: NFLPropPlayerPage) -> some View {
        let market = page.markets.first { $0.key == marketKey }
        let quote = board.quote(playerId: page.playerId, market: marketKey)
        let baseline = baselineValue(page)
        let line = market?.line
        let gap = baseline.flatMap { base in line.map { base - $0 } }
        return card("The number") {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                if let line {
                    Text(NflPropBoardCopy.formatLine(line))
                        .font(.system(size: 34, weight: .black, design: .rounded))
                        .foregroundStyle(NflCardInk.line)
                } else {
                    Text("no line yet")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color.appTextMuted)
                }
                if let market, let book = heroBook(market, quote) {
                    SportsbookLogoView(logoURL: nil, bookKey: book, bookName: book, style: .regular)
                        .frame(width: 22, height: 22)
                }
            }
            if let market {
                HStack(spacing: 12) {
                    if let over = market.overPrice { Text("Over \(american(over))") }
                    if let under = market.underPrice { Text("Under \(american(under))") }
                }
                .font(.system(size: 13, weight: .semibold))
            }
            if let gap, let line {
                let wash = abs(gap) < (marketKey.contains("yds") ? 0.5 : abs(line) * 0.03)
                Text(wash ? "wash vs his baseline" : "\(gap > 0 ? "+" : "−")\(String(format: "%.1f", abs(gap))) vs his baseline")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(wash ? Color.appTextMuted : (gap > 0 ? NflCardInk.green : NflCardInk.red))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.appSurfaceMuted, in: Capsule())
            }
        }
    }

    @ViewBuilder
    private func usageBlock(_ page: NFLPropPlayerPage) -> some View {
        let tiles = usageTiles(page)
        if !tiles.isEmpty {
            card("Usage") {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    ForEach(tiles, id: \.label) { tile in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(tile.label).font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.appTextMuted)
                            Text(tile.value).font(.system(size: 16, weight: .bold))
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(8)
                        .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
            }
        }
    }

    private func gameLogBlock(_ page: NFLPropPlayerPage) -> some View {
        let weeks = gradedWeeks()
        return card("Every game against that week's number") {
            if weeks.isEmpty {
                Text("This market is not charted.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextMuted)
            } else {
                GameLogChart(weeks: weeks)
                    .frame(height: 196)
            }
        }
    }

    @ViewBuilder
    private func matchupBlock(_ page: NFLPropPlayerPage) -> some View {
        let sections = fpSections(page)
        if !sections.isEmpty {
            ForEach(sections) { section in
                card(section.title) {
                    ownerLine(page)
                    if let hero = section.hero {
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Text(hero.value)
                                .font(.system(size: 26, weight: .bold, design: .rounded))
                                .foregroundStyle(hero.color)
                            Text(hero.caption)
                                .font(.system(size: 12))
                                .foregroundStyle(Color.appTextMuted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    if !section.lede.isEmpty {
                        Text(section.lede)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.appTextMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if section.rows.isEmpty {
                        Text("Not charted.")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.appTextMuted)
                    } else {
                        ForEach(section.rows) { row in
                            PropDuelRow(row: row, page: page)
                        }
                    }
                }
            }
        }
    }

    private func ownerLine(_ page: NFLPropPlayerPage) -> some View {
        HStack(spacing: 8) {
            NFLPlayerHeadshot(playerName: page.playerName, playerId: page.playerId, headshotUrl: page.headshotUrl, size: 28)
            Text(page.playerName)
                .font(.system(size: 13, weight: .bold))
                .lineLimit(1)
            Text("vs")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.appTextMuted)
            GameCardTeamAvatar(teamName: page.opponent ?? "", sport: "nfl", size: 26, colors: NFLTeamColors.colorPair(for: page.opponent ?? ""))
            Text(page.opponent ?? "")
                .font(.system(size: 13, weight: .bold))
            Spacer(minLength: 0)
        }
    }

    private func card<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.system(size: 16, weight: .bold))
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(light: 0xFFFFFF, dark: 0x202024), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.appBorder.opacity(0.6), lineWidth: 1))
    }

    private func resultBadge(_ result: String?) -> some View {
        let raw = (result ?? "").lowercased()
        let label = raw == "win" ? "Win" : raw == "loss" ? "Loss" : raw == "push" ? "Push" : "Pending"
        let color: Color = raw == "win" ? NflCardInk.green : raw == "loss" ? NflCardInk.red : Color.appTextMuted
        return Text(label)
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(color)
    }

    private func tellRow(_ tell: NflPropTell) -> some View {
        let dir = (tell.dir ?? "").lowercased()
        let context = dir.contains("context")
        let under = dir.contains("under")
        let color: Color = context ? Color.appTextMuted : (under ? NflCardInk.red : NflCardInk.green)
        let label = context ? "Context" : (under ? "Under" : (dir.isEmpty ? "Read" : dir.prefix(1).uppercased() + dir.dropFirst()))
        return HStack(alignment: .top, spacing: 8) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(color)
                .padding(.horizontal, 8)
                .frame(height: 22)
                .background(color.opacity(0.15), in: Capsule())
            VStack(alignment: .leading, spacing: 2) {
                if let src = tell.src, !src.isEmpty {
                    Text(src.uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.appTextMuted)
                }
                Text(sentenceCase(tell.text))
                    .font(.system(size: 13))
                    .foregroundStyle(context ? Color.appTextMuted : Color.appTextPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    /// Capitalize the first letter of each sentence. Stored tells often arrive
    /// as lowercase fragments. A period inside a number, like 0.21, stays put.
    private func sentenceCase(_ raw: String) -> String {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return text }
        var out = ""
        var capitalize = true
        let chars = Array(text)
        for index in chars.indices {
            let char = chars[index]
            if capitalize {
                if char.isWhitespace {
                    out.append(char)
                } else if char.isLetter {
                    out.append(contentsOf: String(char).uppercased())
                    capitalize = false
                } else {
                    out.append(char)
                    capitalize = false
                }
            } else {
                out.append(char)
                if char == "." || char == "!" || char == "?" {
                    let next = index + 1 < chars.count ? chars[index + 1] : nil
                    if next == nil || next?.isWhitespace == true || next == "\"" || next == "”" {
                        capitalize = true
                    }
                }
            }
        }
        return out
    }

    private func american(_ price: Int) -> String {
        price > 0 ? "+\(price)" : "\(price)"
    }

    private func heroBook(_ market: NFLPropPageMarket, _ quote: NflPropBookQuote?) -> String? {
        guard let quote else { return nil }
        var books: [String] = []
        if linesMatch(quote.overLine, market.line), let book = quote.overBook { books.append(book) }
        if linesMatch(quote.underLine, market.line), let book = quote.underBook, book != quote.overBook { books.append(book) }
        let have = Set(books.map { $0.lowercased() })
        if have.contains("draftkings") { return "draftkings" }
        if have.contains("fanduel") { return "fanduel" }
        return nil
    }

    private func linesMatch(_ book: Double?, _ page: Double?) -> Bool {
        guard let book, let page else { return book == nil && page == nil }
        return book == page
    }

    private func matchupTitle(_ page: NFLPropPlayerPage) -> String {
        let away = page.isHome == true ? (page.opponent ?? "") : (page.team ?? "")
        let home = page.isHome == true ? (page.team ?? "") : (page.opponent ?? "")
        return "\(away) at \(home)"
    }

    private func contextFacts(_ page: NFLPropPlayerPage) -> [(label: String, value: String)] {
        let home = page.isHome == true ? page.team : page.opponent
        let away = page.isHome == true ? page.opponent : page.team
        guard let row = board.slate.first(where: { $0.homeAb == home && $0.awayAb == away }) else { return [] }
        var facts: [(String, String)] = []
        if let spread = row.spreadClose {
            let teamSpread = page.isHome == true ? spread : -spread
            facts.append(("Team spread", "\(page.team ?? "") \(teamSpread > 0 ? "+" : "")\(NflPropBoardCopy.formatLine(teamSpread))"))
        }
        if let total = row.totalClose {
            facts.append(("Total", NflPropBoardCopy.formatLine(total)))
        }
        if let spread = row.spreadClose, let total = row.totalClose {
            let homeImplied = (total - spread) / 2
            let awayImplied = (total + spread) / 2
            facts.append(("Implied", "\(away ?? "") \(String(format: "%.1f", awayImplied)) · \(home ?? "") \(String(format: "%.1f", homeImplied))"))
        }
        if row.indoors == true {
            facts.append(("Weather", "Indoors"))
        } else if let summary = row.summary, !summary.isEmpty {
            facts.append(("Weather", summary))
        } else {
            var parts: [String] = []
            if let temp = row.tempF { parts.append("\(Int(temp.rounded()))°F") }
            if let wind = row.windMph { parts.append("wind \(Int(wind.rounded())) mph") }
            if !parts.isEmpty { facts.append(("Weather", parts.joined(separator: ", "))) }
        }
        return facts
    }

    private func baselineValue(_ page: NFLPropPlayerPage) -> Double? {
        let key: String? = switch marketKey {
        case "player_reception_yds": "rec_yds"
        case "player_receptions": "receptions"
        case "player_rush_yds": "rush_yds"
        case "player_rush_attempts": "rush_att"
        case "player_pass_yds": "pass_yds"
        case "player_pass_tds": "pass_td"
        case "player_pass_attempts": "pass_att"
        case "player_pass_completions": "completions"
        default: nil
        }
        guard let key else { return nil }
        return page.baseline[key]
    }

    private func family(_ page: NFLPropPlayerPage) -> String {
        if marketKey == "player_anytime_td" { return page.scheme?.kind == "receiving" ? "receiving" : "rushing" }
        if marketKey.contains("rush") { return "rushing" }
        if page.scheme?.kind == "qb" || marketKey.hasPrefix("player_pass") { return "passing" }
        return "receiving"
    }

    private func trenchSentence(_ page: NFLPropPlayerPage) -> String? {
        guard let trenches = page.fpCards?["trenches"] else { return nil }
        let pass = trenches["pass_pro_edge"]?.doubleValue
        let run = trenches["run_block_edge"]?.doubleValue
        let passLive = pass.map { abs($0) >= 0.03 } ?? false
        let runLive = run.map { abs($0) >= 0.03 } ?? false
        guard passLive || runLive else { return nil }
        let offense = page.team ?? "The offense"
        let defense = page.opponent ?? "the defense"
        let pocketWinner = (pass ?? 0) < 0 ? defense : offense
        let pocket = "\(pocketWinner) win the pocket"
        let ybc = trenches["line"]?["ol_ybc_per_att"]?.doubleValue
        let allowed = trenches["front"]?["dl_ybc_allowed"]?.doubleValue
        let ground = ybc.flatMap { yards in
            allowed.map { "\(offense) opens \(String(format: "%.2f", yards)) yards before contact against a \(defense) front giving up \(String(format: "%.2f", $0))" }
        }
        if runLive, let ground, !passLive || abs(run ?? 0) >= abs(pass ?? 0) {
            return passLive ? "\(ground). \(pocket)." : "\(ground)."
        }
        return runLive && ground != nil ? "\(pocket). \(ground!)." : "\(pocket)."
    }

    private func rankedTraits(_ page: NFLPropPlayerPage) -> [TraitBar] {
        let keys: [String]
        switch family(page) {
        case "rushing":
            keys = ["RushingConceptZoneAttemptsSuccessPercentage", "RushingConceptManAttemptsSuccessPercentage", "RushingAttemptsStuffsPercentage", "RushingRunsExplosivePercentage", "RushingYardsAfterContactPerAttempt"]
        case "passing":
            keys = ["PassingPressuredPercentage", "PassingSackedPercentage", "PassingCompletionsPercentage", "PassingDeepThrowAttemptsPercentage"]
        default:
            keys = ["ReceivingAlignmentWideTargetsPercentage", "ReceivingAlignmentSlotTargetsPercentage", "PassingYardsAfterCatchPercentage", "PassingTargetedReadCheckdownPercentage"]
        }
        let labels = [
            "RushingConceptZoneAttemptsSuccessPercentage": "Zone run success",
            "RushingConceptManAttemptsSuccessPercentage": "Man/gap run success",
            "RushingAttemptsStuffsPercentage": "Stuff rate",
            "RushingRunsExplosivePercentage": "Explosive runs",
            "RushingYardsAfterContactPerAttempt": "Yards after contact",
            "PassingPressuredPercentage": "Pressure rate",
            "PassingSackedPercentage": "Sack rate",
            "PassingCompletionsPercentage": "Completion rate",
            "PassingDeepThrowAttemptsPercentage": "Deep throws",
            "ReceivingAlignmentWideTargetsPercentage": "Targets out wide",
            "ReceivingAlignmentSlotTargetsPercentage": "Slot targets",
            "PassingYardsAfterCatchPercentage": "Yards after the catch",
            "PassingTargetedReadCheckdownPercentage": "Checkdowns",
        ]
        let traits = page.fpCards?["scheme"]?["defense_traits"]
        var rows: [TraitBar] = []
        for key in keys {
            guard let actual = traits?["\(key)_actual"]?.doubleValue,
                  let league = traits?["\(key)_league"]?.doubleValue, league != 0 else { continue }
            let gap = actual / league - 1
            if abs(gap) < 0.05 { continue }
            rows.append(TraitBar(key: key, label: labels[key] ?? key, gap: gap, rank: traits?["\(key)_rank"]?.intValue, of: traits?["\(key)_of"]?.intValue))
        }
        return rows.sorted { abs($0.gap) > abs($1.gap) }.prefix(4).map { $0 }
    }

    private func traitBar(_ trait: TraitBar, page: NFLPropPlayerPage) -> some View {
        let row = CenterRow(
            id: trait.key,
            label: trait.label,
            detail: "This defense against the league, at the same denominator.",
            valueText: percentGap(trait.gap),
            gap: trait.gap,
            wash: 0.05,
            scale: 1.4,
            rankText: rankText(trait.rank, trait.of)
        )
        return PropDuelRow(row: row, page: page)
    }

    private func wheel(_ page: NFLPropPlayerPage) -> [WheelSlice]? {
        let kind = page.scheme?.kind
        let fam = family(page)
        let qb = kind == "qb" && fam == "passing"
        let receiving = kind == "receiving" && fam == "receiving"
        guard qb || receiving, let splits = page.scheme?.playerSplits, !splits.isEmpty else { return nil }
        let names = qb ? ["man", "zone", "blitz", "one_high", "pressure", "two_high"] : ["man", "zone", "one_high", "two_high"]
        let usual = qb ? page.scheme?.playerOverall?.ypa : page.scheme?.playerOverall?.ypt
        var slices: [WheelSlice] = []
        for name in names {
            guard let cell = splits[name] else { continue }
            let value = qb ? cell.ypa : cell.ypt
            let rate = page.scheme?.defense?.dims[name]?.rate
            guard let value, let rate, rate > 0 else { continue }
            slices.append(WheelSlice(name: lookLabel(name), pct: rate, value: value, above: usual.map { value >= $0 } ?? true))
        }
        return slices.isEmpty ? nil : slices
    }

    private func lookRows(_ page: NFLPropPlayerPage) -> [LookRow] {
        guard wheel(page) == nil, let scheme = page.scheme else { return [] }
        let fam = family(page)
        let names = fam == "passing" ? ["man", "zone", "two_high", "pressure", "blitz"] : fam == "rushing" ? ["heavy_box", "light_box"] : ["zone", "man", "two_high"]
        let source = fam == "rushing" ? scheme.rushSplits : scheme.playerSplits
        let usual = fam == "rushing" ? scheme.rushOverall?.ypc : (scheme.playerOverall?.ypt ?? scheme.playerOverall?.ypa)
        return names.compactMap { name in
            guard let cell = source[name] else { return nil }
            let value = cell.ypt ?? cell.ypa ?? cell.ypc
            guard let value else { return nil }
            let above = usual.map { value >= $0 } ?? true
            let rate = scheme.defense?.dims[name]?.rate
            let how = rate.map { "\(lookLabel(name)) on \(Int(($0 * 100).rounded()))% of snaps" } ?? lookLabel(name)
            return LookRow(name: name, sentence: "\(how). \(String(format: "%.2f", value)) \(above ? "above" : "below") his usual.", above: above)
        }
    }

    private func usageTiles(_ page: NFLPropPlayerPage) -> [(label: String, value: String)] {
        let role = page.fpCards?["role"]
        let pairs: [(String, String)] = [
            ("Targets / game", "targets_per_game"),
            ("Routes / game", "routes_per_game"),
            ("Slot share", "align_slot_share"),
            ("Wide share", "align_wide_share"),
        ]
        return pairs.compactMap { label, key in
            guard let value = role?[key]?.doubleValue else { return nil }
            let shown = key.contains("share") ? String(format: "%.0f%%", value * 100) : String(format: "%.1f", value)
            return (label, shown)
        }
    }

    private func gradedWeeks() -> [LogWeek] {
        let games = trends?.recentGameLog ?? []
        let current = games.filter { $0.season == (page?.season ?? 0) && $0.actuals[marketKey] != nil && $0.lines[marketKey] != nil }
        let source = current.count >= 8 ? current : games
        let weeks = source.compactMap { game -> LogWeek? in
            guard let actual = game.actuals[marketKey], let line = game.lines[marketKey] else { return nil }
            return LogWeek(id: "\(game.season)-\(game.week)", week: game.week, opp: game.opp, actual: actual, line: line, cleared: actual > line)
        }
        return Array(weeks.prefix(10).reversed())
    }

    private func fpSections(_ page: NFLPropPlayerPage) -> [FpSection] {
        let defense = page.opponent ?? "the defense"
        let player = lastName(page.playerName)
        let allowed = allowedSections(position: page.position ?? "", market: marketKey)
        var sections: [FpSection] = []
        if allowed.contains("vs_position"), let row = allowanceRow(page, defense: defense) {
            sections.append(FpSection(title: "What \(defense) allows", lede: "", hero: nil, rows: [row]))
        }
        if allowed.contains("run_concept"), let section = conceptSection(page, defense: defense, player: player) {
            sections.append(section)
        }
        if allowed.contains("alignment"), let section = alignmentSection(page, defense: defense, player: player) {
            sections.append(section)
        }
        if allowed.contains("routes"), let section = routeSection(page, defense: defense, player: player) {
            sections.append(section)
        }
        return sections
    }

    private func allowedSections(position: String, market: String) -> Set<String> {
        let pos = position.uppercased()
        let recv = pos == "WR" || pos == "TE"
        let back = pos == "RB" || pos == "FB"
        let rush = market == "player_rush_yds" || market == "player_rush_attempts"
        let receiving = market == "player_reception_yds" || market == "player_receptions"
        let passing = market == "player_pass_yds" || market == "player_pass_tds" || market == "player_pass_attempts" || market == "player_pass_completions"
        if market == "player_anytime_td" { return ["vs_position"] }
        var out: Set<String> = []
        if recv && receiving { out.formUnion(["routes", "alignment", "vs_position"]) }
        if (back || pos == "QB") && rush { out.formUnion(["run_concept", "vs_position"]) }
        if back && receiving { out.formUnion(["routes", "alignment", "vs_position"]) }
        if pos == "QB" && passing { out.insert("vs_position") }
        return out
    }

    private func allowanceRow(_ page: NFLPropPlayerPage, defense: String) -> CenterRow? {
        guard let spec = vsPositionStat(market: marketKey, position: page.position ?? ""),
              let bag = page.fpCards?["matchup"]?["vs_position"],
              let actual = bag["\(spec.key)_actual"]?.doubleValue,
              let league = bag["\(spec.key)_league"]?.doubleValue, league != 0 else { return nil }
        let gap = (actual - league) / league
        return CenterRow(
            id: spec.key,
            label: spec.unit,
            detail: "\(defense) allow \(String(format: "%.1f", actual)) \(spec.unit). A league-average defense allows \(String(format: "%.1f", league)).",
            valueText: percentGap(gap),
            gap: gap,
            wash: 0.03,
            scale: 1.4,
            rankText: rankText(bag["\(spec.key)_rank"]?.intValue, bag["\(spec.key)_of"]?.intValue)
        )
    }

    private func vsPositionStat(market: String, position: String) -> (key: String, unit: String)? {
        if market == "player_anytime_td" {
            if position.uppercased() == "QB" || position.uppercased() == "RB" {
                return ("rush_tds", "rushing touchdowns a game")
            }
            return ("rec_tds", "receiving touchdowns a game")
        }
        switch market {
        case "player_reception_yds": return ("rec_yds", "receiving yards a game")
        case "player_receptions": return ("receptions", "catches a game")
        case "player_rush_yds": return ("rush_yds", "rushing yards a game")
        case "player_rush_attempts": return ("rush_att", "carries a game")
        case "player_pass_yds": return ("pass_yds", "passing yards a game")
        case "player_pass_tds": return ("pass_tds", "passing touchdowns a game")
        case "player_pass_attempts", "player_pass_completions": return ("pass_att", "pass attempts a game")
        default: return nil
        }
    }

    private func conceptSection(_ page: NFLPropPlayerPage, defense: String, player: String) -> FpSection? {
        guard let by = page.fpCards?["run_concept"]?["by"]?.objectValue else { return nil }
        let rows: [CenterRow] = by.compactMap { key, cell in
            guard let actual = cell["def_yards_per_attempt"]?.doubleValue,
                  let league = cell["def_yards_per_attempt_league"]?.doubleValue, league != 0 else { return nil }
            let name = prettyName(key)
            let gap = (actual - league) / league
            var lead = ""
            if let his = cell["yards_per_attempt"]?.doubleValue {
                lead += "He gains \(String(format: "%.2f", his)) yards a carry"
            }
            if let attempts = cell["attempts"]?.doubleValue {
                lead += lead.isEmpty ? "" : " on "
                lead += "\(String(format: "%.0f", attempts)) \(name.lowercased()) carries"
            }
            if !lead.isEmpty { lead += ". " }
            return CenterRow(
                id: key,
                label: name,
                detail: "\(lead)\(defense) allow \(String(format: "%.2f", actual)) yards a carry. The league allows \(String(format: "%.2f", league)).",
                valueText: percentGap(gap),
                gap: gap,
                wash: 0.03,
                scale: 1.4,
                rankText: rankText(cell["def_rank"]?.intValue, cell["def_of"]?.intValue)
            )
        }
        .sorted { lhs, rhs in
            let left = by[lhs.id]?["attempts"]?.doubleValue ?? 0
            let right = by[rhs.id]?["attempts"]?.doubleValue ?? 0
            return left > right
        }
        guard !rows.isEmpty else { return nil }
        let yardNet = rows.reduce(0.0) { sum, row in
            let cell = by[row.id]
            let actual = cell?["def_yards_per_attempt"]?.doubleValue ?? 0
            let league = cell?["def_yards_per_attempt_league"]?.doubleValue ?? 0
            return sum + (actual - league)
        } / Double(rows.count)
        return FpSection(
            title: "How he runs",
            lede: "Each row is a run concept. The bar is what \(defense) allow on that concept against the league, so it points at \(sidePhrase(yardNet, wash: 0.15, player: player, defense: defense)).",
            hero: nil,
            rows: rows
        )
    }

    private func alignmentSection(_ page: NFLPropPlayerPage, defense: String, player: String) -> FpSection? {
        let spots = page.fpCards?["playsheet"]?["spots"]?.objectValue ?? [:]
        let align = page.fpCards?["matchup"]?["vs_alignment"]?.objectValue ?? [:]
        let labels = ["slot": "Slot", "wide": "Out wide", "inline": "Inline", "backfield": "Backfield"]
        struct Spot { let key: String; let routes: Double; let actual: Double; let league: Double; let rank: Int?; let of: Int? }
        let entries: [Spot] = spots.compactMap { key, spot in
            guard let routes = spot["routes"]?.doubleValue, routes > 0,
                  let actual = align[key]?["yds_actual"]?.doubleValue,
                  let league = align[key]?["yds_league"]?.doubleValue, league != 0 else { return nil }
            return Spot(key: key, routes: routes, actual: actual, league: league, rank: align[key]?["yds_rank"]?.intValue, of: align[key]?["yds_of"]?.intValue)
        }
        let total = entries.reduce(0) { $0 + $1.routes }
        guard total > 0 else { return nil }
        var net = 0.0
        let rows: [CenterRow] = entries.sorted { $0.routes > $1.routes }.map { spot in
            let share = spot.routes / total
            let gap = (spot.actual - spot.league) / spot.league
            net += share * (spot.actual - spot.league)
            let label = labels[spot.key] ?? prettyName(spot.key)
            let whereText = label == "Out wide" ? "out wide" : "in the \(label.lowercased())"
            return CenterRow(
                id: spot.key,
                label: label,
                detail: "\(String(format: "%.1f", share * 100))% of his routes start \(whereText). \(defense) allow \(String(format: "%.1f", spot.actual)) yards a game to receivers lined up there. A league-average defense allows \(String(format: "%.1f", spot.league)).",
                valueText: percentGap(gap),
                gap: gap,
                wash: 0.03,
                scale: 1.4,
                rankText: rankText(spot.rank, spot.of)
            )
        }
        let tone = sideColor(net, wash: 1)
        return FpSection(
            title: "Where he lines up",
            lede: "",
            hero: SectionHero(
                value: signedYards(net),
                caption: "\(sidePhrase(net, wash: 1, player: player, defense: defense)) — weighted by where his routes actually start",
                color: tone
            ),
            rows: rows
        )
    }

    private func routeSection(_ page: NFLPropPlayerPage, defense: String, player: String) -> FpSection? {
        guard let routes = page.fpCards?["routes"]?.arrayValue else { return nil }
        let built: [CenterRow] = routes.compactMap { leaf in
            guard let label = leaf["route"]?.stringValue,
                  let actual = leaf["def_yards_per_route_actual"]?.doubleValue,
                  let league = leaf["def_yards_per_route_league"]?.doubleValue else { return nil }
            let gap = actual - league
            let share = leaf["share"]?.doubleValue
            let perGame = leaf["routes"]?.doubleValue
            let shareText = share.map { String(format: "%.1f%% of his routes", $0 * 100) } ?? "A branch of his tree"
            let volume = perGame.map { String(format: ", %.1f a game", $0) } ?? ""
            return CenterRow(
                id: label,
                label: prettyName(label),
                detail: "\(shareText)\(volume). \(defense) allow \(String(format: "%.2f", actual)) yards a route on \(label.lowercased()) routes. The league allows \(String(format: "%.2f", league)).",
                valueText: yardGap(gap),
                gap: gap,
                wash: 0.05,
                scale: 0.16,
                rankText: rankText(leaf["def_rank"]?.intValue, leaf["def_of"]?.intValue)
            )
        }
        .sorted { lhs, rhs in
            let left = routes.first { $0["route"]?.stringValue == lhs.id }?["share"]?.doubleValue ?? 0
            let right = routes.first { $0["route"]?.stringValue == rhs.id }?["share"]?.doubleValue ?? 0
            return left > right
        }
        guard !built.isEmpty else { return nil }
        let net = built.reduce(0.0) { sum, row in
            let share = routes.first { $0["route"]?.stringValue == row.id }?["share"]?.doubleValue ?? (1 / Double(built.count))
            return sum + share * row.gap
        }
        let tone = sideColor(net, wash: 0.05)
        return FpSection(
            title: "His route tree",
            lede: "",
            hero: SectionHero(
                value: signedYards(net),
                caption: "\(sidePhrase(net, wash: 0.05, player: player, defense: defense)) — each branch against what an average defense allows",
                color: tone
            ),
            rows: built
        )
    }

    private func prettyName(_ raw: String) -> String {
        let cleaned = raw.replacingOccurrences(of: "_", with: " ")
        return cleaned == cleaned.lowercased() ? cleaned.capitalized : cleaned
    }

    private func sideColor(_ gap: Double, wash: Double) -> Color {
        abs(gap) < wash ? Color.appTextMuted : (gap > 0 ? NflCardInk.green : NflCardInk.red)
    }

    private func sidePhrase(_ gap: Double, wash: Double, player: String, defense: String) -> String {
        if abs(gap) < wash { return "a wash" }
        return gap > 0 ? "\(player)'s side" : "\(defense)'s side"
    }

    private func signedYards(_ value: Double) -> String {
        let mark = value > 0 ? "+" : value < 0 ? "−" : ""
        return "\(mark)\(String(format: "%.1f", abs(value))) yds"
    }

    private func percentGap(_ gap: Double) -> String {
        "\(gap > 0 ? "+" : "−")\(String(format: "%.1f", abs(gap * 100)))%"
    }

    private func yardGap(_ gap: Double) -> String {
        "\(gap > 0 ? "+" : "−")\(String(format: "%.1f", abs(gap))) yds"
    }

    private func rankText(_ rank: Int?, _ of: Int?) -> String? {
        guard let rank, of == 32 else { return nil }
        return "\(rank)\(ordinalSuffix(rank)) of 32"
    }

    private func lastName(_ name: String) -> String {
        name.split(separator: " ").last.map(String.init) ?? name
    }

    private func lookLabel(_ name: String) -> String {
        switch name {
        case "two_high": return "Two high"
        case "one_high": return "One high"
        case "heavy_box": return "Heavy box"
        case "light_box": return "Light box"
        default: return name.capitalized
        }
    }

    private func ordinalSuffix(_ n: Int) -> String {
        let mod = n % 100
        if (11...13).contains(mod) { return "th" }
        switch n % 10 {
        case 1: return "st"
        case 2: return "nd"
        case 3: return "rd"
        default: return "th"
        }
    }
}

private struct TraitBar {
    let key: String
    let label: String
    let gap: Double
    let rank: Int?
    let of: Int?
}

private struct WheelSlice {
    let name: String
    let pct: Double
    let value: Double
    let above: Bool
}

private struct LookRow {
    let name: String
    let sentence: String
    let above: Bool
}

private struct LogWeek: Identifiable {
    let id: String
    let week: Int
    let opp: String
    let actual: Double
    let line: Double
    let cleared: Bool
}

private struct CenterRow: Identifiable {
    let id: String
    let label: String
    let detail: String
    let valueText: String
    let gap: Double
    let wash: Double
    /// How far a 1.0 gap travels across the track. Percent gaps use 1.4. Yard gaps use 0.16.
    let scale: Double
    let rankText: String?
}

private struct SectionHero {
    let value: String
    let caption: String
    let color: Color
}

private struct FpSection: Identifiable {
    let title: String
    let lede: String
    let hero: SectionHero?
    let rows: [CenterRow]
    var id: String { title }
}

private struct PropDuelRow: View {
    let row: CenterRow
    let page: NFLPropPlayerPage

    var body: some View {
        let washed = abs(row.gap) < row.wash
        let color: Color = washed ? Color.appTextMuted : (row.gap > 0 ? NflCardInk.green : NflCardInk.red)
        let winner = row.gap > 0 ? lastName(page.playerName) : (page.opponent ?? "Defense")
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(row.label)
                        .font(.system(size: 15, weight: .bold))
                    Text(row.detail)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .trailing, spacing: 3) {
                    if !washed {
                        HStack(spacing: 4) {
                            winnerMark(size: 16)
                            Text(winner.uppercased())
                                .font(.system(size: 10, weight: .bold))
                                .lineLimit(1)
                        }
                        .foregroundStyle(color)
                        .padding(.leading, 3)
                        .padding(.trailing, 7)
                        .padding(.vertical, 2)
                        .background(color.opacity(0.12), in: Capsule())
                        .overlay(Capsule().strokeBorder(color.opacity(0.3), lineWidth: 1))
                    }
                    Text(washed ? "Wash" : row.valueText)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(color)
                    if let rank = row.rankText {
                        Text(rank)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(color)
                    }
                }
            }
            DuelTrack(gap: row.gap, wash: row.wash, scale: row.scale, color: color) {
                winnerMark(size: 17)
            }
        }
        .padding(.vertical, 8)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.appBorder.opacity(0.35)).frame(height: 1)
        }
    }

    @ViewBuilder
    private func winnerMark(size: CGFloat) -> some View {
        if row.gap > 0 {
            NFLPlayerHeadshot(playerName: page.playerName, playerId: page.playerId, headshotUrl: page.headshotUrl, size: size)
        } else {
            GameCardTeamAvatar(teamName: page.opponent ?? "", sport: "nfl", size: size, colors: NFLTeamColors.colorPair(for: page.opponent ?? ""))
        }
    }

    private func lastName(_ name: String) -> String {
        name.split(separator: " ").last.map(String.init) ?? name
    }
}

private struct DuelTrack<Mark: View>: View {
    let gap: Double
    let wash: Double
    let scale: Double
    let color: Color
    @ViewBuilder var mark: () -> Mark

    var body: some View {
        GeometryReader { geo in
            let reach = min(geo.size.width * 0.48, geo.size.width * CGFloat(abs(gap) * scale))
            let live = abs(gap) >= wash && reach > 2
            ZStack {
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(Color.appBorder.opacity(0.45))
                Rectangle()
                    .fill(Color.appTextPrimary.opacity(0.7))
                    .frame(width: 1.5, height: 18)
                if live {
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(color)
                        .frame(width: reach, height: 12)
                        .offset(x: gap > 0 ? reach / 2 : -reach / 2)
                    mark()
                        .position(
                            x: geo.size.width / 2 + (gap > 0 ? reach - 9 : -(reach - 9)),
                            y: geo.size.height / 2
                        )
                }
            }
        }
        .frame(height: 18)
    }
}

private struct CoverageWheel: View {
    let slices: [WheelSlice]

    var body: some View {
        let total = slices.reduce(0) { $0 + $1.pct }
        Canvas { context, size in
            let side = min(size.width, size.height)
            let rect = CGRect(x: (size.width - side) / 2, y: 0, width: side, height: side).insetBy(dx: 18, dy: 18)
            var start = Angle.degrees(-90)
            for slice in slices {
                let sweep = Angle.degrees(360 * (slice.pct / max(total, 0.01)))
                var path = Path()
                path.addArc(center: CGPoint(x: rect.midX, y: rect.midY), radius: rect.width / 2, startAngle: start, endAngle: start + sweep, clockwise: false)
                path.addLine(to: CGPoint(x: rect.midX, y: rect.midY))
                context.fill(path, with: .color(slice.above ? NflCardInk.green : NflCardInk.red))
                start += sweep
            }
            let hole = rect.insetBy(dx: rect.width * 0.28, dy: rect.width * 0.28)
            context.fill(Path(ellipseIn: hole), with: .color(Color(light: 0xFFFFFF, dark: 0x202024)))
        }
        .overlay(alignment: .bottom) {
            Text(slices.map { "\($0.name) \(Int(($0.pct * 100).rounded()))%" }.joined(separator: " · "))
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Color.appTextMuted)
                .lineLimit(2)
                .multilineTextAlignment(.center)
        }
    }
}

private struct GameLogChart: View {
    let weeks: [LogWeek]

    var body: some View {
        let peak = max(weeks.map(\.actual).max() ?? 1, weeks.map(\.line).max() ?? 1, 1)
        HStack(alignment: .bottom, spacing: 6) {
            ForEach(weeks) { week in
                VStack(spacing: 4) {
                    Text(NflPropBoardCopy.formatLine(week.actual))
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(week.cleared ? NflCardInk.green : NflCardInk.red)
                    GeometryReader { geo in
                        let height = max(4, geo.size.height * week.actual / peak)
                        let tick = geo.size.height * week.line / peak
                        ZStack(alignment: .bottom) {
                            RoundedRectangle(cornerRadius: 3, style: .continuous)
                                .fill(week.cleared ? NflCardInk.green : NflCardInk.red)
                                .frame(height: height)
                            Rectangle()
                                .fill(Color.appTextPrimary)
                                .frame(height: 2)
                                .offset(y: -(tick - 1))
                        }
                        .frame(maxHeight: .infinity, alignment: .bottom)
                    }
                    Text("W\(week.week)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Color.appTextMuted)
                    GameCardTeamAvatar(teamName: week.opp, sport: "nfl", size: 18, colors: NFLTeamColors.colorPair(for: week.opp))
                    Text(NflPropBoardCopy.formatLine(week.line))
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Color.appTextMuted)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}
