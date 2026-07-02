import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices

/// Drill-down presented when a histogram bar is tapped: the top public agents
/// whose metric falls in that bin (ranked by net units), each expandable to
/// show their currently-open (pending) picks. Only public agents appear — the
/// RPC enforces that; private agents contribute to the bars but are never named.
///
/// Loads lazily on appear via `PlatformStatsService.fetchBinAgents`. Rows expand
/// in place rather than pushing a detail page — this sheet is presented from the
/// Secret Settings modal, which has no Agents navigation stack.
struct BinAgentsSheet: View {
    let title: String
    let metric: StatMetric
    let sport: AgentSport?
    let lower: Double
    let upper: Double
    let minDecided: Int
    /// DEBUG/harness override — when set, skips the network fetch.
    var preloaded: [BinAgent]? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var loadState: LoadState = .loading
    @State private var agents: [BinAgent] = []
    @State private var expanded: Set<String> = []

    private enum LoadState: Equatable {
        case loading, loaded, failed(String)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                content
                    .padding(16)
            }
            .background(Color.appSurface.ignoresSafeArea())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .tint(Color.appPrimary)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .task { await load() }
    }

    @ViewBuilder
    private var content: some View {
        switch loadState {
        case .loading:
            VStack(spacing: 12) {
                ForEach(0..<4, id: \.self) { _ in binRowSkeleton }
            }
        case .failed(let message):
            ContentUnavailableView {
                Label("Couldn't load agents", systemImage: "exclamationmark.triangle")
            } description: {
                Text(message)
            } actions: {
                Button("Retry") { Task { await load() } }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.appPrimary)
            }
            .padding(.top, 40)
        case .loaded:
            if agents.isEmpty {
                ContentUnavailableView(
                    "No public agents here",
                    systemImage: "person.crop.circle.badge.questionmark",
                    description: Text("No public agents fall in this range with open picks.")
                )
                .padding(.top, 40)
            } else {
                VStack(spacing: 10) {
                    Text("Top public agents · ranked by net units")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    ForEach(agents) { agent in
                        agentCard(agent)
                    }
                }
            }
        }
    }

    private func agentCard(_ agent: BinAgent) -> some View {
        let accent = AgentColorPalette.primary(for: agent.avatarColor)
        let isExpanded = expanded.contains(agent.id)
        return VStack(alignment: .leading, spacing: 12) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    if isExpanded { expanded.remove(agent.id) } else { expanded.insert(agent.id) }
                }
            } label: {
                HStack(spacing: 12) {
                    avatar(agent, accent: accent)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(agent.name)
                            .font(.system(size: 15, weight: .heavy))
                            .foregroundStyle(Color.appTextPrimary)
                            .lineLimit(1)
                        HStack(spacing: 8) {
                            Text(agent.recordLabel)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Color.appTextSecondary)
                            if let wr = agent.winRate {
                                Text("\(Int((wr * 100).rounded()))%")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(Color.appAccentBlue)
                            }
                        }
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 3) {
                        Text("\(agent.netUnits >= 0 ? "+" : "")\(String(format: "%.2fu", agent.netUnits))")
                            .font(.system(size: 15, weight: .heavy, design: .monospaced))
                            .foregroundStyle(agent.netUnits >= 0 ? Color.appWin : Color.appLoss)
                        Text(pickCountLabel(agent))
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.appTextMuted)
                }
            }
            .buttonStyle(.plain)

            if isExpanded {
                if agent.pendingPicks.isEmpty {
                    Text("No open picks right now")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    // Reuse the agent-detail today's-picks rail — same mini
                    // boarding-pass tickets, horizontally scrolled.
                    AgentTodaysPicksRail(picks: agent.pendingPicks, accent: accent) { _ in }
                        .padding(.horizontal, -16)
                }
            }
        }
        .padding(14)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func avatar(_ agent: BinAgent, accent: Color) -> some View {
        ZStack {
            Circle()
                .fill(LinearGradient(
                    colors: AgentColorPalette.avatarGradient(for: agent.avatarColor),
                    startPoint: .topLeading, endPoint: .bottomTrailing))
            Text(agent.avatarEmoji)
                .font(.system(size: 20))
        }
        .frame(width: 42, height: 42)
    }

    private func pickCountLabel(_ agent: BinAgent) -> String {
        let n = agent.pendingPicks.count
        if n == 0 { return "No open picks" }
        return n == 1 ? "1 open pick" : "\(n) open picks"
    }

    private var binRowSkeleton: some View {
        HStack(spacing: 12) {
            SkeletonCircle(42)
            VStack(alignment: .leading, spacing: 6) {
                SkeletonBlock(width: 120, height: 14)
                SkeletonBlock(width: 80, height: 11)
            }
            Spacer()
            SkeletonBlock(width: 54, height: 16)
        }
        .padding(14)
        .shimmering()
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func load() async {
        if let preloaded {
            agents = preloaded
            loadState = .loaded
            return
        }
        loadState = .loading
        do {
            agents = try await PlatformStatsService.fetchBinAgents(
                metric: metric, sport: sport, lower: lower, upper: upper,
                minDecided: minDecided, limit: 20
            )
            loadState = .loaded
        } catch {
            loadState = .failed((error as NSError).localizedDescription)
        }
    }
}
