import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Honeydew's interactive achievement showcase, using sample personalization only.
/// The surrounding carousel owns Continue/Back and the existing onboarding backdrop.
struct OnboardingAchievementsPage: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selectedID = "streak-25"
    @State private var previewDate = Date()
    @State private var hintPhase: HintPhase = .waiting
    @ScaledMetric(relativeTo: .caption) private var thumbnailSize = 60.0
    private enum HintPhase { case waiting, touching, dragging, finished }

    private static let medals: [AchievementDefinition] = {
        let families = AchievementGroup.allCases.map { group in
            AchievementCatalog.definitions.filter { $0.group == group }
        }
        let interleaved = (0..<(families.map(\.count).max() ?? 0)).flatMap { milestone in
            families.compactMap { milestone < $0.count ? $0[milestone] : nil }
        }
        return interleaved.filter { $0.id == "streak-25" } + interleaved.filter { $0.id != "streak-25" }
    }()
    private var selected: AchievementDefinition {
        Self.medals.first { $0.id == selectedID } ?? Self.medals[0]
    }

    var body: some View {
        GeometryReader { geometry in
            ScrollView(showsIndicators: false) {
                VStack(spacing: 8) {
                    Text("Track skill with achievements!")
                        .font(.system(size: 25, weight: .heavy, design: .rounded))
                        .multilineTextAlignment(.center).padding(.horizontal, 24)
                    AchievementMedalView(familyAsset: selected.group.asset,
                        variantRoot: selected.variantRoot, earned: true,
                        recipientName: "Your name", earnedAt: previewDate,
                        caption: selected.title.uppercased(),
                        onInteractionBegan: dismissHint)
                        .id(selectedID)
                        .frame(height: max(220, min(360, geometry.size.height - 310)))
                        .overlay { swipeHint }
                        .accessibilityLabel("\(selected.title), 3D achievement preview")
                        .accessibilityHint("Drag horizontally to rotate the medal")
                    Text(selected.title)
                        .font(.system(size: 21, weight: .bold, design: .rounded))
                        .multilineTextAlignment(.center).padding(.horizontal, 20)
                    Text("Swipe to spin. Tap a medal below to explore.")
                        .font(.caption).foregroundStyle(.secondary)
                        .multilineTextAlignment(.center).padding(.horizontal, 20)
                    medalPicker.padding(.top, 4)
                }
                .padding(.vertical, 8)
                .frame(maxWidth: 720).frame(maxWidth: .infinity)
            }
        }
        .task(id: reduceMotion) { await demonstrateSwipe() }
        .sensoryFeedback(.selection, trigger: selectedID)
    }

    private var medalPicker: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Explore all \(Self.medals.count) achievements")
                .font(.caption.weight(.bold)).foregroundStyle(.secondary)
                .padding(.horizontal, 20)
            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(spacing: 10) {
                        ForEach(Self.medals) { medal in
                            Button {
                                dismissHint()
                                selectedID = medal.id
                            } label: {
                                Image(uiImage: AchievementThumbnail.image(named: medal.thumbnail))
                                    .resizable().scaledToFit().padding(5)
                                    .frame(width: thumbnailSize, height: thumbnailSize)
                                    .background(selectedID == medal.id ? Color.green.opacity(0.12) : .clear,
                                        in: RoundedRectangle(cornerRadius: 14))
                                    .overlay {
                                        RoundedRectangle(cornerRadius: 14)
                                            .strokeBorder(selectedID == medal.id ? Color.green : .clear, lineWidth: 2)
                                    }
                            }
                            .buttonStyle(.plain).id(medal.id)
                            .accessibilityLabel("\(medal.title), \(medal.group.title)")
                            .accessibilityHint("Show this medal in the 3D preview")
                            .accessibilityAddTraits(selectedID == medal.id ? .isSelected : [])
                        }
                    }.padding(.horizontal, 20)
                }
                .frame(height: thumbnailSize)
                .onAppear { proxy.scrollTo(selectedID, anchor: .center) }
            }
        }
    }
    private var swipeHint: some View {
        Image(systemName: "hand.point.up.left.fill")
            .font(.system(size: 38, weight: .medium)).foregroundStyle(.white)
            .shadow(color: .black.opacity(0.4), radius: 3, y: 2)
            .offset(x: hintPhase == .waiting || hintPhase == .touching ? -68 : 68, y: 24)
            .opacity(hintPhase == .touching || hintPhase == .dragging ? 1 : 0)
            .allowsHitTesting(false).accessibilityHidden(true)
    }
    @MainActor private func demonstrateSwipe() async {
        guard !reduceMotion, hintPhase == .waiting else { dismissHint(); return }
        do {
            try await Task.sleep(for: .milliseconds(900))
            guard hintPhase == .waiting else { return }
            withAnimation(.easeOut(duration: 0.2)) { hintPhase = .touching }
            try await Task.sleep(for: .milliseconds(250))
            guard hintPhase == .touching else { return }
            withAnimation(.easeInOut(duration: 1.3)) { hintPhase = .dragging }
            try await Task.sleep(for: .milliseconds(1500))
            withAnimation(.easeOut(duration: 0.2)) { hintPhase = .finished }
        } catch { dismissHint() }
    }
    private func dismissHint() { hintPhase = .finished }
}
