import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Multi-step "Save this System" sheet. Asks which side the system bets before naming.
/// Never surfaces jargon like "verdict" / "symmetric" / "RPC".
struct SaveSystemSheet: View {
    @Bindable var store: HistoricalAnalysisStore
    let userId: UUID
    /// Called with `isPublic` after a successful save (for toast copy).
    var onSaved: ((Bool) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var step: Step = .name
    @State private var verdict: AnalysisSystemVerdict?
    @State private var name = ""
    @State private var isPublic = false
    @State private var errorMessage: String?

    private enum Step {
        case totalsSide
        case pickSideFilter
        case onOrAgainst
        case name
    }

    private var sport: HistoricalAnalysisSport { store.sport }
    private var betType: String { store.betType }
    private var isTotals: Bool { AnalysisSystemCopy.isTotalMarket(betType, sport: sport) }
    private var isSide: Bool { AnalysisSystemCopy.isSideMarket(betType, sport: sport) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    switch step {
                    case .totalsSide:
                        prompt("Which side?")
                        optionButton(icon: "⬆️", title: "The Over") {
                            chooseVerdict(.over)
                        }
                        optionButton(icon: "⬇️", title: "The Under") {
                            chooseVerdict(.under)
                        }
                    case .pickSideFilter:
                        prompt(
                            "Your filters describe the game — now pick which side to track. Every game has two teams. Which side does this system bet?"
                        )
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                            sideChip("Home teams") { applySideFilter(side: "home") }
                            sideChip("Away teams") { applySideFilter(side: "away") }
                            sideChip("Favorites") { applySideFilter(favDog: "favorite") }
                            sideChip("Underdogs") { applySideFilter(favDog: "underdog") }
                        }
                    case .onOrAgainst:
                        prompt("Which side does this system bet?")
                        optionButton(
                            icon: "⚡",
                            title: "Bet ON these teams",
                            subtitle: "Every time a team matches my filters, bet on them."
                        ) { chooseVerdict(.team) }
                        optionButton(
                            icon: "🔄",
                            title: "Bet AGAINST these teams",
                            subtitle: "Every time a team matches my filters, bet on the other side."
                        ) { chooseVerdict(.fade) }
                    case .name:
                        nameStep
                    }
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.red)
                    }
                }
                .padding(20)
            }
            .background(Color.appSurface)
            .navigationTitle("Save this System")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onAppear { bootstrap() }
        }
        .presentationDetents([.medium, .large])
    }

    @ViewBuilder
    private var nameStep: some View {
        Text("System name")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Color.appTextSecondary)
        TextField("e.g. Home dogs off a blowout", text: $name)
            .textFieldStyle(.roundedBorder)
            .autocorrectionDisabled()

        if let verdict {
            Text(
                "We'll track this system's record as if you bet \(AnalysisSystemCopy.betPhrase(verdict)) once in every game that matches your filters."
            )
            .font(.system(size: 13))
            .foregroundStyle(Color.appTextSecondary)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 4)
        }

        Toggle(isOn: $isPublic) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Share to the Systems Leaderboard")
                    .font(.system(size: 14, weight: .semibold))
                Text(
                    "Other users will see your username, this system's name, and its record. Systems need 10+ games of history to appear."
                )
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            }
        }
        .tint(Color.appPrimary)
        .padding(.top, 8)

        Button {
            Task { await save() }
        } label: {
            HStack {
                if store.isSavingSystem { ProgressView().tint(.white) }
                Text("Save System")
                    .font(.system(size: 16, weight: .bold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(canSave ? Color.appPrimary : Color.appPrimary.opacity(0.4), in: RoundedRectangle(cornerRadius: 14))
            .foregroundStyle(.white)
        }
        .disabled(!canSave)
        .padding(.top, 12)
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && verdict != nil
            && !store.isSavingSystem
    }

    private func bootstrap() {
        name = ""
        isPublic = false
        verdict = nil
        errorMessage = nil
        if isTotals {
            step = .totalsSide
        } else if isSide {
            let symmetric = AnalysisSystemCopy.isSideSymmetric(snapshot: store.snapshot, sport: sport)
            step = symmetric ? .pickSideFilter : .onOrAgainst
        } else {
            step = .name
        }
    }

    private func chooseVerdict(_ v: AnalysisSystemVerdict) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        verdict = v
        step = .name
    }

    private func applySideFilter(side: String? = nil, favDog: String? = nil) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        store.updateSnapshot { snap in
            if let side { snap.side = side }
                            if let favDog {
                                // Spread markets pin via spreadSide; ML / RL / team total use favDog.
                                if ["fg_spread", "h1_spread"].contains(store.betType) {
                                    snap.spreadSide = favDog
                                } else {
                                    snap.favDog = favDog
                                }
                            }
        }
        store.scheduleFetch()
        step = .onOrAgainst
    }

    private func save() async {
        guard let verdict else { return }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        errorMessage = nil
        do {
            try await store.saveSystem(name: trimmed, verdict: verdict, isPublic: isPublic, userId: userId)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            onSaved?(isPublic)
            dismiss()
        } catch {
            errorMessage = Self.userFacingSaveError(error)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
    }

    /// Map PostgREST / network errors to plain-English copy (no jargon).
    private static func userFacingSaveError(_ error: Error) -> String {
        let raw = error.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = raw.lowercased()
        if lower.contains("row-level security") || lower.contains("42501") || lower.contains("not authenticated") {
            return "Couldn't save — sign in again and try once more."
        }
        if lower.contains("jwt") || lower.contains("session") {
            return "Couldn't save — your session expired. Sign in again."
        }
        if lower.contains("duplicate") || lower.contains("unique") {
            return "Couldn't save — try a different name."
        }
        if lower.contains("network") || lower.contains("timed out") || lower.contains("offline") {
            return "Couldn't save — check your connection and try again."
        }
        if raw.isEmpty {
            return "Couldn't save — try again."
        }
        if raw.count > 160 {
            return "Couldn't save — \(raw.prefix(140))…"
        }
        return "Couldn't save — \(raw)"
    }

    private func prompt(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(Color.appTextPrimary)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func optionButton(
        icon: String,
        title: String,
        subtitle: String? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 12) {
                Text(icon).font(.system(size: 22))
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    if let subtitle {
                        Text(subtitle)
                            .font(.system(size: 12))
                            .foregroundStyle(Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.appBorder.opacity(0.4), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func sideChip(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.appBorder.opacity(0.4), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
