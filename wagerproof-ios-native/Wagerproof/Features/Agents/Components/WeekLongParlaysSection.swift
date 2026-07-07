import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices

// =====================================================================
// WeekLongParlaysSection — the agent-detail section under Today's Picks
// for week-long NFL/CFB parlay tickets. A weekly ticket is built once
// from the remaining games of the football week (Tue→Mon) and persists
// here through Monday night; users prune tickets with the swipe-to-trash
// gesture.
//
// DISPLAY-ONLY: there is no separate "build weekly parlay" control here.
// The week ticket is a byproduct of the ONE generation flow — the main
// "Generate Today's Picks" run builds it too when the agent has weekly
// parlays enabled (see AgentDetailView.maybeAutoBuildWeeklyParlay). This
// section only shows what that run produced, so users never face two
// competing pick-generation buttons.
//
// States:
//   • locked        → non-Pro viewers see a lock row (mirrors Performance)
//   • generating    → the shared AgentGenerationCard live-run cinematic
//   • has tickets   → compact mini-ticket rail matching Today's Picks
//   • enabled+empty → CTA copy explaining it builds with the agent's picks
//   • disabled      → "turn it on in Settings" hint (owner only)
// =====================================================================

struct WeekLongParlaysSection: View {
    let parlays: [AgentParlay]
    var accent: Color = .appPrimary
    /// personality_params.weekly_parlay_enabled (nil = off).
    let weeklyEnabled: Bool
    let canSeePicks: Bool
    let isOwnAgent: Bool
    /// True while the week ticket is being built (store.generatingWindow == .week).
    let isGeneratingWeekly: Bool
    let liveRunState: TriggerV3RunStatus?
    let spriteIndex: Int
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
                weeklyTicketsPager
            } else if weeklyEnabled {
                emptyCTA
            } else if isOwnAgent {
                disabledHint
            }
        }
    }

    // MARK: - States

    private var weeklyTicketsPager: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .center, spacing: 12) {
                ForEach(Array(parlays.enumerated()), id: \.element.id) { index, parlay in
                    AgentParlayMiniTicket(parlay: parlay, accent: accent)
                        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .onTapGesture { onTapParlay(parlay) }
                        .deletableTicket(enabled: onDeleteParlay != nil) {
                            onDeleteParlay?(parlay)
                        }
                        .staggeredAppear(index: index)
                }
            }
            .padding(.horizontal, WidgetCard.hInset)
            .padding(.vertical, 4)
        }
        .padding(.horizontal, -WidgetCard.hInset)
        .scrollClipDisabled()
        .accessibilityLabel("\(parlays.count) weekly parlay ticket\(parlays.count == 1 ? "" : "s")")
    }

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
                    Text("Use Generate Today's Picks. If this week's NFL/CFB slate has a clean parlay, it will appear here and stay live through Monday night.")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
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

// MARK: - Skeleton

/// Loading placeholder matching the section's ticket footprint (per the
/// design-system rule: every list gets a skeleton shaped like its content).
struct WeekLongParlaysSectionSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            AgentSectionHeader(title: "Week Long Parlays", systemImage: "calendar")
            HStack(alignment: .center, spacing: 12) {
                ForEach(0..<2, id: \.self) { _ in
                    AgentPickMiniTicketSkeleton()
                }
            }
            .padding(.vertical, 4)
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
    let secondTicket = AgentParlay(
        id: "p2", avatarId: "a1", sport: .nfl, legsCount: 3,
        combinedOdds: "+612", units: 0.8, confidence: 3,
        reasoningText: "Three props built from separate signal clusters.",
        keyFactors: ["Props cleared the model's signal gate"], result: .pending,
        targetDate: "2026-09-14", scope: .weekly, weekKey: "2026-09-08",
        createdAt: "2026-09-08T12:08:00Z", legs: Array(legs.prefix(3))
    )
    return ScrollView {
        VStack(spacing: 32) {
            WeekLongParlaysSection(
                parlays: [ticket, secondTicket], accent: Color(hex: 0x00E676),
                weeklyEnabled: true, canSeePicks: true, isOwnAgent: true,
                isGeneratingWeekly: false,
                liveRunState: nil, spriteIndex: 0,
                onTapParlay: { _ in }, onDeleteParlay: { _ in }
            )
            WeekLongParlaysSection(
                parlays: [], accent: Color(hex: 0x00E676),
                weeklyEnabled: true, canSeePicks: true, isOwnAgent: true,
                isGeneratingWeekly: false,
                liveRunState: nil, spriteIndex: 0,
                onTapParlay: { _ in }
            )
            WeekLongParlaysSection(
                parlays: [], accent: Color(hex: 0x00E676),
                weeklyEnabled: false, canSeePicks: true, isOwnAgent: true,
                isGeneratingWeekly: false,
                liveRunState: nil, spriteIndex: 0,
                onTapParlay: { _ in }
            )
            WeekLongParlaysSectionSkeleton()
        }
        .padding(16)
    }
    .background(Color(hex: 0x0B1011))
    .preferredColorScheme(.dark)
}
