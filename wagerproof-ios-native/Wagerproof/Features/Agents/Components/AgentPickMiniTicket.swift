import SwiftUI
import WagerproofDesign
import WagerproofModels

// =====================================================================
// AgentPickMiniTicket — the miniaturized boarding-pass ticket.
//
// Same cardstock + perforation + route-line language as `AgentPickTicket`
// (see AgentPickTicket.swift), shrunk to a FIXED width so a day's picks
// ride in a horizontal rail (`AgentTodaysPicksRail`) led by a glass date
// circle. Tapping a mini ticket opens the same per-pick audit sheet the
// full cards use.
//
// Why a dedicated mini instead of scaling the full ticket: the full ticket
// is 250pt tall with an away/home names row + selection quote + market /
// odds / units stamps. At rail size that all collapses illegibly, so the
// mini keeps only the three things that read at a glance — the route
// (AWAY → HOME), the selection, and odds/units — and drops the rest.
// =====================================================================

struct AgentPickMiniTicket: View {
    let pick: AgentPick
    /// Agent brand tint — drives the units stamp + the pending confidence gauge.
    var accent: Color = .appPrimary

    // FIXED geometry so the perforation notch always lands on the tear line and
    // every ticket in the rail is uniform. Mirrors the full ticket's ratios.
    // Taller than the original 172pt so the card carries the game date + a short
    // "why" (reasoning) footer under the odds/units stamps — the info the user
    // asked for — instead of reading as a cramped stub.
    static let width: CGFloat = 178
    static let height: CGFloat = 240
    static let notchY: CGFloat = 116

    private var status: PickTicketStatus { pick.ticketStatus }

    var body: some View {
        VStack(spacing: 0) {
            topSection
                .frame(height: Self.notchY)
            bottomSection
                .frame(height: Self.height - Self.notchY)
        }
        .frame(width: Self.width, height: Self.height)
        .background { miniTicketCardstock(notchY: Self.notchY) }
        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(pick.matchup), \(pick.pickSelection), \(status.text)")
        .accessibilityHint("Tap to expand the pick")
    }

    // MARK: Top — sport tag, status/confidence, route line

    private var topSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                sportTag
                Spacer(minLength: 4)
                statusCorner
            }

            Spacer(minLength: 10)

            PickRouteLineRow(pick: pick, codeSize: 18)

            Spacer(minLength: 10)
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

    private var sportTag: some View {
        HStack(spacing: 4) {
            Image(systemName: pick.sport.sfSymbol)
                .font(.system(size: 9, weight: .semibold))
            Text(pick.sport.rawValue.uppercased())
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.6)
        }
        .foregroundStyle(Color.appTextSecondary)
    }

    /// Pending picks show a confidence gauge (no result yet); graded picks show
    /// the compact WIN / LOSS / PUSH stamp, matching the full ticket's badge.
    @ViewBuilder
    private var statusCorner: some View {
        if pick.result == .pending {
            HStack(spacing: 3) {
                Image(systemName: "gauge.medium")
                    .font(.system(size: 9, weight: .bold))
                Text("\(pick.confidence)/5")
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
                .background(status.color.opacity(0.16),
                            in: Capsule())
        }
    }

    // MARK: Bottom — selection + odds / units stamps

    private var bottomSection: some View {
        VStack(alignment: .leading, spacing: 9) {
            // The pick itself, shown proud — no quotes, no italic. It's the whole
            // point of the ticket, so it's the boldest, largest line on the card.
            Text(pick.pickSelection)
                .font(.system(size: 15, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(2)
                .minimumScaleFactor(0.72)
                .fixedSize(horizontal: false, vertical: true)

            HStack(alignment: .firstTextBaseline) {
                MiniPickStamp(label: "Market", value: PickTicketFormat.market(pick), alignment: .leading)
                Spacer(minLength: 6)
                MiniPickStamp(label: "Odds", value: pick.odds?.nonEmptyMini ?? "—", alignment: .center)
                Spacer(minLength: 6)
                MiniPickStamp(label: "Units", value: PickTicketFormat.units(pick.units), tint: accent, alignment: .trailing)
            }

            // The "why" behind the pick — the reasoning snippet is the main new
            // info the taller card buys us. Self-hides when the generator gave no
            // reasoning (the fixed card height just leaves a little tail space).
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

    /// Short "why" line for the footer: the agent's reasoning, or the first key
    /// factor as a fallback. Empty when neither is present.
    private var reasoningSnippet: String {
        let reasoning = pick.reasoningText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !reasoning.isEmpty { return reasoning }
        return pick.keyFactors?.first?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }
}

/// Translucent boarding-pass cardstock shared by the live + locked mini tickets.
/// A blurred glass base under a semi-opaque dark gradient, so the agent's
/// pixelwave aura bleeds through instead of the old flat/opaque panel (the
/// tickets read as glass over the page now, per design). The perforation notch
/// is punched via eoFill on `PickTicketShape`; the drop shadow lifts the card
/// off the aura.
@ViewBuilder
func miniTicketCardstock(notchY: CGFloat) -> some View {
    let shape = PickTicketShape(notchY: notchY, cornerRadius: 18, notchRadius: 7)
    ZStack {
        shape.fill(.ultraThinMaterial, style: FillStyle(eoFill: true))
        shape.fill(
            LinearGradient(colors: [Color(hex: 0x141927).opacity(0.55),
                                    Color(hex: 0x0D101A).opacity(0.72)],
                           startPoint: .top, endPoint: .bottom),
            style: FillStyle(eoFill: true)
        )
    }
    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    .shadow(color: .black.opacity(0.45), radius: 10, y: 5)
}

/// Compact label/value stamp for the mini ticket bottom — the small-type cousin
/// of `PickTicketStamp`.
struct MiniPickStamp: View {
    let label: String
    let value: String
    var tint: Color = .appTextPrimary
    let alignment: HorizontalAlignment

    var body: some View {
        VStack(alignment: alignment, spacing: 2) {
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
            Text(value)
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundStyle(tint)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
    }
}

// MARK: - Horizontal rail

/// Today's picks as a horizontal rail: a glass date circle pinned at the start,
/// then the day's mini tickets scrolling right. No scroll dots (per design) —
/// the peeking trailing ticket is the affordance that there's more. Tapping a
/// ticket calls `onTapPick` (the detail screen opens the audit sheet).
///
/// Edge-bleed: the host section pads its content by `WidgetCard.hInset`; this
/// rail cancels that with a negative outer pad and re-applies the inset inside
/// the scroll content, so cards scroll under the screen edge while the first
/// item still lines up with the section header.
struct AgentTodaysPicksRail: View {
    /// Picks + parlay tickets interleaved (newest first).
    let items: [AgentBetItem]
    var accent: Color = .appPrimary
    var onTapPick: (AgentPick) -> Void
    var onTapParlay: (AgentParlay) -> Void

    init(
        items: [AgentBetItem],
        accent: Color = .appPrimary,
        onTapPick: @escaping (AgentPick) -> Void,
        onTapParlay: @escaping (AgentParlay) -> Void = { _ in }
    ) {
        self.items = items
        self.accent = accent
        self.onTapPick = onTapPick
        self.onTapParlay = onTapParlay
    }

    /// Picks-only convenience — callers without parlays (BinAgentsSheet,
    /// previews) keep their existing shape.
    init(
        picks: [AgentPick],
        accent: Color = .appPrimary,
        onTapPick: @escaping (AgentPick) -> Void
    ) {
        self.init(items: picks.map(AgentBetItem.pick), accent: accent, onTapPick: onTapPick)
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .center, spacing: 12) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    Group {
                        switch item {
                        case .pick(let pick):
                            AgentPickMiniTicket(pick: pick, accent: accent)
                                .onTapGesture { onTapPick(pick) }
                        case .parlay(let parlay):
                            AgentParlayMiniTicket(parlay: parlay, accent: accent)
                                .onTapGesture { onTapParlay(parlay) }
                        }
                    }
                    .staggeredAppear(index: index)
                }
            }
            .padding(.horizontal, WidgetCard.hInset)
            .padding(.vertical, 4)   // breathing room so card shadows aren't clipped
        }
        // Let the card drop-shadows bleed past the scroll bounds.
        .scrollClipDisabled()
    }
}

// MARK: - Skeleton rail (loading)

/// Loading placeholder for the rail: a circle skeleton + a couple of mini-ticket
/// skeletons, matching the real rail's footprint so the swap doesn't jump.
struct AgentTodaysPicksRailSkeleton: View {
    var count: Int = 3

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .center, spacing: 12) {
                ForEach(0..<count, id: \.self) { _ in
                    AgentPickMiniTicketSkeleton()
                }
            }
            .padding(.horizontal, WidgetCard.hInset)
            .padding(.vertical, 4)
        }
        .scrollClipDisabled()
    }
}

/// Mini-ticket skeleton — same cardstock + notch geometry as the real ticket,
/// with the inner content shimmering. Mirrors `PickCardSkeleton`'s approach.
struct AgentPickMiniTicketSkeleton: View {
    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    SkeletonCapsule(width: 48, height: 12)
                    Spacer(minLength: 4)
                    SkeletonCapsule(width: 30, height: 12)
                    SkeletonCapsule(width: 34, height: 12)
                }
                Spacer(minLength: 10)
                HStack(spacing: 8) {
                    SkeletonCircle(22); SkeletonBlock(width: 28, height: 18)
                    Spacer(minLength: 0)
                    SkeletonBlock(width: 28, height: 18); SkeletonCircle(22)
                }
                Spacer(minLength: 10)
            }
            .padding(.horizontal, 14)
            .padding(.top, 12)
            .frame(height: AgentPickMiniTicket.notchY)

            VStack(alignment: .leading, spacing: 9) {
                SkeletonBlock(width: 96, height: 13)
                HStack {
                    SkeletonBlock(width: 40, height: 18)
                    Spacer(minLength: 6)
                    SkeletonBlock(width: 32, height: 18)
                    Spacer(minLength: 6)
                    SkeletonBlock(width: 30, height: 18)
                }
                SkeletonBlock(width: 140, height: 10)
                SkeletonBlock(width: 104, height: 10)
            }
            .padding(.horizontal, 14)
            .padding(.top, 11)
            .padding(.bottom, 12)
            .frame(height: AgentPickMiniTicket.height - AgentPickMiniTicket.notchY, alignment: .top)
        }
        .frame(width: AgentPickMiniTicket.width, height: AgentPickMiniTicket.height)
        .shimmering()
        .background {
            PickTicketShape(notchY: AgentPickMiniTicket.notchY, cornerRadius: 18, notchRadius: 7)
                .fill(Color(hex: 0x111521), style: FillStyle(eoFill: true))
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }
}

// MARK: - Locked rail (non-Pro)

/// The non-Pro locked state, styled as a rail so it reads as a peer of the real
/// today's-picks rail: a date circle + a couple of locked mini tickets (same
/// cardstock + notch, content swapped for a lock + upgrade prompt). Replaces the
/// old flat muted placeholders.
struct AgentLockedPicksRail: View {
    var accent: Color = .appPrimary

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .center, spacing: 12) {
                ForEach(0..<2, id: \.self) { _ in
                    AgentPickMiniTicketLocked(accent: accent)
                }
            }
            .padding(.horizontal, WidgetCard.hInset)
            .padding(.vertical, 4)
        }
        .scrollClipDisabled()
    }
}

/// A locked mini ticket — the same boarding-pass cardstock as the real mini
/// ticket, with the content replaced by a lock + "Upgrade to Pro" prompt.
struct AgentPickMiniTicketLocked: View {
    var accent: Color = .appPrimary

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "lock.fill")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
            Text("Upgrade to Pro")
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
            Text("to view this agent's picks")
                .font(.system(size: 10))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 14)
        .frame(width: AgentPickMiniTicket.width, height: AgentPickMiniTicket.height)
        .background { miniTicketCardstock(notchY: AgentPickMiniTicket.notchY) }
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(accent.opacity(0.16), lineWidth: 1)
        )
    }
}

private extension String {
    var nonEmptyMini: String? { isEmpty ? nil : self }
}

// MARK: - Preview

#if DEBUG
/// Visual harness for the today's-picks rail + mini ticket + glass action chips,
/// rendered over the page's near-black surface so the glass reads correctly.
/// Pure sample data — no network, no auth — so it builds on device.
#Preview("Today's Picks rail") {
    let accent = Color(hex: 0x6366F1)
    let today: String = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }()

    func pick(
        _ id: String,
        _ sport: AgentSport,
        matchup: String,
        bet: String,
        selection: String,
        odds: String?,
        units: Double = 1,
        confidence: Int = 3,
        result: AgentPick.PickResultStatus = .pending
    ) -> AgentPick {
        AgentPick(
            id: id, avatarId: "a", gameId: "g", sport: sport, matchup: matchup,
            gameDate: today, betType: bet, pickSelection: selection, odds: odds,
            units: units, confidence: confidence,
            reasoningText: "Sample reasoning for the preview harness.",
            keyFactors: ["Edge vs market", "Recent form"],
            result: result, actualResult: nil, gradedAt: nil, createdAt: today
        )
    }

    let picks: [AgentPick] = [
        pick("1", .mlb, matchup: "New York Yankees @ Boston Red Sox", bet: "total", selection: "Over 8.5", odds: "-110", confidence: 4),
        pick("2", .nfl, matchup: "Kansas City Chiefs @ Buffalo Bills", bet: "spread", selection: "KC -3.5", odds: "-110", units: 2, confidence: 3),
        pick("3", .nba, matchup: "Los Angeles Lakers @ Denver Nuggets", bet: "moneyline", selection: "Nuggets ML", odds: "+125", confidence: 5, result: .won),
        pick("4", .ncaab, matchup: "Duke Blue Devils @ UNC Tar Heels", bet: "total", selection: "Under 145.5", odds: "-108", result: .lost),
    ]

    return ScrollView {
        VStack(alignment: .leading, spacing: 28) {
            Group {
                AgentSectionHeader(title: "Today's Picks", systemImage: "doc.text.image")
                AgentTodaysPicksRail(picks: picks, accent: accent) { _ in }
            }

            Group {
                Text("LOADING").font(.caption).foregroundStyle(.secondary).padding(.leading, 16)
                AgentTodaysPicksRailSkeleton()
            }

            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    AutopilotChip(isOn: true, accent: accent) { _ in }
                    AutopilotChip(isOn: false, accent: accent) { _ in }
                }
                HStack(spacing: 10) {
                    HoldToRegenButton(accent: accent, enabled: true) {}
                    HoldToRegenButton(accent: accent, enabled: false) {}
                }
            }
            .padding(.horizontal, 16)
        }
        .padding(.vertical, 24)
    }
    .background(Color(hex: 0x0B1011))
    .preferredColorScheme(.dark)
}
#endif
