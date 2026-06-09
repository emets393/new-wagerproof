import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Square gradient matchup card used inside Spotify-style horizontal sections.
/// Ports `wagerproof-mobile/components/OutlierMatchupCard.tsx`.
///
/// Two diagonal team-logo bubbles (away top-left, home bottom-right) sit over
/// a primary→primary linear gradient. A circular "VS" pill is centered above
/// both logos. Subtext (icon + label + value) sits below the card.
///
/// The accent color travels with the section (e.g. `#22c55e` for value, `#f59e0b`
/// for fade) so the icon next to the pickLabel and the pickValue text share
/// the same hue as the section header.
struct OutlierMatchupCardView: View {
    let awayTeam: String
    let homeTeam: String
    let sport: SportLeague
    var awayTeamLogo: String? = nil
    var homeTeamLogo: String? = nil
    var awayColor: Color? = nil
    var homeColor: Color? = nil
    var pickIcon: String? = nil
    let pickLabel: String
    var pickValue: String? = nil
    var accentColor: Color = .appPrimary
    var loading: Bool = false
    var onTap: () -> Void = {}

    // Square is 50% smaller than the original 160pt card so the matchup graphic
    // reads as a compact thumbnail and the bet label / odds carry the weight.
    private let cardSize: CGFloat = 80
    private let logoSize: CGFloat = 32
    private let logoBgSize: CGFloat = 38
    private let vsSize: CGFloat = 18
    /// Inset of each diagonal disc from the card corner (half the original 6pt
    /// since the square halved), used by both the disc position and the corner.
    private let logoInset: CGFloat = 3

    /// Corner radius tuned so the rounded card corners are *concentric* with the
    /// two diagonal logo discs. The away disc is centered at (R, R) and the home
    /// disc at (cardSize-R, cardSize-R); a corner radius of exactly that center
    /// offset makes each corner arc share its center with the disc it hugs,
    /// leaving a uniform gap around the disc instead of a tighter square corner.
    private var concentricCornerRadius: CGFloat { cardSize / 2 - logoBgSize / 2 + logoInset }

    // Resolve logos from team name + sport when the caller doesn't pass an
    // explicit URL — the Top Agent Picks feed only carries matchup names, so
    // without this the discs always fell back to initials. Mirrors RN
    // `resolveLogoUrl` in components/OutlierMatchupCard.tsx.
    private var resolvedAwayLogo: String? { awayTeamLogo ?? OutlierTeamPalette.logoURL(for: awayTeam, sport: sport) }
    private var resolvedHomeLogo: String? { homeTeamLogo ?? OutlierTeamPalette.logoURL(for: homeTeam, sport: sport) }

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 6) {
                gradientCard
                subtextRow
                if let pickValue {
                    Text(pickValue)
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(accentColor)
                        .lineLimit(1)
                }
            }
            .frame(width: cardSize)
        }
        .buttonStyle(.plain)
    }

    private var resolvedAwayColor: Color {
        awayColor ?? OutlierTeamPalette.color(for: awayTeam, sport: sport, slot: .away)
    }

    private var resolvedHomeColor: Color {
        homeColor ?? OutlierTeamPalette.color(for: homeTeam, sport: sport, slot: .home)
    }

    private var gradientCard: some View {
        ZStack {
            LinearGradient(
                colors: [resolvedAwayColor, resolvedHomeColor],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )

            // The two team discs and the VS pill share one GlassEffectContainer
            // so iOS 26 liquid-merges them where they overlap in the center —
            // the signature Liquid Glass "combining" effect. Same treatment as
            // the overlapping discs on OutlierGameTile / GameRowCard.
            LiquidGlassMergeContainer(spacing: 22) {
                ZStack {
                    // Away disc — top-left, tinted with the away team color.
                    teamBubble(name: awayTeam, logoUrl: resolvedAwayLogo, tint: resolvedAwayColor)
                        .position(x: cardSize/2 - logoBgSize/2 + logoInset, y: cardSize/2 - logoBgSize/2 + logoInset)

                    // Home disc — bottom-right, tinted with the home team color.
                    teamBubble(name: homeTeam, logoUrl: resolvedHomeLogo, tint: resolvedHomeColor)
                        .position(x: cardSize/2 + logoBgSize/2 - logoInset, y: cardSize/2 + logoBgSize/2 - logoInset)

                    // VS pill — centered, glass so it fuses with both discs.
                    vsPill
                }
                .frame(width: cardSize, height: cardSize)
            }

            if loading {
                Color.black.opacity(0.45)
                ProgressView().tint(.white)
            }
        }
        .frame(width: cardSize, height: cardSize)
        .clipShape(RoundedRectangle(cornerRadius: concentricCornerRadius, style: .continuous))
    }

    private func teamBubble(name: String, logoUrl: String?, tint: Color) -> some View {
        ZStack {
            if let urlString = logoUrl, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    if case .success(let img) = phase {
                        img.resizable().scaledToFit()
                    } else {
                        teamInitials(name)
                    }
                }
                .frame(width: logoBgSize * 0.82, height: logoBgSize * 0.82)
                .clipShape(Circle())
            } else {
                teamInitials(name)
            }
        }
        .frame(width: logoBgSize, height: logoBgSize)
        .teamGlassDisc(primary: tint, secondary: tint, tint: 0.45)
        .shadow(color: tint.opacity(0.22), radius: 5, x: 0, y: 1)
    }

    @ViewBuilder
    private var vsPill: some View {
        let label = Text("VS")
            .font(.system(size: 8, weight: .heavy))
            .tracking(0.2)
            .foregroundStyle(Color.appTextPrimary)
            .frame(width: vsSize, height: vsSize)
        Group {
            if #available(iOS 26.0, *) {
                label.glassEffect(.regular, in: Circle())
            } else {
                label.background(Color.appSurfaceElevated, in: Circle())
            }
        }
        .shadow(color: .black.opacity(0.3), radius: 4, x: 0, y: 2)
    }

    private func teamInitials(_ name: String) -> some View {
        Text(OutlierTeamPalette.initials(for: name))
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(.white)
    }

    private var subtextRow: some View {
        HStack(spacing: 4) {
            if let pickIcon {
                Image(systemName: pickIcon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(accentColor)
            }
            Text(pickLabel)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.65)
        }
        .padding(.top, 3)
    }
}

/// Static team-color palette shared by all Outliers cards. Ports RN
/// `utils/teamColors.ts` + `constants/mlbTeams.ts`: each side of the card's
/// gradient (and its glass disc tint) takes that team's primary *brand* color —
/// the color that reads off its logo — so the square is tinted to the matchup.
///
/// MLB resolves through the shared `MLBTeams` table; NFL/NBA through the brand
/// maps below. CFB/NCAAB have no name-keyed color table here (they're DB-id
/// mapped), so they fall back to a sport tint — FIDELITY-WAIVER #024, tracked in
/// `tickets/018-outliers-team-palette.md`.
enum OutlierTeamPalette {
    enum Slot { case away, home }

    static func color(for team: String, sport: SportLeague, slot: Slot) -> Color {
        // Real brand color first — this is what tints the square to the logos.
        if let hex = brandPrimary(for: team, sport: sport) {
            return Color(hex: Int(hex))
        }
        // Sport-tint fallback for CFB/NCAAB and any unmatched name.
        switch sport {
        case .nfl: return slot == .away ? Color(hex: 0x013369) : Color(hex: 0x002244)
        case .cfb: return slot == .away ? Color(hex: 0xC8102E) : Color(hex: 0x7A0000)
        case .nba: return slot == .away ? Color(hex: 0x1D428A) : Color(hex: 0x0B1F4D)
        case .ncaab: return slot == .away ? Color(hex: 0xF58426) : Color(hex: 0x7A3A05)
        case .mlb: return slot == .away ? Color(hex: 0x002D72) : Color(hex: 0x001F50)
        }
    }

    /// Team primary brand color (matches the logo) by name + sport. nil when the
    /// sport has no name-keyed table here (CFB/NCAAB) or the name doesn't match.
    private static func brandPrimary(for team: String, sport: SportLeague) -> UInt32? {
        switch sport {
        case .mlb:
            // MLBTeams.colors returns a neutral pair when unmatched, so gate on a
            // real table hit — otherwise we'd paint the neutral as a brand color.
            guard MLBTeams.info(for: team) != nil else { return nil }
            return MLBTeams.colors(for: team).primary
        case .nfl: return lookupColor(nflColorsLower, team)
        case .nba: return lookupColor(nbaColorsLower, team)
        case .cfb, .ncaab: return nil
        }
    }

    /// Exact (case-insensitive) match, then longest contained-key match so
    /// "Buffalo Bills" resolves off the "buffalo" key. Keys are pre-lowercased.
    private static func lookupColor(_ map: [String: UInt32], _ team: String) -> UInt32? {
        let key = team.trimmingCharacters(in: .whitespaces).lowercased()
        if let exact = map[key] { return exact }
        var best: UInt32? = nil
        var bestLen = 0
        for (k, v) in map where key.contains(k) && k.count > bestLen { best = v; bestLen = k.count }
        return best
    }

    private static let nflColorsLower: [String: UInt32] =
        Dictionary(nflPrimary.map { ($0.key.lowercased(), $0.value) }, uniquingKeysWith: { a, _ in a })
    private static let nbaColorsLower: [String: UInt32] =
        Dictionary(nbaPrimary.map { ($0.key.lowercased(), $0.value) }, uniquingKeysWith: { a, _ in a })

    /// Two-letter team initials. Drops common stop words to keep them tight.
    static func initials(for team: String) -> String {
        let stop: Set<String> = ["the", "of"]
        let words = team
            .components(separatedBy: .whitespaces)
            .filter { !$0.isEmpty && !stop.contains($0.lowercased()) }
        if words.count >= 2 {
            return String(words[0].prefix(1)).uppercased() + String(words[1].prefix(1)).uppercased()
        }
        return String(team.prefix(2)).uppercased()
    }

    /// Resolve an ESPN logo URL from a team name + sport. Ports RN
    /// `resolveLogoUrl` (components/OutlierMatchupCard.tsx) so the discs show
    /// real logos when the caller only has matchup names (Top Agent Picks feed).
    ///
    /// NFL matchups carry city names, NBA full+city names, MLB full names
    /// (fuzzy via the shared `MLBTeams` table). CFB/NCAAB are DB-id mapped and
    /// have no name→logo table here, so they fall back to initials — same gap
    /// as FIDELITY-WAIVER #024.
    static func logoURL(for team: String, sport: SportLeague) -> String? {
        switch sport {
        case .nfl: return nflLogo[team].map { "https://a.espncdn.com/i/teamlogos/nfl/500/\($0).png" }
        case .nba: return nbaLogo[team].map { "https://a.espncdn.com/i/teamlogos/nba/500/\($0).png" }
        case .mlb: return MLBTeams.info(for: team)?.logoUrl
        case .cfb, .ncaab: return nil
        }
    }

    // ESPN slug maps. NFL is keyed by city (matchups read "Buffalo @ Kansas
    // City"); NBA carries both full and city keys. Mirror of RN
    // `getNFLTeamLogo` / `getNBATeamLogo` in utils/teamColors.ts.
    private static let nflLogo: [String: String] = [
        "Arizona": "ari", "Atlanta": "atl", "Baltimore": "bal", "Buffalo": "buf",
        "Carolina": "car", "Chicago": "chi", "Cincinnati": "cin", "Cleveland": "cle",
        "Dallas": "dal", "Denver": "den", "Detroit": "det", "Green Bay": "gb",
        "Houston": "hou", "Indianapolis": "ind", "Jacksonville": "jax", "Kansas City": "kc",
        "Las Vegas": "lv", "Los Angeles Chargers": "lac", "Los Angeles Rams": "lar",
        "LA Chargers": "lac", "LA Rams": "lar", "Miami": "mia", "Minnesota": "min",
        "New England": "ne", "New Orleans": "no", "NY Giants": "nyg", "NY Jets": "nyj",
        "Philadelphia": "phi", "Pittsburgh": "pit", "San Francisco": "sf",
        "Seattle": "sea", "Tampa Bay": "tb", "Tennessee": "ten", "Washington": "wsh",
    ]

    private static let nbaLogo: [String: String] = [
        "Atlanta Hawks": "atl", "Atlanta": "atl", "Boston Celtics": "bos", "Boston": "bos",
        "Brooklyn Nets": "bkn", "Brooklyn": "bkn", "Charlotte Hornets": "cha", "Charlotte": "cha",
        "Chicago Bulls": "chi", "Chicago": "chi", "Cleveland Cavaliers": "cle", "Cleveland": "cle",
        "Dallas Mavericks": "dal", "Dallas": "dal", "Denver Nuggets": "den", "Denver": "den",
        "Detroit Pistons": "det", "Detroit": "det", "Golden State Warriors": "gs", "Golden State": "gs",
        "Houston Rockets": "hou", "Houston": "hou", "Indiana Pacers": "ind", "Indiana": "ind",
        "LA Clippers": "lac", "Los Angeles Clippers": "lac", "LA Lakers": "lal", "Los Angeles Lakers": "lal",
        "Memphis Grizzlies": "mem", "Memphis": "mem", "Miami Heat": "mia", "Miami": "mia",
        "Milwaukee Bucks": "mil", "Milwaukee": "mil", "Minnesota Timberwolves": "min", "Minnesota": "min",
        "New Orleans Pelicans": "no", "New Orleans": "no", "New York Knicks": "ny", "New York": "ny",
        "Oklahoma City Thunder": "okc", "Oklahoma City": "okc", "Orlando Magic": "orl", "Orlando": "orl",
        "Philadelphia 76ers": "phi", "Philadelphia": "phi", "Phoenix Suns": "phx", "Phoenix": "phx",
        "Portland Trail Blazers": "por", "Portland": "por", "Sacramento Kings": "sac", "Sacramento": "sac",
        "San Antonio Spurs": "sa", "San Antonio": "sa", "Toronto Raptors": "tor", "Toronto": "tor",
        "Utah Jazz": "utah", "Utah": "utah", "Washington Wizards": "wsh", "Washington": "wsh",
    ]

    // Primary brand colors (city + full-name keys). Mirror of RN
    // `getNFLTeamColors` / `getNBATeamColors` in utils/teamColors.ts — only the
    // primary is needed since the gradient blends away→home primaries.
    private static let nflPrimary: [String: UInt32] = [
        "Arizona": 0x97233F, "Arizona Cardinals": 0x97233F, "Atlanta": 0xA71930, "Atlanta Falcons": 0xA71930,
        "Baltimore": 0x241773, "Baltimore Ravens": 0x241773, "Buffalo": 0x00338D, "Buffalo Bills": 0x00338D,
        "Carolina": 0x0085CA, "Carolina Panthers": 0x0085CA, "Chicago": 0x0B162A, "Chicago Bears": 0x0B162A,
        "Cincinnati": 0xFB4F14, "Cincinnati Bengals": 0xFB4F14, "Cleveland": 0x311D00, "Cleveland Browns": 0x311D00,
        "Dallas": 0x003594, "Dallas Cowboys": 0x003594, "Denver": 0xFB4F14, "Denver Broncos": 0xFB4F14,
        "Detroit": 0x0076B6, "Detroit Lions": 0x0076B6, "Green Bay": 0x203731, "Green Bay Packers": 0x203731,
        "Houston": 0x03202F, "Houston Texans": 0x03202F, "Indianapolis": 0x002C5F, "Indianapolis Colts": 0x002C5F,
        "Jacksonville": 0x101820, "Jacksonville Jaguars": 0x101820, "Kansas City": 0xE31837, "Kansas City Chiefs": 0xE31837,
        "Las Vegas": 0x000000, "Las Vegas Raiders": 0x000000, "Los Angeles Chargers": 0x0080C6, "LA Chargers": 0x0080C6,
        "Los Angeles Rams": 0x003594, "LA Rams": 0x003594, "Miami": 0x008E97, "Miami Dolphins": 0x008E97,
        "Minnesota": 0x4F2683, "Minnesota Vikings": 0x4F2683, "New England": 0x002244, "New England Patriots": 0x002244,
        "New Orleans": 0x101820, "New Orleans Saints": 0x101820, "NY Giants": 0x0B2265, "New York Giants": 0x0B2265,
        "NY Jets": 0x125740, "New York Jets": 0x125740, "Philadelphia": 0x004C54, "Philadelphia Eagles": 0x004C54,
        "Pittsburgh": 0xFFB612, "Pittsburgh Steelers": 0xFFB612, "San Francisco": 0xAA0000, "San Francisco 49ers": 0xAA0000,
        "Seattle": 0x002244, "Seattle Seahawks": 0x002244, "Tampa Bay": 0xD50A0A, "Tampa Bay Buccaneers": 0xD50A0A,
        "Tennessee": 0x0C2340, "Tennessee Titans": 0x0C2340, "Washington": 0x5A1414, "Washington Commanders": 0x5A1414,
    ]

    private static let nbaPrimary: [String: UInt32] = [
        "Atlanta Hawks": 0xE03A3E, "Atlanta": 0xE03A3E, "Boston Celtics": 0x007A33, "Boston": 0x007A33,
        "Brooklyn Nets": 0x000000, "Brooklyn": 0x000000, "Charlotte Hornets": 0x1D1160, "Charlotte": 0x1D1160,
        "Chicago Bulls": 0xCE1141, "Chicago": 0xCE1141, "Cleveland Cavaliers": 0x860038, "Cleveland": 0x860038,
        "Dallas Mavericks": 0x00538C, "Dallas": 0x00538C, "Denver Nuggets": 0x0E2240, "Denver": 0x0E2240,
        "Detroit Pistons": 0xC8102E, "Detroit": 0xC8102E, "Golden State Warriors": 0x1D428A, "Golden State": 0x1D428A,
        "Houston Rockets": 0xCE1141, "Houston": 0xCE1141, "Indiana Pacers": 0x002D62, "Indiana": 0x002D62,
        "LA Clippers": 0xC8102E, "Los Angeles Clippers": 0xC8102E, "LA Lakers": 0x552583, "Los Angeles Lakers": 0x552583,
        "Memphis Grizzlies": 0x5D76A9, "Memphis": 0x5D76A9, "Miami Heat": 0x98002E, "Miami": 0x98002E,
        "Milwaukee Bucks": 0x00471B, "Milwaukee": 0x00471B, "Minnesota Timberwolves": 0x0C2340, "Minnesota": 0x0C2340,
        "New Orleans Pelicans": 0x0C2340, "New Orleans": 0x0C2340, "New York Knicks": 0x006BB6, "New York": 0x006BB6,
        "Oklahoma City Thunder": 0x007AC1, "Oklahoma City": 0x007AC1, "Orlando Magic": 0x0077C0, "Orlando": 0x0077C0,
        "Philadelphia 76ers": 0x006BB6, "Philadelphia": 0x006BB6, "Phoenix Suns": 0x1D1160, "Phoenix": 0x1D1160,
        "Portland Trail Blazers": 0xE03A3E, "Portland": 0xE03A3E, "Sacramento Kings": 0x5A2D81, "Sacramento": 0x5A2D81,
        "San Antonio Spurs": 0xC4CED4, "San Antonio": 0xC4CED4, "Toronto Raptors": 0xCE1141, "Toronto": 0xCE1141,
        "Utah Jazz": 0x002B5C, "Utah": 0x002B5C, "Washington Wizards": 0x002B5C, "Washington": 0x002B5C,
    ]
}
