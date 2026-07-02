import SwiftUI
import UIKit
import WagerproofDesign
import WagerproofModels
import WagerproofStores

// =====================================================================
// PickHistoryFolder — the pick-history "folder" + its browse sheet.
//
// Ported from Orbital Focus's Mission Log (the user's own app):
//   • AgentPickFolderCard — a manila folder with the agent's most recent
//     pick tickets poking out of the top. Lives in the agent detail page
//     where the old "Pick History" list used to be; tapping it opens…
//   • PickHistorySheet   — the folder expanded into a bottom sheet: a
//     rolodex of pick tickets you scroll up out of the folder, filter by
//     result / sport / sort, and tap to expand into the full pass.
//
// The boarding-pass ticket itself lives in AgentPickTicket.swift.
// =====================================================================

// MARK: - Folder card (agent detail page)

/// The closed folder shown in place of the old Pick History list. The most
/// recent tickets poke out the top, fanned and tucked into the folder; the
/// whole card is one tap target that opens `PickHistorySheet`.
struct AgentPickFolderCard: View {
    /// Newest-first; only the first few peek out. Picks and parlays interleave.
    let recentItems: [AgentBetItem]
    var totalCount: Int = 0
    var loading: Bool = false
    var locked: Bool = false
    var agentColor: Color = .appPrimary
    var onTap: () -> Void = {}

    private static let cardHeight: CGFloat = 264
    private static let frontHeight: CGFloat = 140
    private static let peekCount = 3
    private static let jitterX: [CGFloat] = [-6, 5, -3]
    private static let jitterTilt: [Double] = [-1.4, 1.0, -0.6]

    private var peeks: [AgentBetItem] { Array(recentItems.prefix(Self.peekCount)) }
    private var isInteractive: Bool { !locked && !loading && !peeks.isEmpty }

    var body: some View {
        ZStack(alignment: .bottom) {
            ticketsLayer
            folderFront
        }
        .frame(height: Self.cardHeight)
        .clipped()
        .contentShape(Rectangle())
        .onTapGesture {
            guard isInteractive else { return }
            PickHaptics.select()
            onTap()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(locked ? "Pick history locked"
                            : "Pick history folder, \(totalCount) graded picks")
        .accessibilityHint(isInteractive ? "Tap to browse the agent's full pick history" : "")
        .accessibilityAddTraits(isInteractive ? .isButton : [])
    }

    // MARK: Tickets poking out

    @ViewBuilder
    private var ticketsLayer: some View {
        ZStack(alignment: .top) {
            if loading {
                folderPeekSkeleton
            } else if peeks.isEmpty {
                emptyCaption
            } else {
                ForEach(Array(peeks.enumerated()).reversed(), id: \.element.id) { index, item in
                    BetItemTicket(item: item, accent: agentColor)
                        .offset(x: Self.jitterX[index % Self.jitterX.count],
                                y: 26 - CGFloat(index) * 10)
                        .rotationEffect(.degrees(Self.jitterTilt[index % Self.jitterTilt.count]))
                        .allowsHitTesting(false)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding(.horizontal, 24)
    }

    private var emptyCaption: some View {
        VStack(spacing: 6) {
            Image(systemName: locked ? "lock.fill" : "tray")
                .font(.system(size: 26, weight: .light))
                .foregroundStyle(Color.appTextSecondary)
            Text(locked ? "Pick history is locked" : "No graded picks yet")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            Text(locked ? "Upgrade to Pro to browse this agent's history"
                        : "Picks land in the folder once they're graded")
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 24)
        .padding(.top, 22)
    }

    private var folderPeekSkeleton: some View {
        SkeletonBlock(width: nil, height: 96)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .padding(.top, 22)
            .shimmering()
    }

    // MARK: Folder shell

    private var folderFront: some View {
        Color.clear
            .frame(height: Self.frontHeight)
            .folderGlass(in: PickFolderFrontShape())
            .overlay(
                PickFolderFrontShape()
                    .stroke(.white.opacity(0.08), lineWidth: 1)
            )
            .overlay(alignment: .bottomLeading) {
                Text("PICK HISTORY")
                    .font(.system(size: 19, weight: .heavy, design: .rounded))
                    .tracking(3)
                    .foregroundStyle(.white.opacity(0.12))
                    .shadow(color: .black.opacity(0.5), radius: 0.5, y: -1)
                    .padding(.leading, 20)
                    .padding(.bottom, 18)
            }
            .overlay(alignment: .bottomTrailing) {
                if isInteractive {
                    HStack(spacing: 5) {
                        Text(totalCount > 0 ? "\(totalCount) picks" : "Browse")
                            .font(.system(size: 11, weight: .heavy))
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 10, weight: .heavy))
                    }
                    .foregroundStyle(agentColor)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(agentColor.opacity(0.14), in: Capsule())
                    .overlay(Capsule().strokeBorder(agentColor.opacity(0.35), lineWidth: 1))
                    .padding(.trailing, 18)
                    .padding(.bottom, 16)
                }
            }
            .padding(.horizontal, 8)
            .allowsHitTesting(false)
    }
}

// MARK: - Browse sheet (folder expanded)

/// The Mission-Log folder as a bottom sheet: opens at a small detent with the
/// folder at the bottom and the newest tickets stuffed in the top. Scrolling
/// pulls tickets up out of the folder rolodex-style; tapping one expands it into
/// the full pass. Filter by result / sport / sort from the floating glass pills.
struct PickHistorySheet: View {
    /// Picks + parlay tickets interleaved, newest first.
    let items: [AgentBetItem]
    var agentName: String = "Agent"
    var agentColor: Color = .appPrimary

    @Environment(\.dismiss) private var dismiss
    @Environment(\.horizontalSizeClass) private var hSize
    @Environment(\.verticalSizeClass) private var vSize
    private var wide: Bool { hSize == .regular && vSize == .compact }

    @State private var statusFilter: AgentPick.PickResultStatus? = nil
    @State private var sportFilter: AgentSport? = nil
    @State private var sortOrder: PickSort = .newest
    @State private var selected: AgentBetItem? = nil
    @State private var detent: PresentationDetent = .height(440)
    @State private var scrollPos = ScrollPosition(edge: .top)
    @State private var stackRevealed = false
    @State private var scrollNotch = 0
    @State private var auditStore = AgentPickAuditStore()

    private enum PickSort: String, CaseIterable {
        case newest = "Newest"
        case oldest = "Oldest"
        case units = "Most Units"
    }

    /// Visible height of the folder assembly at the bottom of the view.
    private static let folderZone: CGFloat = 230
    /// How far the unstack gesture fans the pile (scroll offset).
    private static let unstackScroll: CGFloat = 600

    /// Deterministic per-position jitter so the pile reads casually stuffed but
    /// never shifts between renders.
    private static let jitterX: [CGFloat] = [-8, 7, -4, 9, -6, 3]
    private static let jitterTilt: [Double] = [-1.6, 1.2, -0.7, 1.8, -1.1, 0.5]

    private var sportsAvailable: [AgentSport] {
        // A true multi-sport parlay has no single sport (sportForFilter == nil)
        // — it only surfaces under "All Sports", never a specific pill.
        var seen = Set<AgentSport>()
        return items.compactMap { item in
            guard let sport = item.sportForFilter else { return nil }
            return seen.insert(sport).inserted ? sport : nil
        }
    }

    private var filteredItems: [AgentBetItem] {
        let filtered = items
            .filter { statusFilter == nil || $0.result == statusFilter }
            .filter { sportFilter == nil || $0.sportForFilter == sportFilter }
        switch sortOrder {
        case .newest: return filtered.sorted { sortKey($0) > sortKey($1) }
        case .oldest: return filtered.sorted { sortKey($0) < sortKey($1) }
        case .units:  return filtered.sorted { $0.units > $1.units }
        }
    }

    private func sortKey(_ item: AgentBetItem) -> String { "\(item.gameDate)|\(item.createdAt)" }

    /// Fan the stack out: full-height sheet + the rolodex scrolled so a handful
    /// of tickets stand clear of the folder.
    private func unstack() {
        stackRevealed = true
        withAnimation(.spring(duration: 0.55)) {
            detent = .large
            scrollPos.scrollTo(y: Self.unstackScroll)
        }
    }

    var body: some View {
        Group {
            if wide { landscapeLog } else { portraitLog }
        }
        .presentationDetents(wide ? [.large] : [.height(440), .large], selection: $detent)
        .presentationDragIndicator(.visible)
        .presentationBackground(Color(hex: 0x0B1011))
        .preferredColorScheme(.dark)
        .onChange(of: detent) { _, newValue in
            guard !wide else { return }
            if newValue == .large && selected == nil && !stackRevealed {
                stackRevealed = true
                withAnimation(.spring(duration: 0.5)) {
                    scrollPos.scrollTo(y: Self.unstackScroll)
                }
            }
        }
        .sheet(isPresented: $auditStore.isPresented) {
            if let pick = auditStore.selectedPick {
                AgentPickPayloadAuditSheet(pick: pick, payload: auditStore.payload)
            }
        }
    }

    // MARK: - Background

    private var background: some View {
        ZStack {
            Color(hex: 0x0B1011)
            RadialGradient(
                colors: [agentColor.opacity(0.30), .clear],
                center: .top, startRadius: 0, endRadius: 420
            )
            .ignoresSafeArea()
        }
    }

    // MARK: - Portrait log — the folder rolodex

    private var portraitLog: some View {
        ZStack {
            background

            // Folder sandwich: tickets live BETWEEN the back flap (behind) and
            // the front panel (in front), so the stack visually slides in and
            // out of the folder.
            ZStack(alignment: .bottom) {
                folderBack
                if let selected {
                    ScrollView(showsIndicators: false) {
                        expandedTicket(for: selected)
                            .padding(.horizontal, 20)
                            .padding(.top, 64)   // rests below the floating bar
                            .padding(.bottom, Self.folderZone - 90)
                            .onTapGesture {
                                PickHaptics.tick()
                                withAnimation(.spring(duration: 0.4)) { self.selected = nil }
                            }
                    }
                    .defaultScrollAnchor(.bottom)
                    .transition(.scale(scale: 0.94).combined(with: .opacity))
                } else {
                    ticketStack
                }
                folderFront
            }
            .clipped()

            // The filter bar floats OVER the rolodex (glass pills).
            VStack {
                topBar
                    .padding(.horizontal, 16)
                    .padding(.top, 14)
                Spacer()
            }
        }
    }

    // MARK: - Landscape log — a grid of tickets (no rolodex)

    private var landscapeLog: some View {
        ZStack {
            background
            VStack(spacing: 0) {
                topBar
                    .padding(.horizontal, 16)
                    .padding(.top, 12)

                if let selected {
                    ScrollView(showsIndicators: false) {
                        expandedTicket(for: selected)
                            .frame(maxWidth: 460)
                            .frame(maxWidth: .infinity)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 16)
                            .onTapGesture {
                                PickHaptics.tick()
                                withAnimation(.spring(duration: 0.4)) { self.selected = nil }
                            }
                    }
                } else if filteredItems.isEmpty {
                    emptyState
                } else {
                    ScrollView(showsIndicators: false) {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 16)], spacing: 16) {
                            ForEach(filteredItems) { item in
                                BetItemTicket(item: item, accent: agentColor)
                                    .onTapGesture {
                                        PickHaptics.select()
                                        withAnimation(.spring(duration: 0.4)) { selected = item }
                                    }
                            }
                        }
                        .padding(16)
                    }
                }
            }
        }
    }

    // MARK: - Top bar (back + filters / back + audit)

    @ViewBuilder
    private var topBar: some View {
        HStack(spacing: 10) {
            Button {
                PickHaptics.tick()
                if selected != nil {
                    withAnimation(.spring(duration: 0.4)) { selected = nil }
                } else {
                    dismiss()
                }
            } label: {
                Image(systemName: selected == nil ? "xmark" : "chevron.left")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .frame(width: 38, height: 38)
                    .liquidGlassBackground(in: Circle())
            }
            .accessibilityLabel(selected == nil ? "Close" : "Back to pick history")

            if selected == nil {
                statusMenu
                sportMenu
                sortMenu
                Spacer(minLength: 0)
            } else {
                Spacer()
            }
        }
    }

    private var statusMenu: some View {
        Menu {
            Picker("Result", selection: $statusFilter) {
                Text("All Results").tag(AgentPick.PickResultStatus?.none)
                Text("Wins").tag(AgentPick.PickResultStatus?.some(.won))
                Text("Losses").tag(AgentPick.PickResultStatus?.some(.lost))
                Text("Pushes").tag(AgentPick.PickResultStatus?.some(.push))
            }
        } label: {
            filterPill(text: statusFilter.map(Self.statusName) ?? "Result",
                       isActive: statusFilter != nil,
                       tint: statusFilter.map(Self.statusColor) ?? agentColor)
        }
        .onChange(of: statusFilter) { _, _ in PickHaptics.tick() }
    }

    private var sportMenu: some View {
        Menu {
            Picker("Sport", selection: $sportFilter) {
                Text("All Sports").tag(AgentSport?.none)
                ForEach(sportsAvailable, id: \.self) { sport in
                    Text(sport.label).tag(AgentSport?.some(sport))
                }
            }
        } label: {
            filterPill(text: sportFilter?.label ?? "Sport",
                       isActive: sportFilter != nil,
                       tint: agentColor)
        }
        .onChange(of: sportFilter) { _, _ in PickHaptics.tick() }
    }

    private var sortMenu: some View {
        Menu {
            Picker("Sort By", selection: $sortOrder) {
                ForEach(PickSort.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
        } label: {
            filterPill(text: sortOrder == .newest ? "Sort By" : sortOrder.rawValue,
                       isActive: sortOrder != .newest,
                       tint: agentColor)
        }
        .onChange(of: sortOrder) { _, _ in PickHaptics.tick() }
    }

    private func filterPill(text: String, isActive: Bool, tint: Color) -> some View {
        HStack(spacing: 6) {
            Text(text)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(isActive ? tint : Color.appTextSecondary)
                .lineLimit(1)
            Image(systemName: "chevron.down")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color.appTextSecondary)
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 38)
        .liquidGlassBackground(in: Capsule())
        .overlay {
            if isActive {
                Capsule().strokeBorder(tint.opacity(0.5), lineWidth: 1)
            }
        }
        .contentShape(Capsule())
    }

    private static func statusName(_ r: AgentPick.PickResultStatus) -> String {
        switch r {
        case .won: return "Wins"
        case .lost: return "Losses"
        case .push: return "Pushes"
        case .pending: return "Pending"
        }
    }

    private static func statusColor(_ r: AgentPick.PickResultStatus) -> Color {
        switch r {
        case .won: return .appWin
        case .lost: return .appLoss
        case .push: return .appPending
        case .pending: return .appTextSecondary
        }
    }

    // MARK: - Ticket stack (rolodex)

    private var ticketStack: some View {
        GeometryReader { geo in
            ScrollView(showsIndicators: false) {
                if filteredItems.isEmpty {
                    emptyState
                        .padding(.top, max(16, geo.size.height - 320))
                } else {
                    // Negative spacing fans the pile (SwiftUI draws later
                    // siblings on top). Each ticket gets a small deterministic
                    // x-offset + tilt so the pile reads hand-stuffed. Parlay
                    // tickets are taller than picks; the negative spacing +
                    // per-ticket visualEffect are both position-driven, so a
                    // mixed-height pile just shows more of the taller tickets.
                    VStack(spacing: -122) {
                        ForEach(Array(filteredItems.enumerated()), id: \.element.id) { index, item in
                            BetItemTicket(item: item, accent: agentColor)
                                .offset(x: Self.jitterX[index % Self.jitterX.count])
                                .rotationEffect(.degrees(Self.jitterTilt[index % Self.jitterTilt.count]))
                                .onTapGesture {
                                    PickHaptics.select()
                                    if detent != .large {
                                        unstack()
                                    } else {
                                        withAnimation(.spring(duration: 0.45)) { selected = item }
                                    }
                                }
                                // Wallet physics, all position-driven: tickets
                                // near the folder mouth get squashed back into
                                // it (the "stuffed" rest state) and pull out to
                                // full size as you scroll them up; tickets
                                // reaching the TOP fade out like a rolodex.
                                .visualEffect { content, proxy in
                                    let container = proxy.bounds(of: .scrollView)?.height ?? 800
                                    let y = proxy.frame(in: .scrollView).minY
                                    let mouth = container - 236     // folder front's top edge
                                    let zoneTop = mouth - 130       // squash zone begins here
                                    let into: CGFloat = max(0, y - zoneTop)
                                    let residual: CGFloat = min(into * 0.18, 200)
                                    let lift: CGFloat = into - residual
                                    let buried: Double = Double(min(1, max(0, 1 - (residual - 150) / 45)))
                                    let topFade: Double = Double(min(1, max(0, (y - 8) / 56)))
                                    let scale: CGFloat = 0.92 + 0.08 * CGFloat(topFade)
                                    return content
                                        .offset(y: -lift)
                                        .scaleEffect(scale, anchor: .bottom)
                                        .opacity(topFade * buried)
                                }
                        }
                    }
                    .padding(.horizontal, 28)
                    .padding(.top, max(16, geo.size.height - 366))
                }
                Color.clear.frame(height: 430)
            }
            .scrollPosition($scrollPos)
            .onAppear {
                if stackRevealed {
                    scrollPos.scrollTo(y: Self.unstackScroll)
                }
            }
            .onTapGesture {
                if detent != .large {
                    PickHaptics.tick()
                    unstack()
                }
            }
            // Rolodex feedback: a soft tick every ~64 pt of travel.
            .onScrollGeometryChange(for: CGFloat.self, of: { $0.contentOffset.y }) { _, offset in
                let notch = Int((offset / 64).rounded())
                if notch != scrollNotch {
                    scrollNotch = notch
                    PickHaptics.tick()
                }
            }
        }
        .animation(.smooth(duration: 0.3), value: statusFilter)
        .animation(.smooth(duration: 0.3), value: sportFilter)
        .animation(.smooth(duration: 0.3), value: sortOrder)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: items.isEmpty ? "tray" : "line.3.horizontal.decrease.circle")
                .font(.system(size: 30, weight: .light))
                .foregroundStyle(Color.appTextSecondary)
            Text(items.isEmpty ? "No graded picks yet" : "Nothing matches")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            Text(items.isEmpty
                 ? "Picks appear here once they're graded."
                 : "No picks match these filters.")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(24)
    }

    /// The expanded pass for either item shape. Parlays skip the audit button —
    /// the pick audit sheet resolves by avatar_picks id.
    @ViewBuilder
    private func expandedTicket(for item: AgentBetItem) -> some View {
        switch item {
        case .pick(let pick):
            ExpandedAgentPickTicket(pick: pick, accent: agentColor,
                                    onAudit: { auditStore.present(pick: pick) })
        case .parlay(let parlay):
            ExpandedAgentParlayTicket(parlay: parlay, accent: agentColor)
        }
    }

    // MARK: - Folder shell

    private var folderBack: some View {
        PickFolderTabShape()
            .fill(LinearGradient(colors: [Color(hex: 0x151A25), Color(hex: 0x0C0F17)],
                                 startPoint: .top, endPoint: .bottom))
            .frame(height: 232)
            .padding(.horizontal, 12)
            .padding(.bottom, 42)
            .allowsHitTesting(false)
    }

    private var folderFront: some View {
        Color.clear
            .frame(height: 234)
            .folderGlass(in: PickFolderFrontShape())
            .overlay(
                PickFolderFrontShape()
                    .stroke(.white.opacity(0.08), lineWidth: 1)
            )
            .overlay(alignment: .bottomLeading) {
                Text("PICK HISTORY")
                    .font(.system(size: 28, weight: .heavy, design: .rounded))
                    .tracking(4)
                    .foregroundStyle(.white.opacity(0.10))
                    .shadow(color: .black.opacity(0.5), radius: 0.5, y: -1)
                    .padding(.leading, 22)
                    .padding(.bottom, 20)
            }
            .padding(.horizontal, 12)
            .contentShape(Rectangle())
            .onTapGesture {
                PickHaptics.tick()
                if selected != nil {
                    withAnimation(.spring(duration: 0.4)) { selected = nil }
                } else if detent != .large {
                    unstack()
                } else {
                    dismiss()
                }
            }
            .accessibilityLabel("Pick history folder")
            .accessibilityHint("Tap to close")
    }
}

// MARK: - Folder glass

private extension View {
    /// Liquid Glass clipped to a plain (non-insettable) `Shape`. The folder
    /// panels use bespoke `Shape`s, which the shared `liquidGlassBackground(in:)`
    /// can't take (it constrains to `InsettableShape`); `glassEffect`/material
    /// only need `some Shape`.
    @ViewBuilder
    func folderGlass<S: Shape>(in shape: S) -> some View {
        if #available(iOS 26.0, *) {
            self.glassEffect(.regular, in: shape)
        } else {
            self.background(.ultraThinMaterial, in: shape)
        }
    }
}

// MARK: - Haptics

/// Imperative haptics for the rolodex (tap + scroll-notch ticks). The rest of
/// the app uses `.sensoryFeedback`, but scroll-driven notch feedback needs an
/// imperative generator, so this folder keeps its own.
enum PickHaptics {
    static func tick() {
        let g = UIImpactFeedbackGenerator(style: .light)
        g.impactOccurred()
    }
    static func select() {
        let g = UIImpactFeedbackGenerator(style: .medium)
        g.impactOccurred()
    }
}
