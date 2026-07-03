import SwiftUI
import WagerproofDesign
import WagerproofModels

// =====================================================================
// AgentPickTicket — an agent pick rendered as a boarding-pass "ticket".
//
// Ported from Orbital Focus's MissionHistoryView boarding-pass system
// (the user's own app) and re-skinned for sports betting: the launch
// site → destination route becomes AWAY → HOME, the mission outcome
// becomes the pick result (WIN / LOSS / PUSH / PENDING), and the
// flight stamps become market / odds / units. The folder rolodex that
// holds these tickets lives in PickHistoryFolder.swift.
//
// Two sizes share the same cardstock + perforation geometry:
//   • AgentPickTicket          — the stacked/list ticket (folder + sheet)
//   • ExpandedAgentPickTicket  — the full pass shown when a ticket is tapped
// =====================================================================

// MARK: - Stack ticket

/// The compact boarding-pass ticket for a single pick. Geometry is FIXED so the
/// perforation notches always land on the tear line (content is uniform).
struct AgentPickTicket: View {
    let pick: AgentPick
    /// Agent brand tint — drives the units chip + confidence pill (the mission
    /// ticket used the crew-role color here).
    var accent: Color = .appPrimary
    /// Onboarding-reveal teaser mode: teams/date stay legible but the actual
    /// pick (market, odds, units, selection, confidence) blurs behind a lock —
    /// the user sees WHAT was generated without the details until they enter
    /// the app (where the paywall makes the ask).
    var teaserBlur: Bool = false

    // Shared with the rolodex physics in PickHistorySheet — keep in sync.
    static let height: CGFloat = 250
    static let notchY: CGFloat = 150

    private var status: PickTicketStatus { pick.ticketStatus }

    var body: some View {
        VStack(spacing: 0) {
            topSection
                .frame(height: Self.notchY)
            bottomSection
                .frame(height: Self.height - Self.notchY)
        }
        .frame(height: Self.height)
        .background {
            // clipShape trims the OUTER halves of the notch circles — the
            // even-odd rule fills them, which would otherwise read as bumps
            // sticking off the edges.
            PickTicketShape(notchY: Self.notchY)
                .fill(LinearGradient(colors: [Color(hex: 0x141927), Color(hex: 0x0D101A)],
                                     startPoint: .top, endPoint: .bottom),
                      style: FillStyle(eoFill: true))
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                // Hairline rim instead of a heavy cast shadow: in the folder peek
                // + rolodex these tickets stack ~10pt apart, so a strong black
                // drop shadow compounds into dark blobs behind the front ticket.
                // A faint top-lit stroke separates the stacked slivers cleanly and
                // a soft ambient shadow keeps depth without pooling.
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .strokeBorder(.white.opacity(0.07), lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.22), radius: 5, y: 2)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(pick.matchup), \(pick.pickSelection), \(status.text)")
        .accessibilityHint("Tap to expand the pick")
    }

    private var topSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(PickTicketFormat.gameDate(pick.gameDate))
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Color.appTextPrimary.opacity(0.85))
                Spacer()
                Text(status.text)
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(status.color)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(status.color.opacity(0.16),
                                in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            }

            Spacer(minLength: 8)

            PickRouteLineRow(pick: pick, codeSize: 32)

            HStack(alignment: .firstTextBaseline) {
                Text(pick.awayHomeNames?.away ?? pick.matchup)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                Spacer()
                Text(pick.betType.capitalized)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                    .blur(radius: teaserBlur ? 5 : 0)
                Spacer()
                Text(pick.awayHomeNames?.home ?? "")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
            }
            .padding(.top, 4)

            Spacer(minLength: 10)
        }
        .padding(.horizontal, 20)
        .padding(.top, 18)
        .overlay(alignment: .bottom) {
            PickDashLine()
                .stroke(Color.white.opacity(0.16),
                        style: StrokeStyle(lineWidth: 1, dash: [5, 5]))
                .frame(height: 1)
                .padding(.horizontal, 18)
        }
    }

    private var bottomSection: some View {
        VStack(spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                PickTicketStamp(label: "Market", value: PickTicketFormat.market(pick), alignment: .leading)
                Spacer()
                PickTicketStamp(label: "Odds", value: pick.odds?.nonEmpty ?? "—", alignment: .center)
                Spacer()
                PickTicketStamp(label: "Units", value: PickTicketFormat.units(pick.units), alignment: .trailing)
            }

            HStack(spacing: 8) {
                // The pick shown proud — no quotes, no italic; the loudest line
                // in the bottom stub.
                Text(pick.pickSelection)
                    .font(.system(size: 15, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: "gauge.medium")
                        .font(.system(size: 9, weight: .bold))
                    Text("\(pick.confidence)/5")
                        .font(.system(size: 10, weight: .bold))
                }
                .foregroundStyle(accent)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 14)
        .padding(.bottom, 14)
        // Teaser: the whole stub (market/odds/units/selection/confidence)
        // blurs unreadable; a lock chip explains why. Clip so the blur
        // doesn't smear past the cardstock edges.
        .blur(radius: teaserBlur ? 6 : 0)
        .clipped()
        .overlay {
            if teaserBlur {
                HStack(spacing: 6) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 11, weight: .bold))
                    Text("Unlock in the app")
                        .font(.system(size: 12, weight: .heavy))
                        .tracking(0.3)
                }
                .foregroundStyle(accent)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(
                    Capsule().fill(Color(hex: 0x0D101A).opacity(0.85))
                )
                .overlay(
                    Capsule().strokeBorder(accent.opacity(0.5), lineWidth: 1)
                )
            }
        }
    }
}

// MARK: - Expanded pass (tap a ticket)

/// The full pick "pass" shown when a ticket is tapped open in the history sheet.
/// Ports Orbital Focus's ExpandedMissionTicket: bigger route header, a satellite
/// ghosted into the cardstock, and a detail grid. `onAudit` surfaces the raw
/// data-trace audit (parity with the old tap-to-audit history rows).
struct ExpandedAgentPickTicket: View {
    let pick: AgentPick
    var accent: Color = .appPrimary
    var onAudit: (() -> Void)? = nil
    /// When true, renders the WagerProof logo + wordmark at the bottom (for the
    /// shareable focus card) and trims the long folder "tail" padding.
    var showsBranding: Bool = false

    private static let notchY: CGFloat = 200
    private var status: PickTicketStatus { pick.ticketStatus }

    var body: some View {
        VStack(spacing: 0) {
            topSection
                .frame(height: Self.notchY)
            detailGrid
        }
        .background {
            PickTicketShape(notchY: Self.notchY)
                .fill(LinearGradient(colors: [Color(hex: 0x151A28), Color(hex: 0x0D101A)],
                                     startPoint: .top, endPoint: .bottom),
                      style: FillStyle(eoFill: true))
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .shadow(color: .black.opacity(0.6), radius: 18, y: -10)
        }
        .accessibilityElement(children: .combine)
    }

    private var topSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(PickTicketFormat.gameDate(pick.gameDate))
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary.opacity(0.9))
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(Color.white.opacity(0.08), in: Capsule())

            Spacer(minLength: 10)

            PickRouteLineRow(pick: pick, codeSize: 42)

            HStack(alignment: .firstTextBaseline) {
                Text(pick.awayHomeNames?.away ?? pick.matchup)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                Spacer()
                Text(pick.betType.capitalized)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                Spacer()
                Text(pick.awayHomeNames?.home ?? "")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
            }
            .padding(.top, 6)

            Spacer(minLength: 12)
        }
        .padding(.horizontal, 22)
        .padding(.top, 20)
        // The sport glyph, ghosted into the cardstock like the reference's
        // dotted world map.
        .background(alignment: .topTrailing) {
            Image(systemName: pick.sport.sfSymbol)
                .font(.system(size: 110, weight: .regular))
                .foregroundStyle(Color.white)
                .opacity(0.05)
                .padding(.top, 14)
                .padding(.trailing, 6)
                .allowsHitTesting(false)
        }
        .overlay(alignment: .bottom) {
            PickDashLine()
                .stroke(Color.white.opacity(0.16),
                        style: StrokeStyle(lineWidth: 1, dash: [5, 5]))
                .frame(height: 1)
                .padding(.horizontal, 18)
        }
    }

    private var detailGrid: some View {
        VStack(spacing: 18) {
            detailRow(
                left: ("Market", PickTicketFormat.market(pick), Color.appTextPrimary),
                right: ("Units", PickTicketFormat.units(pick.units), accent))
            detailRow(
                left: ("Odds", pick.odds?.nonEmpty ?? "—", Color.appTextPrimary),
                right: ("Confidence", "\(pick.confidence)/5", accent))
            detailRow(
                left: ("Game Date", PickTicketFormat.gameDate(pick.gameDate), Color.appTextPrimary),
                right: ("Result", status.text, status.color))

            // The pick itself — labeled "Selection" so it doesn't collide with
            // the Market (bet type) row above.
            VStack(alignment: .leading, spacing: 3) {
                Text("Selection")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                Text(pick.pickSelection)
                    .font(.system(size: 15, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Color.appTextPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if !pick.reasoningText.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("SUMMARY")
                        .font(.system(size: 11, weight: .heavy))
                        .tracking(1)
                        .foregroundStyle(Color.appTextSecondary)
                    Text(pick.reasoningText)
                        .font(.system(size: 14))
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            if let factors = pick.keyFactors, !factors.isEmpty {
                VStack(alignment: .leading, spacing: 5) {
                    Text("KEY FACTORS")
                        .font(.system(size: 11, weight: .heavy))
                        .tracking(1)
                        .foregroundStyle(Color.appTextSecondary)
                    ForEach(Array(factors.enumerated()), id: \.offset) { _, factor in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Circle().fill(accent).frame(width: 5, height: 5)
                                .alignmentGuide(.firstTextBaseline) { d in d[.bottom] - 4 }
                            Text(factor)
                                .font(.system(size: 14))
                                .foregroundStyle(Color.appTextSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            if let onAudit {
                Button(action: onAudit) {
                    HStack(spacing: 6) {
                        Image(systemName: "terminal")
                            .font(.system(size: 12, weight: .bold))
                        Text("View data audit")
                            .font(.system(size: 13, weight: .heavy))
                    }
                    .foregroundStyle(accent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(accent.opacity(0.12))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .strokeBorder(accent.opacity(0.35), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }

            if showsBranding {
                WagerproofTicketFooter()
                    .frame(maxWidth: .infinity)
                    .padding(.top, 10)
            }
        }
        .padding(.horizontal, 22)
        .padding(.top, 18)
        // Branded (focus/share) cards end just below the logo; unbranded (folder)
        // cards keep the long tail that rides down into the folder pocket.
        .padding(.bottom, showsBranding ? 22 : 110)
    }

    private func detailRow(left: (String, String, Color), right: (String, String, Color)) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 3) {
                Text(left.0)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                Text(left.1)
                    .font(.system(size: 17, weight: .semibold, design: .monospaced))
                    .foregroundStyle(left.2)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text(right.0)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                Text(right.1)
                    .font(.system(size: 17, weight: .semibold, design: .monospaced))
                    .foregroundStyle(right.2)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
    }
}

// MARK: - Branding footer

/// WagerProof logo + two-tone wordmark, shown at the bottom of a shareable pick
/// card so exported images carry the brand.
struct WagerproofTicketFooter: View {
    var body: some View {
        HStack(spacing: 7) {
            Image("WagerproofLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 16, height: 16)
            HStack(spacing: 0) {
                Text("Wager").foregroundStyle(Color.appTextPrimary.opacity(0.7))
                Text("Proof").foregroundStyle(Color(hex: 0x00E676))
            }
            .font(.system(size: 13, weight: .heavy))
        }
        .opacity(0.9)
    }
}

// MARK: - Shared ticket pieces

/// "🟦KC ·――🏈――· BUF🟥" — the route header both ticket sizes share. Each end
/// pairs the team's real abbreviation with a flat (non-glass) logo avatar disc;
/// the sport glyph rides the dashed route line between them.
struct PickRouteLineRow: View {
    let pick: AgentPick
    let codeSize: CGFloat

    private var dotColor: Color { pick.ticketStatus.color }
    private var away: PickTeamVisual {
        PickTicketFormat.teamVisual(pick.awayHomeNames?.away ?? pick.matchup, sport: pick.sport)
    }
    private var home: PickTeamVisual {
        PickTicketFormat.teamVisual(pick.awayHomeNames?.home ?? "", sport: pick.sport)
    }

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            teamEnd(visual: away)
            routeLine
            teamEnd(visual: home)
        }
    }

    /// Logo stacked ABOVE the abbreviation (rather than beside it) so the logo
    /// can be the prominent, larger element and the code reads as its label.
    @ViewBuilder
    private func teamEnd(visual: PickTeamVisual) -> some View {
        VStack(spacing: 4) {
            PickTeamAvatar(visual: visual, size: codeSize * 1.25)
            Text(visual.code)
                .font(.system(size: codeSize * 0.8, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .fixedSize(horizontal: true, vertical: false)
    }

    private var routeLine: some View {
        HStack(spacing: 6) {
            Circle().fill(dotColor).frame(width: 6, height: 6)
            PickDashLine()
                .stroke(Color.white.opacity(0.22),
                        style: StrokeStyle(lineWidth: 1, dash: [3, 4]))
                .frame(height: 1)
            Image(systemName: pick.sport.sfSymbol)
                .font(.system(size: codeSize * 0.42, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
            PickDashLine()
                .stroke(Color.white.opacity(0.22),
                        style: StrokeStyle(lineWidth: 1, dash: [3, 4]))
                .frame(height: 1)
            Circle().fill(dotColor).frame(width: 6, height: 6)
        }
        .frame(maxWidth: .infinity)
    }
}

/// Flat (non-glass) team logo avatar for the pick ticket — carries the ESPN
/// logo (MLB) or the abbreviation as fallback initials over a team-tinted
/// gradient disc, plus a faint contrast plate so a same-color logo never
/// vanishes into the disc.
///
/// Deliberately skips the `teamGlassDisc` treatment `GameRowCard` /
/// `PropPlayerCard` use — Pick History can render dozens of these at once
/// (folder peek + the full rolodex sheet), and real Liquid Glass per disc
/// is too much compositing cost multiplied across a long scrolling list.
struct PickTeamAvatar: View {
    let visual: PickTeamVisual
    var size: CGFloat = 28

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let plate = logoContrastPlate(for: visual.primary)
        ZStack {
            if let urlString = visual.logoURL, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        ZStack {
                            if let plate { Circle().fill(plate) }
                            img.resizable().scaledToFit()
                                .padding(plate != nil ? size * 0.07 : 0)
                        }
                    default:
                        initials
                    }
                }
                .frame(width: size * 0.82, height: size * 0.82)
                .clipShape(Circle())
            } else {
                initials
            }
        }
        .frame(width: size, height: size)
        .background(
            Circle()
                .fill(Color.appSurfaceElevated)
                .overlay(
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [visual.primary, visual.secondary],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .opacity(0.45)
                )
                .overlay(Circle().strokeBorder(Color.appSurfaceElevated, lineWidth: 1.5))
        )
    }

    private var initials: some View {
        Text(visual.code)
            .font(.system(size: size * 0.36, weight: .bold))
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.25), radius: 1, y: 1)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
    }

    /// Same logic as `GameRowCard.logoContrastPlate` — drop a faint
    /// opposite-luminance wash behind a same-color logo so it stays legible.
    private func logoContrastPlate(for primary: Color) -> Color? {
        let lum = primary.relativeLuminance
        switch colorScheme {
        case .dark:
            return lum < 0.45 ? Color(white: 0.78).opacity(0.15) : nil
        default:
            return lum > 0.6 ? Color.black.opacity(0.55) : nil
        }
    }
}

struct PickTicketStamp: View {
    let label: String
    let value: String
    let alignment: HorizontalAlignment

    var body: some View {
        VStack(alignment: alignment, spacing: 3) {
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
            Text(value)
                .font(.system(size: 16, weight: .semibold, design: .monospaced))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
    }
}

// MARK: - Status + formatting

struct PickTicketStatus {
    let text: String
    let color: Color
}

extension AgentPick {
    var ticketStatus: PickTicketStatus {
        switch result {
        case .won:     return PickTicketStatus(text: "WIN", color: .appWin)
        case .lost:    return PickTicketStatus(text: "LOSS", color: .appLoss)
        case .push:    return PickTicketStatus(text: "PUSH", color: .appPending)
        case .pending: return PickTicketStatus(text: "PENDING", color: .appTextSecondary)
        }
    }

    /// Away / home team names parsed from the matchup string (`Away @ Home`,
    /// `Away vs Home`, …). Returns nil when the matchup isn't a 2-team split.
    var awayHomeNames: (away: String, home: String)? {
        let parts = PickTicketFormat.splitMatchup(matchup)
        guard parts.count == 2 else { return nil }
        return (parts[0], parts[1])
    }

    var ticketAwayCode: String {
        PickTicketFormat.teamCode(awayHomeNames?.away ?? matchup, sport: sport)
    }

    var ticketHomeCode: String {
        PickTicketFormat.teamCode(awayHomeNames?.home ?? "", sport: sport)
    }
}

/// Pure formatting helpers shared by the ticket, folder, and sheet.
enum PickTicketFormat {
    static func gameDate(_ s: String) -> String {
        if s.isEmpty { return "Pending" }
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        guard let date = df.date(from: s) else { return s }
        let cal = Calendar.current
        if cal.isDateInToday(date) { return "Today" }
        if cal.isDateInYesterday(date) { return "Yesterday" }
        if cal.isDateInTomorrow(date) { return "Tomorrow" }
        let out = DateFormatter()
        out.dateFormat = "MMM d, yyyy"
        return out.string(from: date)
    }

    /// Short market label for a stamp ("Spread", "Total", "ML", …).
    static func market(_ pick: AgentPick) -> String {
        let bt = pick.betType.lowercased()
        if bt.contains("moneyline") || bt == "ml" { return "Moneyline" }
        if bt.contains("spread") || bt.contains("runline") || bt.contains("run line") { return "Spread" }
        if bt.contains("total") || bt.contains("over") || bt.contains("under") { return "Total" }
        return pick.betType.isEmpty ? "Pick" : pick.betType.capitalized
    }

    static func units(_ u: Double) -> String {
        if u == u.rounded() { return String(format: "%.0fu", u) }
        return String(format: "%.1fu", u)
    }

    static func splitMatchup(_ matchup: String) -> [String] {
        let separators = [" @ ", " at ", " vs. ", " vs ", " v. ", " v "]
        for separator in separators {
            let parts = matchup.components(separatedBy: separator)
            if parts.count == 2 {
                return parts.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            }
        }
        return []
    }

    /// Best-effort airport-code-style team abbreviation. MLB uses the real
    /// abbreviation table; other sports fall back to word initials (ticket #008
    /// will add a centralized team-color/abbrev library).
    static func teamCode(_ name: String, sport: AgentSport) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "—" }
        if sport == .mlb, let info = MLBTeams.info(for: trimmed) {
            return info.team
        }
        let words = trimmed.split(separator: " ").map(String.init)
        if words.count >= 2 {
            return words.prefix(3).compactMap(\.first).map(String.init).joined().uppercased()
        }
        return String(trimmed.prefix(3)).uppercased()
    }

    /// Full display identity for a team on a ticket: the real abbreviation plus
    /// (for MLB) the ESPN logo + brand colors, resolved from the same
    /// `MLBTeams` registry the game cards use. `logoUrl(for:)` / `colors(for:)`
    /// resolve both full names and bare abbreviations. Non-MLB picks only carry
    /// a matchup string (no name-keyed registry yet), so they fall back to
    /// word-initials on a neutral glass disc.
    static func teamVisual(_ name: String, sport: AgentSport) -> PickTeamVisual {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return PickTeamVisual(code: "—", logoURL: nil,
                                  primary: Color(hex: 0x1F2937), secondary: Color(hex: 0x6B7280))
        }
        if sport == .mlb, let logo = MLBTeams.logoUrl(for: trimmed) {
            let (primary, secondary) = MLBTeams.colors(for: trimmed)
            return PickTeamVisual(
                code: MLBTeams.info(for: trimmed)?.team ?? trimmed.uppercased(),
                logoURL: logo,
                primary: Color(hex: Int(primary)),
                secondary: Color(hex: Int(secondary))
            )
        }
        return PickTeamVisual(code: teamCode(trimmed, sport: sport), logoURL: nil,
                              primary: Color(hex: 0x1F2937), secondary: Color(hex: 0x6B7280))
    }
}

/// Resolved display identity for one team on a pick ticket — see
/// `PickTicketFormat.teamVisual`.
struct PickTeamVisual {
    let code: String
    let logoURL: String?
    let primary: Color
    let secondary: Color
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}

// MARK: - Shapes

/// A boarding pass: rounded rect with circular notches punched into both edges
/// at the tear line. Even-odd fill cuts true holes, so the surface behind shows
/// through the notches.
struct PickTicketShape: Shape {
    let notchY: CGFloat
    var cornerRadius: CGFloat = 22
    var notchRadius: CGFloat = 9

    func path(in rect: CGRect) -> Path {
        var p = Path(roundedRect: rect, cornerRadius: cornerRadius, style: .continuous)
        p.addEllipse(in: CGRect(x: rect.minX - notchRadius, y: rect.minY + notchY - notchRadius,
                                width: notchRadius * 2, height: notchRadius * 2))
        p.addEllipse(in: CGRect(x: rect.maxX - notchRadius, y: rect.minY + notchY - notchRadius,
                                width: notchRadius * 2, height: notchRadius * 2))
        return p
    }
}

/// The folder's FRONT panel: a low brim on the left rising over a chamfer to a
/// raised tab on the right — the mirror of the back flap, so together they read
/// as an open manila folder.
struct PickFolderFrontShape: Shape {
    func path(in rect: CGRect) -> Path {
        let r: CGFloat = 18          // top corner radius
        let rb: CGFloat = 26         // bottom corner radius
        let brimDrop: CGFloat = 26   // how far the left brim sits below the tab
        let chamferStart = rect.minX + rect.width * 0.46
        let chamferEnd = chamferStart + 34

        var p = Path()
        p.move(to: CGPoint(x: rect.minX + rb, y: rect.maxY))
        p.addQuadCurve(to: CGPoint(x: rect.minX, y: rect.maxY - rb),
                       control: CGPoint(x: rect.minX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.minY + brimDrop + r))
        p.addQuadCurve(to: CGPoint(x: rect.minX + r, y: rect.minY + brimDrop),
                       control: CGPoint(x: rect.minX, y: rect.minY + brimDrop))
        p.addLine(to: CGPoint(x: chamferStart, y: rect.minY + brimDrop))
        p.addLine(to: CGPoint(x: chamferEnd, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX - r, y: rect.minY))
        p.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.minY + r),
                       control: CGPoint(x: rect.maxX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - rb))
        p.addQuadCurve(to: CGPoint(x: rect.maxX - rb, y: rect.maxY),
                       control: CGPoint(x: rect.maxX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}

/// The folder's back flap: a wide tab on the left, then a chamfer down to the
/// main edge — only its top sliver shows behind the tickets.
struct PickFolderTabShape: Shape {
    func path(in rect: CGRect) -> Path {
        let r: CGFloat = 18
        let tabDrop: CGFloat = 30        // how far the right side sits below the tab
        let tabEnd = rect.minX + rect.width * 0.52
        let chamferEnd = tabEnd + 34

        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.minY + r))
        p.addQuadCurve(to: CGPoint(x: rect.minX + r, y: rect.minY),
                       control: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: tabEnd, y: rect.minY))
        p.addLine(to: CGPoint(x: chamferEnd, y: rect.minY + tabDrop))
        p.addLine(to: CGPoint(x: rect.maxX - r, y: rect.minY + tabDrop))
        p.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.minY + tabDrop + r),
                       control: CGPoint(x: rect.maxX, y: rect.minY + tabDrop))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}

/// A 1-pt horizontal line — stroked with a dash style for perforations and
/// route lines.
struct PickDashLine: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.midY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        return p
    }
}
