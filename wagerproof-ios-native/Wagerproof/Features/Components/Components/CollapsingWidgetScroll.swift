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
    /// When true, the page draws no full-bleed base of its own — only the hero
    /// keeps its (opaque) masking background. Used in carousel mode, where a
    /// single shared base + glow lives behind the swiping pages, so each page
    /// must be transparent (otherwise the page's own surface, inset by the
    /// paging `TabView`'s safe area, leaves visible bands at the screen edges).
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
    /// Full-bleed background behind both the page and the hero (e.g. team-color
    /// auras). Receives `progress` so it can dim/shrink with scroll. Used as the
    /// hero's background too, so the hero stays opaque (masks scrolling content)
    /// while still showing the glow.
    @ViewBuilder var background: (_ progress: CGFloat) -> Background
    /// Builds the hero. `progress`: 0 = expanded (top), 1 = collapsed.
    @ViewBuilder var hero: (_ progress: CGFloat) -> Hero
    @ViewBuilder var content: Content

    @State private var scrollY: CGFloat = 0

    private var collapseDistance: CGFloat { max(1, heroMaxHeight - heroMinHeight) }
    private var progress: CGFloat { min(1, max(0, scrollY / collapseDistance)) }
    private var heroHeight: CGFloat { heroMaxHeight - collapseDistance * progress }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                content
                Color.clear.frame(height: 48 + contentBottomInset)
            }
            // Content begins below the fully-expanded hero (content height +
            // its top inset) PLUS a gap, so the first card sits a hair below the
            // hero. The gap stays constant through the collapse (both move with
            // scroll), so the card can't peek above the hero's masking edge if
            // the scroll-driven hero height lags layout by a frame. The gap
            // closes naturally right as the card reaches the pin line.
            .padding(.top, heroMaxHeight + heroTopInset + WidgetCard.gap)
        }
        // Reliable scroll-offset read (iOS 18+). `contentOffset.y` is negative
        // by the top content inset at rest, so adding the inset normalizes the
        // top to 0 and it grows as you scroll down.
        .onScrollGeometryChange(for: CGFloat.self) { geo in
            geo.contentOffset.y + geo.contentInsets.top
        } action: { _, newValue in
            scrollY = newValue
        }
        // Named space lets each card read its live viewport position.
        .coordinateSpace(name: kCollapsingScrollSpace)
        // Cards pin just under the compact hero (which sits `heroTopInset` lower).
        .environment(\.widgetPinLine, heroMinHeight + heroTopInset)
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
                .padding(.top, heroTopInset)
                .frame(height: heroHeight + heroTopInset, alignment: .top)
                // Same aura as the page, but bled UP under the nav/status bar so
                // its opaque base masks content scrolling up there (the nav bar
                // is transparent). The glow shows through and stays aligned to
                // the page aura beneath. Hero content stays below the notch.
                .background {
                    background(progress)
                        .ignoresSafeArea(.container, edges: .top)
                }
        }
    }
}

/// Team-color "aurora" glows that bleed in from the left and right screen edges
/// (away color left, home color right), tall and soft, with a slow wobble. Dims
/// and shrinks as `progress` (0 = expanded … 1 = collapsed) increases. The
/// `appSurface` base is opaque so this can double as the hero's masking bg.
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
    private let blobWidth: CGFloat = 300
    private let blobHeight: CGFloat = 580

    @State private var wobble: CGFloat = 0

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
                ZStack {
                    blob(awayColor)
                        .scaleEffect(shrink * (1 + 0.06 * wobble))
                        .position(x: 0, y: yLocal + wobble * 16)
                    blob(homeColor)
                        .scaleEffect(shrink * (1 - 0.06 * wobble))
                        .position(x: geo.size.width, y: yLocal - wobble * 16)
                }
                .opacity(intensity)
                // Rasterize the blurred glows once, then animate cheap
                // transforms on the layer for the aurora wobble.
                .drawingGroup()
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 5).repeatForever(autoreverses: true)) {
                wobble = 1
            }
        }
    }

    private func blob(_ color: Color) -> some View {
        Ellipse()
            .fill(
                RadialGradient(
                    colors: [color.opacity(0.85), color.opacity(0.0)],
                    center: .center,
                    startRadius: 0,
                    endRadius: blobWidth * 0.62
                )
            )
            .frame(width: blobWidth, height: blobHeight)
            .blur(radius: 48)
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

/// A widget card for `CollapsingWidgetScroll`. Header pins, body collapses under
/// it, header fades out at full collapse. Reuses `WidgetHeaderAccessory` /
/// `WidgetCard` from `PinnedWidgetScroll.swift`.
struct WidgetCollapsingSection<Content: View>: View {
    let title: String
    let systemImage: String
    var iconTint: Color = .appPrimary
    var accessory: WidgetHeaderAccessory = .none
    var onHeaderTap: (() -> Void)? = nil
    var bodyPadding: CGFloat = 16
    @ViewBuilder var content: Content

    @Environment(\.widgetPinLine) private var pinLine
    /// Live top position of the card's NATURAL layout box (unaffected by the
    /// visual collapse, which uses offset/clip only).
    @State private var minY: CGFloat = 0
    /// Cached natural (uncollapsed) height. Measured whenever the card is at
    /// full size so the collapse math has a stable reference.
    @State private var naturalHeight: CGFloat = 0

    /// Fixed header band height (icon/title row + vertical padding).
    private let headerHeight: CGFloat = 48
    /// Distance the pill fades out over, in place, once fully collapsed.
    private let fadeRange: CGFloat = 44

    var body: some View {
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
            .background(
                GeometryReader { geo in
                    Color.clear
                        .onAppear { measure(geo) }
                        .onChange(of: geo.frame(in: .named(kCollapsingScrollSpace))) { _, _ in
                            measure(geo)
                        }
                }
            )
            .padding(.horizontal, WidgetCard.hInset)
            .padding(.bottom, WidgetCard.gap)
            // The pinned/collapsing card draws above the next one during handoff.
            .zIndex(collapsing ? 1 : 0)
    }

    private func measure(_ geo: GeometryProxy) {
        let f = geo.frame(in: .named(kCollapsingScrollSpace))
        if abs(minY - f.minY) > 0.5 { minY = f.minY }
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
            Color.clear.frame(height: headerHeight)
            // Body window — clips the body so it disappears at the header's
            // bottom edge as it slides up, and never renders behind the header.
            content
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(bodyPadding)
                .offset(y: -collapse)
                .frame(height: bodyWindow, alignment: .top)
                .clipped()
        }
        .frame(height: visualHeight, alignment: .top)

        ZStack(alignment: .top) {
            stack
            headerButton
                .frame(height: headerHeight)
                .frame(maxWidth: .infinity, alignment: .leading)
                .zIndex(1)
        }
        .clipShape(cardShape)
        .liquidGlassBackground(in: cardShape)
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
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .semibold))
                // Match the title color (translucent secondary) so icon + label
                // read as one iOS-style section header.
                .foregroundStyle(Color.appTextSecondary)
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
        }
    }
}
