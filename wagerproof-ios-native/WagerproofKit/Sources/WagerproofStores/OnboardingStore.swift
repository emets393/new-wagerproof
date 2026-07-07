import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices
import WagerproofSharedKit

/// Owns the onboarding wizard's state:
///   - Local-only completion flag (persisted via App Group `UserDefaults`)
///   - Step pointer (1...15) — 13 carousel pages + 2 cinematic phases
///   - Survey form state (sports, bettor type, primary goal, etc.)
///   - Agent builder draft (projected from the embedded `AgentCreationStore`)
///
/// Mutations are cache-first locally with a fire-and-forget background sync to
/// `profiles` (never blocks). Server fail → user still proceeds.
///
/// v2 (Onboarding redesign): answers are written to the store AT TAP TIME so
/// the carousel's shared chrome can derive CTA enablement from `canAdvance` —
/// pages themselves are stateless and can be unmounted by the pager's
/// windowing without losing answers.
@Observable
@MainActor
public final class OnboardingStore {
    /// 20-step ordered flow. Steps 1...18 are pages inside the onboarding
    /// carousel (`carouselIndex` 0...17); 19/20 are full-screen cinematic
    /// phases rendered outside the pager. Raw values MUST stay contiguous —
    /// `advance()`/`back()` navigate by ±1 arithmetic.
    ///
    /// The builder deliberately walks EVERY user (preset or custom) through
    /// the per-section personality pages — each explains how the dials shape
    /// the agent, which builds investment before the generation cinematic.
    public enum Step: Int, CaseIterable, Sendable, Comparable {
        case terms             = 1
        case bettorType        = 2
        case bettingPitfalls   = 3
        case personalizedValue = 4
        case acquisitionSource = 5
        case primaryGoal       = 6
        case agentHQ           = 7
        case agentValueIntro   = 8
        case agentValueProof   = 9
        case attPriming        = 10
        case builderSports     = 11
        case builderArchetype  = 12
        case builderMindset    = 13
        case builderBetStyle   = 14
        case builderDataTrust  = 15
        case builderSportRules = 16
        case builderInsights   = 17
        case builderIdentity   = 18
        case generation        = 19
        case reveal            = 20

        public var isCinematic: Bool { self >= .generation }

        /// TabView slot (0-based). nil for cinematic steps — they render
        /// outside the pager, so misuse is loud rather than snapping the
        /// carousel to a wrong page.
        public var carouselIndex: Int? { isCinematic ? nil : rawValue - 1 }

        public static let carouselPageCount = 18

        /// Progress-bar fraction. nil for cinematic steps (no chrome there).
        public var progress: Double? {
            isCinematic ? nil : Double(rawValue) / Double(Self.carouselPageCount)
        }

        public static func < (lhs: Step, rhs: Step) -> Bool {
            lhs.rawValue < rhs.rawValue
        }
    }

    public enum BettorType: String, Codable, Sendable {
        case casual, serious, professional
    }

    /// Survey answers synced to `profiles.onboarding_data`.
    public struct SurveyAnswers: Codable, Sendable, Equatable {
        public var favoriteSports: [String] = []
        /// Multi-select — every betting pitfall the user tapped as familiar
        /// on the `.bettingPitfalls` page (optional; empty is a valid answer).
        public var bettingPitfalls: [String] = []
        /// Dormant since the v2 redesign removed the age question (the 18+
        /// attestation lives on the Terms checkbox instead). Kept so older
        /// payloads that carried `age` keep their Codable shape; never set.
        public var age: Int?
        public var bettorType: BettorType?
        public var mainGoal: String?
        public var emailOptIn: Bool?
        public var acquisitionSource: String?
        public var termsAcceptedAt: String?
        /// Set alongside `termsAcceptedAt` — the Terms checkbox copy includes
        /// an explicit "I confirm I am 18 or older" attestation.
        public var overEighteenAttested: Bool?

        public init() {}
    }

    /// Full agent-draft state — mirrors the standalone wizard's
    /// `AgentCreationStore.Draft` so onboarding can collect the same depth of
    /// configuration the Agents-tab builder does. Persisted to
    /// `profiles.onboarding_data.agentFormState` with the same shape as RN's
    /// `CreateAgentFormState` (snake_case keys).
    ///
    /// Defaults match `AgentCreationStore.Draft` exactly so an agent built
    /// here is indistinguishable from one built in the standalone wizard.
    public struct AgentDraft: Codable, Sendable, Equatable {
        public var preferredSports: [SportLeague] = []
        public var archetype: String?  // archetype id; matches AgentArchetype.rawValue
        public var name: String = ""
        // RN INITIAL_FORM_STATE defaults: emoji=🤖, color=gradient indigo→pink.
        public var avatarEmoji: String = "\u{1F916}"
        public var avatarColor: String = "gradient:#6366f1,#ec4899"
        /// User-chosen pixel character (0...7). nil = legacy name-hash pick.
        public var spriteIndex: Int? = nil
        public var personalityParams: AgentPersonalityParams = .default
        public var customInsights: AgentCustomInsights = .empty
        public var autoGenerate: Bool = true
        public var autoGenerateTime: String = "09:00"
        public var autoGenerateTimezone: String = "America/New_York"

        public init() {}

        // Tolerant decoder — older onboarding payloads written before the
        // expansion (avatar_emoji/avatar_color only) still decode without
        // crashing. Missing fields fall back to wizard defaults.
        enum CodingKeys: String, CodingKey {
            case preferredSports
            case archetype
            case name
            case avatarEmoji
            case avatarColor
            case spriteIndex
            case personalityParams
            case customInsights
            case autoGenerate
            case autoGenerateTime
            case autoGenerateTimezone
        }

        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            self.preferredSports = (try? c.decode([SportLeague].self, forKey: .preferredSports)) ?? []
            self.archetype = try? c.decodeIfPresent(String.self, forKey: .archetype)
            self.name = (try? c.decode(String.self, forKey: .name)) ?? ""
            self.avatarEmoji = (try? c.decode(String.self, forKey: .avatarEmoji)) ?? "\u{1F916}"
            self.avatarColor = (try? c.decode(String.self, forKey: .avatarColor)) ?? "gradient:#6366f1,#ec4899"
            self.spriteIndex = try? c.decodeIfPresent(Int.self, forKey: .spriteIndex)
            self.personalityParams = (try? c.decode(AgentPersonalityParams.self, forKey: .personalityParams)) ?? .default
            self.customInsights = (try? c.decode(AgentCustomInsights.self, forKey: .customInsights)) ?? .empty
            self.autoGenerate = (try? c.decode(Bool.self, forKey: .autoGenerate)) ?? true
            self.autoGenerateTime = (try? c.decode(String.self, forKey: .autoGenerateTime)) ?? "09:00"
            self.autoGenerateTimezone = (try? c.decode(String.self, forKey: .autoGenerateTimezone)) ?? "America/New_York"
        }
    }

    // MARK: - Observable state

    /// Driven by `attachUser` / `markComplete` / `detachUser`. Defaults to
    /// `false` at launch — `RootRouter` waits in `.launching` until the auth
    /// listener calls `attachUser(userId:)` for the signed-in user, at which
    /// point the cached completion flag is loaded synchronously and Supabase
    /// is queried in the background to reconcile (local-cache-first +
    /// background DB validation).
    public private(set) var isComplete: Bool = false
    public private(set) var currentStep: Step = .terms
    public private(set) var survey: SurveyAnswers = SurveyAnswers()
    public private(set) var agentDraft: AgentDraft = AgentDraft()
    /// Monotonic counter the views use for haptic triggers — bumps on each advance.
    public private(set) var advanceCount: Int = 0
    public private(set) var isTransitioning: Bool = false

    // Transient per-run UI state. Lives here (not in the page views) so the
    // pager's windowed unmounting can't lose it and the shared chrome can
    // derive CTA enablement from `canAdvance(from:)`.
    /// Terms page: user reached the bottom of the terms scroller.
    public private(set) var hasScrolledTermsToBottom: Bool = false
    /// Terms page: the agree + 18+ checkbox is ticked.
    public private(set) var hasCheckedTerms: Bool = false
    /// Builder archetype page: a preset (or "from scratch") was explicitly
    /// chosen. Tracked separately from `agentDraft.archetype` because the
    /// scratch path intentionally leaves the archetype nil.
    public private(set) var hasChosenArchetype: Bool = false
    /// Agent-pitch page: index of the visible reason-carousel slide (0...2).
    /// Lives here so the shared chrome's Continue can step through every
    /// slide before advancing the page — the user reads all three.
    public private(set) var agentPitchSlide: Int = 0

    /// Highest pitch-carousel slide index (0-based).
    public static let agentPitchSlideCount = 3

    /// The user this store is currently scoped to. `nil` when signed out —
    /// completion checks return `false` until a user attaches.
    private var attachedUserId: String?
    private var validationTask: Task<Void, Never>?

    public init() {}

    // MARK: - User attachment

    /// Bind the store to the signed-in user. Loads cached completion synchronously
    /// (no spinner between splash and the next screen) and kicks off a background
    /// Supabase read to reconcile. Idempotent — calling twice with the same
    /// userId is a no-op.
    public func attachUser(userId: String) {
        if attachedUserId == userId { return }
        attachedUserId = userId

        // Step 1: instant cache read. Local cache is authoritative on offline
        // launches.
        let cached = AppGroup.defaults.bool(forKey: AppGroupKey.onboardingComplete(userId: userId))
        isComplete = cached

        // Step 2: background validate against Supabase. If the server has
        // `onboarding_completed=true` but the local cache disagreed (fresh
        // install / new device), update state + cache so the user doesn't
        // re-experience the wizard. Failures are intentionally swallowed —
        // local cache is the fallback source of truth.
        validationTask?.cancel()
        validationTask = Task { [weak self, userId] in
            await self?.validateAgainstSupabase(userId: userId)
        }
    }

    /// Detach the current user. Called from sign-out flows so the in-memory
    /// completion flag doesn't bleed into the next sign-in. The per-user cache
    /// entry stays put so that re-signing as the same user is still instant.
    public func detachUser() {
        validationTask?.cancel()
        validationTask = nil
        attachedUserId = nil
        isComplete = false
        resetToStart()
    }

    private func validateAgainstSupabase(userId: String) async {
        do {
            let client = await MainSupabase.shared.client
            let row: OnboardingFlagRow = try await client
                .from("profiles")
                .select("onboarding_completed")
                .eq("user_id", value: userId)
                .single()
                .execute()
                .value

            // Re-check we're still attached to the same user — auth could have
            // flipped while the network call was in flight.
            guard attachedUserId == userId else { return }
            let serverCompleted = row.onboardingCompleted ?? false
            if serverCompleted && !isComplete {
                isComplete = true
                AppGroup.defaults.set(true, forKey: AppGroupKey.onboardingComplete(userId: userId))
            }
            // We never downgrade `true → false` from the server: if the user
            // just completed locally and the server write hasn't landed yet,
            // a server `false` would otherwise bounce them back into the flow.
        } catch {
            // Network failure / no profile row yet — trust local cache.
        }
    }

    private struct OnboardingFlagRow: Decodable {
        let onboardingCompleted: Bool?
        enum CodingKeys: String, CodingKey { case onboardingCompleted = "onboarding_completed" }
    }

    // MARK: - Step navigation

    public func advance() {
        guard !isTransitioning else { return }
        guard let next = Step(rawValue: currentStep.rawValue + 1) else { return }
        isTransitioning = true
        currentStep = next
        advanceCount &+= 1
        // 350ms lock — prevents double-taps from skipping steps and matches
        // the carousel's page-slide duration.
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 350_000_000)
            await MainActor.run { self?.isTransitioning = false }
        }
    }

    public func back() {
        guard !isTransitioning else { return }
        guard let prev = Step(rawValue: currentStep.rawValue - 1) else { return }
        isTransitioning = true
        currentStep = prev
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 350_000_000)
            await MainActor.run { self?.isTransitioning = false }
        }
    }

    /// Jump back to step 1 without firing transitions. Used by reviewers /
    /// "reset onboarding" affordance in secret-settings and by `detachUser`.
    public func resetToStart() {
        currentStep = .terms
        survey = SurveyAnswers()
        agentDraft = AgentDraft()
        advanceCount = 0
        hasScrolledTermsToBottom = false
        hasCheckedTerms = false
        hasChosenArchetype = false
        agentPitchSlide = 0
    }

    // MARK: - CTA gating

    /// Whether the shared chrome's Continue CTA should be enabled on `step`.
    /// Pages write answers at tap time, so this is the single validation
    /// surface the carousel container consults.
    public func canAdvance(from step: Step) -> Bool {
        switch step {
        case .terms:
            return hasCheckedTerms
        case .bettorType:
            return survey.bettorType != nil
        case .acquisitionSource:
            return survey.acquisitionSource != nil
        case .primaryGoal:
            return survey.mainGoal != nil
        case .builderSports:
            return !agentDraft.preferredSports.isEmpty
        case .builderArchetype:
            return hasChosenArchetype
        case .builderIdentity:
            let trimmed = agentDraft.name.trimmingCharacters(in: .whitespacesAndNewlines)
            return !trimmed.isEmpty && trimmed.count <= 50
        case .bettingPitfalls, .agentHQ, .personalizedValue, .agentValueIntro,
             .agentValueProof, .attPriming,
             .builderMindset, .builderBetStyle, .builderDataTrust,
             .builderSportRules, .builderInsights,
             .generation, .reveal:
            return true
        }
    }

    // MARK: - Survey mutators

    public func setFavoriteSports(_ sports: [String]) {
        survey.favoriteSports = sports
    }

    public func toggleFavoriteSport(_ sport: String) {
        if let idx = survey.favoriteSports.firstIndex(of: sport) {
            survey.favoriteSports.remove(at: idx)
        } else {
            survey.favoriteSports.append(sport)
        }
    }

    public func toggleBettingPitfall(_ pitfall: String) {
        if let idx = survey.bettingPitfalls.firstIndex(of: pitfall) {
            survey.bettingPitfalls.remove(at: idx)
        } else {
            survey.bettingPitfalls.append(pitfall)
        }
    }

    public func setBettorType(_ type: BettorType) {
        survey.bettorType = type
    }

    public func setMainGoal(_ goal: String) {
        survey.mainGoal = goal
    }

    public func setAcquisitionSource(_ source: String) {
        survey.acquisitionSource = source
    }

    public func setTermsScrolledToBottom() {
        hasScrolledTermsToBottom = true
    }

    public func setTermsChecked(_ checked: Bool) {
        hasCheckedTerms = checked
    }

    /// Stamps acceptance + the 18+ attestation. Called from the Terms page's
    /// continue action (checkbox copy covers both).
    public func setTermsAccepted() {
        survey.termsAcceptedAt = ISO8601DateFormatter().string(from: Date())
        survey.overEighteenAttested = true
    }

    // MARK: - Agent draft mutators

    public func setAgentSports(_ sports: [SportLeague]) {
        agentDraft.preferredSports = sports
    }

    public func setAgentArchetype(_ archetype: String?) {
        agentDraft.archetype = archetype
    }

    public func setArchetypeChosen() {
        hasChosenArchetype = true
    }

    public func setAgentPitchSlide(_ index: Int) {
        agentPitchSlide = max(0, min(Self.agentPitchSlideCount - 1, index))
    }

    public func setAgentName(_ name: String) {
        agentDraft.name = name
    }

    public func setAgentEmoji(_ emoji: String) {
        agentDraft.avatarEmoji = emoji
    }

    public func setAgentColor(_ color: String) {
        agentDraft.avatarColor = color
    }

    /// Replace the entire agent draft. Used by the builder pages to project
    /// mutations from the embedded `AgentCreationStore` back into onboarding
    /// state so `markComplete()` can persist them and the cinematic screens
    /// render the live draft.
    public func setAgentDraft(_ draft: AgentDraft) {
        agentDraft = draft
    }

    // MARK: - Completion

    /// Mark onboarding complete + background-sync `profiles.onboarding_completed`.
    /// Cache-first: local flag is set instantly so the app NEVER re-shows
    /// onboarding on network failure. The Supabase write is fire-and-forget —
    /// failure does NOT block the user.
    public func markComplete() {
        // Local cache write first — never blocks.
        isComplete = true
        if let userId = attachedUserId {
            AppGroup.defaults.set(true, forKey: AppGroupKey.onboardingComplete(userId: userId))
        }

        // Fire Meta SDK `fb_mobile_complete_registration` so the install →
        // register funnel attributes correctly.
        MetaAnalyticsService.shared.trackCompleteRegistration(method: "email")

        // Snapshot data for the background sync. Pass copies so the
        // mutators below can't race with the network task.
        let surveySnapshot = survey
        let agentSnapshot = agentDraft

        Task.detached { [surveySnapshot, agentSnapshot] in
            await Self.syncToSupabase(survey: surveySnapshot, agent: agentSnapshot)
        }
    }

    /// DEBUG/dev-tools affordance — reset wizard state AND wipe the per-user
    /// cache so the user re-experiences onboarding on next launch. Production
    /// callers should prefer `detachUser()` (sign-out) instead.
    public func reset() {
        isComplete = false
        if let userId = attachedUserId {
            AppGroup.defaults.set(false, forKey: AppGroupKey.onboardingComplete(userId: userId))
        }
        resetToStart()
    }

    // MARK: - Background sync

    /// Fire-and-forget profile sync; never blocks UI. Failure intentionally
    /// swallowed; the local cache is the source of truth.
    private static func syncToSupabase(survey: SurveyAnswers, agent: AgentDraft) async {
        do {
            let client = await MainSupabase.shared.client
            guard let user = try? await client.auth.session.user else { return }
            let payload = OnboardingSyncPayload(
                onboardingData: OnboardingDataPayload(survey: survey, agent: agent),
                onboardingCompleted: true
            )
            try await client
                .from("profiles")
                .update(payload)
                .eq("user_id", value: user.id)
                .execute()
        } catch {
            // FIDELITY-WAIVER #027: Offline write queue not ported — failure log + drop.
            // Acceptable since the call is fire-and-forget and the local cache
            // is authoritative for gating.
        }
    }

    private struct OnboardingSyncPayload: Encodable {
        let onboardingData: OnboardingDataPayload
        let onboardingCompleted: Bool

        enum CodingKeys: String, CodingKey {
            case onboardingData = "onboarding_data"
            case onboardingCompleted = "onboarding_completed"
        }
    }

    private struct OnboardingDataPayload: Encodable {
        let survey: SurveyAnswers
        let agent: AgentDraft

        // Match RN's nested shape: { favoriteSports, age, ..., agentFormState }.
        // bettingPitfalls is iOS-only (no RN/web counterpart yet) — an extra
        // key in the jsonb payload, ignored by clients that don't read it.
        enum CodingKeys: String, CodingKey {
            case favoriteSports, bettingPitfalls, age, bettorType, mainGoal
            case acquisitionSource, termsAcceptedAt, overEighteenAttested
            case agentFormState
        }

        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(survey.favoriteSports, forKey: .favoriteSports)
            try c.encode(survey.bettingPitfalls, forKey: .bettingPitfalls)
            try c.encodeIfPresent(survey.age, forKey: .age)
            try c.encodeIfPresent(survey.bettorType?.rawValue, forKey: .bettorType)
            try c.encodeIfPresent(survey.mainGoal, forKey: .mainGoal)
            try c.encodeIfPresent(survey.acquisitionSource, forKey: .acquisitionSource)
            try c.encodeIfPresent(survey.termsAcceptedAt, forKey: .termsAcceptedAt)
            try c.encodeIfPresent(survey.overEighteenAttested, forKey: .overEighteenAttested)
            try c.encode(AgentFormStatePayload(agent: agent), forKey: .agentFormState)
        }
    }

    /// Snake-case mirror of RN's `CreateAgentFormState` (types/agent.ts:429-449).
    /// The web/RN clients hydrate the standalone agent wizard from this exact
    /// shape after onboarding completes, so adding fields here must round-trip
    /// with `INITIAL_FORM_STATE` defaults on the JS side.
    private struct AgentFormStatePayload: Encodable {
        let preferredSports: [String]
        let archetype: String?
        let name: String
        let avatarEmoji: String
        let avatarColor: String
        let spriteIndex: Int?
        let personalityParams: AgentPersonalityParams
        let customInsights: AgentCustomInsights
        let autoGenerate: Bool
        let autoGenerateTime: String
        let autoGenerateTimezone: String

        init(agent: AgentDraft) {
            self.preferredSports = agent.preferredSports.map(\.rawValue)
            self.archetype = agent.archetype
            self.name = agent.name
            self.avatarEmoji = agent.avatarEmoji
            self.avatarColor = agent.avatarColor
            self.spriteIndex = agent.spriteIndex
            self.personalityParams = agent.personalityParams
            self.customInsights = agent.customInsights
            self.autoGenerate = agent.autoGenerate
            self.autoGenerateTime = agent.autoGenerateTime
            self.autoGenerateTimezone = agent.autoGenerateTimezone
        }

        enum CodingKeys: String, CodingKey {
            case preferredSports = "preferred_sports"
            case archetype
            case name
            case avatarEmoji = "avatar_emoji"
            case avatarColor = "avatar_color"
            case spriteIndex = "sprite_index"
            case personalityParams = "personality_params"
            case customInsights = "custom_insights"
            case autoGenerate = "auto_generate"
            case autoGenerateTime = "auto_generate_time"
            case autoGenerateTimezone = "auto_generate_timezone"
        }
    }
}

#if DEBUG
public extension OnboardingStore {
    /// DEBUG-only seam used by ScreenshotHarness to land on a specific step.
    /// Not exposed to production callers — onboarding step navigation is
    /// always driven by `advance()` / `back()`.
    func debugSet(step: Step) {
        currentStep = step
    }

    func debugSet(survey: SurveyAnswers) {
        self.survey = survey
    }

    func debugSet(agentDraft: AgentDraft) {
        self.agentDraft = agentDraft
    }
}
#endif
