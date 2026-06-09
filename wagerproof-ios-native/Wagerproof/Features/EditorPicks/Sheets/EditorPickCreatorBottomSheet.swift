import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

/// Editor-only create/edit pick form. Mirrors RN
/// `EditorPickCreatorBottomSheet.tsx`: League → Game → Pick Type → Pick Value
/// → Best Price → Sportsbook → Units → Free Pick toggle → Editor's Analysis.
/// Two save modes: Save as Draft / Publish; Delete shown only when editing.
///
/// Field-by-field validation rules ported directly:
///   - league, game, pickType, pickValue: required for ANY save
///   - editorsNotes: required only when publishing
///   - league cannot be changed when editing (chip disabled)
///   - units chip toggles off when tapped again
struct EditorPickCreatorBottomSheet: View {
    let editingPick: EditorPick?
    var onSaved: () async -> Void = {}
    var onClose: () -> Void = {}

    // Form state
    @State private var league: GameType?
    @State private var selectedGameId: String = ""
    @State private var pickType: PickKind?
    @State private var betType: String = ""
    @State private var pickValue: String = ""
    @State private var bestPrice: String = ""
    @State private var sportsbook: String = ""
    @State private var units: String = ""
    @State private var editorsNotes: String = ""
    @State private var isFreePick: Bool = false

    // Submit state
    @State private var submitting: Bool = false
    @State private var deleting: Bool = false
    @State private var validationError: String?
    @State private var showValidation: Bool = false
    @State private var showDeleteConfirm: Bool = false

    @FocusState private var focused: Field?

    enum Field: Hashable { case betType, pickValue, bestPrice, sportsbook, notes }

    enum PickKind: String, CaseIterable, Hashable {
        case spread, overUnder = "over_under", moneyline
        var label: String {
            switch self {
            case .spread: return "Spread"
            case .overUnder: return "Over/Under"
            case .moneyline: return "Moneyline"
            }
        }
    }

    private static let unitsOptions = ["0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5"]

    private var isEditing: Bool { editingPick != nil }

    var body: some View {
        NavigationStack {
            Form {
                leagueSection
                if league != nil {
                    gameSection
                }
                pickTypeSection
                pickValueSection
                priceSection
                sportsbookSection
                unitsSection
                freePickSection
                notesSection
                actionsSection
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(isEditing ? "Edit Pick" : "Create Editor Pick")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { onClose() }
                        .tint(Color.appTextSecondary)
                }
            }
        }
        .presentationDetents([.fraction(0.9)])
        .presentationDragIndicator(.visible)
        .alert("Validation Error", isPresented: $showValidation, presenting: validationError) { _ in
            Button("OK", role: .cancel) {}
        } message: { msg in
            Text(msg)
        }
        .confirmationDialog(
            "Delete this pick? This cannot be undone.",
            isPresented: $showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task { await deletePick() }
            }
            Button("Cancel", role: .cancel) {}
        }
        .task(id: editingPick?.id) { hydrate() }
    }

    // MARK: - Sections

    @ViewBuilder
    private var leagueSection: some View {
        Section("League *") {
            HStack(spacing: 8) {
                ForEach([GameType.nfl, .cfb, .nba, .ncaab], id: \.self) { l in
                    chip(text: l.displayLabel, selected: league == l) {
                        if !isEditing { league = l }
                    }
                    .disabled(isEditing)
                    .opacity(isEditing && league != l ? 0.5 : 1)
                }
            }
            .sensoryFeedback(.selection, trigger: league)
        }
    }

    @ViewBuilder
    private var gameSection: some View {
        Section("Select Game *") {
            // FIDELITY-WAIVER #014: GamesStore.fetchActiveGames not yet ported;
            // editors can still type the game id in the meantime. Full game
            // picker lands when EditorPicksGameStore ports (see ticket #014).
            TextField("Game ID", text: $selectedGameId)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled(true)
                .disabled(isEditing)
        }
    }

    @ViewBuilder
    private var pickTypeSection: some View {
        Section("Pick Type *") {
            HStack(spacing: 8) {
                ForEach(PickKind.allCases, id: \.self) { pt in
                    chip(text: pt.label, selected: pickType == pt, tint: Color.appAccentBlue) {
                        pickType = pt
                    }
                }
            }
            .sensoryFeedback(.selection, trigger: pickType)
        }
    }

    @ViewBuilder
    private var pickValueSection: some View {
        Section {
            TextField("e.g. \"Chiefs -3.5\" or \"Over 47.5\"", text: $pickValue)
                .focused($focused, equals: .pickValue)
        } header: {
            Text("Pick Value *")
        }
    }

    @ViewBuilder
    private var priceSection: some View {
        Section {
            TextField("-110", text: $bestPrice)
                .keyboardType(.numbersAndPunctuation)
                .focused($focused, equals: .bestPrice)
        } header: {
            Text("Best Price")
        }
    }

    @ViewBuilder
    private var sportsbookSection: some View {
        Section {
            TextField("e.g. FanDuel, DraftKings", text: $sportsbook)
                .focused($focused, equals: .sportsbook)
        } header: {
            Text("Sportsbook")
        }
    }

    @ViewBuilder
    private var unitsSection: some View {
        Section("Units") {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Self.unitsOptions, id: \.self) { u in
                        chip(text: u, selected: units == u, tint: Color.appAccentAmber) {
                            // Tap-same-twice clears (RN parity).
                            units = (units == u) ? "" : u
                        }
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    @ViewBuilder
    private var freePickSection: some View {
        Section {
            Toggle(isOn: $isFreePick) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Free Pick").font(.system(size: 15, weight: .semibold))
                    Text("Visible to all users (not just Pro)")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                }
            }
            .tint(Color.appPrimary)
        }
    }

    @ViewBuilder
    private var notesSection: some View {
        Section("Editor's Analysis (required for publishing)") {
            TextEditor(text: $editorsNotes)
                .frame(minHeight: 100)
                .focused($focused, equals: .notes)
        }
    }

    @ViewBuilder
    private var actionsSection: some View {
        Section {
            Button {
                Task { await save(publish: true) }
            } label: {
                HStack {
                    if submitting { ProgressView().tint(.white) }
                    Image(systemName: "checkmark")
                    Text(isEditing ? "Update & Publish" : "Publish")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.appPrimary)
            .disabled(submitting || deleting)

            Button {
                Task { await save(publish: false) }
            } label: {
                HStack {
                    Image(systemName: "square.and.arrow.down")
                    Text("Save as Draft")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .disabled(submitting || deleting)

            if isEditing {
                Button(role: .destructive) {
                    showDeleteConfirm = true
                } label: {
                    HStack {
                        if deleting { ProgressView() }
                        Image(systemName: "trash")
                        Text("Delete Pick")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(Color.appLoss)
                .disabled(submitting || deleting)
            }
        }
    }

    // MARK: - Chip helper

    @ViewBuilder
    private func chip(
        text: String,
        selected: Bool,
        tint: Color = Color.appPrimary,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(text)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(selected ? .white : Color.appTextPrimary)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(selected ? tint : Color.appSurfaceMuted, in: Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Behaviour

    private func hydrate() {
        guard let pick = editingPick else { reset(); return }
        league = pick.gameType
        selectedGameId = pick.gameId
        pickType = PickKind(rawValue: pick.selectedBetType)
        betType = pick.betType ?? ""
        pickValue = pick.pickValue ?? ""
        bestPrice = pick.bestPrice ?? ""
        sportsbook = pick.sportsbook ?? ""
        units = pick.units.map { String(format: "%g", $0) } ?? ""
        editorsNotes = pick.editorsNotes ?? ""
        isFreePick = pick.isFreePick ?? false
    }

    private func reset() {
        league = nil
        selectedGameId = ""
        pickType = nil
        betType = ""
        pickValue = ""
        bestPrice = ""
        sportsbook = ""
        units = ""
        editorsNotes = ""
        isFreePick = false
    }

    private func validate(publish: Bool) -> String? {
        if league == nil { return "Please select a league" }
        if selectedGameId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Please enter a game"
        }
        if pickType == nil { return "Please select a pick type" }
        if pickValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Please enter a pick value"
        }
        if publish && editorsNotes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Please add editor notes before publishing"
        }
        return nil
    }

    private func save(publish: Bool) async {
        if let err = validate(publish: publish) {
            validationError = err
            showValidation = true
            return
        }
        guard let pickType, let league else { return }

        submitting = true
        defer { submitting = false }

        struct PickPayload: Encodable {
            let game_id: String
            let game_type: String
            let editor_id: String?
            let selected_bet_type: String
            let pick_value: String
            let best_price: String?
            let sportsbook: String?
            let units: Double?
            let editors_notes: String?
            let is_published: Bool
            let is_free_pick: Bool
            let bet_type: String?
            let updated_at: String
        }

        do {
            let main = await MainSupabase.shared.client
            let userId = main.auth.currentUser?.id.uuidString

            let payload = PickPayload(
                game_id: selectedGameId.trimmingCharacters(in: .whitespacesAndNewlines),
                game_type: league.rawValue,
                editor_id: userId,
                selected_bet_type: pickType.rawValue,
                pick_value: pickValue.trimmingCharacters(in: .whitespacesAndNewlines),
                best_price: nilIfEmpty(bestPrice),
                sportsbook: nilIfEmpty(sportsbook),
                units: Double(units),
                editors_notes: nilIfEmpty(editorsNotes),
                is_published: publish,
                is_free_pick: isFreePick,
                bet_type: nilIfEmpty(betType),
                updated_at: ISO8601DateFormatter().string(from: Date())
            )

            if let editing = editingPick {
                _ = try await main
                    .from("editors_picks")
                    .update(payload)
                    .eq("id", value: editing.id)
                    .execute()
            } else {
                _ = try await main
                    .from("editors_picks")
                    .insert(payload)
                    .execute()
            }
            await onSaved()
            onClose()
        } catch {
            validationError = "Failed to save pick: \(error.localizedDescription)"
            showValidation = true
        }
    }

    private func deletePick() async {
        guard let pick = editingPick else { return }
        deleting = true
        defer { deleting = false }
        do {
            let main = await MainSupabase.shared.client
            _ = try await main
                .from("editors_picks")
                .delete()
                .eq("id", value: pick.id)
                .execute()
            await onSaved()
            onClose()
        } catch {
            validationError = "Failed to delete pick: \(error.localizedDescription)"
            showValidation = true
        }
    }

    private func nilIfEmpty(_ s: String) -> String? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}
