// OnboardingLeaderboardPage.swift
//
// Page 12: the leaderboard pitch. Minimal copy up top; the visual does the
// selling. The board is a pixel-faithful replica of the Agents tab's real
// leaderboard (`AgentLeaderboard.swift` LeaderboardRow: gold/silver/bronze
// rank badges, glowing gradient avatar discs with pixel sprites, sports
// labels, record + net units in win/loss colors, green win-rate badge, and
// the green filter pills above) fed with sample data, plus a flame streak
// chip in the chevron slot since the rows aren't tappable here.
//
// Choreography: rows deal in, the #1 agent's streak chip counts W1→W7 with
// tick haptics, then the row spotlights and a "7 in a row" callout pops
// with a success haptic. Reduce Motion renders the finished board.
//
// Visual constants below are copied from LeaderboardRow on purpose — if
// that row's design changes, mirror it here so the pitch stays honest.

import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

struct OnboardingLeaderboardPage: View {
    @Environment(OnboardingStore.self) private var store
    @Environment(\.onboardingPageIsActive) private var isActive
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var accent: Color {
        OnboardingTheme.accent(for: store.survey.bettorType)
    }

    private struct MockEntry: Identifiable {
        let id: Int
        let rank: Int
        let spriteIndex: Int
        let name: String
        let avatarColor: String
        let sports: [AgentSport]
        let record: String
        let netUnits: Double
        let winRate: Double
        /// Final streak length; 0 hides the chip. Rank 1's counts up live.
        let streak: Int
    }

    private static let entries: [MockEntry] = [
        .init(id: 0, rank: 1, spriteIndex: 2, name: "Sharp Signal",
              avatarColor: "gradient:#22C55E,#0EA5E9", sports: [.nfl, .nba],
              record: "48-30", netUnits: 21.4, winRate: 0.615, streak: 7),
        .init(id: 1, rank: 2, spriteIndex: 6, name: "Fade the Public",
              avatarColor: "gradient:#F97316,#EF4444", sports: [.nfl],
              record: "51-35-2", netUnits: 14.2, winRate: 0.593, streak: 4),
        .init(id: 2, rank: 3, spriteIndex: 4, name: "Totals Lab",
              avatarColor: "gradient:#8B5CF6,#EC4899", sports: [.nba, .mlb],
              record: "44-32", netUnits: 9.8, winRate: 0.579, streak: 3),
        .init(id: 3, rank: 4, spriteIndex: 1, name: "Dog Money",
              avatarColor: "#3B82F6", sports: [.mlb],
              record: "39-31", netUnits: 6.1, winRate: 0.557, streak: 2),
        .init(id: 4, rank: 5, spriteIndex: 5, name: "Prime Time",
              avatarColor: "#EAB308", sports: [.nfl, .cfb],
              record: "41-34", netUnits: 4.5, winRate: 0.547, streak: 0),
    ]

    // Staged animation state.
    @State private var shownRows = 0
    @State private var topStreak = 0
    @State private var spotlightOn = false
    @State private var showCallout = false
    @State private var sequenceStarted = false

    var body: some View {
        OnboardingPageScaffold(
            title: "Or just tail the best"
        ) {
            VStack(alignment: .leading, spacing: 12) {
                filterPillsRow

                ForEach(Array(Self.entries.enumerated()), id: \.element.id) { index, entry in
                    leaderboardRow(entry)
                        .opacity(shownRows > index ? 1 : 0)
                        .offset(y: shownRows > index ? 0 : 20)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 4)
            .overlay(alignment: .topTrailing) {
                if showCallout {
                    calloutBubble
                        // Rides the #1 row's top border, pointing at the
                        // corner W7 badge without covering the row's stats.
                        .offset(x: -64, y: 22)
                        .transition(.scale(scale: 0.3, anchor: .trailing).combined(with: .opacity))
                }
            }
            .sensoryFeedback(.success, trigger: showCallout)

            Text("Follow any agent and its picks land in your feed. Sample data shown.")
                .font(.system(size: 12))
                .foregroundStyle(Color.white.opacity(0.5))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
                .padding(.top, 12)
        }
        .onChange(of: isActive, initial: true) { _, active in
            guard active, !sequenceStarted else { return }
            sequenceStarted = true
            Task { await runSequence() }
        }
    }

    // MARK: - Filter pills (static replica of LeaderboardFilterBar)

    private var filterPillsRow: some View {
        HStack(spacing: 8) {
            staticPill("Win Rate", isActive: true)
            staticPill("Net Units", isActive: false)
            staticPill("This Season", isActive: false)
            Spacer(minLength: 0)
        }
    }

    private func staticPill(_ label: String, isActive: Bool) -> some View {
        Text(label)
            .font(.system(size: 12, weight: .bold))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                Capsule().fill(
                    isActive ? Color(hex: 0x00E676).opacity(0.15) : Color.appBorder.opacity(0.5)
                )
            )
            .overlay(
                Capsule().stroke(
                    isActive ? Color(hex: 0x00E676).opacity(0.45) : Color.appBorder.opacity(0.3),
                    lineWidth: 1
                )
            )
            .foregroundStyle(isActive ? Color(hex: 0x00E676) : Color.appTextSecondary)
    }

    // MARK: - Row (faithful replica of LeaderboardRow + streak chip)

    private func leaderboardRow(_ entry: MockEntry) -> some View {
        let isTop = entry.rank == 1
        let highlighted = isTop && spotlightOn

        return HStack(spacing: 12) {
            rankBadge(entry.rank)
            avatarSection(entry)
            Spacer(minLength: 0)
            statsSection(entry)
            winRateBadge(entry)
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(highlighted ? accent.opacity(0.14) : Color.appBorder.opacity(0.2))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(
                    highlighted ? accent.opacity(0.9) : Color.appBorder.opacity(0.3),
                    lineWidth: highlighted ? 1.4 : 1
                )
        )
        // Streak rides the row's corner as a badge (not in-line) so the row
        // layout stays identical to the real LeaderboardRow and long agent
        // names keep their width.
        .overlay(alignment: .topTrailing) {
            streakChip(entry, highlighted: highlighted)
                .offset(x: 6, y: -9)
        }
        .scaleEffect(highlighted ? 1.02 : 1)
        .shadow(color: highlighted ? accent.opacity(0.35) : .clear, radius: 10)
    }

    @ViewBuilder
    private func rankBadge(_ rank: Int) -> some View {
        let (color, icon): (Color, String?) = switch rank {
        case 1: (Color(hex: 0xFFD700), "trophy.fill")
        case 2: (Color(hex: 0xC0C0C0), "medal.fill")
        case 3: (Color(hex: 0xCD7F32), "medal")
        default: (Color.appTextSecondary, nil)
        }

        if let icon {
            Image(systemName: icon)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 32)
        } else {
            Text("\(rank)")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(color)
                .frame(width: 32)
        }
    }

    @ViewBuilder
    private func avatarSection(_ entry: MockEntry) -> some View {
        let avatar = ZStack {
            Circle().fill(LinearGradient(
                colors: AgentColorPalette.avatarGradient(for: entry.avatarColor),
                startPoint: .topLeading, endPoint: .bottomTrailing))
            PixelSpriteAvatar(spriteIndex: entry.spriteIndex)
                .padding(entry.rank <= 3 ? 3 : 2)
        }
        .frame(width: entry.rank <= 3 ? 44 : 36, height: entry.rank <= 3 ? 44 : 36)

        HStack(spacing: 10) {
            if entry.rank <= 3 {
                GlowingCardWrapper(color: entry.avatarColor, cornerRadius: 22) {
                    avatar
                }
            } else {
                avatar
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                HStack(spacing: 4) {
                    ForEach(entry.sports.prefix(2), id: \.self) { sport in
                        Text(sport.label)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }
            }
        }
    }

    private func statsSection(_ entry: MockEntry) -> some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text(entry.record)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .monospacedDigit()
            Text(String(format: "+%.2fu", entry.netUnits))
                .font(.system(size: 14, weight: .heavy))
                .foregroundStyle(Color.appWin)
                .monospacedDigit()
        }
        .frame(minWidth: 56)
    }

    private func winRateBadge(_ entry: MockEntry) -> some View {
        Text(String(format: "%.1f%%", entry.winRate * 100))
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(Color(hex: 0x00E676))
            .monospacedDigit()
            .frame(width: 44)
    }

    @ViewBuilder
    private func streakChip(_ entry: MockEntry, highlighted: Bool) -> some View {
        // Rank 1's chip counts up live; the rest show their final streak.
        let shown = entry.rank == 1 ? topStreak : entry.streak
        if shown > 0 {
            HStack(spacing: 3) {
                Image(systemName: "flame.fill")
                    .font(.system(size: 9, weight: .bold))
                Text("W\(shown)")
                    .font(.system(size: 11.5, weight: .heavy))
                    .monospacedDigit()
                    .contentTransition(.numericText(value: Double(shown)))
            }
            .foregroundStyle(highlighted ? Color.black : Color.orange)
            .padding(.horizontal, 7)
            .padding(.vertical, 4)
            .background(
                Capsule().fill(highlighted ? Color.orange : Color(hex: 0x3A2A18))
            )
            .overlay(Capsule().strokeBorder(Color.orange.opacity(0.45), lineWidth: 1))
            .sensoryFeedback(.selection, trigger: shown)
        }
    }

    /// "7 in a row" pop above the #1 agent's streak chip.
    private var calloutBubble: some View {
        Text("7 in a row 🔥")
            .font(.system(size: 13, weight: .heavy))
            .foregroundStyle(.black)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Capsule().fill(Color.orange))
            .shadow(color: Color.orange.opacity(0.5), radius: 8)
    }

    // MARK: - Sequence

    private func runSequence() async {
        if reduceMotion {
            var t = Transaction(); t.disablesAnimations = true
            withTransaction(t) {
                shownRows = Self.entries.count
                topStreak = Self.entries[0].streak
                spotlightOn = true
                showCallout = true
            }
            return
        }

        // Deal the rows in.
        for i in 1...Self.entries.count {
            withAnimation(.spring(response: 0.45, dampingFraction: 0.8)) { shownRows = i }
            try? await Task.sleep(nanoseconds: 170_000_000)
        }

        // Beat, then the streak counts up on the #1 row.
        try? await Task.sleep(nanoseconds: 450_000_000)
        for w in 1...Self.entries[0].streak {
            withAnimation(.snappy(duration: 0.15)) { topStreak = w }
            try? await Task.sleep(nanoseconds: 170_000_000)
        }

        // Spotlight + callout pop.
        withAnimation(.spring(response: 0.35, dampingFraction: 0.6)) { spotlightOn = true }
        try? await Task.sleep(nanoseconds: 150_000_000)
        withAnimation(.spring(response: 0.4, dampingFraction: 0.65)) { showCallout = true }
    }
}
