import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Feature Requests screen — community voting + developer roadmap.
/// Ports `wagerproof-mobile/app/(drawer)/(tabs)/feature-requests.tsx`.
///
/// Layout strategy (matches spec §6):
/// - `List(.insetGrouped)` with up to four sections: Community Voting,
///   Planned, In Progress, Completed (the last three subdivide the
///   "Developer Roadmap" RN section).
/// - Toolbar leading: `xmark` to dismiss the sheet (RN used the hamburger;
///   our entry point is itself a sheet so we offer a close button instead).
/// - Toolbar trailing: `plus` opens `SubmitFeatureRequestSheet`.
/// - `.refreshable` triggers `store.refresh(userId:)`.
/// - Each row uses `FeatureRequestRow` and a `.contextMenu` for share /
///   copy actions.
///
/// The screen is reachable from the side menu (B03 SideMenuSheet) — it is
/// NOT a tab. Presentation is controlled by `MainTabStore.isFeatureRequestsPresented`.
struct FeatureRequestsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthStore.self) private var auth
    @State private var store: FeatureRequestsStore
    @State private var isSubmitSheetPresented = false

    /// Production callers use the default initializer.
    init() {
        _store = State(initialValue: FeatureRequestsStore())
    }

    /// DEBUG init for the screenshot harness — accepts a pre-seeded store
    /// so the view can render empty / loaded / error states deterministically.
    #if DEBUG
    init(store: FeatureRequestsStore) {
        _store = State(initialValue: store)
    }
    #endif

    /// User id from AuthStore. The whole screen is meaningless without an
    /// authenticated session, but the side-menu entry is only enabled in
    /// the `.authenticated` phase so we treat `nil` as "loading" rather
    /// than blocking.
    private var userId: UUID? {
        if case let .authenticated(id) = auth.phase { return id }
        return nil
    }

    var body: some View {
        NavigationStack {
            content
                .background(Color.appSurface.ignoresSafeArea())
                .navigationTitle("Feature Requests")
                .navigationBarTitleDisplayMode(.large)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            dismiss()
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 15, weight: .semibold))
                        }
                        .tint(Color.appTextPrimary)
                        .accessibilityLabel("Close")
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            isSubmitSheetPresented = true
                        } label: {
                            Image(systemName: "plus")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(.white)
                                .frame(width: 32, height: 32)
                                .background(Color.appPrimary)
                                .clipShape(Circle())
                        }
                        .accessibilityLabel("Submit feature request")
                        .sensoryFeedback(.impact(weight: .light), trigger: isSubmitSheetPresented)
                    }
                }
                .refreshable {
                    await store.refresh(userId: userId)
                }
                .task {
                    if case .idle = store.loadState {
                        await store.refresh(userId: userId)
                    }
                }
                .sheet(isPresented: $isSubmitSheetPresented) {
                    if let userId {
                        SubmitFeatureRequestSheet(
                            userId: userId,
                            displayName: auth.profile?.displayName
                        )
                        .environment(store)
                        .presentationDetents([.medium, .large])
                        .presentationDragIndicator(.visible)
                    } else {
                        // User signed out mid-flow — rare but possible.
                        ContentUnavailableView(
                            "Sign in required",
                            systemImage: "person.crop.circle.badge.exclamationmark",
                            description: Text("Sign in to submit a feature request.")
                        )
                    }
                }
                .sensoryFeedback(.success, trigger: store.justSubmittedAt)
                .sensoryFeedback(.selection, trigger: store.userVotes)
        }
    }

    @ViewBuilder
    private var content: some View {
        if store.isLoading && !store.hasRequests {
            loadingPlaceholder
        } else if case let .failed(message) = store.loadState, !store.hasRequests {
            errorState(message: message)
        } else if !store.hasRequests {
            emptyState
        } else {
            listContent
        }
    }

    @ViewBuilder
    private var listContent: some View {
        List {
            // Community Voting
            Section {
                if store.approvedRequests.isEmpty {
                    ContentUnavailableView {
                        Label("No feature requests yet", systemImage: "lightbulb")
                    } description: {
                        Text("Be the first to submit one!")
                    }
                    .listRowBackground(Color.clear)
                } else {
                    ForEach(store.approvedRequests) { request in
                        rowFor(request: request, isRoadmap: false)
                    }
                }
            } header: {
                sectionHeader("Community Voting", icon: "lightbulb.fill", color: Color.appPrimary)
            }

            // Developer Roadmap — Planned
            if !store.plannedRoadmapItems.isEmpty {
                Section {
                    ForEach(store.plannedRoadmapItems) { request in
                        rowFor(request: request, isRoadmap: true)
                    }
                } header: {
                    sectionHeader(
                        "Planned",
                        icon: "clock",
                        color: Color.appAccentBlue,
                        count: store.plannedRoadmapItems.count
                    )
                }
            }

            // Developer Roadmap — In Progress
            if !store.inProgressRoadmapItems.isEmpty {
                Section {
                    ForEach(store.inProgressRoadmapItems) { request in
                        rowFor(request: request, isRoadmap: true)
                    }
                } header: {
                    sectionHeader(
                        "In Progress",
                        icon: "paperplane.circle.fill",
                        color: Color.appAccentPurple,
                        count: store.inProgressRoadmapItems.count
                    )
                }
            }

            // Developer Roadmap — Completed
            if !store.completedRoadmapItems.isEmpty {
                Section {
                    ForEach(store.completedRoadmapItems) { request in
                        rowFor(request: request, isRoadmap: true)
                    }
                } header: {
                    sectionHeader(
                        "Completed",
                        icon: "checkmark.circle.fill",
                        color: Color(hex: 0x22C55E),
                        count: store.completedRoadmapItems.count
                    )
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.appSurface)
        .animation(.appStandard, value: store.requests)
        .animation(.appQuick, value: store.userVotes)
    }

    @ViewBuilder
    private func rowFor(request: FeatureRequest, isRoadmap: Bool) -> some View {
        let userVote = store.userVotes.first { $0.featureRequestId == request.id }?.voteType
        FeatureRequestRow(
            request: request,
            userVote: userVote,
            // Roadmap items: pass `nil` to disable voting UI per RN (line 364).
            onVote: isRoadmap ? nil : { type in
                guard let userId else { return }
                Task { await store.vote(requestId: request.id, userId: userId, voteType: type) }
            }
        )
        .listRowBackground(Color.appSurfaceElevated)
        .contextMenu {
            Button {
                UIPasteboard.general.string = "\(request.title)\n\n\(request.description)"
            } label: {
                Label("Copy", systemImage: "doc.on.doc")
            }
            ShareLink(item: shareText(for: request)) {
                Label("Share", systemImage: "square.and.arrow.up")
            }
        }
    }

    @ViewBuilder
    private func sectionHeader(
        _ title: String,
        icon: String,
        color: Color,
        count: Int? = nil
    ) -> some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(color)
            Text(title)
                .font(AppFont.captionEmphasized)
                .foregroundStyle(Color.appTextPrimary)
                .textCase(nil)
            if let count {
                Text("\(count)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(color)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, 2)
                    .background(color.opacity(0.18))
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.sm))
            }
            Spacer()
        }
    }

    @ViewBuilder
    private var loadingPlaceholder: some View {
        // Skeleton rows shaped like `FeatureRequestRow`, rendered in the same
        // `List(.insetGrouped)` as the loaded state so the crossfade to real
        // content doesn't shift the layout. Uses the unified Skeleton*/
        // .shimmering() vocabulary (see GameCardShimmer) instead of a flat
        // redacted card.
        List {
            Section {
                ForEach(0..<3, id: \.self) { _ in
                    FeatureRequestRowSkeleton()
                        .listRowBackground(Color.appSurfaceElevated)
                }
            } header: {
                sectionHeader("Community Voting", icon: "lightbulb.fill", color: Color.appPrimary)
            }
            Section {
                ForEach(0..<2, id: \.self) { _ in
                    FeatureRequestRowSkeleton()
                        .listRowBackground(Color.appSurfaceElevated)
                }
            } header: {
                sectionHeader("Planned", icon: "clock", color: Color.appAccentBlue)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.appSurface)
        .disabled(true) // Skeletons aren't interactive.
    }

    @ViewBuilder
    private var emptyState: some View {
        ContentUnavailableView {
            Label("No feature requests yet", systemImage: "lightbulb")
        } description: {
            Text("Be the first to submit one! Tap the green + button up top.")
        } actions: {
            Button {
                isSubmitSheetPresented = true
            } label: {
                Label("Submit a request", systemImage: "plus.circle.fill")
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.appPrimary)
        }
    }

    @ViewBuilder
    private func errorState(message: String) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 36))
                .foregroundStyle(Color.appAccentAmber)
            Text("Couldn't load feature requests")
                .font(AppFont.headline)
                .foregroundStyle(Color.appTextPrimary)
            Text(message)
                .font(AppFont.caption)
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)
            Button {
                Task { await store.refresh(userId: userId) }
            } label: {
                Label("Retry", systemImage: "arrow.clockwise")
                    .font(AppFont.bodyEmphasized)
                    .foregroundStyle(.white)
                    .padding(.horizontal, Spacing.lg)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.appPrimary)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .padding(.top, Spacing.sm)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(Spacing.xl)
    }

    private func shareText(for request: FeatureRequest) -> String {
        "WagerProof feature request: \(request.title)\n\n\(request.description)"
    }
}

/// Skeleton mirror of `FeatureRequestRow`: a leading status-icon block, a
/// title + status-chip stack, a two-line description, and a footer with a
/// caption block and a trailing vote-controls cluster. Only the inner
/// placeholder group shimmers — the List cell chrome stays solid (see
/// GameCardShimmer for the shared pattern).
private struct FeatureRequestRowSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // header: 28pt icon + title/status-badge stack
            HStack(alignment: .top, spacing: Spacing.md) {
                SkeletonBlock(width: 22, height: 22, cornerRadius: 6)
                    .frame(width: 28, alignment: .leading)
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    SkeletonBlock(width: 190, height: 16)        // title (.headline)
                    SkeletonCapsule(width: 84, height: 18)       // status badge
                }
            }
            // description (two lines)
            VStack(alignment: .leading, spacing: 6) {
                SkeletonBlock(height: 12)
                SkeletonBlock(width: 220, height: 12)
            }
            // footer: "By <name> · <date>" caption + vote controls cluster
            HStack(alignment: .center, spacing: Spacing.md) {
                SkeletonBlock(width: 140, height: 11)
                Spacer(minLength: 0)
                HStack(spacing: Spacing.xs) {
                    SkeletonBlock(width: 32, height: 32, cornerRadius: CornerRadius.sm)
                    SkeletonBlock(width: 40, height: 24, cornerRadius: CornerRadius.sm)
                    SkeletonBlock(width: 32, height: 32, cornerRadius: CornerRadius.sm)
                }
            }
        }
        .padding(.vertical, Spacing.xs)
        .shimmering()
    }
}

#if DEBUG
#Preview("Loaded") {
    FeatureRequestsView()
        .environment(AuthStore())
}
#endif
