import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Six-step agent creation wizard host. Ports
/// `wagerproof-mobile/app/(drawer)/(tabs)/agents/create.tsx` (the top-level
/// screen) and orchestrates the six step views + celebration overlays.
///
/// Architecture:
///   - One `AgentCreationStore` owns the in-flight draft + submit state.
///   - Step body switches on `store.step` (0..5).
///   - Bottom continue/back footer lives in `safeAreaInset(.bottom)` so it
///     respects keyboard avoidance + bottom safe area natively.
///   - On submit success, full-screen covers walk through generation intro
///     → born celebration → pop back to the agents grid.
///
/// FIDELITY-WAIVER #079 / #080 / #081: noted on the time-picker + cinematic
/// + celebration views respectively (Lottie/RN-specific motion replaced with
/// SwiftUI-native equivalents).
struct AgentCreationView: View {
    @Environment(AgentsStore.self) private var agentsStore
    @Environment(AgentEntitlementsStore.self) private var entitlements
    @Environment(\.dismiss) private var dismiss

    @State private var store = AgentCreationStore()
    @State private var confirmDiscard = false
    @State private var showGenerationIntro = false
    @State private var showCelebration = false
    @State private var createdAgent: Agent?

    private static let stepTitles = [
        "Sport & Style",
        "Identity",
        "Personality",
        "Data & Conditions",
        "Custom Insights",
        "Review"
    ]

    private var stepCount: Int { AgentCreationStore.totalSteps }

    private var canProceed: Bool {
        store.canProceed(from: store.step)
    }

    private var autoModeForcedOff: Bool {
        // Pro-tier ceiling: when 10 active agents already exist, new ones
        // can't run on autopilot. Admin + free do not hit this gate.
        guard !entitlements.isAdmin, entitlements.isPro else { return false }
        return agentsStore.activeCount >= AgentEntitlementsStore.proMaxActiveAgents
    }

    private var maxLiveAutoAgents: Int? {
        if entitlements.isAdmin { return nil }
        return entitlements.isPro ? AgentEntitlementsStore.proMaxActiveAgents : nil
    }

    var body: some View {
        // Step views are now native Forms (each owns its own scrolling +
        // keyboard avoidance). The outer ScrollView + padding VStack are
        // gone so Forms aren't double-wrapped. The Color.appSurface ZStack
        // backdrop is also removed — Form provides its grouped background.
        stepBody
        .navigationTitle(Self.stepTitles[store.step])
        .navigationBarTitleDisplayMode(.inline)
        // Hide the app tab bar — the wizard is a focused full-screen flow
        // pushed on the Agents tab, not a place to tab-switch from.
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    confirmDiscard = true
                } label: {
                    Image(systemName: "xmark")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Text("\(store.step + 1)/\(stepCount)")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            ToolbarItem(placement: .principal) {
                stepProgressBar
            }
        }
        .safeAreaInset(edge: .bottom) {
            if store.step < stepCount - 1 {
                navigationFooter
            }
        }
        .confirmationDialog(
            "Discard Agent?",
            isPresented: $confirmDiscard,
            titleVisibility: .visible
        ) {
            Button("Discard", role: .destructive) { dismiss() }
            Button("Keep Editing", role: .cancel) { }
        } message: {
            Text("Are you sure you want to discard this agent? All progress will be lost.")
        }
        .alert(
            "Couldn't create agent",
            isPresented: submitFailedBinding,
            actions: {
                Button("OK", role: .cancel) { store.submitState = .idle }
            },
            message: {
                if case .failed(let msg) = store.submitState {
                    Text(msg)
                }
            }
        )
        .fullScreenCover(isPresented: $showGenerationIntro) {
            AgentCreationGenerationIntroView {
                showGenerationIntro = false
                showCelebration = true
            }
            // Prevent swipe-down dismissal — the choreography auto-completes.
            .interactiveDismissDisabled(true)
        }
        .fullScreenCover(isPresented: $showCelebration) {
            if let agent = createdAgent {
                AgentBornCelebrationView(agent: agent) {
                    finishAndExit(agent: agent)
                }
                .interactiveDismissDisabled(true)
            }
        }
        .task {
            // Seed validation context. Existing names protects against
            // duplicate-name submission server-side via the same check RN runs.
            store.existingAgentNames = agentsStore.agents.map { $0.agent.name }
            // Load archetypes eagerly so swiping into the Preset path doesn't
            // show a flash of empty + spinner.
            await store.loadArchetypesIfNeeded()
        }
        .onChange(of: agentsStore.agents) { _, newValue in
            store.existingAgentNames = newValue.map { $0.agent.name }
        }
    }

    // MARK: - Step body

    @ViewBuilder
    private var stepBody: some View {
        switch store.step {
        case 0: Step1SportArchetypeView(store: store)
        case 1: Step2IdentityView(store: store)
        case 2: Step3PersonalityView(store: store)
        case 3: Step4DataAndConditionsView(store: store)
        case 4: Step5CustomInsightsView(store: store)
        default:
            Step6ReviewView(
                store: store,
                autoModeForcedOff: autoModeForcedOff,
                liveAutoAgentsCount: agentsStore.activeCount,
                maxLiveAutoAgents: maxLiveAutoAgents,
                onCreate: { Task { await submit() } }
            )
        }
    }

    // MARK: - Header progress bar

    private var stepProgressBar: some View {
        // Per-step segmented progress capsule — matches the RN header bar of
        // small green pills (one per step, filled up to current).
        HStack(spacing: 4) {
            ForEach(0..<stepCount, id: \.self) { idx in
                Capsule()
                    .fill(idx <= store.step ? Color(hex: 0x00E676) : Color.appBorder)
                    .frame(width: 22, height: 3)
            }
        }
    }

    // MARK: - Footer

    private var navigationFooter: some View {
        // Floating Liquid Glass pills — no opaque material band, so the wizard
        // content flows continuously behind them to the bottom edge (the glass
        // refracts whatever scrolls under it). The Back pill only appears past
        // step 0 so Next spans the full width up front.
        HStack(spacing: 12) {
            if store.step > 0 {
                Button {
                    store.back()
                } label: {
                    Text("Back")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .liquidGlassBackground(in: Capsule(), interactive: true)
                }
                .buttonStyle(.plain)
            }

            Button {
                advance()
            } label: {
                Text("Next")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(canProceed ? .black : Color.appTextSecondary)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .liquidGlassBackground(
                        in: Capsule(),
                        tint: Color(hex: 0x00E676).opacity(canProceed ? 0.9 : 0.25),
                        interactive: true
                    )
            }
            .buttonStyle(.plain)
            .disabled(!canProceed)
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
        .padding(.bottom, 6)
    }

    // MARK: - Actions

    private func advance() {
        // Surface validation message (parity with RN's Alert.alert call).
        guard canProceed else { return }
        store.advance()
    }

    private func submit() async {
        guard let agent = await store.submit(autoModeForcedOff: autoModeForcedOff) else {
            return
        }
        createdAgent = agent
        showGenerationIntro = true
    }

    private func finishAndExit(agent: Agent) {
        Task {
            // Reload the agents list so the newly-created agent appears in
            // the grid the moment the user lands back on the hub.
            await agentsStore.refresh()
            await MainActor.run {
                showCelebration = false
                dismiss()
            }
        }
    }

    private var submitFailedBinding: Binding<Bool> {
        Binding(
            get: {
                if case .failed = store.submitState { return true }
                return false
            },
            set: { newValue in
                if !newValue { store.submitState = .idle }
            }
        )
    }
}
