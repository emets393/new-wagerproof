package com.wagerproof.core.design.pixeloffice

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.random.Random

/**
 * Plain value carried from the caller into the office sim. Kept free of any
 * store-layer dependency — it consumes pre-derived display state, mirroring
 * iOS `PixelOfficeAgentSpec`. Derivation contract (deriveOfficeState): not
 * active → idle/"OFF"; generated today → done/"PICKS READY"; else
 * working/"WORKING".
 */
data class PixelOfficeAgentSpec(
    val displayName: String,
    val emoji: String,
    /** `#RRGGBB` or `gradient:#RRGGBB,...` — name-tag border accent. */
    val accentColorHex: String?,
    /** Stable 0..7 character index — matches the agent's card avatar tile. */
    val spriteIndex: Int,
    val state: String, // working | thinking | done | idle | error
    val stateLabel: String, // pill text (OFF / PICKS READY / WORKING / …)
    val isActive: Boolean,
)

/**
 * One agent in the office — full simulation state (map-space position, walk
 * path, facing, animation key/frame, logical state) plus render-side name-tag
 * data. All positions are top-down 0..864 / 0..800 map coordinates (y grows
 * downward — Compose draws top-down natively, no SpriteKit Y flip needed).
 */
class PixelOfficeAgent(
    val agentIndex: Int,
    /** 0..7 — which avatar_N sheet drives this character. */
    val avatarIdx: Int,
    val displayName: String,
    val emoji: String,
    val accentColor: Color,
) {
    var mapX = 0f
    var mapY = 0f
    var targetX = 0f
    var targetY = 0f
    var fromX = 0f
    var fromY = 0f
    var toX = 0f
    var toY = 0f

    var facing = "down" // down | up | left | right
    var arrived = true
    var path = mutableListOf<GridCoord>()
    var pathIdx = 0
    var moveProgress = 0f // 0-1 between current tile centers

    var state = "idle" // working | thinking | done | idle | error
    var isActive = true
    var claimedPointKey = ""
    var bubbleEmoji = ""

    var animKey = "front_idle"
    var frameIdx = 0
    var animTimer = 0.0 // accumulates dt for fps-gated frame steps

    /** Pill text (may be a derived label like "PICKS READY", not just state). */
    var stateLabel = "RESTING"

    /**
     * De-collision offset applied to the floating name tag by the label
     * relaxation. (0,0) = directly above the head.
     */
    var nameTagOffset = Offset.Zero

    /** "emoji name" truncated at 13 chars — precomputed once like iOS. */
    val tagText: String = run {
        val full = if (emoji.isEmpty()) displayName else "$emoji $displayName"
        if (full.length > 13) full.take(12) + "…" else full
    }

    companion object {
        /**
         * Foot-anchor lift: sprite center sits FRAME_HEIGHT/2 − 8 = 24 px above
         * the map point (RN `destY = y - FH + 8`), so feet meet desks/seats.
         */
        const val FOOT_ANCHOR_LIFT = PixelOfficeGeo.FRAME_HEIGHT / 2 - 8f

        /**
         * Parse `#6366f1` or `gradient:#6366f1,#ec4899` into a Color. Falls
         * back to slate-grey so the name-tag border never vanishes.
         */
        fun parseAccentColor(raw: String?): Color {
            val fallback = Color(0xFF94A3B8)
            var input = raw?.takeIf { it.isNotEmpty() } ?: return fallback
            if (input.startsWith("gradient:")) {
                input = input.removePrefix("gradient:").substringBefore(",")
            }
            var hex = input.trim()
            if (hex.startsWith("#")) hex = hex.drop(1)
            if (hex.length != 6) return fallback
            val value = hex.toLongOrNull(16) ?: return fallback
            return Color(0xFF000000L or value)
        }
    }
}

/**
 * The pixel-office simulation — port of `PixelOfficeScene.swift`'s game loop
 * (itself the RN requestAnimationFrame loop): A* walk-to-station motion, point
 * claiming, staggered initial routing + periodic 5 s state churn, name-tag
 * label relaxation, night monitor-glow particles, and laptop occupancy.
 *
 * Pure state + step functions with no Compose dependency; the [PixelOffice]
 * composable steps it from `withFrameNanos` and draws the result each frame.
 */
class PixelOfficeSimulation(private val random: Random = Random.Default) {

    var agents: List<PixelOfficeAgent> = emptyList()
        private set

    /** Derived from the floor key — gates the night-only monitor-glow particles. */
    var isNight = false

    val particles = mutableListOf<PixelOfficeParticle>()

    private val claimedPoints = mutableSetOf<String>()
    private var particleTimer = 0f
    private var churnTimer = 0f
    private var elapsed = 0.0

    /** Pending staggered initial routes: fire-at-time (s) → agent. */
    private val pendingRoutes = mutableListOf<Pair<Double, PixelOfficeAgent>>()

    /**
     * Replace the roster. Spawns each agent at a random spot, then staggers a
     * FORCED route to its station (0.6 + i·0.4 s) — RN's same-state early
     * return would otherwise leave them parked at their spawn point forever.
     */
    fun setAgents(specs: List<PixelOfficeAgentSpec>) {
        agents = emptyList()
        claimedPoints.clear()
        particles.clear()
        pendingRoutes.clear()
        elapsed = 0.0
        churnTimer = 0f
        particleTimer = 0f

        val capped = specs.take(PixelOfficePoints.desks.size)
        val spawns = PixelOfficePoints.allSpawns.shuffled(random)

        val roster = capped.mapIndexed { idx, spec ->
            PixelOfficeAgent(
                agentIndex = idx,
                avatarIdx = spec.spriteIndex.coerceIn(0, 7),
                displayName = spec.displayName,
                emoji = spec.emoji,
                accentColor = PixelOfficeAgent.parseAccentColor(spec.accentColorHex),
            ).apply {
                val spawn = spawns[idx % spawns.size]
                val sx = spawn.x + random.nextFloat() * 8f - 4f
                val sy = spawn.y + random.nextFloat() * 8f - 4f
                mapX = sx; mapY = sy
                targetX = sx; targetY = sy
                fromX = sx; fromY = sy
                toX = sx; toY = sy
                facing = "down"
                arrived = true
                isActive = spec.isActive
                animKey = "front_idle"
                // Seed the pill with the derived state/label so the color
                // reads correctly during the brief pre-route window.
                state = spec.state
                stateLabel = spec.stateLabel
            }
        }
        agents = roster

        roster.forEachIndexed { idx, agent ->
            pendingRoutes.add((0.6 + idx * 0.4) to agent)
        }
    }

    /** Advance the whole sim. Caller clamps dt to 0.1 s (pause/resume gaps). */
    fun update(dt: Float) {
        if (dt <= 0f) return
        elapsed += dt

        // Staggered initial routing.
        val due = pendingRoutes.filter { it.first <= elapsed }
        if (due.isNotEmpty()) {
            pendingRoutes.removeAll(due)
            for ((_, agent) in due) setAgentState(agent, agent.state, force = true)
        }

        // Periodic state churn — every 5 s a random agent re-routes.
        churnTimer += dt
        if (churnTimer >= 5f) {
            churnTimer -= 5f
            periodicStateChange()
        }

        stepAgents(dt)
        relaxLabels(dt)

        particleTimer += dt
        if (particleTimer > 0.3f) {
            particleTimer = 0f
            spawnActivityParticles()
        }
        updateParticles(dt)
    }

    /** Bullpen seats (0-7) occupied by a working/thinking/error agent. */
    fun occupiedSeats(): Set<Int> {
        val occupied = mutableSetOf<Int>()
        for (a in agents) {
            if (a.state !in WORK_STATES) continue
            if (a.claimedPointKey.startsWith("desk_")) {
                a.claimedPointKey.removePrefix("desk_").toIntOrNull()?.let(occupied::add)
            }
        }
        return occupied
    }

    // MARK: - State assignment + claiming

    /**
     * Assign a new logical state and route the agent to an appropriate point.
     * [force] overrides the same-state early return (initial routing).
     */
    private fun setAgentState(agent: PixelOfficeAgent, newState: String, force: Boolean = false) {
        if (!force && agent.state == newState) return

        agent.state = newState
        agent.stateLabel = if (agent.isActive) PixelOfficeStateColor.label(newState) else "OFF"

        if (agent.claimedPointKey.isNotEmpty()) {
            claimedPoints.remove(agent.claimedPointKey)
            agent.claimedPointKey = ""
        }

        var point: ClaimablePoint? = when (newState) {
            "working", "thinking" -> claimPoint(PixelOfficePoints.all.filter { it.type == "desk" })
            "done" -> claimPoint(PixelOfficePoints.all.filter { it.type == "idle" })
            "idle" -> claimPoint(PixelOfficePoints.all.filter { it.type == "idle" || it.type == "meeting" })
            "error" -> return // stay put at the current desk
            else -> null
        }
        if (point == null) point = claimPoint(PixelOfficePoints.all)
        val pt = point ?: return

        agent.claimedPointKey = pt.key
        agent.targetX = pt.x
        agent.targetY = pt.y
        agent.arrived = false

        val path = PixelOfficePathfinding.aStar(
            startCol = PixelOfficePathfinding.pixToCol(agent.mapX),
            startRow = PixelOfficePathfinding.pixToRow(agent.mapY),
            endCol = PixelOfficePathfinding.pixToCol(pt.x),
            endRow = PixelOfficePathfinding.pixToRow(pt.y),
        )
        agent.path = path.toMutableList()
        agent.pathIdx = 0
        agent.moveProgress = 0f
        agent.fromX = agent.mapX
        agent.fromY = agent.mapY
        val first = path.firstOrNull()
        if (first != null) {
            agent.toX = PixelOfficePathfinding.tileCenterX(first.col)
            agent.toY = PixelOfficePathfinding.tileCenterY(first.row)
        } else {
            agent.toX = pt.x
            agent.toY = pt.y
        }
        agent.bubbleEmoji = PixelOfficeActivity.bubbles[pt.activity] ?: ""
    }

    private fun claimPoint(candidates: List<ClaimablePoint>): ClaimablePoint? {
        for (pt in candidates.shuffled(random)) {
            if (pt.key !in claimedPoints) {
                claimedPoints.add(pt.key)
                return pt
            }
        }
        return null
    }

    private fun periodicStateChange() {
        val agent = agents.randomOrNull(random) ?: return
        val states = if (!agent.isActive) {
            listOf("idle", "idle", "idle", "thinking")
        } else {
            listOf("working", "thinking", "done", "working", "thinking", "idle")
        }
        setAgentState(agent, states.random(random))
    }

    // MARK: - Movement + animation step

    private fun stepAgents(dt: Float) {
        for (a in agents) {
            if (!a.arrived && a.path.isNotEmpty()) {
                val segDist = hypot(a.toX - a.fromX, a.toY - a.fromY)
                val step = if (segDist > 0f) (PixelOfficeGeo.WALK_SPEED * dt) / segDist else 1f
                a.moveProgress += step

                if (a.moveProgress >= 1f) {
                    a.mapX = a.toX; a.mapY = a.toY
                    a.pathIdx += 1
                    if (a.pathIdx < a.path.size) {
                        a.moveProgress = 0f
                        a.fromX = a.mapX; a.fromY = a.mapY
                        a.toX = PixelOfficePathfinding.tileCenterX(a.path[a.pathIdx].col)
                        a.toY = PixelOfficePathfinding.tileCenterY(a.path[a.pathIdx].row)
                    } else {
                        // End of the tile path — final approach to the exact point.
                        val dxF = a.targetX - a.mapX
                        val dyF = a.targetY - a.mapY
                        val distF = hypot(dxF, dyF)
                        if (distF < 4f) {
                            a.mapX = a.targetX; a.mapY = a.targetY
                            a.arrived = true
                            a.path.clear(); a.pathIdx = 0; a.moveProgress = 0f
                            PixelOfficePoints.byKey[a.claimedPointKey]?.let { a.facing = it.facing }
                        } else {
                            a.moveProgress = 0f
                            a.fromX = a.mapX; a.fromY = a.mapY
                            a.toX = a.targetX; a.toY = a.targetY
                            a.path.add(
                                GridCoord(
                                    PixelOfficePathfinding.pixToCol(a.targetX),
                                    PixelOfficePathfinding.pixToRow(a.targetY),
                                ),
                            )
                        }
                    }
                } else {
                    a.mapX = a.fromX + (a.toX - a.fromX) * a.moveProgress
                    a.mapY = a.fromY + (a.toY - a.fromY) * a.moveProgress
                    val dx = a.toX - a.fromX
                    val dy = a.toY - a.fromY
                    a.facing = if (abs(dx) > abs(dy)) (if (dx > 0) "right" else "left") else (if (dy > 0) "down" else "up")
                }
            } else if (!a.arrived && a.path.isEmpty()) {
                // Direct-movement fallback (no path found).
                val dx = a.targetX - a.mapX
                val dy = a.targetY - a.mapY
                val dist = hypot(dx, dy)
                if (dist < 3f) {
                    a.mapX = a.targetX; a.mapY = a.targetY
                    a.arrived = true
                    PixelOfficePoints.byKey[a.claimedPointKey]?.let { a.facing = it.facing }
                } else {
                    val step = PixelOfficeGeo.WALK_SPEED * dt
                    a.mapX += (dx / dist) * minOf(step, dist)
                    a.mapY += (dy / dist) * minOf(step, dist)
                    a.facing = if (abs(dx) > abs(dy)) (if (dx > 0) "right" else "left") else (if (dy > 0) "down" else "up")
                }
            }

            // ── Animation key ──
            val dir = PixelOfficePoints.dirImage(a.facing)
            if (!a.arrived) {
                a.animKey = "${dir}_walk"
                a.bubbleEmoji = ""
            } else if (a.state == "done") {
                a.animKey = "front_done_dance"
            } else if (a.state == "error") {
                a.animKey = "front_alert_jump"
            } else {
                val pt = if (a.claimedPointKey.isNotEmpty()) PixelOfficePoints.byKey[a.claimedPointKey] else null
                if ((a.state == "working" || a.state == "thinking") && pt != null &&
                    (pt.activity == "working" || pt.activity == "thinking")
                ) {
                    val ptDir = PixelOfficePoints.dirImage(pt.facing)
                    a.animKey = if (a.state == "working") "${ptDir}_sit_work" else "${ptDir}_sit_idle"
                } else {
                    a.animKey = "${dir}_idle"
                }
            }

            // ── Frame cycling (idle sit/stand ticks slower) ──
            val fps = if (a.arrived && a.state == "idle") PixelOfficeGeo.IDLE_ANIM_FPS else PixelOfficeGeo.ANIM_FPS
            a.animTimer += dt.toDouble()
            val interval = 1.0 / fps
            if (a.animTimer >= interval) {
                a.animTimer -= interval
                PixelAnim.fromKey(a.animKey)?.let { anim ->
                    a.frameIdx = (a.frameIdx + 1) % anim.frameIndices.size
                }
            }
        }
    }

    // MARK: - Name-tag de-collision

    /**
     * Keep floating name tags from overlapping when agents cluster: a few
     * relaxation passes push tags sharing a ~52-px vertical band apart until
     * their centers are ≥ 2·56 + 6 px, then each tag glides toward its target
     * offset (re-centering to 0 when space frees up).
     */
    private fun relaxLabels(dt: Float) {
        val n = agents.size
        if (n == 0) return

        val halfW = 56f
        val padX = 6f
        val bandH = 52f

        val dxOff = FloatArray(n)
        if (n > 1) {
            repeat(10) {
                for (i in 0 until n) {
                    for (j in (i + 1) until n) {
                        // Different rows → tags don't share a vertical band.
                        if (abs(agents[i].mapY - agents[j].mapY) >= bandH) continue
                        val dx = (agents[j].mapX + dxOff[j]) - (agents[i].mapX + dxOff[i])
                        val overlap = (halfW * 2 + padX) - abs(dx)
                        if (overlap > 0) {
                            val push = overlap / 2
                            // Deterministic tie-break when perfectly x-aligned.
                            val s = if (dx > 0) 1f else if (dx < 0) -1f else if (i < j) -1f else 1f
                            dxOff[i] -= push * s
                            dxOff[j] += push * s
                        }
                    }
                }
            }
        }

        val lerp = minOf(1f, dt * 9f)
        for (i in 0 until n) {
            val target = dxOff[i].coerceIn(-74f, 74f)
            val cur = agents[i].nameTagOffset
            agents[i].nameTagOffset = Offset(
                cur.x + (target - cur.x) * lerp,
                cur.y + (0f - cur.y) * lerp,
            )
        }
    }

    // MARK: - Particles

    /**
     * Per-activity particles each ~0.3 s tick. With the active point set only
     * the night monitor-glow fires; coffee/fire branches are ported for parity
     * and light up if a future point assigns one of those named activities.
     */
    private fun spawnActivityParticles() {
        for (a in agents) {
            if (!a.arrived) continue
            val pt = PixelOfficePoints.byKey[a.claimedPointKey] ?: continue
            if (pt.activity == "getting_coffee") {
                spawnParticle(
                    x = a.mapX + random.nextFloat() * 8f - 4f, y = a.mapY - 20f,
                    color = Color.White.copy(alpha = 0.5f),
                    vy = -15f - random.nextFloat() * 10f,
                    radius = 1f + random.nextFloat() * 1.5f, maxLife = 1.0f,
                )
            }
            if (pt.activity == "fire_hangout" || pt.activity == "grilling") {
                spawnParticle(
                    x = a.mapX + random.nextFloat() * 12f - 6f, y = a.mapY - 10f,
                    color = Color(1f, 140f / 255f, 0f, 0.7f),
                    vx = random.nextFloat() * 12f - 6f, vy = -20f - random.nextFloat() * 15f,
                    radius = 1f + random.nextFloat(), maxLife = 0.7f,
                )
            }
        }
        if (isNight) {
            for (a in agents) {
                if (!(a.arrived && a.state == "working" && a.claimedPointKey.isNotEmpty())) continue
                if (random.nextFloat() < 0.4f) {
                    spawnParticle(
                        x = a.mapX + random.nextFloat() * 16f - 8f, y = a.mapY - 24f,
                        color = Color(45f / 255f, 212f / 255f, 191f / 255f, 0.35f), // teal monitor glow
                        vx = random.nextFloat() * 6f - 3f, vy = -5f - random.nextFloat() * 5f,
                        radius = 2f + random.nextFloat() * 2f, maxLife = 1.2f,
                    )
                }
            }
        }
    }

    private fun spawnParticle(
        x: Float,
        y: Float,
        color: Color,
        vx: Float = random.nextFloat() * 8f - 4f,
        vy: Float = -12f - random.nextFloat() * 8f,
        radius: Float = 1.5f + random.nextFloat() * 1.5f,
        maxLife: Float = 0.8f + random.nextFloat() * 0.6f,
    ) {
        particles.add(
            PixelOfficeParticle(
                x = x, y = y, vx = vx, vy = vy,
                life = 1f, maxLife = maxLife, radius = radius,
                color = color, opacity = 0.6f + random.nextFloat() * 0.3f,
            ),
        )
    }

    private fun updateParticles(dt: Float) {
        for (i in particles.indices.reversed()) {
            val p = particles[i]
            p.life -= dt / p.maxLife
            if (p.life <= 0f) {
                particles.removeAt(i)
                continue
            }
            p.x += p.vx * dt
            p.y += p.vy * dt
            p.opacity = p.life * 0.5f
        }
        while (particles.size > 30) particles.removeAt(0)
    }

    private companion object {
        val WORK_STATES = setOf("working", "thinking", "error")
    }
}
