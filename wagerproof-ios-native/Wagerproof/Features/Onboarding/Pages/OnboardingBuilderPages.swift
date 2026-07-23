// OnboardingBuilderPages.swift
//
// Pages 11–13: the simplified onboarding agent builder. Three focused pages
// instead of the standalone wizard's five — sports, an archetype preset (a
// one-tap personality), and identity. Deep parameter tuning stays in the
// Agents-tab wizard; onboarding optimizes for reaching the generation
// cinematic fast with a complete, working draft.
//
// All three pages mutate the SHARED `AgentCreationStore` owned by
// `OnboardingView`; the carousel container mirrors every draft change into
// `OnboardingStore.agentDraft` (CTA gating + persistence + reveal card).

import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

// MARK: - Page 11: agent sports

struct OnboardingBuilderSportsPage: View {
    @Environment(OnboardingStore.self) private var store
    @Bindable var creation: AgentCreationStore

    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 12)]

    private var accent: Color {
        OnboardingTheme.accent(for: store.survey.bettorType)
    }

    var body: some View {
        OnboardingPageScaffold(
            title: "Which sports should your agent work?",
            subtitle: "Pick every league you want it to research — adjust anytime."
        ) {
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(Array(AgentSport.allCases.enumerated()), id: \.element) { index, sport in
                    OnboardingChip(
                        label: sport.label,
                        icon: sport.sfSymbol,
                        isSelected: creation.draft.preferredSports.contains(sport),
                        accent: accent
                    ) {
                        creation.toggleSport(sport)
                    }
                    .pageEntrance(index: 2 + index)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
            .sensoryFeedback(.selection, trigger: creation.draft.preferredSports)
        }
        .animation(.appQuick, value: creation.draft.preferredSports)
    }
}

// MARK: - Page 12: archetype preset

struct OnboardingBuilderArchetypePage: View {
    @Environment(OnboardingStore.self) private var store
    @Bindable var creation: AgentCreationStore
    var copySourceAgent: Agent? = nil
    var copiedDraft: AgentCreationStore.Draft? = nil
    var copySelection: Binding<Bool>? = nil

    private var isCustomSelected: Bool {
        store.hasChosenArchetype && creation.draft.archetype == nil
            && !isCopySelected
    }

    private var isCopySelected: Bool {
        copySelection?.wrappedValue == true
    }

    var body: some View {
        OnboardingPageScaffold(
            title: "Pick a starting point",
            subtitle: "Preset or custom — either way, you'll walk its full personality on the next pages."
        ) {
            VStack(spacing: 4) {
                if let copySourceAgent, copiedDraft != nil {
                    copyBuildCard(copySourceAgent)
                        .pageEntrance(index: 2)

                    Text("OR START ANOTHER WAY")
                        .font(.system(size: 11, weight: .heavy))
                        .tracking(1.0)
                        .foregroundStyle(Color.white.opacity(0.4))
                        .padding(.vertical, 8)
                        .pageEntrance(index: 3)
                }

                customizeCard
                    .pageEntrance(index: copySourceAgent == nil ? 2 : 4)

                Text("OR PICK A PRESET")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(1.0)
                    .foregroundStyle(Color.white.opacity(0.4))
                    .padding(.vertical, 8)
                    .pageEntrance(index: 3)

                switch creation.archetypesLoadState {
                case .idle, .loading:
                    archetypeSkeletons
                case .failed:
                    loadFailedCard
                case .loaded:
                    // Onboarding surfaces just the top 3 presets (slim, pixel-guy
                    // tiles); the full roster + deep tuning lives in the Agents wizard.
                    ForEach(Array(creation.archetypeRows.prefix(3).enumerated()), id: \.element.id) { index, row in
                        ArchetypeCard(
                            row: row,
                            style: .compact,
                            spriteIndex: index,
                            selected: creation.draft.archetype?.rawValue == row.id && store.hasChosenArchetype
                        ) {
                            applyPreservingSports(row)
                        }
                        .glyphRipple(on: creation.draft.archetype?.rawValue == row.id)
                        .pageEntrance(index: 4 + min(index, 4))
                    }
                }
            }
            .padding(.horizontal, 24)
            .sensoryFeedback(.selection, trigger: creation.draft.archetype)
            .sensoryFeedback(.selection, trigger: store.hasChosenArchetype)
        }
    }

    private func copyBuildCard(_ source: Agent) -> some View {
        let accent = AgentColorPalette.primary(for: source.avatarColor)
        return Button {
            guard let copiedDraft else { return }
            creation.draft = copiedDraft
            copySelection?.wrappedValue = true
            store.setArchetypeChosen()
        } label: {
            HStack(spacing: 14) {
                AgentPixelAvatarTile(
                    spriteIndex: source.spriteIndex,
                    avatarColor: source.avatarColor,
                    size: 48,
                    cornerRadius: 12
                )

                VStack(alignment: .leading, spacing: 4) {
                    Text("Copy this build")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("\(source.name)'s sports, strategy, insights, and personality")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.white.opacity(0.6))
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .liquidGlassBackground(
                in: RoundedRectangle(cornerRadius: 16, style: .continuous),
                tint: isCopySelected ? accent.opacity(0.20) : Color.white.opacity(0.05)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(isCopySelected ? accent : Color.clear, lineWidth: 1.5)
            }
        }
        .buttonStyle(OnboardingPressStyle())
        .glyphRipple(on: isCopySelected)
        .animation(.appQuick, value: isCopySelected)
    }

    /// `applyArchetype` overwrites the draft's sports with the preset's
    /// recommendations — correct in the standalone wizard (same screen),
    /// surprising here where the user just picked sports one page back.
    /// Apply, then restore their selection.
    private func applyPreservingSports(_ row: PresetArchetypeRow) {
        copySelection?.wrappedValue = false
        let chosenSports = creation.draft.preferredSports
        creation.applyArchetype(row)
        if !chosenSports.isEmpty {
            creation.draft.preferredSports = chosenSports
        }
        store.setArchetypeChosen()
    }

    private var customizeCard: some View {
        OnboardingOptionCard(
            title: "Customize",
            detail: "Start balanced and shape every dial yourself on the next pages",
            icon: "slider.horizontal.3",
            isSelected: isCustomSelected,
            accent: .appPrimary
        ) {
            // Keep the sports the user just picked; clear preset params so
            // the personality pages open on balanced defaults (unless
            // they've already customized — then keep their tweaks).
            guard !isCustomSelected else { return }
            copySelection?.wrappedValue = false
            let chosenSports = creation.draft.preferredSports
            creation.clearArchetype()
            creation.draft.preferredSports = chosenSports
            store.setArchetypeChosen()
        }
    }

    private var archetypeSkeletons: some View {
        VStack(spacing: 12) {
            ForEach(0..<3, id: \.self) { _ in
                HStack(spacing: 12) {
                    SkeletonBlock(width: 48, height: 48, cornerRadius: 12)
                    VStack(alignment: .leading, spacing: 8) {
                        SkeletonBlock(width: 140, height: 16)
                        SkeletonBlock(height: 12)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color.white.opacity(0.05))
                )
                .shimmering()
            }
        }
        .padding(.vertical, 4)
    }

    private var loadFailedCard: some View {
        VStack(spacing: 12) {
            Text("Couldn't load presets")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(.white)
            Text("Check your connection and retry, or start from scratch below.")
                .font(.system(size: 14))
                .foregroundStyle(Color.white.opacity(0.6))
                .multilineTextAlignment(.center)
            Button("Retry") {
                Task { await creation.loadArchetypesIfNeeded() }
            }
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(Color.appPrimary)
        }
        .padding(20)
        .frame(maxWidth: .infinity)
        .liquidGlassBackground(
            in: RoundedRectangle(cornerRadius: 16, style: .continuous),
            tint: Color.white.opacity(0.05)
        )
    }
}

// MARK: - Page 13: identity (name + avatar)

struct OnboardingBuilderIdentityPage: View {
    @Bindable var creation: AgentCreationStore
    @Environment(OnboardingStore.self) private var store

    @FocusState private var nameFocused: Bool

    /// Same gradient options as the standalone wizard's Step2Identity —
    /// stored as "gradient:#hex1,#hex2", the Supabase wire format.
    private static let gradients: [String] = [
        "gradient:#6366f1,#ec4899",
        "gradient:#8b5cf6,#06b6d4",
        "gradient:#ef4444,#f97316",
        "gradient:#22c55e,#06b6d4",
        "gradient:#f97316,#eab308",
        "gradient:#ec4899,#8b5cf6",
        "gradient:#06b6d4,#6366f1",
        "gradient:#22c55e,#eab308",
        "gradient:#ef4444,#ec4899",
        "gradient:#8b5cf6,#f97316",
        "gradient:#3b82f6,#22c55e",
        "gradient:#f59e0b,#ef4444",
        "gradient:#14b8a6,#8b5cf6",
        "gradient:#6366f1,#3b82f6",
        "gradient:#dc2626,#7c3aed",
        "gradient:#0ea5e9,#22d3ee",
    ]

    /// Stable preview sprite: the seeded/user-chosen character. Never
    /// derived from the live name — typing must not reshuffle the pixel guy.
    private var previewSpriteIndex: Int {
        creation.draft.spriteIndex ?? 0
    }

    var body: some View {
        OnboardingPageScaffold(
            title: "Name your agent",
            subtitle: "This is who you'll see grinding the research."
        ) {
            // Live avatar preview — chosen character over the chosen color.
            ZStack {
                gradientView(for: creation.draft.avatarColor)
                    .frame(width: 88, height: 88)
                    .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 26, style: .continuous)
                            .strokeBorder(Color.white.opacity(0.35), lineWidth: 1.5)
                    )
                PixelSpriteAvatar(spriteIndex: previewSpriteIndex, animated: true)
                    .padding(8)
                    .frame(width: 88, height: 88)
            }
            .padding(.top, 8)
            .pageEntrance(index: 2)
            .glyphRipple(on: creation.draft.avatarColor)
            .glyphRipple(on: creation.draft.spriteIndex)

            // Name field — the only keyboard surface in the whole flow.
            VStack(alignment: .leading, spacing: 6) {
                TextField(
                    "",
                    text: $creation.draft.name,
                    prompt: Text("e.g., Sharp Shooter, The Oracle")
                        .foregroundColor(Color.white.opacity(0.4))
                )
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled(true)
                .focused($nameFocused)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 13)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.white.opacity(0.08))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(
                            nameFocused ? Color.appPrimary : Color.white.opacity(0.2),
                            lineWidth: 1
                        )
                )

                HStack {
                    if creation.draft.name.count > 50 {
                        Text("Name must be 50 characters or less")
                            .font(.system(size: 12))
                            .foregroundStyle(Color.appLoss)
                    }
                    Spacer()
                    Text("\(creation.draft.name.count)/50")
                        .font(.system(size: 12))
                        .foregroundStyle(
                            creation.draft.name.count > 50 ? Color.appLoss : Color.white.opacity(0.5)
                        )
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 10)
            .pageEntrance(index: 3)

            // Character picker — the 8 pixel-office people (avatar_0…7),
            // same roster the Agents tab settings offer.
            VStack(alignment: .leading, spacing: 10) {
                Text("CHARACTER")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(Color.white.opacity(0.5))
                    .tracking(0.8)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(0..<8, id: \.self) { idx in
                            let isSelected = previewSpriteIndex == idx
                            Button {
                                creation.draft.spriteIndex = idx
                            } label: {
                                PixelSpriteAvatar(spriteIndex: idx, animated: isSelected)
                                    .frame(width: 42, height: 56)
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 6)
                                    .liquidGlassBackground(
                                        in: RoundedRectangle(cornerRadius: 10, style: .continuous),
                                        tint: isSelected ? Color.appPrimary.opacity(0.20) : Color.white.opacity(0.05)
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                                            .strokeBorder(isSelected ? Color.appPrimary : .clear, lineWidth: 2)
                                    )
                            }
                            .buttonStyle(OnboardingPressStyle())
                            .accessibilityLabel("Character \(idx + 1)")
                            .accessibilityAddTraits(isSelected ? .isSelected : [])
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 14)
            .pageEntrance(index: 4)
            .sensoryFeedback(.selection, trigger: creation.draft.spriteIndex)

            // Color grid.
            VStack(alignment: .leading, spacing: 10) {
                Text("COLOR")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(Color.white.opacity(0.5))
                    .tracking(0.8)

                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4), spacing: 12) {
                    ForEach(Self.gradients, id: \.self) { gradient in
                        let isSelected = creation.draft.avatarColor == gradient
                        Button {
                            creation.draft.avatarColor = gradient
                        } label: {
                            ZStack {
                                gradientView(for: gradient)
                                    .frame(width: 48, height: 48)
                                    .clipShape(Circle())
                                if isSelected {
                                    ZStack {
                                        Circle()
                                            .fill(Color.white.opacity(0.9))
                                            .frame(width: 22, height: 22)
                                        Image(systemName: "checkmark")
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundStyle(.black)
                                    }
                                }
                            }
                            .overlay(
                                Circle().strokeBorder(isSelected ? Color.white : Color.clear, lineWidth: 3)
                            )
                        }
                        .buttonStyle(OnboardingPressStyle())
                    }
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 14)
            .pageEntrance(index: 5)
            .sensoryFeedback(.selection, trigger: creation.draft.avatarColor)
        }
        .scrollDismissesKeyboard(.immediately)
    }

    @ViewBuilder
    private func gradientView(for raw: String) -> some View {
        if raw.hasPrefix("gradient:") {
            let stripped = String(raw.dropFirst("gradient:".count))
            let colors: [Color] = stripped.split(separator: ",").compactMap {
                Color(hexString: String($0))
            }
            if colors.count >= 2 {
                LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
            } else if let first = colors.first {
                first
            } else {
                Color(hex: 0x6366F1)
            }
        } else {
            Color(hexString: raw) ?? Color(hex: 0x6366F1)
        }
    }
}
