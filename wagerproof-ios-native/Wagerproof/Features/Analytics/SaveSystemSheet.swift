import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Guided save flow for the system currently configured in Historical Trends.
///
/// The flow edits a local draft. Choosing Home/Away/Favorite/Underdog never
/// mutates the live analysis unless the saved system is later applied.
struct SaveSystemSheet: View {
    @Bindable var store: HistoricalAnalysisStore
    let userId: UUID
    let embedded: Bool
    /// Called with `isPublic` after a successful save.
    var onSaved: ((Bool) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @FocusState private var nameFocused: Bool

    @State private var step: Step
    @State private var entryStep: Step
    @State private var draftSnapshot: HistoricalAnalysisUISnapshot
    @State private var verdict: AnalysisSystemVerdict?
    @State private var name = ""
    @State private var isPublic = false
    @State private var errorMessage: String?
    @State private var maxUnlockedPage = 0

    private enum Step: Int, Hashable {
        case sideChoice
        case betDirection
        case details
    }

    init(
        store: HistoricalAnalysisStore,
        userId: UUID,
        initialSnapshot: HistoricalAnalysisUISnapshot? = nil,
        initialVerdict: AnalysisSystemVerdict? = nil,
        initialName: String = "",
        embedded: Bool = false,
        onSaved: ((Bool) -> Void)? = nil
    ) {
        self.store = store
        self.userId = userId
        self.embedded = embedded
        self.onSaved = onSaved

        let snapshot = initialSnapshot ?? store.snapshot
        let draftBetType = snapshot.betType.isEmpty ? store.betType : snapshot.betType
        let isTotal = AnalysisSystemCopy.isTotalMarket(draftBetType, sport: store.sport)
        let isSymmetricSide =
            AnalysisSystemCopy.isSideMarket(draftBetType, sport: store.sport)
            && AnalysisSystemCopy.isSideSymmetric(snapshot: snapshot, sport: store.sport)
        let first: Step
        if initialVerdict != nil {
            first = .details
        } else {
            first = isTotal || isSymmetricSide ? .sideChoice : .betDirection
        }
        _step = State(initialValue: first)
        _entryStep = State(initialValue: first)
        _draftSnapshot = State(initialValue: snapshot)
        _verdict = State(initialValue: initialVerdict)
        _name = State(initialValue: initialName)
    }

    private var sport: HistoricalAnalysisSport { store.sport }
    private var betType: String { draftSnapshot.betType }
    private var isTotals: Bool {
        AnalysisSystemCopy.isTotalMarket(betType, sport: sport)
    }
    private var marketLabel: String {
        HistoricalAnalysisBetType(rawValue: betType)?.label ?? betType.uppercased()
    }
    private var filterLabels: [String] {
        HistoricalAnalysisCopy.filterChipLabels(sport: sport, snapshot: draftSnapshot)
    }
    private var pages: [Step] {
        switch entryStep {
        case .sideChoice:
            return isTotals ? [.sideChoice, .details] : [.sideChoice, .betDirection, .details]
        case .betDirection:
            return [.betDirection, .details]
        case .details:
            return [.details]
        }
    }
    @ViewBuilder
    var body: some View {
        if embedded {
            navigationContent
        } else {
            NavigationStack {
                navigationContent
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .presentationBackground(Color(hex: 0x0B1011))
            .preferredColorScheme(.dark)
        }
    }

    private var navigationContent: some View {
        TabView(selection: $step) {
            ForEach(pages, id: \.self) { page in
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        progressHeader(for: page)
                        currentSystemCard
                        stepContent(for: page)

                        if page == .details, let errorMessage {
                            Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Color.appLoss)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 16)
                    .padding(.bottom, 28)
                }
                .scrollDismissesKeyboard(.interactively)
                .tag(page)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .onChange(of: step) { previousPage, nextPage in
            if pageIndex(nextPage) > maxUnlockedPage {
                step = previousPage
            }
        }
        .sensoryFeedback(.selection, trigger: step)
        .background(Color(hex: 0x0B1011).ignoresSafeArea())
        .navigationTitle("Save System")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !embedded {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button {
                    Task { await save() }
                } label: {
                    if store.isSavingSystem {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Text("Save")
                            .fontWeight(.semibold)
                    }
                }
                .disabled(!canSave)
                .accessibilityLabel(store.isSavingSystem ? "Saving system" : "Save system")
            }
        }
    }

    @ViewBuilder
    private func stepContent(for page: Step) -> some View {
        switch page {
        case .sideChoice:
            sideChoiceStep
        case .betDirection:
            betDirectionStep
        case .details:
            detailsStep
        }
    }

    private func progressHeader(for page: Step) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(stepEyebrow(for: page))
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.9)
                .foregroundStyle(Color.appTextSecondary)
                .textCase(.uppercase)
            HStack(spacing: 5) {
                ForEach(pages.indices, id: \.self) { index in
                    Capsule()
                        .fill(index <= pageIndex(page) ? Color.appPrimary : Color.appBorder.opacity(0.55))
                        .frame(maxWidth: .infinity)
                        .frame(height: 3)
                }
            }
        }
    }

    private var currentSystemCard: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.appPrimary.opacity(0.18))
                    .frame(width: 44, height: 44)
                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Color.appPrimary)
            }
            VStack(alignment: .leading, spacing: 5) {
                Text("Save this \(sport.shortTitle) system")
                    .font(.system(size: 17, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                Text(
                    ([marketLabel] + Array(filterLabels.prefix(2)))
                        .joined(separator: " · ")
                )
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
        }
    }

    private var sideChoiceStep: some View {
        VStack(alignment: .leading, spacing: 12) {
            stepTitle(
                isTotals ? "Which total should it track?" : "Which teams should it track?",
                subtitle: isTotals
                    ? "Choose how every matching game is graded."
                    : "This turns a two-sided search into one repeatable betting rule."
            )

            if isTotals {
                optionCard(
                    systemImage: "arrow.up",
                    title: "The Over",
                    subtitle: "Grade every matching game as an Over bet.",
                    tint: Color.appWin
                ) {
                    chooseVerdict(.over)
                }
                optionCard(
                    systemImage: "arrow.down",
                    title: "The Under",
                    subtitle: "Grade every matching game as an Under bet.",
                    tint: Color(hex: 0x38BDF8)
                ) {
                    chooseVerdict(.under)
                }
            } else {
                optionCard(
                    systemImage: "house.fill",
                    title: "Home teams",
                    subtitle: "Only track teams playing at home.",
                    tint: Color.appPrimary
                ) {
                    applySideFilter(side: "home")
                }
                optionCard(
                    systemImage: "airplane",
                    title: "Away teams",
                    subtitle: "Only track teams playing on the road.",
                    tint: Color.appPrimary
                ) {
                    applySideFilter(side: "away")
                }
                optionCard(
                    systemImage: "star.fill",
                    title: "Favorites",
                    subtitle: "Only track the favored side.",
                    tint: Color.appPrimary
                ) {
                    applySideFilter(favDog: "favorite")
                }
                optionCard(
                    systemImage: "bolt.fill",
                    title: "Underdogs",
                    subtitle: "Only track the underdog side.",
                    tint: Color.appPrimary
                ) {
                    applySideFilter(favDog: "underdog")
                }
            }
        }
    }

    private var betDirectionStep: some View {
        VStack(alignment: .leading, spacing: 12) {
            stepTitle(
                "How should it bet?",
                subtitle: "Choose whether the system backs matching teams or fades them."
            )
            optionCard(
                systemImage: "checkmark.circle.fill",
                title: "Bet ON matching teams",
                subtitle: "When a team matches these filters, bet on that team.",
                tint: Color.appWin
            ) {
                chooseVerdict(.team)
            }
            optionCard(
                systemImage: "arrow.triangle.2.circlepath",
                title: "Bet AGAINST matching teams",
                subtitle: "When a team matches, bet on the other side.",
                tint: Color(hex: 0xF59E0B)
            ) {
                chooseVerdict(.fade)
            }
        }
    }

    private var detailsStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            stepTitle(
                "Name and save it",
                subtitle: "Use a name that makes the rule easy to recognize later."
            )

            VStack(alignment: .leading, spacing: 8) {
                Text("SYSTEM NAME")
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(0.9)
                    .foregroundStyle(Color.appTextSecondary)
                TextField("e.g. Home dogs off a blowout", text: $name)
                    .font(.system(size: 15, weight: .semibold))
                    .padding(.horizontal, 14)
                    .frame(height: 48)
                    .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 13))
                    .overlay(
                        RoundedRectangle(cornerRadius: 13)
                            .strokeBorder(
                                nameFocused ? Color.appPrimary.opacity(0.8) : Color.appBorder.opacity(0.5),
                                lineWidth: 1
                            )
                    )
                    .focused($nameFocused)
                    .autocorrectionDisabled()
                    .submitLabel(.done)
            }

            if let verdict {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "scope")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.appPrimary)
                        .padding(.top, 1)
                    Text(
                        "Tracks one bet \(AnalysisSystemCopy.betPhrase(verdict)) for every game matching this setup."
                    )
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                }
                .padding(12)
                .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 13))
                .overlay(
                    RoundedRectangle(cornerRadius: 13)
                        .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
                )
            }

            Toggle(isOn: $isPublic) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Share to Systems Leaderboard")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text("Your username, system name, rules, and graded performance will be visible after 10 matching games.")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .tint(Color.appPrimary)
            .padding(14)
            .systemSheetPanel()
        }
    }

    private var canSave: Bool {
        step == .details
            && !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && verdict != nil
            && !store.isSavingSystem
    }

    private func pageIndex(_ page: Step) -> Int {
        pages.firstIndex(of: page) ?? 0
    }

    private func stepEyebrow(for page: Step) -> String {
        "Step \(pageIndex(page) + 1) of \(pages.count)"
    }

    private func advance(to nextPage: Step) {
        guard let nextIndex = pages.firstIndex(of: nextPage) else { return }
        errorMessage = nil
        withAnimation(.easeInOut(duration: 0.2)) {
            maxUnlockedPage = max(maxUnlockedPage, nextIndex)
            step = nextPage
        }
    }

    private func chooseVerdict(_ nextVerdict: AnalysisSystemVerdict) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        verdict = nextVerdict
        advance(to: .details)
    }

    private func applySideFilter(side: String? = nil, favDog: String? = nil) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        if let side {
            draftSnapshot.side = side
        }
        if let favDog {
            if ["fg_spread", "h1_spread"].contains(betType) {
                draftSnapshot.spreadSide = favDog
            } else {
                draftSnapshot.favDog = favDog
            }
        }
        advance(to: .betDirection)
    }

    private func save() async {
        guard let verdict else { return }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        errorMessage = nil
        do {
            try await store.saveSystem(
                name: trimmed,
                verdict: verdict,
                isPublic: isPublic,
                userId: userId,
                snapshot: draftSnapshot
            )
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            onSaved?(isPublic)
            dismiss()
        } catch {
            errorMessage = Self.userFacingSaveError(error)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
    }

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
        return raw.count > 160 ? "Couldn't save — \(raw.prefix(140))…" : "Couldn't save — \(raw)"
    }

    private func stepTitle(_ title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.system(size: 20, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
            Text(subtitle)
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func optionCard(
        systemImage: String,
        title: String,
        subtitle: String,
        tint: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: systemImage)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(tint)
                    .frame(width: 40, height: 40)
                    .background(tint.opacity(0.14), in: Circle())
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            .padding(14)
            .systemSheetPanel()
        }
        .buttonStyle(.plain)
    }
}
