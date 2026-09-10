import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Mirrors Honeydew's static discovery shelves. RealityKit is reserved for detail.
struct AchievementDiscoverySection: View {
    @Environment(AchievementsStore.self) private var store
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Your Collection").font(.title3.bold())
                    Text("\(store.unlockedCount) of \(AchievementCatalog.definitions.count) achievements")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer()
                NavigationLink("See All") { AchievementLibraryView() }.font(.subheadline.weight(.semibold))
            }
            AchievementShelf(title: store.recentlyUnlocked.isEmpty ? "Up Next" : "Recently Unlocked",
                items: store.recentlyUnlocked.isEmpty ? store.upNext : store.recentlyUnlocked)
        }
        .padding(.vertical, 20)
        .task { await store.refresh() }
    }
}

private struct AchievementShelf: View {
    let title: String
    let items: [Achievement]
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
            ScrollView(.horizontal) {
                LazyHStack(alignment: .top, spacing: 16) {
                    ForEach(items) { item in
                        NavigationLink { AchievementDetailView(id: item.id) } label: {
                            AchievementTile(item: item, compact: true).frame(width: 88)
                        }.buttonStyle(.plain)
                    }
                }
            }.scrollIndicators(.hidden)
        }
    }
}

struct AchievementLibraryView: View {
    @Environment(AchievementsStore.self) private var store
    @State private var filter = Filter.all
    @ScaledMetric(relativeTo: .caption) private var cardWidth = 100.0
    private enum Filter: String, CaseIterable { case all = "All", earned = "Unlocked", locked = "In Progress" }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    Text("Your Collection").font(.title2.bold())
                    Spacer()
                    Text("\(store.unlockedCount) / \(AchievementCatalog.definitions.count)")
                        .font(.headline).foregroundStyle(.secondary)
                }
                if let error = store.errorMessage {
                    Text(error).font(.footnote).foregroundStyle(.secondary)
                }
                if filter == .all && !store.recentlyUnlocked.isEmpty {
                    AchievementShelf(title: "Recently Unlocked", items: store.recentlyUnlocked)
                }
                Picker("Show achievements", selection: $filter) {
                    ForEach(Filter.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }.pickerStyle(.segmented)
                if filter == .earned && store.unlockedCount == 0 {
                    ContentUnavailableView("Your first medal is waiting", systemImage: "medal",
                        description: Text("Explore the collection to see what you can earn."))
                }
                ForEach(AchievementGroup.allCases) { group in
                    let all = store.achievements.filter { $0.definition.group == group }
                    let items = all.filter { filter == .all || (filter == .earned ? $0.earned : !$0.earned) }
                    if !items.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text(group.title).font(.headline).accessibilityAddTraits(.isHeader)
                                Spacer()
                                Text("\(all.filter(\.earned).count)/\(all.count)").font(.caption).foregroundStyle(.secondary)
                            }
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: cardWidth), spacing: 16)], spacing: 22) {
                                ForEach(items) { item in
                                    NavigationLink { AchievementDetailView(id: item.id) } label: {
                                        AchievementTile(item: item)
                                    }.buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
                if filter == .locked && store.unlockedCount == AchievementCatalog.definitions.count {
                    Text("You’ve unlocked the whole collection!").font(.headline)
                }
            }.padding(20)
        }
        .background(Color.appSurface.ignoresSafeArea())
        .navigationTitle("Achievements")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .refreshable { await store.refresh() }
        .task { await store.refresh() }
    }
}

private struct AchievementTile: View {
    let item: Achievement
    var compact = false
    var body: some View {
        VStack(spacing: 6) {
            Image(uiImage: AchievementThumbnail.image(named: item.definition.thumbnail, earned: item.earned)).resizable().scaledToFit()
                .frame(height: compact ? 88 : 108)
                .overlay(alignment: .bottomTrailing) {
                    if !item.earned { Image(systemName: "lock.fill").font(.caption2).foregroundStyle(.secondary) }
                }
            Text(item.definition.title).font(.caption.weight(.semibold)).multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            if !item.earned {
                ProgressView(value: item.fraction).tint(.green)
                    .accessibilityLabel("Progress").accessibilityValue(item.fraction.formatted(.percent))
            } else if let date = item.status.earnedAt {
                Text(date.formatted(.dateTime.month(.defaultDigits).day().year(.twoDigits)))
                    .font(compact ? .system(size: 9) : .caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(item.definition.title), \(item.earned ? "unlocked" : "locked"), \(item.definition.requirement)")
    }
}

struct AchievementDetailView: View {
    let id: String
    @Environment(AchievementsStore.self) private var store
    @Environment(AuthStore.self) private var auth
    @State private var immersive = false
    @State private var revealed = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        if let item = store.achievement(id: id) {
            GeometryReader { geometry in
                ScrollView {
                    VStack(spacing: 10) {
                        AchievementMedalView(familyAsset: item.definition.group.asset,
                            variantRoot: item.definition.variantRoot, earned: item.earned,
                            recipientName: auth.profile?.displayName ?? auth.profile?.username ?? "WagerProof",
                            earnedAt: item.status.earnedAt, caption: item.definition.title.uppercased())
                            .frame(height: immersive ? geometry.size.height * 0.7 : 420)
                            .scaleEffect(revealed || immersive ? 1 : 0.55)
                            .opacity(revealed ? 1 : 0)
                        if !immersive {
                            VStack(spacing: 10) {
                                Text(item.definition.title).font(.system(size: 28, weight: .bold)).multilineTextAlignment(.center)
                                if let date = item.status.earnedAt {
                                    Label("Unlocked \(date.formatted(date: .abbreviated, time: .omitted))", systemImage: "checkmark.seal.fill")
                                        .font(.subheadline).foregroundStyle(.green)
                                } else {
                                    Label("Not yet earned", systemImage: "lock.fill").font(.subheadline).foregroundStyle(.secondary)
                                }
                                Text(item.definition.requirement).font(.body).foregroundStyle(.secondary)
                                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                                if !item.earned {
                                    ProgressView(value: item.fraction).tint(.green).padding(.top, 12)
                                    Text(progressLabel(item)).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                                }
                            }.padding(.horizontal, 28)
                            Text("Drag to rotate · Double-tap to flip").font(.caption).foregroundStyle(.secondary)
                            AchievementShareButton(item: item).padding(.horizontal, 28).padding(.top, 12)
                        }
                    }.padding(.bottom, 32)
                }
            }
            .background(Color.appSurface.ignoresSafeArea())
            .navigationTitle(immersive ? "" : item.definition.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .tabBar)
            .toolbar { ToolbarItem(placement: .topBarTrailing) {
                Button { withAnimation { immersive.toggle() } } label: {
                    Image(systemName: immersive ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right")
                }.accessibilityLabel(immersive ? "Show achievement details" : "Expand medal")
            } }
            .onAppear {
                if reduceMotion { revealed = true }
                else { withAnimation(.spring(response: 0.55, dampingFraction: 0.82)) { revealed = true } }
            }
            .task { await store.refresh() }
        }
    }
    private func progressLabel(_ item: Achievement) -> String {
        if item.definition.group == .leaderboard {
            return item.status.currentValue > 0 ? "Best eligible rank: \(Int(item.status.currentValue))" : "No eligible leaderboard rank yet"
        }
        if item.id.hasPrefix("consistent") {
            let decided = item.id == "consistent" ? "100" : String(item.id.dropFirst("consistent-".count))
            return "\(item.status.currentValue.formatted(.number.precision(.fractionLength(0...1))))% win rate · \(decided) decided picks required" }
        return "\(item.status.currentValue.formatted(.number.precision(.fractionLength(0...1)))) / \(item.status.targetValue.formatted(.number.precision(.fractionLength(0...1))))"
    }
}

struct AchievementUnlockedSheet: View {
    let item: Achievement
    let onDone: () -> Void
    @Environment(AuthStore.self) private var auth
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showRotationHint = true
    @State private var fingerAtEnd = false
    var body: some View {
        VStack(spacing: 20) {
            Text("ACHIEVEMENT UNLOCKED").font(.caption.bold()).tracking(2).foregroundStyle(.secondary)
            AchievementMedalView(familyAsset: item.definition.group.asset, variantRoot: item.definition.variantRoot,
                earned: true, recipientName: auth.profile?.displayName ?? auth.profile?.username ?? "WagerProof",
                earnedAt: item.status.earnedAt, caption: item.definition.title.uppercased(),
                onInteractionBegan: { showRotationHint = false })
                .frame(maxHeight: .infinity)
                .overlay(alignment: .bottom) {
                    if showRotationHint {
                        VStack(spacing: 8) {
                            Image(systemName: "hand.draw.fill")
                                .font(.system(size: 30, weight: .medium))
                                .offset(x: reduceMotion ? 0 : fingerAtEnd ? 38 : -38)
                                .shadow(color: .black.opacity(0.4), radius: 4, y: 2)
                                .accessibilityHidden(true)
                            Text("Swipe me to rotate").font(.subheadline.weight(.semibold))
                        }
                        .foregroundStyle(.primary)
                        .padding(.horizontal, 20).padding(.vertical, 12)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
                        .allowsHitTesting(false)
                        .task {
                            guard !reduceMotion else { return }
                            // Let the reveal spin finish before teaching the horizontal gesture.
                            try? await Task.sleep(for: .milliseconds(750))
                            guard !Task.isCancelled else { return }
                            withAnimation(.easeInOut(duration: 1.15).repeatCount(3, autoreverses: true)) {
                                fingerAtEnd = true
                            }
                        }
                    }
                }
            Text(item.definition.title).font(.system(size: 28, weight: .bold)).multilineTextAlignment(.center)
            Text(item.definition.requirement).foregroundStyle(.secondary).multilineTextAlignment(.center)
            AchievementShareButton(item: item)
            Button("Continue", action: onDone).font(.headline).frame(maxWidth: .infinity).padding()
                .background(.green, in: Capsule()).foregroundStyle(.black)
        }.padding(28).padding(.top, 24).background(Color.appSurface.ignoresSafeArea())
        .overlay {
            if !reduceMotion {
                LottieView(name: "confetti", loopMode: .playOnce)
                    .id(item.id)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
        .interactiveDismissDisabled()
    }
}

/// Matches Honeydew: share only an earned medal, using the baked native image.
private struct AchievementShareButton: View {
    let item: Achievement

    var body: some View {
        if item.earned, let thumbnail = UIImage(named: item.definition.thumbnail) {
            let image = Image(uiImage: thumbnail)
            ShareLink(
                item: image,
                subject: Text("WagerProof Achievement"),
                message: Text("I just earned “\(item.definition.title)” on WagerProof! 🏆"),
                preview: SharePreview(item.definition.title, image: image)
            ) {
                Label("Share with a Friend", systemImage: "square.and.arrow.up")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .foregroundStyle(.green)
                    .background(.green.opacity(0.12), in: Capsule())
            }
            .buttonStyle(.plain)
        }
    }
}
