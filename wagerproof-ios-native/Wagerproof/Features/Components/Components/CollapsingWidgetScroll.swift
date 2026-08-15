import SwiftUI
import WagerproofDesign

/// iOS Weather–style collapsing scroll shell (PROTOTYPE — wired to MLB first).
///
/// Two pieces of choreography the plain-`List` `PinnedWidgetScroll` can't do:
///   1. A **hero** that starts tall and shrinks into a compact bar as you
///      scroll. The hero builder receives a `progress` (0 = fully expanded,
///      1 = fully collapsed) so it can cross-fade a large layout into a compact
///      one. The hero is an opaque top overlay, so anything scrolling above the
///      pin line is hidden behind it.
///   2. `WidgetCollapsingSection` cards whose header pins at the pin line while
///      the body scrolls up *under* it, the card keeps its rounded corners, and
///      at full collapse the header **fades out** as the next card's header
///      arrives — the Weather cross-fade handoff (vs `List`'s hard push-off).
///
/// All geometry is driven off the scroll offset read via the named coordinate
/// space, so behaviour is deterministic and tunable via the constants below.
/// iOS 18+.
private let kCollapsingScrollSpace = "collapsingWidgetScroll"

struct CollapsingWidgetScroll<Background: View, Hero: View, Content: View>: View {
    var heroMaxHeight: CGFloat = 230
    var heroMinHeight: CGFloat = 60
    /// When true, the page and hero draw no full-bleed base of their own. Used
    /// in carousel mode, where one shared base + glow lives behind every swiping
    /// page. The scroll content is alpha-masked below the hero instead of using
    /// a second, page-colored hero background, so adjacent matchups cannot form
    /// a hard aura boundary during a swipe.
    var transparentPage: Bool = false
    /// Top inset for the HERO CONTENT (not its background). Used in carousel mode,
    /// where the page bleeds under a transparent nav bar: the aura/glow fills the
    /// status-bar + nav-bar area, but the hero's date/logos must start below it so
    /// they don't clip behind the back button. The background still bleeds to the
    /// very top regardless of this inset.
    var heroTopInset: CGFloat = 0
    /// Bottom padding added past the scroll content so the last widget clears a
    /// floating bottom bar (the carousel's matchup strip) + the home indicator.
    var contentBottomInset: CGFloat = 0
    /// Game-detail pages disable Liquid Glass because MLB can keep ~11 cards
    /// resident at once, with two pages visible mid-swipe. Other surfaces that
    /// reuse this shell retain their existing glass treatment by default.
    var usesLiquidGlass: Bool = true
    /// Extra chrome pinned under the collapsing hero (a market picker, etc.).
    /// Included in content top-padding and the widget pin line. The caller
    /// overlays the accessory and parks it at `max(heroTopInset, heroBottom)`
    /// so it never slides under the nav-bar back button.
    var pinAccessoryHeight: CGFloat = 0
    /// Live bottom of the collapsing hero (content height + current top inset).
    /// Written on scroll so a pin-accessory overlay can track it.
    var heroBottom: Binding<CGFloat>? = nil
    /// When set, the collapsed hero uses this top inset instead of
    /// `0.35 * heroTopInset`. Prop pages pass a value that clears the
    /// status bar so the docked title isn't jammed into the Dynamic Island.
    var dockedTopInsetOverride: CGFloat? = nil
    /// Fires when the user actually scrolls (not 1–2pt layout jitter).
    /// Prop detail uses this to ease the expanded line pill closed.
    var onUserScroll: (() -> Void)? = nil
    /// Full-bleed background behind both the page and the hero (e.g. team-color
    /// auras). Receives `progress` so it can dim/shrink with scroll. Used as the
    /// hero's background too, so the hero stays opaque (masks scrolling content)
    /// while still showing the glow.
    @ViewBuilder var background: (_ progress: CGFloat) -> Background
    /// Builds the hero. `progress`: 0 = expanded (top), 1 = collapsed.
    @ViewBuilder var hero: (_ progress: CGFloat) -> Hero
    @ViewBuilder var content: Content

    @State private var scrollY: CGFloat = 0

    /// Compact matchup docks into the nav-bar row beside the back button.
    /// Keep a small pad so discs don't slide under the Dynamic Island.
    private var dockedTopInset: CGFloat { dockedTopInsetOverride ?? max(8, heroTopInset * 0.35) }
    private var expandedChrome: CGFloat { heroMaxHeight + pinAccessoryHeight + heroTopInset }
    private var collapsedChrome: CGFloat { heroMinHeight + dockedTopInset }
    private var collapseDistance: CGFloat { max(1, expandedChrome - collapsedChrome) }
    private var progress: CGFloat { min(1, max(0, scrollY / collapseDistance)) }
    private var heroHeight: CGFloat {
        heroMaxHeight - (heroMaxHeight - heroMinHeight) * progress
    }
    private var effectiveTopInset: CGFloat {
        heroTopInset - (heroTopInset - dockedTopInset) * progress
    }
    private var liveHeroBottom: CGFloat { heroHeight + effectiveTopInset }
    /// Accessory parks under the nav bar (`heroTopInset`) once the shrinking
    /// hero would otherwise drag it into the back-button row.
    private var pinLine: CGFloat {
        guard pinAccessoryHeight > 0 else { return heroMinHeight + effectiveTopInset }
        return max(heroTopInset, liveHeroBottom) + pinAccessoryHeight
    }

    private func reportHeroBottom() {
        guard let heroBottom else { return }
        let bottom = liveHeroBottom
        if abs(heroBottom.wrappedValue - bottom) > 0.5 {
            heroBottom.wrappedValue = bottom
        }
    }

    var body: some View {
        ScrollView {
            // Lazy: a detail page stacks 7-11 widget cards, each with its own
            // glass surface and (for gated ones) a material overlay. Eagerly
            // building the whole stack on open was a large slice of the sheet's
            // first-frame cost. A card is fully faded out by the time its natural
            // layout box leaves the viewport, so lazy disposal is never visible.
            LazyVStack(spacing: 0) {
                content
                Color.clear.frame(height: 48 + contentBottomInset)
            }
            // Content begins below the fully-expanded hero (content height +
            // its top inset) PLUS a gap, so the first card sits a hair below the
            // hero. The gap stays constant through the collapse (both move with
            // scroll), so the card can't peek above the hero's masking edge if
            // the scroll-driven hero height lags layout by a frame. The gap
            // closes naturally right as the card reaches the pin line.
            .padding(.top, expandedChrome + WidgetCard.gap)
        }
        // The hero used to hide scrolling content with its own opaque copy of
        // the matchup aura. In a paging carousel those copies travel with their
        // pages and meet at a sharp vertical edge mid-swipe. Keep the content
        // masking behavior, but perform it as an alpha mask so the single fixed
        // carousel aura remains visible through both pages and their heroes.
        .mask(alignment: .top) {
            VStack(spacing: 0) {
                if transparentPage {
                    Color.clear
                        .frame(height: heroHeight + effectiveTopInset)
                }
                Rectangle()
                    .fill(Color.white)
            }
        }
        // iOS 26 adds an automatic shade where scrolling content meets the top
        // edge. The hero already provides its own opaque content mask, so that
        // extra system treatment becomes a visible dark band during collapse.
        .modifier(HideTopScrollEdgeEffect())
        // Reliable scroll-offset read (iOS 18+). `contentOffset.y` is negative
        // by the top content inset at rest, so adding the inset normalizes the
        // top to 0 and it grows as you scroll down.
        .onScrollGeometryChange(for: CGFloat.self) { geo in
            geo.contentOffset.y + geo.contentInsets.top
        } action: { oldValue, newValue in
            // Clamp + quantize BEFORE writing @State. `progress` is the only
            // consumer and it saturates at both ends, so every offset outside
            // [0, collapseDistance] renders identically — yet a raw write re-ran
            // the whole page body (hero morph + every card) on all 120 frames a
            // second. Clamping means scrolling deep in the list, or rubber-
            // banding at the top, costs nothing at all.
            let clamped = min(max(0, newValue), collapseDistance)
            if abs(scrollY - clamped) > 0.5 { scrollY = clamped }
            reportHeroBottom()
            // Unclamped delta — the hero offset saturates, but the user can
            // still be scrolling the widget list after the title has docked.
            if abs(newValue - oldValue) > 8 {
                onUserScroll?()
            }
        }
        .onAppear { reportHeroBottom() }
        // Named space lets each card read its live viewport position.
        .coordinateSpace(name: kCollapsingScrollSpace)
        // Cards pin just under the compact hero (which docks into the toolbar),
        // or under the pin-accessory when one is present.
        .environment(\.widgetPinLine, pinLine)
        .environment(\.widgetUsesLiquidGlass, usesLiquidGlass)
        .background(alignment: .top) {
            // In carousel mode the page is transparent — the shared base + glow
            // sit behind the swiping pages, so the safe-area bands stay filled.
            if !transparentPage {
                background(progress)
                    .ignoresSafeArea()
            }
        }
        .overlay(alignment: .top) {
            hero(progress)
                .frame(height: heroHeight, alignment: .top)
                .frame(maxWidth: .infinity)
                .clipped()
                // Push the hero CONTENT below the (transparent) nav/status bar so
                // the date row doesn't clip behind the back button, while the
                // background below still bleeds all the way up.
                .padding(.top, effectiveTopInset)
                .frame(height: heroHeight + effectiveTopInset, alignment: .top)
                // Standalone pages still use their aura as the hero's opaque
                // content mask. Carousel pages intentionally omit this copy:
                // the ScrollView alpha mask above handles clipping, while the
                // one fixed carousel aura shows continuously through the hero.
                .background {
                    if !transparentPage {
                        background(progress)
                            .ignoresSafeArea(.container, edges: .top)
                            // CLIP to the hero band. The aura's glows are
                            // positioned in GLOBAL coordinates and otherwise
                            // spill below the masking surface.
                            .clipped()
                    }
                }
        }
    }
}

private struct HideTopScrollEdgeEffect: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.scrollEdgeEffectHidden(for: .top)
        } else {
            content
        }
    }
}

/// Team-color "aurora" glows that bleed in from the left and right screen edges
/// (away color left, home color right), wide and soft, and STATIC — no idle
/// wobble (user call: the background shouldn't oscillate). Dims and shrinks as
/// `progress` (0 = expanded … 1 = collapsed) increases. The `appSurface` base
/// is opaque so this can double as the hero's masking bg.
///
/// Glow positions are anchored in GLOBAL screen coordinates so the page
/// instance and the hero instance line up seamlessly.
struct TeamAuraBackground: View {
    var awayColor: Color
    var homeColor: Color
    var progress: CGFloat
    /// When true, paints an opaque `appSurface` base (use as a page/hero
    /// background). When false, renders only the glows (use as a fixed additive
    /// overlay so the same glow can be shared across a swiping carousel).
    var showBase: Bool = true

    /// Absolute Y (from the top of the screen) the glows center on.
    private let anchorY: CGFloat = 210
    /// Glow radius as a fraction of the screen width. Was a hard-coded 300pt
    /// box, which showed the same absolute sliver of glow on a 6.9" phone as on
    /// an iPad; 0.48 reproduces the phone look and scales with the device.
    private let radiusFraction: CGFloat = 0.48
    private let blurRadius: CGFloat = 48

    var body: some View {
        let p = min(1, max(0, progress))
        // Dim + shrink WITH the logo as it collapses, but keep a baseline glow
        // (never fades all the way out).
        let intensity = Double(1 - 0.45 * p)   // 1.0 → 0.55
        let shrink = 1 - 0.30 * p              // 1.0 → 0.70

        ZStack {
            if showBase { Color.appSurface }
            GeometryReader { geo in
                let g = geo.frame(in: .global)
                let yLocal = anchorY - g.minY
                let radius = geo.size.width * radiusFraction
                ZStack {
                    // `.drawingGroup()` goes on the BLOB, inside the progress-driven
                    // scale/opacity — not around them. A drawingGroup re-rasterizes
                    // whenever its subtree changes, so wrapping the scaled+faded
                    // stack meant re-running both `blur(radius: 48)` passes on every
                    // scroll frame. The blob itself only depends on its color and the
                    // screen width, so cached here it rasterizes once and the collapse
                    // animates as cheap GPU transforms on the resulting texture.
                    blob(awayColor, radius: radius)
                        .drawingGroup()
                        .scaleEffect(shrink)
                        .position(x: 0, y: yLocal)
                    blob(homeColor, radius: radius)
                        .drawingGroup()
                        .scaleEffect(shrink)
                        .position(x: geo.size.width, y: yLocal)
                }
                .opacity(intensity)
            }
        }
    }

    private func blob(_ color: Color, radius: CGFloat) -> some View {
        // The gradient must reach zero alpha exactly AT the shape's rim. This was
        // a 300x580 Ellipse filled with a radial gradient whose endRadius (186)
        // overshot the ellipse's half-width (150), so the fill was still ~16%
        // opaque where the shape cut it — a hard edge down each side of the glow.
        // A circle sized to the gradient's own reach has nothing left to clip.
        Circle()
            .fill(
                RadialGradient(
                    colors: [color.opacity(0.85), color.opacity(0.0)],
                    center: .center,
                    startRadius: 0,
                    endRadius: radius
                )
            )
            .frame(width: radius * 2, height: radius * 2)
            .blur(radius: blurRadius)
            // Padding sits INSIDE the caller's `.drawingGroup()` so the raster
            // bounds include the blur halo. A drawingGroup crops to its view's
            // bounds, which turned the soft falloff into a hard rectangle.
            .padding(blurRadius)
    }
}

/// Pin line (distance from the top of the scroll viewport at which a card's
/// header sticks). Injected by `CollapsingWidgetScroll`.
private struct WidgetPinLineKey: EnvironmentKey {
    static let defaultValue: CGFloat = 0
}
extension EnvironmentValues {
    var widgetPinLine: CGFloat {
        get { self[WidgetPinLineKey.self] }
        set { self[WidgetPinLineKey.self] = newValue }
    }
}

/// False while this page is a resident-but-not-selected page of a carousel.
///
/// A paging `TabView` keeps neighbouring pages built, so a detail page's ~15-19
/// live backdrop blurs are being composited even when the page is off screen —
/// two visible pages mid-swipe put ~30-38 concurrent blurs on the GPU, well past
/// what an A16 sustains at 120Hz. Non-current pages fall back to a flat fill and
/// are promoted back to real glass once `selection` settles. Defaults to `true`
/// so standalone (non-carousel) pages are unaffected.
private struct WidgetPageIsCurrentKey: EnvironmentKey {
    static let defaultValue: Bool = true
}
extension EnvironmentValues {
    var widgetPageIsCurrent: Bool {
        get { self[WidgetPageIsCurrentKey.self] }
        set { self[WidgetPageIsCurrentKey.self] = newValue }
    }
}

private struct WidgetUsesLiquidGlassKey: EnvironmentKey {
    static let defaultValue: Bool = true
}
extension EnvironmentValues {
    var widgetUsesLiquidGlass: Bool {
        get { self[WidgetUsesLiquidGlassKey.self] }
        set { self[WidgetUsesLiquidGlassKey.self] = newValue }
    }
}

/// A widget card for `CollapsingWidgetScroll`. Header pins, body collapses under
/// it, header fades out at full collapse. Reuses `WidgetHeaderAccessory` /
/// `WidgetCard` from `PinnedWidgetScroll.swift`.
struct WidgetCollapsingSection<Content: View>: View {
    let title: String
    let systemImage: String
    var iconTint: Color = .appPrimary
    var icon: AnyView? = nil
    var showsHeader: Bool = true
    var accessory: WidgetHeaderAccessory = .none
    var onHeaderTap: (() -> Void)? = nil
    /// Plain-language answer to the widget's question. It lives in the body so
    /// it can wrap without changing the fixed pinned-header geometry.
    var headline: String? = nil
    var bodyPadding: CGFloat = 16
    /// When this value changes the card remeasures its natural height. Use when
    /// section content shrinks (e.g. loading skeleton → empty state) so the
    /// collapsing scroll shell does not keep a stale tall layout box.
    var contentKey: String = ""
    @ViewBuilder var content: Content

    @Environment(\.widgetPinLine) private var pinLine
    @Environment(\.widgetPageIsCurrent) private var pageIsCurrent
    @Environment(\.widgetUsesLiquidGlass) private var usesLiquidGlass
    /// Live top position of the card's NATURAL layout box (unaffected by the
    /// visual collapse, which uses offset/clip only).
    @State private var minY: CGFloat = 0
    /// Cached natural (uncollapsed) height. Measured whenever the card is at
    /// full size so the collapse math has a stable reference.
    @State private var naturalHeight: CGFloat = 0
    @State private var lastContentKey: String = ""
    /// True once this card's top has reached the pin line, i.e. it has become the
    /// section at the top of the page. Drives the light per-section haptic tick.
    @State private var isPinned = false

    /// Fixed header band height (icon/title row + vertical padding).
    private var headerHeight: CGFloat { showsHeader ? 48 : 0 }
    /// Distance the pill fades out over, in place, once fully collapsed.
    private let fadeRange: CGFloat = 44

    init(
        title: String,
        systemImage: String,
        iconTint: Color = .appPrimary,
        icon: AnyView? = nil,
        showsHeader: Bool = true,
        accessory: WidgetHeaderAccessory = .none,
        onHeaderTap: (() -> Void)? = nil,
        headline: String? = nil,
        bodyPadding: CGFloat = 16,
        contentKey: String = "",
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.systemImage = systemImage
        self.iconTint = iconTint
        self.icon = icon
        self.showsHeader = showsHeader
        self.accessory = accessory
        self.onHeaderTap = onHeaderTap
        self.headline = headline
        self.bodyPadding = bodyPadding
        self.contentKey = contentKey
        self.content = content()
    }

    var body: some View {
        if !showsHeader {
            // Headerless cards (NFL/CFB pick rows render their own title inside
            // the body). Skip pin/collapse — with headerHeight=0 the collapse
            // math shrinks the card to zero height as soon as it sits below the
            // hero pin line, which made game detail pages look blank.
            cardVisual(collapse: 0, visualHeight: nil)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, WidgetCard.hInset)
                .padding(.bottom, WidgetCard.gap)
        } else {
            collapsingBody
        }
    }

    @ViewBuilder
    private var collapsingBody: some View {
        let H = naturalHeight
        // How far the card's natural top has scrolled past the pin line.
        let over = max(0, pinLine - minY)
        let maxCollapse = max(0, H - headerHeight)
        // The card pins its top at the line and REDUCES IN HEIGHT (body collapses
        // up under its header) — all 4 sides visible — until it's a header-height
        // pill. Then it FADES OUT IN PLACE (still pinned, never sliding under the
        // hero) as the next card arrives. The body is clipped under the header so
        // the fade only ever shows the header + glass, never scrolling content.
        let collapse = min(over, maxCollapse)
        let collapsing = over > 0 && H > 0
        let visualHeight: CGFloat? = collapsing ? max(headerHeight, H - collapse) : nil
        let opacity: Double = over <= maxCollapse
            ? 1
            : Double(max(0, 1 - (over - maxCollapse) / fadeRange))

        cardVisual(collapse: collapse, visualHeight: visualHeight)
            // Reserve the natural height in layout while collapsing so the next
            // card scrolls up normally; the pill is drawn within this box.
            .frame(height: collapsing ? H : nil, alignment: .top)
            // Pin the top at the line the whole time (it fades, never slides).
            .offset(y: collapsing ? over : 0)
            .opacity(opacity)
            .frame(maxWidth: .infinity)
            // `onGeometryChange` rather than a GeometryReader in a `.background`:
            // it reads the frame without inserting a reader (and a Color.clear,
            // and two lifecycle modifiers) into every card's layout.
            .onGeometryChange(for: CGRect.self) { proxy in
                proxy.frame(in: .named(kCollapsingScrollSpace))
            } action: { frame in
                measure(frame)
            }
            .padding(.horizontal, WidgetCard.hInset)
            .padding(.bottom, WidgetCard.gap)
            // The pinned/collapsing card draws above the next one during handoff.
            .zIndex(collapsing ? 1 : 0)
            .onChange(of: contentKey) { _, newKey in
                if newKey != lastContentKey {
                    naturalHeight = 0
                    lastContentKey = newKey
                }
            }
            .onAppear {
                if lastContentKey != contentKey {
                    naturalHeight = 0
                    lastContentKey = contentKey
                }
            }
            // Light tick as this section reaches (or releases) the top of the
            // page. `.sensoryFeedback` ignores the initial value, and content
            // starts well below the pin line, so opening a page is silent.
            .sensoryFeedback(.impact(weight: .light), trigger: isPinned)
    }

    private func measure(_ f: CGRect) {
        // Below the pin line the card never collapses — `over` clamps to 0, so
        // every minY > pinLine renders identically. Clamping to a single sentinel
        // there means a card only writes @State (and re-runs its body) once it
        // actually reaches the pin line, instead of on every scroll frame. With
        // 7-11 cards a page that was the bulk of the per-frame invalidation.
        let tracked = f.minY > pinLine ? pinLine + 1 : f.minY
        if abs(minY - tracked) > 0.5 { minY = tracked }
        // Section-boundary tick. Asymmetric thresholds (reach the line to pin,
        // clear it by 6pt to unpin) so a card resting exactly on the pin line
        // can't flutter the state — and the haptic — every frame. Only one card
        // transitions per boundary: the outgoing section stays pinned as it
        // fades, so a scroll produces exactly one tick per section crossed.
        let pinnedNow = isPinned ? f.minY <= pinLine + 6 : f.minY <= pinLine
        if pinnedNow != isPinned { isPinned = pinnedNow }
        // Cache the natural height only while the card is at full size (not
        // pinned), so the collapse reference stays correct even if the content
        // height changes (e.g. an expandable projection).
        let over = max(0, pinLine - f.minY)
        if (over <= 0 && abs(naturalHeight - f.height) > 0.5) || naturalHeight == 0 {
            naturalHeight = f.height
        }
    }

    /// The glass card, clipped to `visualHeight` (the shrinking pill). The body
    /// lives in a window BELOW the header and is clipped there, so it's never
    /// drawn behind the header — the header band only ever shows the glass
    /// (transparent to the aura behind the page, but with no body content
    /// peeking through it). The body slides up and is cut off at the header's
    /// bottom edge as the card collapses; all four rounded sides stay visible.
    /// On iOS 26 it's native Liquid Glass, with an `ultraThinMaterial` fallback.
    @ViewBuilder
    private func cardVisual(collapse: CGFloat, visualHeight: CGFloat?) -> some View {
        let cardShape = RoundedRectangle(cornerRadius: WidgetCard.corner, style: .continuous)
        // Only constrain the body window WHILE collapsing — otherwise the body
        // renders at full natural height so the card measures correctly (a
        // window tied to the measured height would collapse to zero and stick).
        let collapsing = visualHeight != nil
        let bodyWindow: CGFloat? = collapsing ? max(0, (visualHeight ?? headerHeight) - headerHeight) : nil

        let stack = VStack(spacing: 0) {
            // Header band — reserved; nothing of the body is ever behind it.
            if showsHeader {
                Color.clear.frame(height: headerHeight)
            }
            // Body window — clips the body so it disappears at the header's
            // bottom edge as it slides up, and never renders behind the header.
            VStack(alignment: .leading, spacing: headline == nil ? 0 : 14) {
                if let headline, !headline.isEmpty {
                    Text(headline)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityLabel("Summary: \(headline)")
                }
                content
            }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(bodyPadding)
                // Preserve every chart's natural drawing size throughout the
                // container handoff. The card still collapses and the body
                // still slides under its pinned header, but the plot is clipped
                // rather than receiving a progressively shorter layout proposal.
                .fixedSize(horizontal: false, vertical: true)
                .offset(y: -collapse)
                .frame(height: bodyWindow, alignment: .top)
                .clipped()
        }
        .frame(height: visualHeight, alignment: .top)

        // Two cases swap the live backdrop blur for a static fill:
        //  - the card is a fully collapsed 48pt pill mid-fade — at that size and
        //    opacity the glass refraction is not resolvable, so the fill reads
        //    identically for a fraction of the cost;
        //  - the page isn't the carousel's current page, so nobody is looking at
        //    it closely enough to notice during the ~300ms paging animation.
        let fullyCollapsed = collapsing && (visualHeight ?? headerHeight) <= headerHeight + 0.5
        let useFlatFill = !usesLiquidGlass || fullyCollapsed || !pageIsCurrent

        ZStack(alignment: .top) {
            stack
            if showsHeader {
                headerButton
                    .frame(height: headerHeight)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .zIndex(1)
            }
        }
        .clipShape(cardShape)
        // The swap lives INSIDE `.background`, not as an if/else around the
        // card: a conditional wrapping the card itself would give it a new
        // structural identity and tear down every widget's state at the exact
        // moment it collapses.
        .background {
            if useFlatFill {
                cardShape.fill(Color.appSurfaceElevated.opacity(0.55))
            } else {
                Color.clear.liquidGlassBackground(in: cardShape)
            }
        }
    }

    /// Tappable header row — no background of its own; the glass comes from the
    /// card surface so the title reads as part of the same Liquid Glass.
    @ViewBuilder
    private var headerButton: some View {
        if let onHeaderTap {
            Button {
                withAnimation(.appQuick) { onHeaderTap() }
            } label: { headerRow }
            .buttonStyle(.plain)
        } else {
            headerRow
        }
    }

    /// iOS section-header style: translucent, uppercase, no pill behind it.
    private var headerRow: some View {
        HStack(spacing: 8) {
            if let icon {
                icon
            } else {
                Image(systemName: systemImage)
                    .font(.system(size: 13, weight: .semibold))
                    // Match the title color (translucent secondary) so icon + label
                    // read as one iOS-style section header.
                    .foregroundStyle(Color.appTextSecondary)
            }
            Text(title.uppercased())
                .font(.system(size: 13, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Color.appTextSecondary)
            Spacer(minLength: 8)
            accessoryView
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var accessoryView: some View {
        switch accessory {
        case .none:
            EmptyView()
        case let .tapHint(expanded, expandedLabel):
            HStack(spacing: 4) {
                Image(systemName: "info.circle")
                    .font(.system(size: 13))
                Text(expanded ? "Less" : expandedLabel)
                    .font(.system(size: 11, weight: .medium))
            }
            .foregroundStyle(Color.appTextSecondary)
        case let .chevron(expanded):
            Image(systemName: expanded ? "chevron.up" : "chevron.down")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
        case let .verdict(text, tintHex):
            WidgetVerdictAccessoryBadge(text: text, tintHex: tintHex)
        }
    }
}
