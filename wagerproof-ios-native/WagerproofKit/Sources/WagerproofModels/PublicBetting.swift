import Foundation

/// Action Network public-betting read. Port of `src/features/publicBetting/signals.ts`.
/// The current line is the consensus book (`away_cons` / `home_cons`). Close columns
/// are best-price-per-side and are never averaged — that produced quarter-point lines
/// no book posts. Ticket share describes the crowd and never gates a money category.
public enum PublicMarket: String, Codable, Hashable, Sendable, CaseIterable {
    case spread, total, ml

    public var label: String {
        switch self {
        case .spread: return "Spread"
        case .total: return "Total"
        case .ml: return "Moneyline"
        }
    }

    public var noun: String {
        switch self {
        case .spread: return "spread"
        case .total: return "total"
        case .ml: return "moneyline"
        }
    }

    /// Smallest move that counts as the line following. Points, or no-vig share for moneyline.
    var confirmMove: Double {
        switch self {
        case .spread, .total: return 0.5
        case .ml: return 0.02
        }
    }

    var strongMove: Double {
        switch self {
        case .spread, .total: return 1.5
        case .ml: return 0.05
        }
    }
}

public enum PublicSide: String, Hashable, Sendable {
    case away, home

    var other: PublicSide { self == .away ? .home : .away }
}

public enum PublicCategory: String, Hashable, Sendable {
    case sharpMoney = "sharp_money"
    case moneyNoMove = "money_no_move"
    case hammered
    case lineFightsMoney = "line_fights_money"
    case publicLoading = "public_loading"
    case consensus
    case linePushesBack = "line_pushes_back"
    case `public`
    case split

    /// Lower leads the feed.
    public var rank: Int {
        switch self {
        case .sharpMoney: return 0
        case .moneyNoMove: return 1
        case .hammered: return 2
        case .lineFightsMoney: return 3
        case .publicLoading: return 4
        case .consensus: return 5
        case .linePushesBack: return 6
        case .public: return 7
        case .split: return 8
        }
    }

    /// `linePushesBack` stays quiet on purpose. It is the common description,
    /// not an alert. `split` renders no chip.
    public var emphasis: PublicEmphasis {
        switch self {
        case .sharpMoney: return .loud
        case .moneyNoMove, .hammered: return .medium
        case .lineFightsMoney, .publicLoading, .consensus, .linePushesBack, .public: return .quiet
        case .split: return .none
        }
    }
}

public enum PublicEmphasis: String, Hashable, Sendable {
    case loud, medium, quiet, none
}

public struct PublicLineQuote: Hashable, Sendable {
    public var movedToward: PublicSide?
    public var moveSize: Double?
    public var open: Double?
    public var current: Double?
    public var homeOpen: Double?
    public var homeCurrent: Double?

    public init(
        movedToward: PublicSide?,
        moveSize: Double?,
        open: Double?,
        current: Double?,
        homeOpen: Double?,
        homeCurrent: Double?
    ) {
        self.movedToward = movedToward
        self.moveSize = moveSize
        self.open = open
        self.current = current
        self.homeOpen = homeOpen
        self.homeCurrent = homeCurrent
    }
}

public struct PublicMarketInput: Sendable {
    public var market: PublicMarket
    public var awayName: String
    public var homeName: String
    public var awayOpen: Double?
    public var homeOpen: Double?
    public var awayCons: Double?
    public var homeCons: Double?
    public var betsAway: Double?
    public var betsHome: Double?
    public var moneyAway: Double?
    public var moneyHome: Double?
    public var tickets: Double?
    public var hasSplit: Bool

    public init(
        market: PublicMarket,
        awayName: String,
        homeName: String,
        awayOpen: Double?,
        homeOpen: Double?,
        awayCons: Double?,
        homeCons: Double?,
        betsAway: Double?,
        betsHome: Double?,
        moneyAway: Double?,
        moneyHome: Double?,
        tickets: Double?,
        hasSplit: Bool
    ) {
        self.market = market
        self.awayName = awayName
        self.homeName = homeName
        self.awayOpen = awayOpen
        self.homeOpen = homeOpen
        self.awayCons = awayCons
        self.homeCons = homeCons
        self.betsAway = betsAway
        self.betsHome = betsHome
        self.moneyAway = moneyAway
        self.moneyHome = moneyHome
        self.tickets = tickets
        self.hasSplit = hasSplit
    }
}

public struct PublicMarketRead: Hashable, Sendable {
    public var market: PublicMarket
    public var ticketSide: PublicSide?
    public var ticketLead: Double
    public var moneyTiltSide: PublicSide?
    public var tiltPp: Double
    public var movedToward: PublicSide?
    public var moveSize: Double?
    public var open: Double?
    public var current: Double?
    public var homeOpen: Double?
    public var homeCurrent: Double?
    public var betsAway: Double
    public var betsHome: Double
    public var moneyAway: Double
    public var moneyHome: Double
    public var category: PublicCategory?
    public var emphasis: PublicEmphasis
    public var strong: Bool
    public var chip: String
    public var sentence: String
    public var excluded: Bool
    public var awaySideName: String
    public var homeSideName: String
    /// Absolute ticket count on this market. Blank while Action omits volume.
    public var tickets: Double?
}

public enum PublicBoardSort: String, CaseIterable, Identifiable, Sendable {
    case sharp, time, money, diff

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .sharp: return "Sharp"
        case .time: return "Time"
        case .money: return "Money %"
        case .diff: return "Difference"
        }
    }
}

public struct PublicMoneyGap: Hashable, Sendable {
    public var side: PublicSide
    public var points: Int
    public var name: String
}

public struct PublicLineCaption: Hashable, Sendable {
    public var mark: String
    public var text: String
    public var flat: Bool
    public var openerMissing: Bool
}

public struct PublicBettingGame: Identifiable, Hashable, Sendable {
    public var id: String { "\(sport)-\(gameId)" }
    public var gameId: Int
    public var sport: String
    public var away: String
    public var home: String
    public var startTime: String?
    public var capturedAt: Date?
    public var tickets: Int?
    public var reads: [PublicMarket: PublicMarketRead]
}

/// One row of `action_public_splits_board`. Extra columns are ignored.
public struct PublicBoardRow: Decodable, Sendable {
    public var gameId: Int
    public var market: String
    public var sport: String
    public var startTime: String?
    public var away: String
    public var home: String
    public var snapTs: String?
    public var awayOpen: Double?
    public var homeOpen: Double?
    public var awayCons: Double?
    public var homeCons: Double?
    public var betsAway: Double?
    public var betsHome: Double?
    public var moneyAway: Double?
    public var moneyHome: Double?
    public var tickets: Double?
    public var hasSplit: Bool

    enum CodingKeys: String, CodingKey {
        case gameId = "game_id"
        case market, sport
        case startTime = "start_time"
        case away, home
        case snapTs = "snap_ts"
        case awayOpen = "away_open"
        case homeOpen = "home_open"
        case awayCons = "away_cons"
        case homeCons = "home_cons"
        case betsAway = "bets_away"
        case betsHome = "bets_home"
        case moneyAway = "money_away"
        case moneyHome = "money_home"
        case tickets
        case hasSplit = "has_split"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        gameId = c.flexInt(.gameId) ?? 0
        market = (try? c.decodeIfPresent(String.self, forKey: .market)) ?? ""
        sport = (try? c.decodeIfPresent(String.self, forKey: .sport)) ?? ""
        startTime = try? c.decodeIfPresent(String.self, forKey: .startTime)
        away = (try? c.decodeIfPresent(String.self, forKey: .away)) ?? ""
        home = (try? c.decodeIfPresent(String.self, forKey: .home)) ?? ""
        snapTs = try? c.decodeIfPresent(String.self, forKey: .snapTs)
        awayOpen = c.flexDouble(.awayOpen)
        homeOpen = c.flexDouble(.homeOpen)
        awayCons = c.flexDouble(.awayCons)
        homeCons = c.flexDouble(.homeCons)
        betsAway = c.flexDouble(.betsAway)
        betsHome = c.flexDouble(.betsHome)
        moneyAway = c.flexDouble(.moneyAway)
        moneyHome = c.flexDouble(.moneyHome)
        tickets = c.flexDouble(.tickets)
        hasSplit = c.flexBool(.hasSplit)
    }
}

public enum PublicBetting {
    public static let divergeTilt = 10.0
    public static let strongTilt = 20.0
    public static let heavyTickets = 60.0
    public static let minTickets = 200.0
    /// Label inside `split` only. Never decides the category or whether a row is shown.
    public static let leanTickets = 55.0
    /// Moneyline only. A 12/88 spread is a real lopsided game, not noise.
    public static let mlMinMinority = 15.0

    public static func impliedProbability(_ american: Double) -> Double {
        if american < 0 { return -american / (-american + 100) }
        return 100 / (american + 100)
    }

    public static func formatLine(_ market: PublicMarket, _ value: Double) -> String {
        if market == .ml {
            let rounded = Int(value.rounded())
            return rounded > 0 ? "+\(rounded)" : "\(rounded)"
        }
        let rounded = (value * 100).rounded() / 100
        if market == .spread && rounded == 0 { return "PK" }
        let text = plain(rounded)
        if market == .spread && rounded > 0 { return "+\(text)" }
        return text
    }

    /// Consensus minus opener. A missing opener stays nil — it is never treated as 0.
    /// Spread and moneyline home numbers come from `homeCons`, never by negating the away number.
    public static func lineDirection(_ input: PublicMarketInput) -> PublicLineQuote {
        let awayOpen = finite(input.awayOpen)
        let homeOpen = finite(input.homeOpen)
        let awayCons = finite(input.awayCons)
        let homeCons = finite(input.homeCons)

        if input.market == .total {
            guard let awayOpen, let awayCons else {
                return PublicLineQuote(movedToward: nil, moveSize: nil, open: awayOpen, current: nil, homeOpen: nil, homeCurrent: nil)
            }
            let move = awayCons - awayOpen
            return PublicLineQuote(
                movedToward: move == 0 ? nil : (move > 0 ? .away : .home),
                moveSize: abs(move),
                open: awayOpen,
                current: awayCons,
                homeOpen: nil,
                homeCurrent: nil
            )
        }

        if input.market == .spread {
            guard let awayOpen, let awayCons else {
                return PublicLineQuote(movedToward: nil, moveSize: nil, open: awayOpen, current: nil, homeOpen: homeOpen, homeCurrent: nil)
            }
            let move = awayCons - awayOpen
            return PublicLineQuote(
                movedToward: move == 0 ? nil : (move < 0 ? .away : .home),
                moveSize: abs(move),
                open: awayOpen,
                current: awayCons,
                homeOpen: homeOpen,
                homeCurrent: homeCons
            )
        }

        let priced = awayOpen != nil && homeOpen != nil && awayCons != nil && homeCons != nil
        guard priced, let awayOpen, let homeOpen, let awayCons, let homeCons else {
            return PublicLineQuote(
                movedToward: nil, moveSize: nil,
                open: awayOpen, current: awayCons,
                homeOpen: homeOpen, homeCurrent: homeCons
            )
        }
        let move = deviggedAway(awayCons, homeCons) - deviggedAway(awayOpen, homeOpen)
        return PublicLineQuote(
            movedToward: move == 0 ? nil : (move > 0 ? .away : .home),
            moveSize: abs(move),
            open: awayOpen,
            current: awayCons,
            homeOpen: homeOpen,
            homeCurrent: homeCons
        )
    }

    public static func quoteLine(
        market: PublicMarket,
        awayName: String,
        homeName: String,
        quote: PublicLineQuote
    ) -> String {
        if market == .total {
            if quote.open == nil && quote.current == nil { return "Line unavailable" }
            if quote.open == nil || quote.current == nil {
                guard let only = quote.current ?? quote.open else { return "Line unavailable" }
                return formatLine(.total, only)
            }
            return "\(formatLine(.total, quote.open!)) → \(formatLine(.total, quote.current!))"
        }

        func side(_ name: String, open: Double?, current: Double?) -> String {
            if let open, let current {
                return "\(name) \(formatLine(market, open)) → \(formatLine(market, current))"
            }
            if let current { return "\(name) \(formatLine(market, current))" }
            if let open { return "\(name) \(formatLine(market, open))" }
            return ""
        }
        let away = side(awayName, open: quote.open, current: quote.current)
        let home = side(homeName, open: quote.homeOpen, current: quote.homeCurrent)
        let joined = [away, home].filter { !$0.isEmpty }.joined(separator: " · ")
        return joined.isEmpty ? "Line unavailable" : joined
    }

    public static func read(_ input: PublicMarketInput) -> PublicMarketRead {
        let awaySide = sideName(input.market, .away, input.awayName, input.homeName)
        let homeSide = sideName(input.market, .home, input.awayName, input.homeName)
        let betsAway = input.betsAway
        let betsHome = input.betsHome
        let moneyKnown = input.moneyAway != nil && input.moneyHome != nil
        let moneyAway = input.moneyAway ?? 0
        let moneyHome = input.moneyHome ?? 0
        let direction = lineDirection(input)

        func blank(_ excluded: Bool) -> PublicMarketRead {
            PublicMarketRead(
                market: input.market,
                ticketSide: nil,
                ticketLead: 0,
                moneyTiltSide: nil,
                tiltPp: 0,
                movedToward: direction.movedToward,
                moveSize: direction.moveSize,
                open: direction.open,
                current: direction.current,
                homeOpen: direction.homeOpen,
                homeCurrent: direction.homeCurrent,
                betsAway: betsAway ?? 0,
                betsHome: betsHome ?? 0,
                moneyAway: moneyAway,
                moneyHome: moneyHome,
                category: nil,
                emphasis: .none,
                strong: false,
                chip: "",
                sentence: "",
                excluded: excluded,
                awaySideName: awaySide,
                homeSideName: homeSide,
                tickets: input.tickets
            )
        }

        let noSplit =
            !input.hasSplit ||
            betsAway == nil || betsHome == nil ||
            betsAway == 0 || betsHome == 0 ||
            betsAway == 100 || betsHome == 100
        if noSplit { return blank(true) }
        // A missing count is not a thin market. The latest snap leaves tickets blank while the
        // split itself is present; only a known count under the floor stays off.
        if let tickets = input.tickets, tickets < minTickets { return blank(true) }
        if input.market == .ml && min(betsAway ?? 0, betsHome ?? 0) < mlMinMinority {
            return blank(true)
        }

        let betsAwayValue = betsAway ?? 0
        let betsHomeValue = betsHome ?? 0
        let popular: PublicSide = betsAwayValue >= betsHomeValue ? .away : .home
        let quiet = popular.other
        let ticketSide: PublicSide? = betsAwayValue == betsHomeValue ? nil : popular
        let ticketLead = max(betsAwayValue, betsHomeValue)
        let moneyTiltSide: PublicSide? = !moneyKnown || moneyAway == betsAwayValue
            ? nil
            : (moneyAway > betsAwayValue ? .away : .home)
        let tiltPp = moneyKnown ? abs(moneyAway - betsAwayValue) : 0

        let moved = direction.movedToward
        let moveSize = direction.moveSize
        let confirmed = moved != nil && moveSize != nil && (moveSize ?? 0) >= input.market.confirmMove
        let effectiveMove = confirmed ? moved : nil

        func name(_ side: PublicSide) -> String { side == .away ? awaySide : homeSide }
        func onSide(_ side: PublicSide, _ away: Double, _ home: Double) -> Double {
            side == .away ? away : home
        }
        let moveText: String = {
            guard let open = direction.open, let current = direction.current else { return "" }
            if input.market == .spread {
                return "\(input.awayName) \(formatLine(.spread, open)) → \(formatLine(.spread, current))"
            }
            return "\(formatLine(input.market, open)) → \(formatLine(input.market, current))"
        }()

        func finish(
            _ category: PublicCategory?,
            _ chip: String,
            _ sentence: String,
            strong: Bool = false
        ) -> PublicMarketRead {
            PublicMarketRead(
                market: input.market,
                ticketSide: ticketSide,
                ticketLead: ticketLead,
                moneyTiltSide: moneyTiltSide,
                tiltPp: tiltPp,
                movedToward: moved,
                moveSize: moveSize,
                open: direction.open,
                current: direction.current,
                homeOpen: direction.homeOpen,
                homeCurrent: direction.homeCurrent,
                betsAway: betsAwayValue,
                betsHome: betsHomeValue,
                moneyAway: moneyAway,
                moneyHome: moneyHome,
                category: category,
                emphasis: category?.emphasis ?? .none,
                strong: strong,
                chip: chip,
                sentence: sentence,
                excluded: false,
                awaySideName: awaySide,
                homeSideName: homeSide,
                tickets: input.tickets
            )
        }

        let diverging = moneyTiltSide == quiet && tiltPp >= divergeTilt
        let piling = moneyTiltSide == popular && tiltPp >= divergeTilt
        let betsOnQuiet = onSide(quiet, betsAwayValue, betsHomeValue)
        let moneyOnQuiet = onSide(quiet, moneyAway, moneyHome)
        let moneyOnPopular = onSide(popular, moneyAway, moneyHome)
        let crowdText = "\(pct(ticketLead))% of bets are on \(name(popular))"

        // Categories 1–5 are spread and total only. A moneyline skips ahead.
        if input.market != .ml && diverging {
            if effectiveMove == quiet {
                let strong = tiltPp >= strongTilt && moveSize != nil && (moveSize ?? 0) >= input.market.strongMove
                return finish(
                    .sharpMoney,
                    "Sharp Money on \(name(quiet))",
                    "\(crowdText), but \(name(quiet)) is taking \(pct(moneyOnQuiet))% of the money on \(pct(betsOnQuiet))% of the tickets — and the \(input.market.noun) has moved \(moveText). The line is following the money, not the tickets.",
                    strong: strong
                )
            }
            if effectiveMove == nil {
                return finish(
                    .moneyNoMove,
                    "Money on \(name(quiet))",
                    "\(name(quiet)) has \(pct(moneyOnQuiet))% of the money on \(pct(betsOnQuiet))% of the tickets. The line hasn't moved for it yet."
                )
            }
            return finish(
                .lineFightsMoney,
                "Line fighting the money",
                "The money leans \(name(quiet)), but the \(input.market.noun) has moved toward \(name(popular)), \(moveText)."
            )
        }

        if input.market != .ml && piling && effectiveMove == popular {
            return finish(
                .hammered,
                "Hammered on \(name(popular))",
                "\(name(popular)) is taking \(pct(ticketLead))% of the bets and an even bigger \(pct(moneyOnPopular))% of the money, and the line has moved with it. That is the public with real volume behind it, not sharp action."
            )
        }

        if input.market != .ml && piling && effectiveMove != quiet {
            return finish(
                .publicLoading,
                "Public loading up on \(name(popular))",
                "\(name(popular)) has \(pct(ticketLead))% of the bets and \(pct(moneyOnPopular))% of the money. The line hasn't followed."
            )
        }

        if !diverging && effectiveMove == quiet && (ticketLead >= heavyTickets || piling) {
            return finish(
                .linePushesBack,
                "Line pushing back",
                "\(pct(ticketLead))% of bets and \(pct(moneyOnPopular))% of the money are on \(name(popular)), but the line moved toward \(name(quiet))."
            )
        }

        if ticketLead >= heavyTickets && effectiveMove == popular {
            return finish(
                .consensus,
                "Everyone on \(name(popular))",
                "Bets and money are both on \(name(popular)) (\(pct(ticketLead))% / \(pct(moneyOnPopular))%), and the line moved with them, \(moveText)."
            )
        }

        if ticketLead >= heavyTickets {
            return finish(
                .public,
                "Public on \(name(popular))",
                "\(pct(ticketLead))% of bets are on \(name(popular))."
            )
        }

        if ticketLead > leanTickets {
            return finish(
                .split,
                "Leaning \(name(popular))",
                "Bets lean \(name(popular)) (\(pct(ticketLead))%) and the money agrees. Nothing unusual."
            )
        }

        return finish(.split, "Split", "The money and the tickets are split.")
    }

    /// Rounded money share minus rounded ticket share on the side the dollars favor.
    /// Nil when the two splits match, or the gap rounds to less than one point.
    public static func moneyGap(for read: PublicMarketRead) -> PublicMoneyGap? {
        guard let side = read.moneyTiltSide else { return nil }
        let tickets = Int((side == .away ? read.betsAway : read.betsHome).rounded())
        let money = Int((side == .away ? read.moneyAway : read.moneyHome).rounded())
        let points = money - tickets
        guard points >= 1 else { return nil }
        let name = side == .away ? read.awaySideName : read.homeSideName
        return PublicMoneyGap(side: side, points: points, name: name)
    }

    /// Open-to-now caption. Nil when the market has no number at all.
    public static func lineCaption(market: PublicMarket, read: PublicMarketRead) -> PublicLineCaption? {
        if read.open == nil && read.current == nil && read.homeOpen == nil && read.homeCurrent == nil {
            return nil
        }
        let flat = read.movedToward == nil || read.moveSize == nil || read.moveSize == 0
        let toward: String?
        switch read.movedToward {
        case .away: toward = read.awaySideName
        case .home: toward = read.homeSideName
        case nil: toward = nil
        }
        let text: String
        if flat {
            text = read.current == nil ? "Opener only" : "Unchanged"
        } else if market == .ml {
            text = "Toward \(toward ?? "")"
        } else {
            text = "\(pointPhrase(read.moveSize ?? 0)) toward \(toward ?? "")"
        }
        let mark: String
        if flat || read.current == nil {
            mark = "⏸️"
        } else if market == .total {
            mark = read.movedToward == .away ? "📈" : "📉"
        } else {
            mark = "👉"
        }
        return PublicLineCaption(
            mark: mark,
            text: text,
            flat: flat,
            openerMissing: read.open == nil && read.current != nil
        )
    }

    /// Same order as the website feed: sharp, time, money lead, or the money-versus-tickets gap.
    public static func ordered(
        _ games: [PublicBettingGame],
        sport: String,
        market: PublicMarket,
        sharpOnly: Bool,
        query: String,
        sort: PublicBoardSort
    ) -> [PublicBettingGame] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let rows = games.filter { game in
            guard game.sport == sport, let read = game.reads[market] else { return false }
            if sharpOnly && read.category != .sharpMoney { return false }
            if needle.isEmpty { return true }
            return haystack(game).contains(needle)
        }
        return rows.sorted { a, b in
            guard let readA = a.reads[market], let readB = b.reads[market] else { return a.id < b.id }
            switch sort {
            case .time:
                return byTime(a, b)
            case .money:
                let left = max(readA.moneyAway, readA.moneyHome)
                let right = max(readB.moneyAway, readB.moneyHome)
                if left != right { return left > right }
                return byTime(a, b)
            case .diff:
                let left = splitGap(readA)
                let right = splitGap(readB)
                if left != right { return left > right }
                return byTime(a, b)
            case .sharp:
                if comesBefore(readA, readB) { return true }
                if comesBefore(readB, readA) { return false }
                return byTime(a, b)
            }
        }
    }

    /// Lower sorts first: category, then tilt, then move size.
    public static func comesBefore(_ a: PublicMarketRead, _ b: PublicMarketRead) -> Bool {
        let rankA = a.category?.rank ?? 99
        let rankB = b.category?.rank ?? 99
        if rankA != rankB { return rankA < rankB }
        if a.tiltPp != b.tiltPp { return a.tiltPp > b.tiltPp }
        return (a.moveSize ?? -1) > (b.moveSize ?? -1)
    }

    public static func games(from rows: [PublicBoardRow]) -> [PublicBettingGame] {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]

        var order: [String] = []
        var buckets: [String: (row: PublicBoardRow, reads: [PublicMarket: PublicMarketRead], captured: Date?, tickets: Double?)] = [:]

        for row in rows {
            guard row.gameId != 0, let market = PublicMarket(rawValue: row.market), !row.sport.isEmpty else { continue }
            let input = PublicMarketInput(
                market: market,
                awayName: row.away,
                homeName: row.home,
                awayOpen: row.awayOpen,
                homeOpen: row.homeOpen,
                awayCons: row.awayCons,
                homeCons: row.homeCons,
                betsAway: row.betsAway,
                betsHome: row.betsHome,
                moneyAway: row.moneyAway,
                moneyHome: row.moneyHome,
                tickets: row.tickets,
                hasSplit: row.hasSplit
            )
            let read = read(input)
            guard !read.excluded else { continue }
            let key = "\(row.sport)-\(row.gameId)"
            let snap = row.snapTs.flatMap { fractional.date(from: $0) ?? plain.date(from: $0) }
            if var existing = buckets[key] {
                existing.reads[market] = read
                if let snap, existing.captured == nil || snap > existing.captured! {
                    existing.captured = snap
                }
                if let tickets = row.tickets, tickets > (existing.tickets ?? 0) {
                    existing.tickets = tickets
                }
                buckets[key] = existing
            } else {
                order.append(key)
                buckets[key] = (row, [market: read], snap, row.tickets)
            }
        }

        return order.compactMap { key in
            guard let bucket = buckets[key] else { return nil }
            return PublicBettingGame(
                gameId: bucket.row.gameId,
                sport: bucket.row.sport,
                away: bucket.row.away,
                home: bucket.row.home,
                startTime: bucket.row.startTime,
                capturedAt: bucket.captured,
                tickets: bucket.tickets.map { Int($0.rounded()) },
                reads: bucket.reads
            )
        }
    }

    private static func sideName(_ market: PublicMarket, _ side: PublicSide, _ away: String, _ home: String) -> String {
        if market == .total { return side == .away ? "the Over" : "the Under" }
        return side == .away ? away : home
    }

    private static func pct(_ value: Double) -> String {
        String(Int(value.rounded()))
    }

    private static func finite(_ value: Double?) -> Double? {
        guard let value, value.isFinite else { return nil }
        return value
    }

    private static func deviggedAway(_ awayPrice: Double, _ homePrice: Double) -> Double {
        let away = impliedProbability(awayPrice)
        let home = impliedProbability(homePrice)
        return away / (away + home)
    }

    private static func splitGap(_ read: PublicMarketRead) -> Double {
        max(abs(read.moneyAway - read.betsAway), abs(read.moneyHome - read.betsHome))
    }

    private static func haystack(_ game: PublicBettingGame) -> String {
        var parts = [game.away, game.home]
        if game.sport == "nfl" {
            parts.append(NFLTeams.abbr(for: game.away))
            parts.append(NFLTeams.abbr(for: game.home))
        }
        return parts.joined(separator: " ").lowercased()
    }

    private static func byTime(_ a: PublicBettingGame, _ b: PublicBettingGame) -> Bool {
        let left = startMs(a)
        let right = startMs(b)
        if left != right { return left < right }
        return a.id < b.id
    }

    private static func startMs(_ game: PublicBettingGame) -> TimeInterval {
        guard let raw = game.startTime else { return .greatestFiniteMagnitude }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: raw) { return date.timeIntervalSince1970 }
        let clock = ISO8601DateFormatter()
        clock.formatOptions = [.withInternetDateTime]
        if let date = clock.date(from: raw) { return date.timeIntervalSince1970 }
        return .greatestFiniteMagnitude
    }

    private static func pointPhrase(_ size: Double) -> String {
        let rounded = (size * 100).rounded() / 100
        let unit = rounded == 1 ? "point" : "points"
        return "\(plain(rounded)) \(unit)"
    }

    private static func plain(_ value: Double) -> String {
        if value == value.rounded() { return String(Int(value)) }
        let tenths = (value * 10).rounded() / 10
        if abs(value - tenths) < 0.001 { return String(format: "%.1f", tenths) }
        return String(format: "%.2f", value)
    }
}

private extension KeyedDecodingContainer {
    func flexDouble(_ key: Key) -> Double? {
        if (try? decodeNil(forKey: key)) == true { return nil }
        if let value = try? decode(Double.self, forKey: key) { return value.isFinite ? value : nil }
        if let value = try? decode(Int.self, forKey: key) { return Double(value) }
        if let value = try? decode(String.self, forKey: key) { return Double(value) }
        return nil
    }

    func flexInt(_ key: Key) -> Int? {
        if (try? decodeNil(forKey: key)) == true { return nil }
        if let value = try? decode(Int.self, forKey: key) { return value }
        if let value = try? decode(Double.self, forKey: key) { return Int(value) }
        if let value = try? decode(String.self, forKey: key) { return Int(value) }
        return nil
    }

    func flexBool(_ key: Key) -> Bool {
        if (try? decodeNil(forKey: key)) == true { return false }
        if let value = try? decode(Bool.self, forKey: key) { return value }
        if let value = try? decode(Int.self, forKey: key) { return value != 0 }
        if let value = try? decode(String.self, forKey: key) {
            return value == "true" || value == "t" || value == "1"
        }
        return false
    }
}
