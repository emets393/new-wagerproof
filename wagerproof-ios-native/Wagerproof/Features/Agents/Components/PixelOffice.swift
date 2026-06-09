import SwiftUI
import SpriteKit
import WagerproofDesign
import WagerproofModels

/// SwiftUI wrapper around the pixel-office SpriteKit scene. This is the
/// native port of `wagerproof-mobile/components/agents/PixelOffice.tsx`.
///
/// The RN component uses Skia (a JS-thread canvas) to composite a 864x800
/// pixel-art office scene where each agent walks to and sits at a desk,
/// driven by a 60fps requestAnimationFrame loop. We port it to **SpriteKit**:
/// per-agent animations move onto SpriteKit's native action system, freeing
/// the SwiftUI render path from per-frame `body` recomputation.
///
/// Architecture:
/// - `PixelOffice` (this file) — SwiftUI host. Owns the floor/time `@AppStorage`,
///   life-cycle observers, and the SKScene instance. Resolves the right floor
///   texture key from those toggles before handing off to the scene.
/// - `PixelOfficeSceneRepresentable` — UIViewRepresentable bridging an `SKView`.
/// - `PixelOfficeScene` — SKScene that owns background/foreground/laptops/agents.
/// - `PixelOfficeAgentNode` — SKSpriteNode subclass per agent.
/// - `PixelOfficeAssets` — typed enums for frame indices, geometry constants,
///    state colors, desk/laptop coords.
///
/// **FIDELITY-WAIVER #082 (resolved)**: The scene now ports the full RN
/// simulation — A* pathfinding over the office collision grid, point claiming,
/// staggered + periodic (5s) state churn, tile-based walk motion with
/// directional walk/sit/idle/done/error animations, laptop open/close
/// occupancy, and the night monitor-glow particle field. Agents spawn at
/// random spots and walk to their stations rather than teleporting to a desk.
/// **FIDELITY-WAIVER #073 (resolved)** — the pixel-office hero scene is now
/// real; CompanyDashboardBanner is wired alongside.
struct PixelOffice: View {

    /// Real agents to populate the office. Up to 8 are rendered (one per desk).
    /// Pass `nil` to render a 4-agent fallback for previews / empty-state.
    let agents: [AgentWithPerformance]?

    /// When true the SKScene is paused — used by the AgentsView so we don't
    /// burn CPU rendering when the tab is off-screen.
    var isActive: Bool = true

    /// User's preferred floor variant. RN persists this in AsyncStorage under
    /// `pixel-office-floor-style`. `@AppStorage` provides the same UserDefaults
    /// persistence with SwiftUI binding semantics. Default = "future" to match
    /// the RN default (PixelOffice.tsx line 601).
    @AppStorage("pixel-office-floor-style") private var floorStyle: String = "future"

    /// User's preferred day/night mode. RN persists under `pixel-office-time-mode`.
    /// "auto" reads the system clock (6am-6pm = day in RN, but RN actually uses
    /// 6am-7pm). We mirror RN's bounds exactly: night = hour < 6 || hour >= 19.
    @AppStorage("pixel-office-time-mode") private var timeMode: String = "auto"

    /// Toggled when the scene phase moves off `.active` so the scene pauses.
    @Environment(\.scenePhase) private var scenePhase

    @State private var scene: PixelOfficeScene?

    var body: some View {
        // Anchor the scene at the natural map aspect ratio. The ScrollView
        // parent gives us infinite vertical space, so we MUST constrain the
        // SKView to a deterministic height — otherwise SwiftUI hands it a
        // zero or accordion-collapsed frame and the SKScene paints a sliver
        // at the top. Wrapping the representable in `.aspectRatio()` lets
        // SwiftUI compute height from width-of-parent.
        ZStack(alignment: .topLeading) {
            PixelOfficeSceneRepresentable(
                floorKey: currentFloorKey,
                agentSpecs: agentSpecs,
                isPaused: !isActive || scenePhase != .active,
                onSceneCreated: { newScene in
                    scene = newScene
                }
            )
            .aspectRatio(
                PixelOfficeGeo.mapWidth / PixelOfficeGeo.mapHeight,
                contentMode: .fit
            )

            // Floor/time control chips (bottom-right). The "Agent HQ — Live"
            // status pill was relocated out of the office onto the sort row
            // above the agent list (see AgentsView.agentHQStatusPill).
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    controlChips
                }
                .padding(8)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        // Push the floor key through the SKScene when the user toggles a chip.
        .onChange(of: currentFloorKey) { _, newKey in
            scene?.updateFloor(key: newKey)
        }
        .onChange(of: agentSpecs) { _, newSpecs in
            scene?.updateAgents(newSpecs)
        }
    }

    // MARK: - Derived state

    /// Floor + time → asset key. Pattern: `floor_{style}_{day|night}`. RN does
    /// the same join on PixelOffice.tsx line 641.
    private var currentFloorKey: String {
        "\(floorStyle)_\(isNight ? "night" : "day")"
    }

    /// Day/night mode resolution. Mirrors PixelOffice.tsx line 636: auto uses
    /// hour < 6 || hour >= 19; explicit day/night override the toggle.
    private var isNight: Bool {
        switch timeMode {
        case "day": return false
        case "night": return true
        default:
            let hour = Calendar.current.component(.hour, from: Date())
            return hour >= 19 || hour < 6
        }
    }

    /// Compute the agent specs handed to the SKScene. Up to 8 agents; if the
    /// caller passes nil we still seed 4 named fallbacks so the preview reads
    /// as populated. Recomputed when `agents` changes — drives the scene's
    /// `updateAgents()` call via `.onChange`.
    private var agentSpecs: [PixelOfficeAgentSpec] {
        if let real = agents, !real.isEmpty {
            return real.prefix(8).map { PixelOfficeAgentSpec.make(from: $0) }
        }
        // Fallback: a few agents with varied states so a logged-out preview
        // reads as a populated, busy office (mirrors RN's initialStates seed).
        let states = ["working", "thinking", "working", "idle"]
        return Array(Self.fallbackNames.prefix(4)).enumerated().map { idx, name in
            let st = states[idx % states.count]
            return PixelOfficeAgentSpec(
                displayName: name,
                emoji: "",
                accentColorHex: nil,
                spriteIndex: idx % 8,
                state: st,
                stateLabel: PixelOfficeStateColor.label(for: st),
                isActive: true
            )
        }
    }

    private static let fallbackNames = [
        "Line Hawk", "Spread Eagle", "Model Maven", "Value Hunter",
        "Risk Ranger", "Trend Spotter", "Odds Oracle", "Sharp Edge",
    ]

    // MARK: - UI chrome

    /// Floor-style + time-mode pills in the bottom-right. Order matches RN
    /// (time on the left, floor style on the right).
    private var controlChips: some View {
        HStack(spacing: 6) {
            Button {
                cycleTimeMode()
            } label: {
                HStack(spacing: 4) {
                    Text(isNight ? "🌙" : "☀️").font(.system(size: 14))
                    Text(timeModeLabel)
                        .font(.system(size: 12, weight: .semibold))
                        .tracking(0.3)
                        .foregroundStyle(Color(red: 0x8b / 255, green: 0x94 / 255, blue: 0x9e / 255))
                }
                .padding(.horizontal, 11)
                .padding(.vertical, 7)
                .liquidGlassBackground(in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Toggle time of day")

            Button {
                toggleFloorStyle()
            } label: {
                HStack(spacing: 4) {
                    Text(floorStyle == "standard" ? "🏢" : "🚀").font(.system(size: 14))
                    Text(floorStyle == "standard" ? "Standard" : "Future")
                        .font(.system(size: 12, weight: .semibold))
                        .tracking(0.3)
                        .foregroundStyle(Color(red: 0x8b / 255, green: 0x94 / 255, blue: 0x9e / 255))
                }
                .padding(.horizontal, 11)
                .padding(.vertical, 7)
                .liquidGlassBackground(in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Toggle floor style")
        }
    }

    private var timeModeLabel: String {
        switch timeMode {
        case "day": return "Day"
        case "night": return "Night"
        default: return "Auto"
        }
    }

    private func toggleFloorStyle() {
        floorStyle = floorStyle == "standard" ? "future" : "standard"
    }

    private func cycleTimeMode() {
        // Match RN cycle order: auto → day → night → auto
        switch timeMode {
        case "auto": timeMode = "day"
        case "day": timeMode = "night"
        default: timeMode = "auto"
        }
    }
}

// MARK: - UIViewRepresentable bridge

/// Bridges `SKScene` into SwiftUI. Owns an `SKView`, lazily builds the
/// scene at first `makeUIView`, and exposes a callback so the parent can
/// hold a reference for targeted updates (`updateFloor`, `updateAgents`).
struct PixelOfficeSceneRepresentable: UIViewRepresentable {
    let floorKey: String
    let agentSpecs: [PixelOfficeAgentSpec]
    let isPaused: Bool
    let onSceneCreated: (PixelOfficeScene) -> Void

    func makeUIView(context: Context) -> SKView {
        let view = SKView(frame: .zero)
        // Pixel-art mode: turn off everything that smooths or blends frames.
        view.ignoresSiblingOrder = true
        view.isAsynchronous = true
        view.preferredFramesPerSecond = 30
        view.backgroundColor = UIColor(red: 0x0f / 255, green: 0x11 / 255, blue: 0x18 / 255, alpha: 1)

        // The scene runs in the RN coordinate space (864x800). SKView will
        // scale via `scaleMode = .resizeFill`.
        let scene = PixelOfficeScene(
            size: CGSize(width: PixelOfficeGeo.mapWidth, height: PixelOfficeGeo.mapHeight),
            floorKey: floorKey
        )
        // Apply initial agent list synchronously so the scene paints
        // populated on first frame instead of empty-then-flash.
        view.presentScene(scene)
        scene.updateAgents(agentSpecs)
        scene.isPaused = isPaused
        context.coordinator.scene = scene
        onSceneCreated(scene)
        return view
    }

    func updateUIView(_ uiView: SKView, context: Context) {
        // SwiftUI calls updateUIView whenever the parent's body recomputes.
        // We rely on the parent's `.onChange` for floor + agents pushes, so
        // this method only needs to reflect the pause flag.
        context.coordinator.scene?.isPaused = isPaused
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator {
        weak var scene: PixelOfficeScene?
    }
}

// MARK: - Equatable conformance for onChange

extension PixelOfficeAgentSpec: Equatable {
    static func == (lhs: PixelOfficeAgentSpec, rhs: PixelOfficeAgentSpec) -> Bool {
        lhs.displayName == rhs.displayName &&
        lhs.emoji == rhs.emoji &&
        lhs.accentColorHex == rhs.accentColorHex &&
        lhs.spriteIndex == rhs.spriteIndex &&
        lhs.state == rhs.state &&
        lhs.stateLabel == rhs.stateLabel &&
        lhs.isActive == rhs.isActive
    }
}

#Preview("PixelOffice — empty") {
    PixelOffice(agents: nil)
        .padding()
        .background(Color.appSurface)
}
