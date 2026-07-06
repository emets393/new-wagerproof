import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices

// =====================================================================
// WeekLongParlaysSection — the agent-detail section under Today's Picks
// for week-long NFL/CFB parlay tickets. A weekly ticket is built once
// from the remaining games of the football week (Tue→Mon) and persists
// here through Monday night; regens are additive (up to 3 per football
// week) and users prune tickets with the swipe-to-trash gesture.
//
// States:
//   • locked        → non-Pro viewers see a lock row (mirrors Performance)
//   • generating    → the shared AgentGenerationCard live-run cinematic
//   • has tickets   → full-width week ticket cards + owner footer controls
//   • enabled+empty → CTA copy + swipe pill + budget chip
//   • disabled      → "turn it on in Settings" hint (owner only)
// =====================================================================

struct WeekLongParlaysSection: View {
    let parlays: [AgentParlay]
    var accent: Color = .appPrimary
    /// personality_params.weekly_parlay_enabled (nil = off).
    let weeklyEnabled: Bool
    let canSeePicks: Bool
    let isOwnAgent: Bool
    /// True while a WEEKLY run is live (store.generatingWindow == .week).
    let isGeneratingWeekly: Bool
    /// True while any OTHER run is live — the weekly pill locks with busy copy.
    let isBusyElsewhere: Bool
    let liveRunState: TriggerV3RunStatus?
    let spriteIndex: Int
    /// Manual weekly budget left this football week (server-computed, 0–3).
    let remaining: Int
    let canGenerate: Bool
    /// Opens the weekly regenerate sheet (which hosts the committing pill).
    let onGenerate: () -> Void
    let onTapParlay: (AgentParlay) -> Void
    /// Owner-only swipe-to-trash; nil = gesture off.
    var onDeleteParlay: ((AgentParlay) -> Void)? = nil
    /// Pushes AgentSettingsView (the disabled-state hint's CTA).
    var onOpenSettings: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            AgentSectionHeader(title: "Week Long Parlays", systemImage: "calendar")

            if !canSeePicks {
                lockedRow
            } else if isGeneratingWeekly {
                AgentGenerationCard(
                    spriteIndex: spriteIndex,
                    accent: accent,
                    state: liveRunState,
                    isGenerating: true,
                    canGenerate: false,
                    lockedLabel: "Building weekly parlay…",
                    onGenerate: {}
                )
            } else if !parlays.isEmpty {
                VStack(spacing: 16) {
                    ForEach(parlays) { parlay in
                        WeekLongParlayCard(parlay: parlay, accent: accent)
                            .contentShape(Rectangle())
                            .onTapGesture { onTapParlay(parlay) }
                            .deletableTicket(enabled: onDeleteParlay != nil) {
                                onDeleteParlay?(parlay)
                            }
                    }
                }
                if isOwnAgent { ticketsFooter }
            } else if weeklyEnabled {
                emptyCTA
            } else if isOwnAgent {
                disabledHint
            }
        }
    }

    // MARK: - States

    private var lockedRow: some View {
        VStack(spacing: 8) {
            Image(systemName: "lock.fill").font(.system(size: 26))
                .foregroundStyle(Color.appTextSecondary)
            Text("Upgrade to view weekly parlays")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
    }

    /// Footer under existing tickets: the weekly budget chip that opens the
    /// weekly regenerate sheet (mirror of the daily rail's footer).
    private var ticketsFooter: some View {
        HStack {
            Text("Live through Monday night")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
            Spacer(minLength: 0)
            RegenerateControlButton(
                remaining: remaining,
                accent: accent,
                enabled: canGenerate && !isBusyElsewhere,
                title: "Weekly Parlay",
                action: onGenerate
            )
        }
        .padding(.top, 2)
    }

    private var emptyCTA: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(accent.opacity(0.16)).frame(width: 40, height: 40)
                    Image(systemName: "calendar.badge.plus")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(accent)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("No week-long ticket yet")
                        .font(.system(size: 15, weight: .heavy))
                        .foregroundStyle(Color.appTextPrimary)
                    Text("Build one parlay from this week's NFL/CFB slate — it stays live through Monday night.")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }

            if isOwnAgent {
                SwipeToGeneratePill(
                    title: pillTitle,
                    accent: accent,
                    isEnabled: canGenerate && !isBusyElsewhere,
                    onCommit: onGenerate
                )
                HStack {
                    Spacer()
                    Text("\(remaining) build\(remaining == 1 ? "" : "s") left this week")
                        .font(.system(size: 11, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(Color.appTextSecondary)
                    Spacer()
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white.opacity(0.04))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(accent.opacity(0.18), lineWidth: 1)
        )
    }

    private var pillTitle: String {
        if isBusyElsewhere { return "Agent is busy…" }
        if !canGenerate { return "Weekly limit reached" }
        return "Swipe to build weekly parlay"
    }

    /// Setting off: a muted one-row hint pointing at Settings.
    private var disabledHint: some View {
        Button { onOpenSettings?() } label: {
            HStack(spacing: 10) {
                Image(systemName: "calendar")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Weekly parlays are off")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text("Turn on Weekly Parlay in Settings to build one week-long NFL/CFB ticket per football week.")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.white.opacity(0.035))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.07), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Week ticket card

/// One week-long ticket: a slim week-context row above the full-width parlay
/// ticket (rendered with the 6-leg clamp so every leg of a week ticket shows).
struct WeekLongParlayCard: View {
    let parlay: AgentParlay
    var accent: Color = .appPrimary

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "calendar")
                    .font(.system(size: 10, weight: .bold))
                Text(weekLabel)
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.5)
                Spacer(minLength: 6)
                if parlay.result == .pending {
                    HStack(spacing: 4) {
                        Circle().fill(accent).frame(width: 5, height: 5)
                        Text("LIVE ALL WEEK")
                            .font(.system(size: 9, weight: .heavy))
                            .tracking(0.8)
                    }
                    .foregroundStyle(accent)
                }
            }
            .foregroundStyle(Color.appTextSecondary)
            .padding(.horizontal, 4)

            AgentParlayTicket(parlay: parlay, accent: accent, maxShownLegs: 6)
        }
    }

    /// "Week of Jul 7 · thru Mon Jul 13" — derived from the ticket's week_key
    /// (its ET Tuesday) and target_date (the Monday it runs through).
    private var weekLabel: String {
        let through = parlay.targetDate.isEmpty ? nil : PickTicketFormat.gameDate(parlay.targetDate)
        if let wk = parlay.weekKey, !wk.isEmpty {
            let start = PickTicketFormat.gameDate(wk)
            if let through { return "WEEK OF \(start.uppercased()) · THRU \(through.uppercased())" }
            return "WEEK OF \(start.uppercased())"
        }
        if let through { return "RUNS THRU \(through.uppercased())" }
        return "WEEK TICKET"
    }
}

// MARK: - Skeleton

/// Loading placeholder matching the section's ticket footprint (per the
/// design-system rule: every list gets a skeleton shaped like its content).
struct WeekLongParlaysSectionSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            AgentSectionHeader(title: "Week Long Parlays", systemImage: "calendar")
            VStack(alignment: .leading, spacing: 10) {
                SkeletonBlock(width: 160, height: 10)
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Color.white.opacity(0.05))
                    .frame(height: AgentParlayTicket.height(forLegs: 3))
            }
            .shimmering()
        }
    }
}

// MARK: - Previews

#Preview("States") {
    let legs: [AgentParlayLeg] = (0..<5).map { i in
        AgentParlayLeg(
            id: "leg\(i)", parlayId: "p1", gameId: "g\(i)", sport: i % 2 == 0 ? .nfl : .cfb,
            matchup: "Bills @ Chiefs", gameDate: "2026-09-1\(i)",
            betType: i == 2 ? "total" : "spread", pickSelection: i == 2 ? "Over 48.5" : "Bills -1.5",
            odds: "-110", legResult: .pending, createdAt: "2026-09-08T12:00:00Z"
        )
    }
    let ticket = AgentParlay(
        id: "p1", avatarId: "a1", sport: .nfl, legsCount: legs.count,
        combinedOdds: "+2438", units: 1.0, confidence: 4,
        reasoningText: "Five spots where the model and the market disagree across the week.",
        keyFactors: ["Model edge on 4 of 5 legs"], result: .pending,
        targetDate: "2026-09-14", scope: .weekly, weekKey: "2026-09-08",
        createdAt: "2026-09-08T12:00:00Z", legs: legs
    )
    return ScrollView {
        VStack(spacing: 32) {
            WeekLongParlaysSection(
                parlays: [ticket], accent: Color(hex: 0x00E676),
                weeklyEnabled: true, canSeePicks: true, isOwnAgent: true,
                isGeneratingWeekly: false, isBusyElsewhere: false,
                liveRunState: nil, spriteIndex: 0, remaining: 2, canGenerate: true,
                onGenerate: {}, onTapParlay: { _ in }, onDeleteParlay: { _ in }
            )
            WeekLongParlaysSection(
                parlays: [], accent: Color(hex: 0x00E676),
                weeklyEnabled: true, canSeePicks: true, isOwnAgent: true,
                isGeneratingWeekly: false, isBusyElsewhere: false,
                liveRunState: nil, spriteIndex: 0, remaining: 3, canGenerate: true,
                onGenerate: {}, onTapParlay: { _ in }
            )
            WeekLongParlaysSection(
                parlays: [], accent: Color(hex: 0x00E676),
                weeklyEnabled: false, canSeePicks: true, isOwnAgent: true,
                isGeneratingWeekly: false, isBusyElsewhere: false,
                liveRunState: nil, spriteIndex: 0, remaining: 3, canGenerate: true,
                onGenerate: {}, onTapParlay: { _ in }
            )
            WeekLongParlaysSectionSkeleton()
        }
        .padding(16)
    }
    .background(Color(hex: 0x0B1011))
    .preferredColorScheme(.dark)
}
