package com.wagerproof.core.design.pixeloffice

import androidx.compose.ui.graphics.Color

// Port of iOS `PixelOfficeAssets.swift` (itself ported verbatim from RN
// `PixelOffice.tsx`). Every constant here is verbatim-critical — see
// docs/inventory/04_design.md §6 and 05_features_agents_part4 §PixelOfficeAssets.

// MARK: - Sprite-sheet frame indices

/**
 * Each animation cycles through 4 frames indexed into the 8-col × 9-row sheet
 * (left-to-right, top-to-bottom: idx 0 = (col 0, row 0), idx 8 = (col 0, row 1)).
 * Row 0 = front, row 2 = left, row 4 = right, row 6 = back; row 8 holds the
 * done-dance + alert-jump specials.
 */
enum class PixelAnim(val key: String, val frameIndices: List<Int>) {
    FRONT_IDLE("front_idle", listOf(0, 1, 2, 3)),
    FRONT_WALK("front_walk", listOf(4, 5, 6, 7)),
    FRONT_SIT_IDLE("front_sit_idle", listOf(8, 9, 10, 11)),
    FRONT_SIT_WORK("front_sit_work", listOf(12, 13, 14, 15)),
    LEFT_IDLE("left_idle", listOf(16, 17, 18, 19)),
    LEFT_WALK("left_walk", listOf(20, 21, 22, 23)),
    LEFT_SIT_IDLE("left_sit_idle", listOf(24, 25, 26, 27)),
    LEFT_SIT_WORK("left_sit_work", listOf(28, 29, 30, 31)),
    RIGHT_IDLE("right_idle", listOf(32, 33, 34, 35)),
    RIGHT_WALK("right_walk", listOf(36, 37, 38, 39)),
    RIGHT_SIT_IDLE("right_sit_idle", listOf(40, 41, 42, 43)),
    RIGHT_SIT_WORK("right_sit_work", listOf(44, 45, 46, 47)),
    BACK_IDLE("back_idle", listOf(48, 49, 50, 51)),
    BACK_WALK("back_walk", listOf(52, 53, 54, 55)),
    BACK_SIT_IDLE("back_sit_idle", listOf(56, 57, 58, 59)),
    BACK_SIT_WORK("back_sit_work", listOf(60, 61, 62, 63)),
    FRONT_DONE_DANCE("front_done_dance", listOf(64, 65, 66, 67)),
    FRONT_ALERT_JUMP("front_alert_jump", listOf(68, 69, 70, 71));

    /** True for the slow 2 fps "asleep" idle cycles (vs the 6 fps alive ones). */
    val isIdle: Boolean
        get() = when (this) {
            FRONT_IDLE, BACK_IDLE, LEFT_IDLE, RIGHT_IDLE,
            FRONT_SIT_IDLE, BACK_SIT_IDLE, LEFT_SIT_IDLE, RIGHT_SIT_IDLE,
            -> true

            else -> false
        }

    companion object {
        private val byKey = entries.associateBy { it.key }
        fun fromKey(key: String): PixelAnim? = byKey[key]
    }
}

// MARK: - Geometry constants

/**
 * The office map renders in a logical 864×800 px coordinate space (top-down,
 * y grows downward); the Compose container aspect-fits it to the canvas.
 */
object PixelOfficeGeo {
    const val MAP_WIDTH = 864f
    const val MAP_HEIGHT = 800f
    const val FRAME_WIDTH = 48f
    const val FRAME_HEIGHT = 64f
    const val SHEET_COLS = 8
    const val SHEET_ROWS = 9
    const val WALK_SPEED = 110f // px/sec in map coords
    const val ANIM_FPS = 6.0
    const val IDLE_ANIM_FPS = 2.0
    const val ARRIVE_THRESHOLD = 2f // px — "arrived" tolerance

    /** Tile size for the A* pathfinder grid. */
    const val TILE = 32f
}

// MARK: - State colors / labels

/** Name-tag pill colors so visual status reads at a glance. */
object PixelOfficeStateColor {
    val idle = Color(0xFF94A3B8)
    val working = Color(0xFFF97316)
    val thinking = Color(0xFF8B5CF6)
    val done = Color(0xFF22C55E)
    val error = Color(0xFFEF4444)

    fun forState(s: String): Color = when (s) {
        "working" -> working
        "thinking" -> thinking
        "done" -> done
        "error" -> error
        else -> idle
    }

    fun label(s: String): String = when (s) {
        "working" -> "WORKING"
        "thinking" -> "THINKING"
        "done" -> "DONE"
        "error" -> "ERROR"
        else -> "RESTING"
    }
}

// MARK: - Interaction points

/** Raw point with a facing direction. `facing` ∈ down | up | left | right. */
data class OfficePoint(val x: Float, val y: Float, val facing: String)

/**
 * A claimable target an agent can walk to and occupy. [key] is the stable
 * claim token (`desk_3`, `idle_0`, …).
 */
data class ClaimablePoint(
    val x: Float,
    val y: Float,
    val facing: String,
    val type: String, // desk | idle | meeting
    val key: String,
    val activity: String, // working | idle | meeting
    val roomId: String,
)

object PixelOfficePoints {
    /**
     * 8 bullpen desks. Row 1 (y=544) faces down toward the camera, row 2
     * (y=672) faces up.
     */
    val desks = listOf(
        OfficePoint(112f, 544f, "down"),
        OfficePoint(176f, 544f, "down"),
        OfficePoint(304f, 544f, "down"),
        OfficePoint(368f, 544f, "down"),
        OfficePoint(112f, 672f, "up"),
        OfficePoint(176f, 672f, "up"),
        OfficePoint(304f, 672f, "up"),
        OfficePoint(368f, 672f, "up"),
    )

    /** Rest spots (patio / CEO office / kitchen / stairs) — done/idle agents. */
    val idle = listOf(
        OfficePoint(240f, 96f, "down"),
        OfficePoint(304f, 96f, "down"),
        OfficePoint(48f, 128f, "right"),
        OfficePoint(112f, 128f, "right"),
        OfficePoint(528f, 160f, "down"),
        OfficePoint(560f, 160f, "down"),
        OfficePoint(592f, 160f, "left"),
        OfficePoint(624f, 160f, "left"),
        OfficePoint(400f, 192f, "down"),
        OfficePoint(688f, 192f, "down"),
        OfficePoint(752f, 192f, "left"),
        OfficePoint(784f, 192f, "left"),
        OfficePoint(80f, 224f, "down"),
        OfficePoint(144f, 224f, "down"),
        OfficePoint(304f, 352f, "down"),
        OfficePoint(336f, 352f, "down"),
        OfficePoint(368f, 352f, "down"),
        OfficePoint(304f, 416f, "up"),
        OfficePoint(336f, 416f, "up"),
        OfficePoint(368f, 416f, "up"),
    )

    /** Conference-room seats. */
    val meeting = listOf(
        OfficePoint(656f, 480f, "down"),
        OfficePoint(720f, 480f, "down"),
        OfficePoint(592f, 512f, "right"),
        OfficePoint(784f, 512f, "left"),
        OfficePoint(592f, 576f, "right"),
        OfficePoint(784f, 576f, "left"),
        OfficePoint(656f, 608f, "up"),
        OfficePoint(720f, 608f, "up"),
    )

    /** Combined claimable set (RN ALL_POINTS). */
    val all: List<ClaimablePoint> = buildList {
        desks.forEachIndexed { i, p ->
            add(ClaimablePoint(p.x, p.y, p.facing, "desk", "desk_$i", "working", "bullpen"))
        }
        idle.forEachIndexed { i, p ->
            add(ClaimablePoint(p.x, p.y, p.facing, "idle", "idle_$i", "idle", "idle"))
        }
        meeting.forEachIndexed { i, p ->
            add(ClaimablePoint(p.x, p.y, p.facing, "meeting", "meeting_$i", "meeting", "conference"))
        }
    }

    /** O(1) key → point lookup for the hot-path game loop (POINTS_BY_KEY). */
    val byKey: Map<String, ClaimablePoint> = all.associateBy { it.key }

    /** All raw spawn points, shuffle-able for initial placement. */
    val allSpawns: List<OfficePoint> = idle + meeting + desks

    /** game direction (down/up/left/right) → sheet dir (front/back/left/right). */
    fun dirImage(facing: String): String = when (facing) {
        "down" -> "front"
        "up" -> "back"
        "left" -> "left"
        "right" -> "right"
        else -> "front"
    }
}

// MARK: - Activity speech-bubble emojis

/**
 * ACTIVITY_BUBBLES from PixelOffice.tsx. The active point set uses
 * working/idle/meeting (none keyed here), so bubbles are dormant — kept for
 * parity so future named activities light up automatically.
 */
object PixelOfficeActivity {
    val bubbles: Map<String, String> = mapOf(
        "getting_coffee" to "☕",
        "eating" to "🍕",
        "watching_tv" to "📺",
        "gaming" to "🎮",
        "grilling" to "🔥",
        "napping" to "💤",
        "thinking" to "💭",
        "snacking" to "🍿",
        "reading" to "📚",
        "fire_hangout" to "🔥",
        "socializing" to "💬",
        "chatting" to "💬",
        "checking_fridge" to "❄️",
        "getting_water" to "💧",
        "petting_dog" to "🐶",
        "cornhole" to "🎯",
        "relaxing" to "🌿",
        "getting_drink" to "🍺",
        "outdoor_meeting" to "💬",
    )
}

// MARK: - Laptop sprite positions

/** Laptop top-left position + facing. */
data class LaptopSpot(val x: Float, val y: Float, val dir: String)

/**
 * All 16 laptops draw every frame; one renders "open" only when the desk seat
 * it maps to (via [idToSeat]) is occupied by a working/thinking/error agent.
 * Seats 8-15 (conference) never appear in DESK_POINTS, so those laptops stay
 * closed — matching RN exactly.
 */
object PixelOfficeLaptops {
    val spots = listOf(
        LaptopSpot(608f, 448f, "right"), // idx 0  - conference
        LaptopSpot(640f, 448f, "down"), // idx 1  - conference
        LaptopSpot(704f, 448f, "down"), // idx 2  - conference
        LaptopSpot(736f, 448f, "left"), // idx 3  - conference
        LaptopSpot(96f, 512f, "down"), // idx 4  - bullpen row 1
        LaptopSpot(160f, 512f, "down"), // idx 5  - bullpen row 1
        LaptopSpot(288f, 512f, "down"), // idx 6  - bullpen row 1
        LaptopSpot(352f, 512f, "down"), // idx 7  - bullpen row 1
        LaptopSpot(608f, 512f, "right"), // idx 8  - conference
        LaptopSpot(640f, 512f, "up"), // idx 9  - conference
        LaptopSpot(704f, 512f, "up"), // idx 10 - conference
        LaptopSpot(736f, 512f, "left"), // idx 11 - conference
        LaptopSpot(96f, 576f, "up"), // idx 12 - bullpen row 2
        LaptopSpot(160f, 576f, "up"), // idx 13 - bullpen row 2
        LaptopSpot(288f, 576f, "up"), // idx 14 - bullpen row 2
        LaptopSpot(352f, 576f, "up"), // idx 15 - bullpen row 2
    )

    /** laptop index → desk seat id (LAPTOP_ID_MAP). */
    val idToSeat: Map<Int, Int> = mapOf(
        0 to 10, 1 to 8, 2 to 9, 3 to 11,
        4 to 0, 5 to 1, 6 to 2, 7 to 3,
        8 to 12, 9 to 14, 10 to 15, 11 to 13,
        12 to 4, 13 to 5, 14 to 6, 15 to 7,
    )

    fun imageName(dir: String, open: Boolean): String {
        val dirKey = PixelOfficePoints.dirImage(dir)
        return "office_laptop_${dirKey}_${if (open) "open" else "close"}"
    }
}

// MARK: - Collision grid

/**
 * 27×25 collision bitmap parsed from RN's office_collision.webp — '1' walkable,
 * '0' blocked. COPIED CHARACTER-FOR-CHARACTER from PixelOfficeAssets.swift.
 */
object PixelOfficeCollision {
    const val GRID_COLS = 27
    const val GRID_ROWS = 25

    val collisionGrid = listOf(
        "000000000000000000000000000",
        "000000000000000000000000000",
        "000000011110000000000000000",
        "010111111110000000000000000",
        "011111111110000001110111100",
        "011110011100110111110111100",
        "011010011100111110010111100",
        "011110011100111111111111100",
        "000000111111111111111111100",
        "000000111111111000000000000",
        "000000111111111000000000000",
        "011110111111111000000000000",
        "000110111111111000001111100",
        "001110111111111011111111110",
        "011111111111111011111111110",
        "011111111111111011100000110",
        "011111111111111011100000110",
        "010000010000011111100000110",
        "010000010000011111111111110",
        "010000010000011111111111110",
        "010111010111011000000000000",
        "011111111111111000000000000",
        "000000000000000000000000000",
        "000000000000000000000000000",
        "000000000000000000000000000",
    )

    /** Blocked tiles keyed by `row * GRID_COLS + col`. */
    val blocked: Set<Int> = buildSet {
        collisionGrid.forEachIndexed { r, line ->
            line.forEachIndexed { c, ch ->
                if (ch == '0') add(r * GRID_COLS + c)
            }
        }
    }

    fun tileCenterX(col: Int): Float = col * PixelOfficeGeo.TILE + PixelOfficeGeo.TILE / 2
    fun tileCenterY(row: Int): Float = row * PixelOfficeGeo.TILE + PixelOfficeGeo.TILE / 2
    fun pixToCol(x: Float): Int = (x / PixelOfficeGeo.TILE).toInt().coerceIn(0, GRID_COLS - 1)
    fun pixToRow(y: Float): Int = (y / PixelOfficeGeo.TILE).toInt().coerceIn(0, GRID_ROWS - 1)
}

// MARK: - Particle

/**
 * Lightweight mutable particle for the canvas particle field (night monitor
 * glow + dormant coffee/fire effects). [color] bakes the source rgba alpha;
 * [opacity] modulates on top at draw time.
 */
class PixelOfficeParticle(
    var x: Float,
    var y: Float,
    var vx: Float,
    var vy: Float,
    var life: Float, // 0-1 remaining
    var maxLife: Float,
    var radius: Float,
    var color: Color,
    var opacity: Float,
)
