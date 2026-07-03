import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Step 1 of the wizard: pick a creation path (scratch / preset), then either
/// select sports (scratch) or an archetype preset (preset).
///
/// Mirrors `components/agents/creation/Screen1_SportArchetype.tsx`.
struct Step1SportArchetypeView: View {
    @Bindable var store: AgentCreationStore
    @State private var path: CreationPath

    enum CreationPath { case unset, scratch, preset }

    init(store: AgentCreationStore) {
        self.store = store
        // Derive initial path from draft state. Mirrors RN's useState initial.
        let initial: CreationPath
        if store.draft.archetype != nil { initial = .preset }
        else if !store.draft.preferredSports.isEmpty { initial = .scratch }
        else { initial = .unset }
        self._path = State(initialValue: initial)
    }

    var body: some View {
        // Step 1 is a selection/landing screen — designed cards read far better
        // here than a flattened grouped Form, so it owns a ScrollView (the host
        // no longer wraps steps; the input-heavy steps are self-scrolling Forms).
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                switch path {
                case .unset: pathSelection
                case .scratch: scratchSection
                case .preset: presetSection
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 24)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Color.appSurface.ignoresSafeArea())
    }

    // MARK: - Path selection

    private var pathSelection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("How do you want to start?")
                .font(.system(size: 22, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
                .padding(.bottom, 2)
            Text("Build a custom strategy or pick a proven preset.")
                .font(.system(size: 15))
                .foregroundStyle(Color.appTextSecondary)
                .padding(.bottom, 16)

            pathCard(
                icon: "slider.horizontal.3",
                iconColor: Color(hex: 0x00E676),
                title: "Build from Scratch",
                desc: "Choose your sports, then fine-tune every parameter yourself."
            ) {
                store.clearArchetype()
                path = .scratch
            }

            pathCard(
                icon: "bolt.fill",
                iconColor: Color(hex: 0x818CF8),
                title: "Use a Preset",
                desc: "Start with a proven betting style. Sports and settings are pre-configured."
            ) {
                store.draft.preferredSports = []
                store.clearArchetype()
                path = .preset
                Task { await store.loadArchetypesIfNeeded() }
            }

            performanceCard
                .padding(.top, 12)
        }
    }

    private func pathCard(icon: String, iconColor: Color, title: String, desc: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(iconColor.opacity(0.15))
                    Image(systemName: icon)
                        .font(.system(size: 22))
                        .foregroundStyle(iconColor)
                }
                .frame(width: 48, height: 48)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text(desc)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.appTextSecondary)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .foregroundStyle(Color.appTextSecondary)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.appBorder.opacity(0.25))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var performanceCard: some View {
        // Static perf brag — same copy + bar widths as RN PERFORMANCE_ROWS.
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(Color(hex: 0x22C55E))
                    Image(systemName: "chart.bar.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(.white)
                }
                .frame(width: 24, height: 24)
                Text("This Model Wins Across the Board")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            Text("Our agents consistently outperform average bettors by running disciplined, 24/7 research and execution.")
                .font(.system(size: 10))
                .foregroundStyle(Color.appTextSecondary)
            perfRow(label: "Our Agents", value: "9-12%", barWidth: 120, color: Color(hex: 0x22C55E), direction: .positive)
            perfRow(label: "Pro Bettor", value: "2-5%", barWidth: 62, color: Color.appBorder, direction: .positive)
            perfRow(label: "Casual Bettor", value: "-5%", barWidth: 38, color: Color.appBorder.opacity(0.6), direction: .negative)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.appBorder.opacity(0.2))
        )
    }

    private enum BarDirection { case positive, negative }

    private func perfRow(label: String, value: String, barWidth: CGFloat, color: Color, direction: BarDirection) -> some View {
        HStack(spacing: 6) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .frame(width: 82, alignment: .leading)
            ZStack(alignment: direction == .positive ? .leading : .trailing) {
                Rectangle().fill(Color.clear).frame(height: 12)
                RoundedRectangle(cornerRadius: 4)
                    .fill(color)
                    .frame(width: barWidth, height: 12)
            }
            Text(value)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .frame(width: 44, alignment: .trailing)
        }
    }

    // MARK: - Scratch: sport selection

    private var scratchSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            changePathButton

            Text("Select Sports")
                .font(.system(size: 22, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
            Text("Which sports should your agent analyze? Pick one or more.")
                .font(.system(size: 15))
                .foregroundStyle(Color.appTextSecondary)
                .padding(.bottom, 8)

            ForEach(AgentSport.allCases, id: \.self) { sport in
                sportRow(sport)
            }

            if store.draft.preferredSports.isEmpty {
                Text("Select at least one sport to continue")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, 12)
            }
        }
    }

    private func sportRow(_ sport: AgentSport) -> some View {
        let isSelected = store.draft.preferredSports.contains(sport)
        let conf = sportConfig(sport)
        return Button {
            store.toggleSport(sport)
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(conf.color.opacity(0.18))
                    Image(systemName: sport.sfSymbol)
                        .font(.system(size: 20))
                        .foregroundStyle(conf.color)
                }
                .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 1) {
                    Text(conf.label)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text(conf.desc)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.appTextSecondary)
                }
                Spacer()
                ZStack {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(isSelected ? Color(hex: 0x00E676) : Color.clear)
                        .frame(width: 24, height: 24)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .strokeBorder(isSelected ? Color(hex: 0x00E676) : Color.appBorder, lineWidth: 2)
                        )
                    if isSelected {
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.black)
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(isSelected ? Color(hex: 0x00E676).opacity(0.08) : Color.appBorder.opacity(0.25))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(isSelected ? Color(hex: 0x00E676) : Color.appBorder, lineWidth: isSelected ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
        .padding(.bottom, 4)
    }

    private struct SportConfig {
        let label: String
        let desc: String
        let color: Color
    }

    private func sportConfig(_ sport: AgentSport) -> SportConfig {
        switch sport {
        case .nfl: return .init(label: "NFL", desc: "Pro Football", color: Color(hex: 0x013369))
        case .cfb: return .init(label: "CFB", desc: "College Football", color: Color(hex: 0xC41E3A))
        case .nba: return .init(label: "NBA", desc: "Pro Basketball", color: Color(hex: 0x1D428A))
        case .ncaab: return .init(label: "NCAAB", desc: "College Basketball", color: Color(hex: 0xFF6B00))
        case .mlb: return .init(label: "MLB", desc: "Pro Baseball", color: Color(hex: 0x002D72))
        }
    }

    // MARK: - Preset

    private var presetSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            changePathButton

            Text("Choose a Preset")
                .font(.system(size: 22, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
            Text("Each preset comes with a tuned strategy and recommended sports. You can customize it later.")
                .font(.system(size: 15))
                .foregroundStyle(Color.appTextSecondary)
                .padding(.bottom, 8)

            switch store.archetypesLoadState {
            case .idle, .loading:
                HStack { Spacer(); ProgressView(); Spacer() }
                    .padding(.vertical, 40)
            case .failed(let msg):
                VStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(Color(hex: 0xEF4444))
                    Text("Couldn't load presets")
                        .font(.system(size: 14, weight: .semibold))
                    Text(msg)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                    Button("Retry") {
                        Task { await store.loadArchetypesIfNeeded() }
                    }
                }
                .frame(maxWidth: .infinity)
                .padding()
            case .loaded:
                ForEach(store.archetypeRows) { row in
                    ArchetypeCard(
                        row: row,
                        selected: store.draft.archetype?.rawValue == row.id
                    ) {
                        store.applyArchetype(row)
                    }
                }
            }
        }
    }

    private var changePathButton: some View {
        Button {
            path = .unset
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "arrow.left")
                    .font(.system(size: 13))
                Text("Change path")
                    .font(.system(size: 14, weight: .medium))
            }
            .foregroundStyle(Color.appTextSecondary)
        }
        .buttonStyle(.plain)
        .padding(.bottom, 12)
    }
}
