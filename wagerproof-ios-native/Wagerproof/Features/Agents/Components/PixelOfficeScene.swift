import SpriteKit
import UIKit
import WagerproofModels

/// The SpriteKit scene that owns the pixel-office composition and drives the
/// full agent simulation ported from `PixelOffice.tsx`'s requestAnimationFrame
/// loop:
///
/// 1. Floor background — the full office scene (desks, walls, plants, and
///    day/night lighting all baked into the `floor_{style}_{day|night}` texture),
///    swapped live on the floor/time toggles. This is the ONLY background layer,
///    mirroring RN: RN draws only the floor texture (its imported `office_bg` is
///    unused). Drawing the opaque `office_bg` on top here would permanently mask
///    the floor and make both toggles no-ops — hence it's intentionally absent.
/// 2. 16 laptop sprites — open when the desk seat they map to is occupied.
/// 3. Per-agent `PixelOfficeAgentNode` characters that spawn at random spots,
///    pathfind (A*) to claimed desk/idle/meeting points, walk with directional
///    animations, sit and work, and churn state on a 5s timer.
/// 4. A particle layer (night monitor-glow + dormant coffee/fire effects).
/// 5. Office foreground overlay (office_fg) — chairs/plants over the characters.
///
/// The simulation is stepped from `update(_:)`; SpriteKit pauses both the loop
/// and the scheduled actions when `isPaused` is set (tab off-screen), so we get
/// the RN `shouldAnimate` gating for free.
///
/// **FIDELITY-WAIVER #082 (resolved)** — A* pathfinding + walk-to-station
/// motion, point claiming, state churn, laptop occupancy, and particles are now
/// fully ported. The one intentional deviation: RN's staggered initial
/// `setAgentState` early-returns when the spawn state already equals the target
/// state (a no-op for real agents), so they only drift via the 5s interval; we
/// *force* the first route so agents actually walk to their stations on load.
@MainActor
final class PixelOfficeScene: SKScene {

    // MARK: - Configuration

    private(set) var floorKey: String
    /// Derived from `floorKey` — gates the night-only monitor-glow particles.
    private var isNight: Bool

    /// Agents currently in the scene, in stable display order. Up to 8.
    private(set) var agents: [PixelOfficeAgentNode] = []

    // MARK: - Scene nodes

    private var floorSprite: SKSpriteNode!
    private var officeFgSprite: SKSpriteNode!
    /// Laptop sprites keyed by laptop index (0..15).
    private var laptopSprites: [Int: SKSpriteNode] = [:]
    /// Pooled particle circles, reused frame to frame.
    private let particleLayer = SKNode()
    private var particleNodes: [SKShapeNode] = []

    // MARK: - Simulation state

    /// Interaction-point keys currently claimed by an agent (so two agents
    /// never target the same desk/seat).
    private var claimedPoints: Set<String> = []
    private var particles: [PixelOfficeParticle] = []
    private var lastOccupiedSeats: Set<Int> = []

    private var lastUpdateTime: TimeInterval = 0
    private var particleTimer: CGFloat = 0

    // Lighting: a cool multiply grade over floor + characters at night, then additive light pools
    // at the lamps/screens baked into the floor art, and a monitor glow on every agent actually working.
    private var darkness: SKSpriteNode!
    private let lightLayer = SKNode()
    private var lights: [(node: SKSpriteNode, base: CGFloat, phase: CGFloat, speed: CGFloat)] = []
    private var monitorGlows: [SKSpriteNode] = []
    private var sceneTime: CGFloat = 0

    // Live wall screen in the conference room: cycles real team stats (see PixelOfficeScreenStats).
    private var screenNodes: [SKSpriteNode] = []
    private var screenGlow: SKSpriteNode!
    private var screenDot: SKShapeNode!
    private var screenPages: [UIImage] = []
    private var screenPage = 0
    private var screenFront = 0
    private var screenTimer: CGFloat = 0
    private var screenFade: CGFloat = 1

    // MARK: - Init

    init(size: CGSize, floorKey: String) {
        self.floorKey = floorKey
        self.isNight = floorKey.contains("night")
        super.init(size: size)
        scaleMode = .aspectFit
        backgroundColor = UIColor(red: 0x0f / 255.0, green: 0x11 / 255.0, blue: 0x18 / 255.0, alpha: 1)
        // Bottom-left anchor (SpriteKit default) so a child at (0,0) sits in the
        // bottom-left. RN draws top-down, so positions convert via `flipY`.
        anchorPoint = CGPoint(x: 0, y: 0)
    }

    required init?(coder aDecoder: NSCoder) {
        fatalError("PixelOfficeScene does not support NSCoder")
    }

    /// Convert RN top-down Y (0=top) into scene Y (0=bottom).
    private static func flipY(_ rnY: CGFloat) -> CGFloat {
        PixelOfficeGeo.mapHeight - rnY
    }

    // MARK: - didMove

    override func didMove(to view: SKView) {
        super.didMove(to: view)
        if floorSprite == nil {
            buildStaticScene()
        }
    }

    private func buildStaticScene() {
        // ── Floor ──
        let floorTex = PixelOfficeTextureCache.shared.staticTexture(named: "floor_\(floorKey)")
            ?? PixelOfficeTextureCache.shared.staticTexture(named: "office_bg")
            ?? SKTexture()
        floorSprite = SKSpriteNode(texture: floorTex)
        floorSprite.size = CGSize(width: PixelOfficeGeo.mapWidth, height: PixelOfficeGeo.mapHeight)
        floorSprite.anchorPoint = CGPoint(x: 0, y: 0)
        floorSprite.position = .zero
        floorSprite.zPosition = 0
        addChild(floorSprite)

        // NOTE: No separate office-structure layer. The floor_* texture already
        // contains the full office (desks, walls, plants). RN's `office_bg` asset
        // is imported-but-unused; drawing it opaque over the floor here would
        // permanently hide the floor and break both the day/night + floor toggles.

        // ── Laptop layer ── (all 16; conference seats render closed forever).
        for (idx, spot) in PixelOfficeLaptops.spots.enumerated() {
            let name = PixelOfficeLaptops.imageName(dir: spot.dir, open: false)
            guard let tex = PixelOfficeTextureCache.shared.staticTexture(named: name) else { continue }
            let sprite = SKSpriteNode(texture: tex)
            sprite.size = CGSize(width: 32, height: 64)
            // RN draws the laptop top-left at spot.{x,y}; with SK's center anchor
            // that's centerX = spot.x + 16, topY = flipY(spot.y) → centerY -32.
            sprite.anchorPoint = CGPoint(x: 0.5, y: 0.5)
            sprite.position = CGPoint(x: spot.x + 16, y: Self.flipY(spot.y) - 32)
            sprite.zPosition = 2
            addChild(sprite)
            laptopSprites[idx] = sprite
        }

        // ── Particle layer ── above characters (z≈3.x), below foreground (z=4).
        particleLayer.position = .zero
        particleLayer.zPosition = 4.3   // above the night grade so the glow reads
        addChild(particleLayer)

        // ── Foreground overlay ──
        if let fgTex = PixelOfficeTextureCache.shared.staticTexture(named: "office_fg") {
            officeFgSprite = SKSpriteNode(texture: fgTex)
            officeFgSprite.size = CGSize(width: PixelOfficeGeo.mapWidth, height: PixelOfficeGeo.mapHeight)
            officeFgSprite.anchorPoint = CGPoint(x: 0, y: 0)
            officeFgSprite.position = .zero
            officeFgSprite.zPosition = 4
            // The overlay's white chairs belong to the original office; on the Future floor they sit on top
            // of that art's own dark chairs, so only the Standard floor shows them.
            officeFgSprite.isHidden = floorKey.hasPrefix("future")
            addChild(officeFgSprite)
        }
        buildLighting()
        buildWallScreen()
        applyTimeOfDay()
    }

    // MARK: - Lighting

    private func buildLighting() {
        darkness = SKSpriteNode(color: UIColor(red: 0.60, green: 0.66, blue: 0.88, alpha: 1),
                                size: CGSize(width: PixelOfficeGeo.mapWidth, height: PixelOfficeGeo.mapHeight))
        darkness.anchorPoint = .zero
        darkness.blendMode = .multiply
        darkness.zPosition = 4.1
        addChild(darkness)
        lightLayer.zPosition = 4.2
        addChild(lightLayer)
        // (x, y top-down map px, radius, rgb, alpha) — positions read off floor_future_night's lamps/screens.
        let cool = (0.55, 0.86, 1.0), warm = (1.0, 0.74, 0.40), cyan = (0.35, 0.90, 1.0)
        let specs: [(CGFloat, CGFloat, CGFloat, (Double, Double, Double), CGFloat)] = [
            (145, 478, 150, cool, 0.34), (332, 478, 150, cool, 0.34), (102, 292, 110, cool, 0.26), (575, 78, 120, cool, 0.24),
            (143, 596, 175, cyan, 0.20), (336, 596, 175, cyan, 0.20),
            (80, 556, 58, warm, 0.55), (207, 612, 58, warm, 0.55), (332, 612, 58, warm, 0.55), (630, 532, 58, warm, 0.5),
            (747, 515, 58, warm, 0.5), (497, 137, 72, warm, 0.45), (790, 145, 72, warm, 0.5),
            (250, 742, 300, (0.45, 0.60, 1.0), 0.14),
        ]
        for (i, sp) in specs.enumerated() {
            let n = SKSpriteNode(texture: PixelOfficeTextureCache.shared.radialLight)
            n.size = CGSize(width: sp.2 * 2, height: sp.2 * 2)
            n.color = UIColor(red: sp.3.0, green: sp.3.1, blue: sp.3.2, alpha: 1)
            n.colorBlendFactor = 1
            n.blendMode = .add
            n.position = CGPoint(x: sp.0, y: Self.flipY(sp.1))
            lightLayer.addChild(n)
            lights.append((n, sp.4, CGFloat(i) * 1.7, sp.2 < 80 ? 2.6 : 1.1))   // small lamps flicker faster
        }
    }

    /// Night: cool grade + full lights. Day: no grade, lights at a quarter (lamps read as "on", not glowing).
    private func applyTimeOfDay() {
        darkness?.isHidden = !isNight
        lightLayer.alpha = isNight ? 1 : 0.25
        officeFgSprite?.isHidden = floorKey.hasPrefix("future")
    }

    private func stepLighting(dt: CGFloat) {
        sceneTime += dt
        for l in lights {
            l.node.alpha = l.base * (1 + 0.07 * sin(sceneTime * l.speed + l.phase) + 0.03 * sin(sceneTime * 7.3 + l.phase * 3))
        }
        // Monitor glow on each agent working at a desk: lights the face from the screen side.
        while monitorGlows.count < agents.count {
            let g = SKSpriteNode(texture: PixelOfficeTextureCache.shared.radialLight)
            g.size = CGSize(width: 78, height: 78)
            g.color = UIColor(red: 0.30, green: 0.95, blue: 0.85, alpha: 1)
            g.colorBlendFactor = 1
            g.blendMode = .add
            lightLayer.addChild(g)
            monitorGlows.append(g)
        }
        for (i, g) in monitorGlows.enumerated() {
            guard i < agents.count else { g.isHidden = true; continue }
            let a = agents[i]
            let atDesk = a.arrived && a.claimedPointKey.hasPrefix("desk_") && (a.state == "working" || a.state == "thinking")
            g.isHidden = !atDesk
            guard atDesk else { continue }
            let facingDown = PixelOfficePoints.byKey[a.claimedPointKey]?.facing == "down"
            g.position = CGPoint(x: a.mapX, y: Self.flipY(facingDown ? a.mapY + 4 : a.mapY - 44))
            g.alpha = (isNight ? 0.55 : 0.2) * (1 + 0.12 * sin(sceneTime * 9 + CGFloat(i) * 2.1))
        }
    }

    // MARK: - Wall screen

    /// The curved display on the conference room's top wall (map x ≈ 606–770, y ≈ 324–376).
    private static let screenCenter = CGPoint(x: 688, y: 350)
    private static let screenSize = CGSize(width: 164, height: 52)

    private func buildWallScreen() {
        screenGlow = SKSpriteNode(texture: PixelOfficeTextureCache.shared.radialLight)
        screenGlow.size = CGSize(width: 300, height: 170)
        screenGlow.color = UIColor(red: 0.30, green: 0.85, blue: 1.0, alpha: 1)
        screenGlow.colorBlendFactor = 1
        screenGlow.blendMode = .add
        screenGlow.alpha = 0.35
        screenGlow.position = CGPoint(x: Self.screenCenter.x, y: Self.flipY(Self.screenCenter.y + 8))
        screenGlow.zPosition = 4.24
        addChild(screenGlow)
        for _ in 0..<2 {
            let n = SKSpriteNode(color: .clear, size: Self.screenSize)
            n.position = CGPoint(x: Self.screenCenter.x, y: Self.flipY(Self.screenCenter.y))
            n.zPosition = 4.25
            addChild(n)
            screenNodes.append(n)
        }
        screenDot = SKShapeNode(circleOfRadius: 2.6)
        screenDot.fillColor = UIColor(red: 0.13, green: 0.77, blue: 0.37, alpha: 1)
        screenDot.strokeColor = .clear
        screenDot.position = CGPoint(x: Self.screenCenter.x + Self.screenSize.width / 2 - 9, y: Self.flipY(Self.screenCenter.y - Self.screenSize.height / 2 + 8))
        screenDot.zPosition = 4.26
        addChild(screenDot)
    }

    private func refreshScreen(_ specs: [PixelOfficeAgentSpec]) {
        screenPages = PixelOfficeScreenStats(specs: specs).pages().map { Self.renderScreen(label: $0.label, value: $0.value, accent: $0.accent) }
        screenPage = 0
        screenTimer = 0
        screenFade = 1
        guard let first = screenPages.first, screenNodes.count == 2 else { return }
        screenNodes[screenFront].texture = SKTexture(image: first)
        screenNodes[screenFront].alpha = 1
        screenNodes[1 - screenFront].alpha = 0
    }

    private func stepScreen(dt: CGFloat) {
        guard screenPages.count > 0, screenNodes.count == 2 else { return }
        screenDot.alpha = 0.45 + 0.55 * abs(sin(sceneTime * 3))
        screenGlow.alpha = 0.30 + 0.06 * sin(sceneTime * 1.4)
        screenTimer += dt
        if screenPages.count > 1 && screenTimer > 3.2 {
            screenTimer = 0
            screenPage = (screenPage + 1) % screenPages.count
            let back = 1 - screenFront
            let tex = SKTexture(image: screenPages[screenPage]); tex.filteringMode = .linear
            screenNodes[back].texture = tex
            screenFront = back
            screenFade = 0
        }
        if screenFade < 1 {
            screenFade = min(1, screenFade + dt / 0.35)
            let k = screenFade * screenFade * (3 - 2 * screenFade)
            screenNodes[screenFront].alpha = k
            screenNodes[1 - screenFront].alpha = 1 - k
            screenNodes[screenFront].position.y = Self.flipY(Self.screenCenter.y) + (1 - k) * 4
        }
    }

    /// One screen page as an image (3× the map size, so it stays crisp when the card scales it down).
    private static func renderScreen(label: String, value: String, accent: UIColor) -> UIImage {
        let W = screenSize.width * 3, H = screenSize.height * 3
        return UIGraphicsImageRenderer(size: CGSize(width: W, height: H)).image { ctx in
            let c = ctx.cgContext
            let r = CGRect(x: 3, y: 3, width: W - 6, height: H - 6)
            let path = UIBezierPath(roundedRect: r, cornerRadius: 18)
            c.saveGState(); path.addClip()
            let bg = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                colors: [UIColor(red: 0.02, green: 0.09, blue: 0.14, alpha: 0.96).cgColor, UIColor(red: 0.04, green: 0.20, blue: 0.25, alpha: 0.96).cgColor] as CFArray,
                                locations: [0, 1])!
            c.drawLinearGradient(bg, start: CGPoint(x: 0, y: 0), end: CGPoint(x: W, y: H), options: [])
            UIColor(white: 1, alpha: 0.05).setFill()
            stride(from: CGFloat(0), to: H, by: 6).forEach { c.fill(CGRect(x: 0, y: $0, width: W, height: 2)) }
            c.restoreGState()
            UIColor(red: 0.35, green: 0.9, blue: 1.0, alpha: 0.85).setStroke()
            path.lineWidth = 4; path.stroke()
            let para = NSMutableParagraphStyle(); para.alignment = .left
            let lab = NSAttributedString(string: label, attributes: [.font: UIFont.systemFont(ofSize: 25, weight: .heavy), .kern: 2.4,
                                                                     .foregroundColor: UIColor(red: 0.55, green: 0.92, blue: 1.0, alpha: 0.9), .paragraphStyle: para])
            lab.draw(at: CGPoint(x: 22, y: 16))
            let size: CGFloat = value.count > 12 ? 50 : 62
            let val = NSAttributedString(string: value, attributes: [.font: UIFont.systemFont(ofSize: size, weight: .black), .kern: -1,
                                                                     .foregroundColor: accent, .paragraphStyle: para])
            val.draw(at: CGPoint(x: 20, y: H - size * 1.2 - 12))
        }
    }

    // MARK: - Public API (SwiftUI → scene)

    /// Swap the floor texture + re-derive day/night for particle gating.
    func updateFloor(key: String) {
        floorKey = key
        isNight = key.contains("night")
        guard let floorSprite = floorSprite else { return }
        if let tex = PixelOfficeTextureCache.shared.staticTexture(named: "floor_\(key)") {
            floorSprite.texture = tex
        }
        applyTimeOfDay()
    }

    /// Replace the agent roster. Spawns each agent at a random spot and then
    /// staggers a forced route to its station. Called on login, agent CRUD, and
    /// performance refresh (the spec's derived state participates in equality,
    /// so only real data changes trigger a rebuild).
    func updateAgents(_ specs: [PixelOfficeAgentSpec]) {
        for a in agents { a.removeFromParent() }
        agents = []
        claimedPoints.removeAll()
        clearParticles()
        // Cancel any pending staggered routes / the periodic churn from a prior roster.
        removeAction(forKey: "staggered")
        removeAction(forKey: "periodic")

        let capped = Array(specs.prefix(PixelOfficePoints.desks.count))
        let spawns = PixelOfficePoints.allSpawns.shuffled()

        for (idx, spec) in capped.enumerated() {
            let node = PixelOfficeAgentNode(
                agentIndex: idx,
                avatarIdx: spec.spriteIndex,
                displayName: spec.displayName,
                emoji: spec.emoji,
                accentColorHex: spec.accentColorHex
            )
            let spawn = spawns[idx % spawns.count]
            let sx = spawn.x + CGFloat.random(in: -4...4)
            let sy = spawn.y + CGFloat.random(in: -4...4)
            node.mapX = sx; node.mapY = sy
            node.targetX = sx; node.targetY = sy
            node.fromX = sx; node.fromY = sy
            node.toX = sx; node.toY = sy
            node.facing = "down"
            node.arrived = true
            node.isActive = spec.isActive
            node.mood = AgentMood(winRate: spec.winRate, streak: spec.currentStreak)
            node.animKey = "front_idle"
            // Seed the pill with the derived state/label so the color reads
            // correctly during the brief pre-route window.
            node.setState(spec.state, label: spec.stateLabel)
            node.applyTextureFrame()
            node.syncSceneNode()
            addChild(node)
            agents.append(node)
        }

        refreshScreen(capped)
        guard !agents.isEmpty else {
            refreshLaptopOccupancy()
            return
        }

        // Staggered initial routing (0.6 + i*0.4s), forced so agents leave their
        // random spawn and walk to a desk/idle/meeting point.
        var routes: [SKAction] = []
        for (idx, node) in agents.enumerated() {
            let delay = 0.6 + Double(idx) * 0.4
            routes.append(SKAction.sequence([
                .wait(forDuration: delay),
                .run { [weak self, weak node] in
                    guard let self, let node else { return }
                    self.setAgentState(node, node.state, force: true)
                }
            ]))
        }
        run(SKAction.group(routes), withKey: "staggered")

        // Periodic state churn — every 5s a random agent re-routes.
        let periodic = SKAction.repeatForever(SKAction.sequence([
            .wait(forDuration: 5),
            .run { [weak self] in self?.periodicStateChange() }
        ]))
        run(periodic, withKey: "periodic")

        refreshLaptopOccupancy()
    }

    // MARK: - State assignment + claiming

    /// Assign a new logical state and route the agent to an appropriate point.
    /// Ports `setAgentState` from PixelOffice.tsx (line 734). `force` overrides
    /// the same-state early return (used for the initial routing).
    private func setAgentState(_ agent: PixelOfficeAgentNode, _ newState: String, force: Bool = false) {
        if !force && agent.state == newState { return }

        let label = agent.isActive ? PixelOfficeStateColor.label(for: newState) : "OFF"
        agent.setState(newState, label: label)

        // Release the current claimed point.
        if !agent.claimedPointKey.isEmpty {
            releasePoint(agent.claimedPointKey)
            agent.claimedPointKey = ""
        }

        var point: ClaimablePoint?
        switch newState {
        case "working", "thinking":
            point = claimPoint(PixelOfficePoints.all.filter { $0.type == "desk" })
        case "done":
            point = claimPoint(PixelOfficePoints.all.filter { $0.type == "idle" })
        case "idle":
            point = claimPoint(PixelOfficePoints.all.filter { $0.type == "idle" || $0.type == "meeting" })
        case "error":
            return  // stay put at the current desk
        default:
            break
        }
        if point == nil {
            point = claimPoint(PixelOfficePoints.all)
        }
        guard let pt = point else { return }

        agent.claimedPointKey = pt.key
        agent.targetX = pt.x
        agent.targetY = pt.y
        agent.arrived = false

        let path = PixelOfficePathfinding.aStar(
            startCol: PixelOfficePathfinding.pixToCol(agent.mapX),
            startRow: PixelOfficePathfinding.pixToRow(agent.mapY),
            endCol: PixelOfficePathfinding.pixToCol(pt.x),
            endRow: PixelOfficePathfinding.pixToRow(pt.y)
        )
        agent.path = path
        agent.pathIdx = 0
        agent.moveProgress = 0
        agent.fromX = agent.mapX
        agent.fromY = agent.mapY
        if let first = path.first {
            agent.toX = PixelOfficePathfinding.tileCenterX(first.col)
            agent.toY = PixelOfficePathfinding.tileCenterY(first.row)
        } else {
            agent.toX = pt.x
            agent.toY = pt.y
        }
        agent.bubbleEmoji = PixelOfficeActivity.bubbles[pt.activity] ?? ""
    }

    private func claimPoint(_ candidates: [ClaimablePoint]) -> ClaimablePoint? {
        for pt in candidates.shuffled() where !claimedPoints.contains(pt.key) {
            claimedPoints.insert(pt.key)
            return pt
        }
        return nil
    }

    private func releasePoint(_ key: String) {
        if !key.isEmpty { claimedPoints.remove(key) }
    }

    private func periodicStateChange() {
        guard let agent = agents.randomElement() else { return }
        if !agent.isActive {
            let states = ["idle", "idle", "idle", "thinking"]
            setAgentState(agent, states.randomElement()!)
        } else {
            let states = ["working", "thinking", "done", "working", "thinking", "idle"]
            setAgentState(agent, states.randomElement()!)
        }
    }

    // MARK: - Game loop

    override func update(_ currentTime: TimeInterval) {
        super.update(currentTime)
        if lastUpdateTime == 0 { lastUpdateTime = currentTime }
        // Clamp dt — large after a pause/resume, matching RN's Math.min(dt, 0.1).
        let dt = CGFloat(min(currentTime - lastUpdateTime, 0.1))
        lastUpdateTime = currentTime
        if dt <= 0 { return }

        stepAgents(dt: dt)
        // Walking judders at 30fps, but seated/idle agents don't need 60 — only pay for it while someone moves.
        let fps = agents.contains { !$0.arrived } ? 60 : 30
        if let view, view.preferredFramesPerSecond != fps { view.preferredFramesPerSecond = fps }
        relaxLabels(dt: dt)

        particleTimer += dt
        if particleTimer > 0.3 {
            particleTimer = 0
            spawnActivityParticles()
        }
        updateParticles(dt: dt)
        renderParticles()
        stepLighting(dt: dt)
        stepScreen(dt: dt)

        refreshLaptopOccupancy()
    }

    /// Per-agent movement + animation step. Ports the `updateAgents` body from
    /// PixelOffice.tsx (line 955): tile-based smooth movement along the A* path,
    /// a final exact-approach segment, facing/anim-key derivation, and fps-gated
    /// frame cycling.
    private func stepAgents(dt: CGFloat) {
        for a in agents {
            if !a.arrived && !a.path.isEmpty {
                let segDist = hypot(a.toX - a.fromX, a.toY - a.fromY)
                let step = segDist > 0 ? (PixelOfficeGeo.walkSpeed * dt) / segDist : 1
                a.moveProgress += step

                if a.moveProgress >= 1 {
                    a.mapX = a.toX; a.mapY = a.toY
                    a.pathIdx += 1
                    if a.pathIdx < a.path.count {
                        a.moveProgress = 0
                        a.fromX = a.mapX; a.fromY = a.mapY
                        a.toX = PixelOfficePathfinding.tileCenterX(a.path[a.pathIdx].col)
                        a.toY = PixelOfficePathfinding.tileCenterY(a.path[a.pathIdx].row)
                    } else {
                        // End of the tile path — final approach to the exact point.
                        let dxF = a.targetX - a.mapX
                        let dyF = a.targetY - a.mapY
                        let distF = hypot(dxF, dyF)
                        if distF < 4 {
                            a.mapX = a.targetX; a.mapY = a.targetY
                            a.arrived = true
                            a.path = []; a.pathIdx = 0; a.moveProgress = 0
                            if let pt = PixelOfficePoints.byKey[a.claimedPointKey] { a.facing = pt.facing }
                        } else {
                            a.moveProgress = 0
                            a.fromX = a.mapX; a.fromY = a.mapY
                            a.toX = a.targetX; a.toY = a.targetY
                            a.path.append(GridCoord(
                                col: PixelOfficePathfinding.pixToCol(a.targetX),
                                row: PixelOfficePathfinding.pixToRow(a.targetY)
                            ))
                        }
                    }
                } else {
                    a.mapX = a.fromX + (a.toX - a.fromX) * a.moveProgress
                    a.mapY = a.fromY + (a.toY - a.fromY) * a.moveProgress
                    let dx = a.toX - a.fromX
                    let dy = a.toY - a.fromY
                    a.facing = abs(dx) > abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up")
                }
            } else if !a.arrived && a.path.isEmpty {
                // Direct-movement fallback (no path found).
                let dx = a.targetX - a.mapX
                let dy = a.targetY - a.mapY
                let dist = hypot(dx, dy)
                if dist < 3 {
                    a.mapX = a.targetX; a.mapY = a.targetY
                    a.arrived = true
                    if let pt = PixelOfficePoints.byKey[a.claimedPointKey] { a.facing = pt.facing }
                } else {
                    let step = PixelOfficeGeo.walkSpeed * dt
                    a.mapX += (dx / dist) * min(step, dist)
                    a.mapY += (dy / dist) * min(step, dist)
                    a.facing = abs(dx) > abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up")
                }
            }

            // ── Animation key ──
            let dir = PixelOfficePoints.dirImage(a.facing)
            if !a.arrived {
                a.animKey = "\(dir)_walk"
                a.bubbleEmoji = ""
            } else if a.state == "done" {
                a.animKey = "front_done_dance"
            } else if a.state == "error" {
                a.animKey = "front_alert_jump"
            } else if (a.state == "working" || a.state == "thinking"),
                      !a.claimedPointKey.isEmpty,
                      let pt = PixelOfficePoints.byKey[a.claimedPointKey],
                      pt.activity == "working" || pt.activity == "thinking" {
                let ptDir = PixelOfficePoints.dirImage(pt.facing)
                a.animKey = a.state == "working" ? "\(ptDir)_sit_work" : "\(ptDir)_sit_idle"
            } else {
                a.animKey = "\(dir)_idle"
            }

            // ── Frame cycling (idle sit/stand ticks slower) ──
            let fps = (a.arrived && a.state == "idle") ? PixelOfficeGeo.idleAnimFps : PixelOfficeGeo.animFps
            a.animTimer += TimeInterval(dt)
            let interval = 1.0 / fps
            if a.animTimer >= interval {
                a.animTimer -= interval
                if let anim = PixelAnim(rawValue: a.animKey) {
                    a.frameIdx = (a.frameIdx + 1) % anim.frameIndices.count
                }
            }

            if !a.stepEmote(dt: TimeInterval(dt), canEmote: a.arrived && a.animKey == "front_idle") {
                a.applyTextureFrame()
            }
            a.syncSceneNode()
        }
    }

    // MARK: - Name-tag de-collision

    /// Keep the floating name tags from overlapping when agents cluster. A small
    /// relaxation nudges tags that share a vertical band apart horizontally, so
    /// they sit side-by-side above their heads instead of stacking on top of one
    /// another. Offsets are recomputed from scratch each frame and the actual tag
    /// glides toward the target (re-centring to 0 when space frees up), so it
    /// reads as the labels elegantly making room for each other.
    private func relaxLabels(dt: CGFloat) {
        let n = agents.count
        guard n > 0 else { return }

        // Name-box geometry in scene space (see PixelOfficeAgentNode: ~116 wide),
        // so two tags need their centres ≥ 2*halfW + padX apart. Tags only collide
        // when their agents share a vertical band of about one tag height.
        let halfW: CGFloat = 56
        let padX: CGFloat = 6
        let bandH: CGFloat = 52

        var dxOff = [CGFloat](repeating: 0, count: n)
        if n > 1 {
            // A few relaxation passes settle clusters of 3+ tags.
            for _ in 0..<10 {
                for i in 0..<n {
                    for j in (i + 1)..<n {
                        // Different rows → tags don't share a vertical band.
                        if abs(agents[i].position.y - agents[j].position.y) >= bandH { continue }
                        let dx = (agents[j].position.x + dxOff[j]) - (agents[i].position.x + dxOff[i])
                        let overlap = (halfW * 2 + padX) - abs(dx)
                        if overlap > 0 {
                            let push = overlap / 2
                            // Deterministic tie-break when perfectly x-aligned.
                            let s: CGFloat = dx > 0 ? 1 : (dx < 0 ? -1 : (i < j ? -1 : 1))
                            dxOff[i] -= push * s
                            dxOff[j] += push * s
                        }
                    }
                }
            }
        }

        // Glide each tag toward its target offset; keep it at head height (y→0).
        let lerp = min(1, dt * 9)
        for i in 0..<n {
            let target = min(74, max(-74, dxOff[i]))
            let cur = agents[i].nameTagOffset
            agents[i].nameTagOffset = CGPoint(
                x: cur.x + (target - cur.x) * lerp,
                y: cur.y + (0 - cur.y) * lerp
            )
        }
    }

    // MARK: - Particles

    /// Spawn the per-activity particles each ~0.3s tick. With the active point
    /// set (working/idle/meeting) only the night monitor-glow fires; the coffee
    /// and fire branches are ported for parity and light up if a future point
    /// assigns one of those named activities.
    private func spawnActivityParticles() {
        for a in agents {
            guard a.arrived, let pt = PixelOfficePoints.byKey[a.claimedPointKey] else { continue }
            if pt.activity == "getting_coffee" {
                spawnParticle(
                    x: a.mapX + .random(in: -4...4), y: a.mapY - 20,
                    color: UIColor(white: 1, alpha: 0.5),
                    vy: -15 - .random(in: 0...10), radius: 1 + .random(in: 0...1.5), maxLife: 1.0
                )
            }
            if pt.activity == "fire_hangout" || pt.activity == "grilling" {
                spawnParticle(
                    x: a.mapX + .random(in: -6...6), y: a.mapY - 10,
                    color: UIColor(red: 1, green: 140 / 255, blue: 0, alpha: 0.7),
                    vx: .random(in: -6...6), vy: -20 - .random(in: 0...15), radius: 1 + .random(in: 0...1), maxLife: 0.7
                )
            }
        }
        if isNight {
            for a in agents where a.arrived && a.state == "working" && !a.claimedPointKey.isEmpty {
                if CGFloat.random(in: 0...1) < 0.4 {
                    spawnParticle(
                        x: a.mapX + .random(in: -8...8), y: a.mapY - 24,
                        color: UIColor(red: 45 / 255, green: 212 / 255, blue: 191 / 255, alpha: 0.35),
                        vx: .random(in: -3...3), vy: -5 - .random(in: 0...5), radius: 2 + .random(in: 0...2), maxLife: 1.2
                    )
                }
            }
        }
    }

    private func spawnParticle(
        x: CGFloat, y: CGFloat, color: UIColor,
        vx: CGFloat? = nil, vy: CGFloat? = nil, radius: CGFloat? = nil, maxLife: CGFloat? = nil
    ) {
        particles.append(PixelOfficeParticle(
            x: x, y: y,
            vx: vx ?? .random(in: -4...4),
            vy: vy ?? (-12 - .random(in: 0...8)),
            life: 1,
            maxLife: maxLife ?? (0.8 + .random(in: 0...0.6)),
            radius: radius ?? (1.5 + .random(in: 0...1.5)),
            color: color,
            opacity: 0.6 + .random(in: 0...0.3)
        ))
    }

    private func updateParticles(dt: CGFloat) {
        for i in stride(from: particles.count - 1, through: 0, by: -1) {
            particles[i].life -= dt / particles[i].maxLife
            if particles[i].life <= 0 {
                particles.remove(at: i)
                continue
            }
            particles[i].x += particles[i].vx * dt
            particles[i].y += particles[i].vy * dt
            particles[i].opacity = particles[i].life * 0.5
        }
        if particles.count > 30 {
            particles.removeFirst(particles.count - 30)
        }
    }

    private func renderParticles() {
        // Grow the pool to fit; a unit circle scaled to each particle's radius.
        while particleNodes.count < particles.count {
            let n = SKShapeNode(circleOfRadius: 1)
            n.strokeColor = .clear
            n.isAntialiased = false
            particleLayer.addChild(n)
            particleNodes.append(n)
        }
        for (i, node) in particleNodes.enumerated() {
            if i < particles.count {
                let p = particles[i]
                node.isHidden = false
                node.position = CGPoint(x: p.x, y: Self.flipY(p.y))
                node.setScale(p.radius)
                node.fillColor = p.color
                node.alpha = p.opacity
            } else {
                node.isHidden = true
            }
        }
    }

    private func clearParticles() {
        particles.removeAll()
        for n in particleNodes { n.removeFromParent() }
        particleNodes.removeAll()
    }

    // MARK: - Laptop occupancy

    /// Open the laptop for any bullpen seat occupied by a working/thinking/error
    /// agent; close the rest. Recomputed each frame but only swaps textures when
    /// the occupied set actually changes.
    private func refreshLaptopOccupancy() {
        var occupied = Set<Int>()
        for a in agents where ["working", "thinking", "error"].contains(a.state) {
            if a.claimedPointKey.hasPrefix("desk_"),
               let seat = Int(a.claimedPointKey.dropFirst("desk_".count)) {
                occupied.insert(seat)
            }
        }
        if occupied == lastOccupiedSeats { return }
        lastOccupiedSeats = occupied

        for (idx, sprite) in laptopSprites {
            let seat = PixelOfficeLaptops.idToSeat[idx] ?? idx
            let open = occupied.contains(seat)
            let dir = PixelOfficeLaptops.spots[idx].dir
            if let tex = PixelOfficeTextureCache.shared.staticTexture(named: PixelOfficeLaptops.imageName(dir: dir, open: open)) {
                sprite.texture = tex
            }
        }
    }
}

// MARK: - Agent spec

/// Plain value carried from SwiftUI into the SKScene. Kept separate from
/// `AgentWithPerformance` so the scene has no store-layer dependency — it just
/// consumes pre-derived display state.
struct PixelOfficeAgentSpec {
    let displayName: String
    let emoji: String
    let accentColorHex: String?
    /// Stable 0…7 character index (see `AgentSpriteIndex`) so the office desk
    /// character matches the agent's avatar tile on its card.
    let spriteIndex: Int
    let state: String      // working | thinking | done | idle | error
    let stateLabel: String // pill text (OFF / PICKS READY / WORKING / …)
    let isActive: Bool
    /// Graded record + units for the wall screen (0 when the roster has no performance, e.g. demo rosters).
    var wins: Int = 0
    var losses: Int = 0
    var pushes: Int = 0
    var netUnits: Double = 0
    /// Drive the agent's performance mood (emotes + icons); nil/0 = neutral.
    var winRate: Double? = nil
    var currentStreak: Int = 0
}

/// Numbers the conference-room screen cycles through, all derived from the roster the scene already has.
struct PixelOfficeScreenStats {
    let working: Int, ready: Int, total: Int
    let wins: Int, losses: Int, pushes: Int, units: Double
    let top: PixelOfficeAgentSpec?

    init(specs: [PixelOfficeAgentSpec]) {
        working = specs.filter { $0.isActive && ($0.state == "working" || $0.state == "thinking") }.count
        ready = specs.filter { $0.state == "done" }.count
        total = specs.count
        wins = specs.reduce(0) { $0 + $1.wins }; losses = specs.reduce(0) { $0 + $1.losses }; pushes = specs.reduce(0) { $0 + $1.pushes }
        units = specs.reduce(0) { $0 + $1.netUnits }
        top = specs.filter { $0.wins + $0.losses > 0 }.max { $0.netUnits < $1.netUnits }
    }

    func pages() -> [(label: String, value: String, accent: UIColor)] {
        let white = UIColor.white, green = UIColor(red: 0.49, green: 0.85, blue: 0.34, alpha: 1), red = UIColor(red: 0.94, green: 0.39, blue: 0.35, alpha: 1)
        let u = (units >= 0 ? "+" : "−") + String(format: "%.1fu", abs(units))
        var out: [(String, String, UIColor)] = [("AGENT HQ · LIVE", "\(working) working · \(ready) ready", white)]
        if wins + losses + pushes > 0 {
            out.append(("TEAM RECORD", "\(wins)-\(losses)-\(pushes)", white))
            out.append(("NET UNITS", u, units >= 0 ? green : red))
        }
        if let top {
            let tu = (top.netUnits >= 0 ? "+" : "−") + String(format: "%.1fu", abs(top.netUnits))
            out.append(("TOP AGENT · \(tu)", top.displayName, white))
        }
        return out
    }
}

extension PixelOfficeAgentSpec {
    /// Derive an office display state from an `AgentWithPerformance`. Mirrors
    /// `deriveOfficeState` in PixelOffice.tsx (line 486).
    static func make(from row: AgentWithPerformance) -> PixelOfficeAgentSpec {
        let state: String
        let label: String
        if !row.agent.isActive {
            state = "idle"; label = "OFF"
        } else if let lastGen = row.agent.lastGeneratedAt,
                  let date = ISO8601DateFormatter().date(from: lastGen),
                  Calendar.current.isDateInToday(date) {
            state = "done"; label = "PICKS READY"
        } else {
            state = "working"; label = "WORKING"
        }
        return PixelOfficeAgentSpec(
            displayName: row.agent.name,
            emoji: row.agent.avatarEmoji,
            accentColorHex: row.agent.avatarColor,
            spriteIndex: row.agent.spriteIndex,
            state: state,
            stateLabel: label,
            isActive: row.agent.isActive,
            wins: row.performance?.wins ?? 0,
            losses: row.performance?.losses ?? 0,
            pushes: row.performance?.pushes ?? 0,
            netUnits: row.performance?.netUnits ?? 0,
            winRate: AgentMood.winRate(row.performance),
            currentStreak: row.performance?.currentStreak ?? 0
        )
    }
}
