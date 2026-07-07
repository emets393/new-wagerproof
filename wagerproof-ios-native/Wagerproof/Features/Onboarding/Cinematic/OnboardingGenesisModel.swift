// OnboardingGenesisModel.swift
//
// Drives the onboarding "generation" cinematic: a CANNED ~15-second theater
// (status verbs, progress, ticket scaffolds, ripple bursts) while the REAL
// work runs concurrently underneath:
//
//   1. `AgentCreationStore.submit` — creates the user's actual agent row
//      (this was the missing piece on iOS: the old flow said "Agent is
//      Born!" without ever creating one).
//   2. A display-only fetch of recent picks from top public agents matching
//      the agent's sports — shown BLURRED on the reveal as teaser tickets.
//      They are NEVER written to the new agent (its record stays honestly
//      0-0); bundled fixtures cover offseason/offline so the reveal never
//      looks broken.
//
// The theater runs a minimum duration even if the network is instant, keeps
// cycling if it's slow, and hard-caps so the user is never stranded. Owned
// as `@State` by OnboardingView so it survives the generation → reveal swap.

import Foundation
import Observation
import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores
#if canImport(UIKit)
import UIKit
#endif

@Observable
@MainActor
final class OnboardingGenesisModel {
    // MARK: Theater state (read by OnboardingGenerationCinematic)

    /// One console line + a unique, stable identity. Identity is a monotonic
    /// sequence — NOT the text — so the view animates the stack as one
    /// cascading group even when the script cycles and a line repeats.
    struct StatusLine: Identifiable, Equatable {
        let id: Int
        let text: String
    }

    /// Newest-first console lines, capped at 4 (matches the pick-generation
    /// card's cadence).
    private(set) var statusLines: [StatusLine] = []
    /// Monotonic id source for `statusLines` (see `StatusLine`).
    private var lineSeq = 0
    /// 0…1 for `GenerationLoadingBar` — scripted, not real progress.
    private(set) var progressFraction: Double = 0
    /// Deals one skeleton ticket into `ToolActivityStack` per increment.
    private(set) var toolCallCount: Int = 0
    /// Bumped with `toolCallCount` for `.sensoryFeedback` triggers.
    private(set) var hapticTick: Int = 0
    /// Flips for the last ~1s of the theater: the generation view fades its
    /// foreground out while the pixel grid plays a ripple finale, so the
    /// carousel → reveal handoff is carried by the background itself.
    private(set) var isFinale = false

    // MARK: Results (read by OnboardingRevealView)

    private(set) var createdAgent: Agent?
    private(set) var creationFailed = false
    private(set) var teaserPicks: [AgentPick] = []

    // MARK: Wiring

    private let onboarding: OnboardingStore
    private let creation: AgentCreationStore
    private let rippleEmitter: GlyphRippleEmitter

    /// Theater floor/cap: never advance before `minSeconds`, never hold past
    /// `maxSeconds` even if the network is dead (the reveal degrades to the
    /// draft card + fixture picks).
    private let minSeconds: TimeInterval = 15
    private let maxSeconds: TimeInterval = 30

    private var runTask: Task<Void, Never>?

    init(
        onboarding: OnboardingStore,
        creation: AgentCreationStore,
        rippleEmitter: GlyphRippleEmitter
    ) {
        self.onboarding = onboarding
        self.creation = creation
        self.rippleEmitter = rippleEmitter
    }

    func start() {
        guard runTask == nil else { return }
        runTask = Task { [weak self] in
            await self?.run()
        }
    }

    func cancel() {
        runTask?.cancel()
        runTask = nil
    }

    // MARK: - Script

    private static let script: [String] = [
        "Booting your agent's brain...",
        "Reading today's board...",
        "Pulling model probabilities...",
        "Scanning line movement...",
        "Checking public splits...",
        "Weighing matchup edges...",
        "Pricing value vs the market...",
        "Cross-checking injury news...",
        "Simulating outcomes...",
        "Grading confidence...",
        "Writing up the reasoning...",
        "Stamping the tickets..."
    ]

    private func run() async {
        let start = Date()

        // Real work — concurrent with the theater. Each side is fault-
        // tolerant; the theater never blocks on either.
        let workTask = Task { [weak self] in
            await self?.performRealWork()
        }

        // Scripted timeline: a new console line every ~1.1s, progress eased
        // toward 1.0 across the minimum duration, a ticket scaffold dealt
        // every ~2.8s, and a background ripple burst every ~1.6s.
        var lineIndex = 0
        var lastTool = Date.distantPast
        var lastRipple = Date.distantPast

        while !Task.isCancelled {
            let elapsed = Date().timeIntervalSince(start)

            // Console line.
            pushLine(Self.script[lineIndex % Self.script.count])
            lineIndex += 1

            // Progress eases to ~0.95 over the floor duration; the final
            // snap to 1.0 happens right before the advance.
            withAnimation(.easeInOut(duration: 0.5)) {
                progressFraction = min(0.95, elapsed / minSeconds)
            }

            // Ticket scaffold deal.
            if Date().timeIntervalSince(lastTool) > 2.8, toolCallCount < 5 {
                lastTool = Date()
                withAnimation(.appBouncy) { toolCallCount += 1 }
                hapticTick &+= 1
            }

            // Full-screen energy: ripple bursts at random points.
            if Date().timeIntervalSince(lastRipple) > 1.6 {
                lastRipple = Date()
                emitRandomRipple()
            }

            // Advance check: floor met AND work settled (or cap blown).
            let workDone = workTask.isCancelled || workSettled
            if (elapsed >= minSeconds && workDone) || elapsed >= maxSeconds {
                break
            }

            try? await Task.sleep(nanoseconds: 1_100_000_000)
        }

        guard !Task.isCancelled else { return }

        // Land the bar and announce.
        withAnimation(.easeInOut(duration: 0.4)) { progressFraction = 1 }
        pushLine("Done. Meet \(displayName).")
        hapticTick &+= 1
        try? await Task.sleep(nanoseconds: 900_000_000)

        // Finale: theater components fade out while the pixel grid itself
        // carries the moment — a wave of ripples marching up the screen —
        // then the reveal cross-fades in over the still-rippling field.
        withAnimation(.easeOut(duration: 0.45)) { isFinale = true }
        #if canImport(UIKit)
        let bounds = UIScreen.main.bounds
        for i in 0..<4 {
            let y = bounds.height * (0.85 - 0.22 * CGFloat(i))
            rippleEmitter.emit(at: CGPoint(
                x: CGFloat.random(in: bounds.width * 0.25...bounds.width * 0.75),
                y: y
            ))
            try? await Task.sleep(nanoseconds: 240_000_000)
        }
        #else
        try? await Task.sleep(nanoseconds: 960_000_000)
        #endif
        guard !Task.isCancelled else { return }
        onboarding.advance()
    }

    private var workSettled = false

    private var displayName: String {
        let name = creation.draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? "your agent" : name
    }

    private func pushLine(_ line: String) {
        lineSeq += 1
        let entry = StatusLine(id: lineSeq, text: line)
        // One smooth spring (no overshoot) carries the whole update: the new
        // line drops in at top, the survivors slide down + dim, and the oldest
        // slides out the bottom — all on the same curve, so the list reads as
        // a single cascading motion rather than four independent flips.
        withAnimation(.appCarousel) {
            statusLines = Array(([entry] + statusLines).prefix(4))
        }
    }

    private func emitRandomRipple() {
        #if canImport(UIKit)
        let bounds = UIScreen.main.bounds
        let point = CGPoint(
            x: CGFloat.random(in: bounds.width * 0.1...bounds.width * 0.9),
            y: CGFloat.random(in: bounds.height * 0.15...bounds.height * 0.85)
        )
        rippleEmitter.emit(at: point)
        #endif
    }

    // MARK: - Real work

    private func performRealWork() async {
        async let agentResult: Agent? = createAgentWithRetry()
        async let picksResult: [AgentPick] = fetchTeaserPicks()

        let (agent, picks) = await (agentResult, picksResult)
        createdAgent = agent
        creationFailed = agent == nil
        teaserPicks = picks
        workSettled = true
    }

    /// One retry, then give up gracefully — the reveal renders the draft
    /// card and the user can create the agent from the Agents tab (its
    /// empty-state drives the standalone wizard).
    private func createAgentWithRetry() async -> Agent? {
        var created = await creation.submit(autoModeForcedOff: false)
        if created == nil {
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            guard !Task.isCancelled else { return nil }
            created = await creation.submit(autoModeForcedOff: false)
        }
        guard var agent = created else { return nil }

        // `create_agent` has no sprite field — persist the user's chosen
        // pixel character via update_agent right after creation. Local copy
        // is patched immediately so the reveal card matches even if the
        // network write lags/fails.
        if let sprite = creation.draft.spriteIndex, agent.spriteIndex != sprite {
            agent.spriteIndexOverride = sprite
            let agentId = agent.id
            Task.detached {
                _ = try? await AgentAuthorizedActionsService.updateAgent(
                    agentId: agentId,
                    payload: ["sprite_index": AnyEncodable(sprite)]
                )
            }
        }
        return agent
    }

    /// Display-only teaser picks: recent picks from top PUBLIC agents in the
    /// new agent's sports. Falls back to bundled fixtures when the feed is
    /// empty (offseason) or unreachable.
    private func fetchTeaserPicks() async -> [AgentPick] {
        let sports = Set(creation.draft.preferredSports)
        do {
            let rows = try await AgentPicksService.fetchTopAgentPicksFeed(
                filterMode: "top10",
                limit: 40
            )
            let matching = rows.filter { sports.isEmpty || sports.contains($0.sport) }
            let chosen = (matching.isEmpty ? rows : matching).prefix(3)
            guard !chosen.isEmpty else { return Self.fixturePicks(sports: sports) }
            return chosen.map { row in
                AgentPick(
                    id: row.id,
                    avatarId: row.avatarId,
                    gameId: row.gameId,
                    sport: row.sport,
                    matchup: row.matchup,
                    gameDate: row.gameDate,
                    betType: row.betType,
                    pickSelection: row.pickSelection,
                    odds: row.odds,
                    units: row.units,
                    confidence: row.confidence,
                    reasoningText: row.reasoningText,
                    keyFactors: nil,
                    result: .pending,
                    actualResult: nil,
                    gradedAt: nil,
                    createdAt: row.createdAt
                )
            }
        } catch {
            return Self.fixturePicks(sports: sports)
        }
    }

    /// Bundled reveal fixtures — real-looking, clearly-plausible tickets for
    /// offseason/offline. Details are blurred on screen, so staleness never
    /// shows; teams stay visible, which is why these use famous matchups.
    static func fixturePicks(sports: Set<AgentSport>) -> [AgentPick] {
        let today: String = {
            let df = DateFormatter()
            df.dateFormat = "yyyy-MM-dd"
            return df.string(from: Date())
        }()

        func pick(_ idx: Int, _ sport: AgentSport, _ matchup: String,
                  _ betType: String, _ selection: String, _ odds: String,
                  _ confidence: Int) -> AgentPick {
            AgentPick(
                id: "onboarding-fixture-\(idx)",
                avatarId: "onboarding-fixture",
                gameId: "onboarding-fixture-\(idx)",
                sport: sport,
                matchup: matchup,
                gameDate: today,
                betType: betType,
                pickSelection: selection,
                odds: odds,
                units: 1.0,
                confidence: confidence,
                reasoningText: "",
                keyFactors: nil,
                result: .pending,
                actualResult: nil,
                gradedAt: nil,
                createdAt: today
            )
        }

        if sports == [.mlb] {
            return [
                pick(0, .mlb, "Yankees @ Red Sox", "moneyline", "Yankees ML", "-125", 4),
                pick(1, .mlb, "Dodgers @ Giants", "total", "Under 8.5", "-110", 3),
                pick(2, .mlb, "Braves @ Phillies", "run line", "Braves -1.5", "+135", 3)
            ]
        }
        var out: [AgentPick] = []
        if sports.isEmpty || sports.contains(.nfl) || sports.contains(.cfb) {
            out.append(pick(0, .nfl, "Chiefs @ Bills", "spread", "Bills +2.5", "-110", 4))
        }
        if sports.isEmpty || sports.contains(.nba) || sports.contains(.ncaab) {
            out.append(pick(1, .nba, "Lakers @ Celtics", "total", "Over 224.5", "-108", 3))
        }
        out.append(pick(2, .nfl, "Cowboys @ Eagles", "moneyline", "Eagles ML", "-135", 4))
        return Array(out.prefix(3))
    }
}
