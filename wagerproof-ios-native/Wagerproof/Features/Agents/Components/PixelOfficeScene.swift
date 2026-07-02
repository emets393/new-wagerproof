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
        particleLayer.zPosition = 3.92
        addChild(particleLayer)

        // ── Foreground overlay ──
        if let fgTex = PixelOfficeTextureCache.shared.staticTexture(named: "office_fg") {
            officeFgSprite = SKSpriteNode(texture: fgTex)
            officeFgSprite.size = CGSize(width: PixelOfficeGeo.mapWidth, height: PixelOfficeGeo.mapHeight)
            officeFgSprite.anchorPoint = CGPoint(x: 0, y: 0)
            officeFgSprite.position = .zero
            officeFgSprite.zPosition = 4
            addChild(officeFgSprite)
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
            node.animKey = "front_idle"
            // Seed the pill with the derived state/label so the color reads
            // correctly during the brief pre-route window.
            node.setState(spec.state, label: spec.stateLabel)
            node.applyTextureFrame()
            node.syncSceneNode()
            addChild(node)
            agents.append(node)
        }

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
        relaxLabels(dt: dt)

        particleTimer += dt
        if particleTimer > 0.3 {
            particleTimer = 0
            spawnActivityParticles()
        }
        updateParticles(dt: dt)
        renderParticles()

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

            a.applyTextureFrame()
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
            isActive: row.agent.isActive
        )
    }
}
