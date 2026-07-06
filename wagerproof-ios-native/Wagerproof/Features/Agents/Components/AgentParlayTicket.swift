import SwiftUI
import WagerproofDesign
import WagerproofModels

// =====================================================================
// AgentParlayTicket — a multi-leg parlay rendered in the same boarding-
// pass vocabulary as AgentPickTicket (cardstock, perforation notch,
// stamps), but variable-height: the single away↔home route row becomes
// a vertical stack of compact leg rows, and the per-pick Market/Odds
// stamps become ONE ticket-level Combined Odds / Units row (a parlay is
// one staked ticket).
//
// Sibling components (not an enum-parameterized AgentPickTicket): the
// pick ticket's fixed height/notchY constants are baked into the folder
// peek + rolodex physics, and a 2–4-leg ticket can't be one fixed size.
//   • AgentParlayTicket          — stacked/list ticket (folder + sheet)
//   • ExpandedAgentParlayTicket  — full pass shown when tapped
//   • AgentParlayMiniTicket      — fixed-size rail ticket (Today's Picks)
// =====================================================================

// MARK: - Status mapping (parity with AgentPick.ticketStatus)

extension AgentParlay {
    var ticketStatus: PickTicketStatus {
        switch result {
        case .won:     return PickTicketStatus(text: "WIN", color: .appWin)
        case .lost:    return PickTicketStatus(text: "LOSS", color: .appLoss)
        case .push:    return PickTicketStatus(text: "PUSH", color: .appPending)
        case .pending: return PickTicketStatus(text: "PENDING", color: .appTextSecondary)
        }
    }
}

extension AgentParlayLeg {
    var legStatusColor: Color {
        switch legResult {
        case .won: return .appWin
        case .lost: return .appLoss
        case .push: return .appPending
        case .pending: return .appTextSecondary
        }
    }
}

/// Short market label for a parlay leg — the leg-shaped cousin of
/// `PickTicketFormat.market` with the period folded in ("1H Spread", "F5 ML").
func parlayLegMarket(_ leg: AgentParlayLeg) -> String {
    let bt = leg.betType.lowercased()
    let base: String
    if bt.contains("moneyline") || bt == "ml" { base = "ML" }
    else if bt == "team_total" { base = "Team Total" }
    else if bt.contains("spread") || bt.contains("runline") { base = "Spread" }
    else if bt.contains("total") { base = "Total" }
    else if bt == "prop" { base = "Prop" }
    else { base = leg.betType.isEmpty ? "Leg" : leg.betType.capitalized }
    switch leg.period {
    case "f5": return "F5 \(base)"
    case "h1": return "1H \(base)"
    default: return base
    }
}

// MARK: - Unified bet ticket

/// Renders the right stacked ticket for either item shape — the one switch the
/// folder peek, rolodex, and landscape grid all share.
struct BetItemTicket: View {
    let item: AgentBetItem
    var accent: Color = .appPrimary

    var body: some View {
        switch item {
        case .pick(let pick):
            AgentPickTicket(pick: pick, accent: accent)
        case .parlay(let parlay):
            AgentParlayTicket(parlay: parlay, accent: accent)
        }
    }
}

// MARK: - Stack ticket (variable height)

/// The compact parlay ticket for the folder peek + rolodex. Height grows with
/// the leg count; expose it statically so stack layouts can precompute.
struct AgentParlayTicket: View {
    let parlay: AgentParlay
    var accent: Color = .appPrimary
    /// Leg rows rendered before truncation. Folder/rolodex call sites keep the
    /// default 4 (their stack physics assume it); the Week Long Parlays section
    /// passes 6 so a full week ticket shows every leg.
    var maxShownLegs: Int = 4

    // Geometry: header + N leg rows above the tear line, a 100pt stub below
    // (same stub height as AgentPickTicket so the bottoms rhyme in the pile).
    static let headerHeight: CGFloat = 52
    static let legRowHeight: CGFloat = 44
    static let stubHeight: CGFloat = 100

    static func notchY(forLegs n: Int, maxLegs: Int = 4) -> CGFloat {
        headerHeight + legRowHeight * CGFloat(max(2, min(n, maxLegs)))
    }

    static func height(forLegs n: Int, maxLegs: Int = 4) -> CGFloat {
        notchY(forLegs: n, maxLegs: maxLegs) + stubHeight
    }

    private var status: PickTicketStatus { parlay.ticketStatus }
    private var shownLegs: [AgentParlayLeg] { Array(parlay.legs.prefix(maxShownLegs)) }
    private var notchY: CGFloat { Self.notchY(forLegs: shownLegs.count, maxLegs: maxShownLegs) }

    var body: some View {
        VStack(spacing: 0) {
            topSection
                .frame(height: notchY)
            bottomSection
                .frame(height: Self.stubHeight)
        }
        .frame(height: Self.height(forLegs: shownLegs.count, maxLegs: maxShownLegs))
        .background {
            PickTicketShape(notchY: notchY)
                .fill(LinearGradient(colors: [Color(hex: 0x141927), Color(hex: 0x0D101A)],
                                     startPoint: .top, endPoint: .bottom),
                      style: FillStyle(eoFill: true))
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .strokeBorder(.white.opacity(0.07), lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.22), radius: 5, y: 2)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(parlay.displayLegsCount) leg parlay, \(parlay.combinedOdds ?? ""), \(status.text)")
        .accessibilityHint("Tap to expand the parlay")
    }

    private var topSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(PickTicketFormat.gameDate(parlay.displayDate))
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Color.appTextPrimary.opacity(0.85))
                parlayBadge
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
            .padding(.top, 18)

            Spacer(minLength: 6)

            VStack(spacing: 0) {
                ForEach(shownLegs) { leg in
                    ParlayLegRow(leg: leg, showsDivider: leg.id != shownLegs.last?.id)
                        .frame(height: Self.legRowHeight)
                }
            }

            Spacer(minLength: 6)
        }
        .padding(.horizontal, 20)
        .overlay(alignment: .bottom) {
            PickDashLine()
                .stroke(Color.white.opacity(0.16),
                        style: StrokeStyle(lineWidth: 1, dash: [5, 5]))
                .frame(height: 1)
                .padding(.horizontal, 18)
        }
    }

    private var parlayBadge: some View {
        HStack(spacing: 4) {
            Image(systemName: "link")
                .font(.system(size: 9, weight: .bold))
            Text("\(parlay.displayLegsCount)-LEG PARLAY")
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.6)
        }
        .foregroundStyle(accent)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(accent.opacity(0.14), in: Capsule())
    }

    private var bottomSection: some View {
        VStack(spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                PickTicketStamp(label: "Legs", value: "\(parlay.displayLegsCount)", alignment: .leading)
                Spacer()
                PickTicketStamp(label: "Combined Odds", value: parlay.combinedOdds ?? "—", alignment: .center)
                Spacer()
                PickTicketStamp(label: "Units", value: PickTicketFormat.units(parlay.units), alignment: .trailing)
            }

            HStack(spacing: 8) {
                Text(parlay.sport == .multi ? "Cross-sport ticket" : "\(parlay.sport.label) ticket")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: "gauge.medium")
                        .font(.system(size: 9, weight: .bold))
                    Text("\(parlay.confidence)/5")
                        .font(.system(size: 10, weight: .bold))
                }
                .foregroundStyle(accent)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 14)
        .padding(.bottom, 14)
    }
}

// MARK: - Leg row (compact)

/// One leg inside the stacked parlay ticket: result dot, market tag, the
/// selection shown proud, and the leg's own odds.
private struct ParlayLegRow: View {
    let leg: AgentParlayLeg
    var showsDivider: Bool = true

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Circle()
                    .fill(leg.legStatusColor)
                    .frame(width: 6, height: 6)
                VStack(alignment: .leading, spacing: 1) {
                    Text(leg.pickSelection)
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    HStack(spacing: 5) {
                        Image(systemName: leg.sport.sfSymbol)
                            .font(.system(size: 8, weight: .semibold))
                        Text(parlayLegMarket(leg))
                            .font(.system(size: 10, weight: .medium))
                        Text(leg.matchup)
                            .font(.system(size: 10))
                            .lineLimit(1)
                    }
                    .foregroundStyle(Color.appTextSecondary)
                }
                Spacer(minLength: 6)
                Text(leg.odds ?? "—")
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Color.appTextPrimary)
            }
            .frame(maxHeight: .infinity)
            if showsDivider {
                PickDashLine()
                    .stroke(Color.white.opacity(0.08),
                            style: StrokeStyle(lineWidth: 1, dash: [3, 4]))
                    .frame(height: 1)
            }
        }
    }
}

// MARK: - Expanded pass (tap a ticket)

/// The full parlay pass — same detail-grid pattern as ExpandedAgentPickTicket,
/// with the single Selection block replaced by a numbered leg list. No audit
/// button for v1: the pick audit sheet fetches by avatar_picks id, which a
/// parlay doesn't have.
struct ExpandedAgentParlayTicket: View {
    let parlay: AgentParlay
    var accent: Color = .appPrimary
    var showsBranding: Bool = false

    private var status: PickTicketStatus { parlay.ticketStatus }
    private var notchY: CGFloat { 96 + CGFloat(min(parlay.legs.count, 4)) * 24 }

    var body: some View {
        VStack(spacing: 0) {
            topSection
                .frame(height: notchY)
            detailGrid
        }
        .background {
            PickTicketShape(notchY: notchY)
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
            HStack(spacing: 8) {
                Text(PickTicketFormat.gameDate(parlay.displayDate))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary.opacity(0.9))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Color.white.opacity(0.08), in: Capsule())
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

            Spacer(minLength: 10)

            HStack(spacing: 6) {
                Image(systemName: "link")
                    .font(.system(size: 15, weight: .bold))
                Text("\(parlay.displayLegsCount)-LEG PARLAY")
                    .font(.system(size: 19, weight: .heavy, design: .rounded))
                    .tracking(1.5)
            }
            .foregroundStyle(accent)

            Text(parlay.sport == .multi ? "Cross-sport ticket" : "\(parlay.sport.label) ticket")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
                .padding(.top, 4)

            Spacer(minLength: 12)
        }
        .padding(.horizontal, 22)
        .padding(.top, 20)
        // The link glyph ghosted into the cardstock, like the pick pass's
        // sport symbol.
        .background(alignment: .topTrailing) {
            Image(systemName: "link")
                .font(.system(size: 100, weight: .regular))
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
                left: ("Combined Odds", parlay.combinedOdds ?? "—", Color.appTextPrimary),
                right: ("Units", PickTicketFormat.units(parlay.units), accent))
            detailRow(
                left: ("Confidence", "\(parlay.confidence)/5", accent),
                right: ("Result", parlay.actualResult ?? status.text, status.color))

            VStack(alignment: .leading, spacing: 8) {
                Text("LEGS")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(1)
                    .foregroundStyle(Color.appTextSecondary)
                ForEach(Array(parlay.legs.enumerated()), id: \.element.id) { index, leg in
                    HStack(alignment: .top, spacing: 10) {
                        Text("\(index + 1)")
                            .font(.system(size: 12, weight: .heavy, design: .monospaced))
                            .foregroundStyle(leg.legStatusColor)
                            .frame(width: 18, height: 18)
                            .background(leg.legStatusColor.opacity(0.15), in: Circle())
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 8) {
                                Text(leg.pickSelection)
                                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                                    .foregroundStyle(Color.appTextPrimary)
                                    .lineLimit(2)
                                    .minimumScaleFactor(0.7)
                                Spacer(minLength: 6)
                                Text(leg.odds ?? "—")
                                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                                    .foregroundStyle(Color.appTextSecondary)
                            }
                            Text("\(parlayLegMarket(leg)) · \(leg.matchup) · \(PickTicketFormat.gameDate(leg.gameDate))")
                                .font(.system(size: 11))
                                .foregroundStyle(Color.appTextSecondary)
                                .lineLimit(1)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if !parlay.reasoningText.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("SUMMARY")
                        .font(.system(size: 11, weight: .heavy))
                        .tracking(1)
                        .foregroundStyle(Color.appTextSecondary)
                    Text(parlay.reasoningText)
                        .font(.system(size: 14))
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            if let factors = parlay.keyFactors, !factors.isEmpty {
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

            if showsBranding {
                WagerproofTicketFooter()
                    .frame(maxWidth: .infinity)
                    .padding(.top, 10)
            }
        }
        .padding(.horizontal, 22)
        .padding(.top, 18)
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

// MARK: - Mini ticket (Today's Picks rail)

/// Fixed-size parlay ticket for the horizontal rail — same footprint as
/// `AgentPickMiniTicket` so the rail stays uniform. The route row becomes a
/// stack of one-line leg selections; the stamps become Legs / Odds / Units.
struct AgentParlayMiniTicket: View {
    let parlay: AgentParlay
    var accent: Color = .appPrimary

    private var status: PickTicketStatus { parlay.ticketStatus }
    private var shownLegs: [AgentParlayLeg] { Array(parlay.legs.prefix(4)) }

    var body: some View {
        VStack(spacing: 0) {
            topSection
                .frame(height: AgentPickMiniTicket.notchY)
            bottomSection
                .frame(height: AgentPickMiniTicket.height - AgentPickMiniTicket.notchY)
        }
        .frame(width: AgentPickMiniTicket.width, height: AgentPickMiniTicket.height)
        .background { miniTicketCardstock(notchY: AgentPickMiniTicket.notchY) }
        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(parlay.displayLegsCount) leg parlay, \(parlay.combinedOdds ?? ""), \(status.text)")
        .accessibilityHint("Tap to expand the parlay")
    }

    private var topSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                HStack(spacing: 4) {
                    Image(systemName: "link")
                        .font(.system(size: 9, weight: .semibold))
                    Text("PARLAY")
                        .font(.system(size: 10, weight: .heavy))
                        .tracking(0.6)
                }
                .foregroundStyle(accent)
                Spacer(minLength: 4)
                Text(PickTicketFormat.gameDate(parlay.displayDate))
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                statusCorner
            }

            Spacer(minLength: 8)

            VStack(alignment: .leading, spacing: 4) {
                ForEach(shownLegs) { leg in
                    HStack(spacing: 5) {
                        Circle()
                            .fill(leg.legStatusColor)
                            .frame(width: 4, height: 4)
                        Text(leg.pickSelection)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color.appTextPrimary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                }
            }

            Spacer(minLength: 8)
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .overlay(alignment: .bottom) {
            PickDashLine()
                .stroke(Color.white.opacity(0.16),
                        style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                .frame(height: 1)
                .padding(.horizontal, 12)
        }
    }

    @ViewBuilder
    private var statusCorner: some View {
        if parlay.result == .pending {
            HStack(spacing: 3) {
                Image(systemName: "gauge.medium")
                    .font(.system(size: 9, weight: .bold))
                Text("\(parlay.confidence)/5")
                    .font(.system(size: 10, weight: .bold))
            }
            .foregroundStyle(accent)
        } else {
            Text(status.text)
                .font(.system(size: 9, weight: .heavy))
                .tracking(0.5)
                .foregroundStyle(status.color)
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(status.color.opacity(0.16), in: Capsule())
        }
    }

    private var bottomSection: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("\(parlay.displayLegsCount)-Leg Ticket")
                .font(.system(size: 15, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)

            HStack(alignment: .firstTextBaseline) {
                MiniPickStamp(label: "Legs", value: "\(parlay.displayLegsCount)", alignment: .leading)
                Spacer(minLength: 6)
                MiniPickStamp(label: "Odds", value: parlay.combinedOdds ?? "—", alignment: .center)
                Spacer(minLength: 6)
                MiniPickStamp(label: "Units", value: PickTicketFormat.units(parlay.units), tint: accent, alignment: .trailing)
            }

            if !reasoningSnippet.isEmpty {
                Text(reasoningSnippet)
                    .font(.system(size: 10))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.top, 11)
        .padding(.bottom, 12)
    }

    private var reasoningSnippet: String {
        let reasoning = parlay.reasoningText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !reasoning.isEmpty { return reasoning }
        return parlay.keyFactors?.first?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }
}
