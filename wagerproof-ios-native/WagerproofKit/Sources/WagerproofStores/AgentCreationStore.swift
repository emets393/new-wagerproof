import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// `AgentCreationStore` is the source of truth for the 6-step agent creation
/// wizard. Ports the `CreateAgentFormState` machinery from
/// `wagerproof-mobile/app/(drawer)/(tabs)/agents/create.tsx` (formState +
/// helpers) into a single observable.
///
/// State model:
///   - `draft` holds the in-progress agent — every field maps to the
///     RN `CreateAgentFormState` interface (`types/agent.ts:429-449`).
///   - `step` is the current wizard page (0..5).
///   - `archetypeRows` is the cached preset list — loaded once when the wizard
///     opens, mirroring RN's `usePresetArchetypes` query (30-min stale).
///   - `submitState` tracks the create-agent network call.
///
/// FIDELITY: Validation matches `validateScreen()` in RN line-for-line — the
/// view consults `canProceed(from:)` before allowing Next.
@Observable
@MainActor
public final class AgentCreationStore {
    public enum SubmitState: Equatable, Sendable {
        case idle
        case submitting
        case succeeded(Agent)
        case failed(String)
    }

    public enum ArchetypesLoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    /// Mutable draft snapshot. The wizard mutates fields directly via the
    /// store's setter helpers; views use `@Bindable` over the store to wire
    /// TextField / Toggle / Slider bindings.
    public struct Draft: Equatable, Sendable {
        public var preferredSports: [AgentSport] = []
        public var archetype: AgentArchetype? = nil
        public var name: String = ""
        // Defaults match RN INITIAL_FORM_STATE (types/agent.ts:451-462).
        public var avatarEmoji: String = "\u{1F916}" // 🤖
        public var avatarColor: String = "gradient:#6366f1,#ec4899"
        /// Chosen pixel character (avatar_0…avatar_7). nil = not chosen yet;
        /// hosts seed it once so the preview doesn't reshuffle per keystroke
        /// (create_agent has no sprite field — persisted via update_agent
        /// right after creation).
        public var spriteIndex: Int? = nil
        public var personalityParams: AgentPersonalityParams = .default
        public var customInsights: AgentCustomInsights = .empty
        public var autoGenerate: Bool = true
        public var autoGenerateTime: String = "09:00"
        public var autoGenerateTimezone: String = "America/New_York"

        /// Public no-arg init so callers outside the module (e.g. the
        /// onboarding agent-builder host) can construct a fresh draft
        /// when seeding from another source of truth.
        public init() {}
    }

    // MARK: - State

    public var draft = Draft()
    public var step: Int = 0
    public var archetypeRows: [PresetArchetypeRow] = []
    public var archetypesLoadState: ArchetypesLoadState = .idle
    public var submitState: SubmitState = .idle

    /// Names of agents the user already owns — set by the view after
    /// `AgentsStore.refresh()`. Used for duplicate-name validation, matching
    /// the RN check in `agents/create.tsx:167-178`.
    public var existingAgentNames: [String] = []

    public static let totalSteps = 6

    public init() {}

    // MARK: - Archetype loading

    /// Fetch the preset archetypes once. Idempotent — subsequent calls no-op
    /// if already loaded. The RN client uses React Query's 30-min staleTime
    /// for the equivalent caching.
    public func loadArchetypesIfNeeded() async {
        if case .loaded = archetypesLoadState { return }
        if case .loading = archetypesLoadState { return }
        archetypesLoadState = .loading
        do {
            let rows = try await PresetArchetypeService.fetchAll()
            self.archetypeRows = rows
            self.archetypesLoadState = .loaded
        } catch {
            self.archetypesLoadState = .failed((error as NSError).localizedDescription)
        }
    }

    // MARK: - Path selection & toggles

    /// Apply an archetype preset: auto-fills sports, archetype id, and merges
    /// the partial personality params on top of defaults. Mirrors RN's
    /// `applyArchetypePreset()` in create.tsx:141-159.
    public func applyArchetype(_ row: PresetArchetypeRow) {
        if let id = AgentArchetype(rawValue: row.id) {
            draft.archetype = id
        } else {
            // Row.id doesn't match a known enum case — leave archetype nil
            // (treated as fully-custom). The edge function accepts arbitrary
            // archetype strings server-side but we don't want a decode crash.
            draft.archetype = nil
        }
        draft.preferredSports = row.recommendedSports
        draft.personalityParams = .applying(row.personalityParams)
        draft.customInsights = row.customInsights
    }

    /// Reset to the "fully-custom" path: clears the archetype but keeps the
    /// user's chosen sports. Mirrors RN's `handleSelectPath('scratch')` flow.
    public func clearArchetype() {
        draft.archetype = nil
        draft.personalityParams = .default
        draft.customInsights = .empty
    }

    /// Toggle a sport selection. Plain multi-select — MLB used to be an
    /// exclusive pick (single-sport Statcast payload) but the generation
    /// pipeline now supports mixing it with other sports.
    public func toggleSport(_ sport: AgentSport) {
        let current = draft.preferredSports
        if current.contains(sport) {
            draft.preferredSports = current.filter { $0 != sport }
        } else {
            draft.preferredSports = current + [sport]
        }
    }

    // MARK: - Validation

    /// Whether the user can advance past the given step. Mirrors
    /// `validateScreen()` in create.tsx:162-192.
    public func canProceed(from stepIndex: Int) -> Bool {
        switch stepIndex {
        case 0:
            return !draft.preferredSports.isEmpty
        case 1:
            let trimmed = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty || trimmed.count > 50 { return false }
            let lowered = trimmed.lowercased()
            if existingAgentNames.contains(where: { $0.lowercased() == lowered }) { return false }
            if draft.avatarEmoji.isEmpty { return false }
            if draft.avatarColor.isEmpty { return false }
            return true
        case 2, 3, 4, 5:
            return true
        default:
            return false
        }
    }

    /// Surface-friendly explanation of why a step is blocked. Mirrors
    /// `getValidationError()` in create.tsx:195-226.
    public func validationError(for stepIndex: Int) -> String? {
        switch stepIndex {
        case 0:
            if draft.preferredSports.isEmpty { return "Please select at least one sport" }
            return nil
        case 1:
            let trimmed = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { return "Please enter a name for your agent" }
            if trimmed.count > 50 { return "Name must be 50 characters or less" }
            let lowered = trimmed.lowercased()
            if existingAgentNames.contains(where: { $0.lowercased() == lowered }) {
                return "You already have an agent named \"\(trimmed)\". Please choose a different name."
            }
            if draft.avatarEmoji.isEmpty { return "Please select an emoji" }
            return nil
        default:
            return nil
        }
    }

    // MARK: - Navigation

    public func advance() {
        guard step < Self.totalSteps - 1 else { return }
        step += 1
    }

    public func back() {
        guard step > 0 else { return }
        step -= 1
    }

    // MARK: - Submission

    /// Submit the draft via the edge function. Sets `submitState` to either
    /// `.succeeded(agent)` or `.failed(reason)`.
    @discardableResult
    public func submit(autoModeForcedOff: Bool) async -> Agent? {
        let trimmedName = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
        // Honor the "Pro auto-slot full" gate the same way RN does — flip
        // auto_generate off before we serialize the payload so the server
        // sees the user's effective intent (manual mode).
        let shouldStartAuto = draft.autoGenerate && !autoModeForcedOff
        let input = CreateAgentInput(
            name: trimmedName,
            avatarEmoji: draft.avatarEmoji,
            avatarColor: draft.avatarColor,
            preferredSports: draft.preferredSports,
            archetype: draft.archetype,
            personalityParams: draft.personalityParams,
            customInsights: draft.customInsights,
            autoGenerate: shouldStartAuto,
            autoGenerateTime: draft.autoGenerateTime,
            autoGenerateTimezone: draft.autoGenerateTimezone
        )
        submitState = .submitting
        do {
            let agent = try await AgentService.create(input: input)
            submitState = .succeeded(agent)
            return agent
        } catch {
            submitState = .failed((error as NSError).localizedDescription)
            return nil
        }
    }
}
