import Foundation
import SpriteKit
import UIKit
import WagerproofDesign

// MARK: - Sprite-sheet frame indices
//
// Ported verbatim from `wagerproof-mobile/components/agents/PixelOffice.tsx`
// (FRAMES dict, ~line 87). Each animation cycles through 4 frames indexed
// into the 8-col x 9-row sheet. Row 0 = front, Row 2 = left, Row 4 = right,
// Row 6 = back; rows 8 holds the done-dance + alert-jump specials.

enum PixelAnim: String {
    case frontIdle = "front_idle"
    case frontWalk = "front_walk"
    case frontSitIdle = "front_sit_idle"
    case frontSitWork = "front_sit_work"
    case leftIdle = "left_idle"
    case leftWalk = "left_walk"
    case leftSitIdle = "left_sit_idle"
    case leftSitWork = "left_sit_work"
    case rightIdle = "right_idle"
    case rightWalk = "right_walk"
    case rightSitIdle = "right_sit_idle"
    case rightSitWork = "right_sit_work"
    case backIdle = "back_idle"
    case backWalk = "back_walk"
    case backSitIdle = "back_sit_idle"
    case backSitWork = "back_sit_work"
    case frontDoneDance = "front_done_dance"
    case frontAlertJump = "front_alert_jump"

    /// 4-frame index list into the 8x9 sheet. Indices count left-to-right,
    /// top-to-bottom: idx 0 = (col 0, row 0), idx 8 = (col 0, row 1), etc.
    var frameIndices: [Int] {
        switch self {
        case .frontIdle: return [0, 1, 2, 3]
        case .frontWalk: return [4, 5, 6, 7]
        case .frontSitIdle: return [8, 9, 10, 11]
        case .frontSitWork: return [12, 13, 14, 15]
        case .leftIdle: return [16, 17, 18, 19]
        case .leftWalk: return [20, 21, 22, 23]
        case .leftSitIdle: return [24, 25, 26, 27]
        case .leftSitWork: return [28, 29, 30, 31]
        case .rightIdle: return [32, 33, 34, 35]
        case .rightWalk: return [36, 37, 38, 39]
        case .rightSitIdle: return [40, 41, 42, 43]
        case .rightSitWork: return [44, 45, 46, 47]
        case .backIdle: return [48, 49, 50, 51]
        case .backWalk: return [52, 53, 54, 55]
        case .backSitIdle: return [56, 57, 58, 59]
        case .backSitWork: return [60, 61, 62, 63]
        case .frontDoneDance: return [64, 65, 66, 67]
        case .frontAlertJump: return [68, 69, 70, 71]
        }
    }

    /// True for the slow 2fps "asleep" idle cycles (vs the 6fps "alive" ones).
    var isIdle: Bool {
        switch self {
        case .frontIdle, .backIdle, .leftIdle, .rightIdle,
             .frontSitIdle, .backSitIdle, .leftSitIdle, .rightSitIdle:
            return true
        default:
            return false
        }
    }
}

// MARK: - Geometry constants
//
// Mirrors the RN constants block — see PixelOffice.tsx lines 67-84. The
// office map is rendered at a logical 864x800 px coordinate space; the
// SwiftUI container scales the SKScene to fit screen width.

enum PixelOfficeGeo {
    static let mapWidth: CGFloat = 864
    static let mapHeight: CGFloat = 800
    static let frameWidth: CGFloat = 48
    static let frameHeight: CGFloat = 64
    static let sheetCols: Int = 8
    static let sheetRows: Int = 9
    static let walkSpeed: CGFloat = 110  // px/sec in map coords
    static let animFps: Double = 6
    static let idleAnimFps: Double = 2
    static let arriveThreshold: CGFloat = 2  // px — "arrived" tolerance
    /// Tile size for the A* pathfinder grid.
    static let tile: CGFloat = 32
}

// MARK: - State colors / labels
//
// Hex codes ported from STATE_COLORS in PixelOffice.tsx (line 108). Used
// for the agent name-tag pill so visual status reads at a glance.

enum PixelOfficeStateColor {
    static let idle = UIColor(red: 0x94 / 255.0, green: 0xa3 / 255.0, blue: 0xb8 / 255.0, alpha: 1)
    static let working = UIColor(red: 0xf9 / 255.0, green: 0x73 / 255.0, blue: 0x16 / 255.0, alpha: 1)
    static let thinking = UIColor(red: 0x8b / 255.0, green: 0x5c / 255.0, blue: 0xf6 / 255.0, alpha: 1)
    static let done = UIColor(red: 0x22 / 255.0, green: 0xc5 / 255.0, blue: 0x5e / 255.0, alpha: 1)
    static let error = UIColor(red: 0xef / 255.0, green: 0x44 / 255.0, blue: 0x44 / 255.0, alpha: 1)

    static func forState(_ s: String) -> UIColor {
        switch s {
        case "working": return working
        case "thinking": return thinking
        case "done": return done
        case "error": return error
        default: return idle
        }
    }

    /// STATE_LABELS from PixelOffice.tsx line 116.
    static func label(for s: String) -> String {
        switch s {
        case "working": return "WORKING"
        case "thinking": return "THINKING"
        case "done": return "DONE"
        case "error": return "ERROR"
        default: return "RESTING"
        }
    }
}

// MARK: - Interaction points
//
// Ported from PixelOffice.tsx DESK_POINTS / IDLE_POINTS / MEETING_POINTS
// (lines 187-232). Coordinates are in map space (0..864, 0..800), top-down
// (y grows downward — the scene flips Y when placing sprites).

/// Raw point with a facing direction. `facing` ∈ down | up | left | right.
struct OfficePoint {
    let x: CGFloat
    let y: CGFloat
    let facing: String
}

/// A claimable target an agent can walk to and occupy. Built from the raw
/// point lists; `key` is the stable claim token (`desk_3`, `idle_0`, …).
struct ClaimablePoint {
    let x: CGFloat
    let y: CGFloat
    let facing: String
    let type: String      // desk | idle | meeting
    let key: String
    let activity: String  // working | idle | meeting
    let roomId: String
}

enum PixelOfficePoints {
    /// 8 bullpen desks. Row 1 (y=544) faces down toward the camera, row 2
    /// (y=672) faces up.
    static let desks: [OfficePoint] = [
        OfficePoint(x: 112, y: 544, facing: "down"),
        OfficePoint(x: 176, y: 544, facing: "down"),
        OfficePoint(x: 304, y: 544, facing: "down"),
        OfficePoint(x: 368, y: 544, facing: "down"),
        OfficePoint(x: 112, y: 672, facing: "up"),
        OfficePoint(x: 176, y: 672, facing: "up"),
        OfficePoint(x: 304, y: 672, facing: "up"),
        OfficePoint(x: 368, y: 672, facing: "up"),
    ]

    /// Rest spots (patio / CEO office / kitchen / stairs) — agents go here when
    /// done or idle.
    static let idle: [OfficePoint] = [
        OfficePoint(x: 240, y: 96, facing: "down"),
        OfficePoint(x: 304, y: 96, facing: "down"),
        OfficePoint(x: 48, y: 128, facing: "right"),
        OfficePoint(x: 112, y: 128, facing: "right"),
        OfficePoint(x: 528, y: 160, facing: "down"),
        OfficePoint(x: 560, y: 160, facing: "down"),
        OfficePoint(x: 592, y: 160, facing: "left"),
        OfficePoint(x: 624, y: 160, facing: "left"),
        OfficePoint(x: 400, y: 192, facing: "down"),
        OfficePoint(x: 688, y: 192, facing: "down"),
        OfficePoint(x: 752, y: 192, facing: "left"),
        OfficePoint(x: 784, y: 192, facing: "left"),
        OfficePoint(x: 80, y: 224, facing: "down"),
        OfficePoint(x: 144, y: 224, facing: "down"),
        OfficePoint(x: 304, y: 352, facing: "down"),
        OfficePoint(x: 336, y: 352, facing: "down"),
        OfficePoint(x: 368, y: 352, facing: "down"),
        OfficePoint(x: 304, y: 416, facing: "up"),
        OfficePoint(x: 336, y: 416, facing: "up"),
        OfficePoint(x: 368, y: 416, facing: "up"),
    ]

    /// Conference-room seats.
    static let meeting: [OfficePoint] = [
        OfficePoint(x: 656, y: 480, facing: "down"),
        OfficePoint(x: 720, y: 480, facing: "down"),
        OfficePoint(x: 592, y: 512, facing: "right"),
        OfficePoint(x: 784, y: 512, facing: "left"),
        OfficePoint(x: 592, y: 576, facing: "right"),
        OfficePoint(x: 784, y: 576, facing: "left"),
        OfficePoint(x: 656, y: 608, facing: "up"),
        OfficePoint(x: 720, y: 608, facing: "up"),
    ]

    /// Combined claimable set — DESK_POINTS + IDLE_POINTS + MEETING_POINTS
    /// (ALL_POINTS in RN, line 246).
    static let all: [ClaimablePoint] = {
        var out: [ClaimablePoint] = []
        for (i, p) in desks.enumerated() {
            out.append(ClaimablePoint(x: p.x, y: p.y, facing: p.facing, type: "desk", key: "desk_\(i)", activity: "working", roomId: "bullpen"))
        }
        for (i, p) in idle.enumerated() {
            out.append(ClaimablePoint(x: p.x, y: p.y, facing: p.facing, type: "idle", key: "idle_\(i)", activity: "idle", roomId: "idle"))
        }
        for (i, p) in meeting.enumerated() {
            out.append(ClaimablePoint(x: p.x, y: p.y, facing: p.facing, type: "meeting", key: "meeting_\(i)", activity: "meeting", roomId: "conference"))
        }
        return out
    }()

    /// O(1) key → point lookup for the hot-path game loop (POINTS_BY_KEY).
    static let byKey: [String: ClaimablePoint] = {
        Dictionary(uniqueKeysWithValues: all.map { ($0.key, $0) })
    }()

    /// All raw spawn points, shuffle-able for initial placement.
    static let allSpawns: [OfficePoint] = idle + meeting + desks

    /// game direction (down/up/left/right) → sprite-sheet dir (front/back/left/right).
    static func dirImage(_ facing: String) -> String {
        switch facing {
        case "down": return "front"
        case "up": return "back"
        case "left": return "left"
        case "right": return "right"
        default: return "front"
        }
    }
}

// MARK: - Activity speech-bubble emojis
//
// ACTIVITY_BUBBLES from PixelOffice.tsx line 122. Only point activities that
// match a key here produce a bubble; the active point set uses working/idle/
// meeting (none of which are keyed), so bubbles are dormant — kept for parity
// and so future named activities light up automatically.

enum PixelOfficeActivity {
    static let bubbles: [String: String] = [
        "getting_coffee": "\u{2615}",
        "eating": "\u{1F355}",
        "watching_tv": "\u{1F4FA}",
        "gaming": "\u{1F3AE}",
        "grilling": "\u{1F525}",
        "napping": "\u{1F4A4}",
        "thinking": "\u{1F4AD}",
        "snacking": "\u{1F37F}",
        "reading": "\u{1F4DA}",
        "fire_hangout": "\u{1F525}",
        "socializing": "\u{1F4AC}",
        "chatting": "\u{1F4AC}",
        "checking_fridge": "\u{2744}\u{FE0F}",
        "getting_water": "\u{1F4A7}",
        "petting_dog": "\u{1F436}",
        "cornhole": "\u{1F3AF}",
        "relaxing": "\u{1F33F}",
        "getting_drink": "\u{1F37A}",
        "outdoor_meeting": "\u{1F4AC}",
    ]
}

// MARK: - Laptop sprite positions
//
// LAPTOP_SPOTS + LAPTOP_ID_MAP from PixelOffice.tsx lines 278-303. All 16
// laptops are drawn; a laptop renders "open" only when the desk seat it maps
// to (via `idToSeat`) is occupied by a working/thinking/error agent. Seats
// 8-15 (conference) never appear in DESK_POINTS, so those laptops stay closed
// — matching RN exactly.

struct LaptopSpot {
    let x: CGFloat
    let y: CGFloat
    let dir: String  // down | up | left | right
}

enum PixelOfficeLaptops {
    static let spots: [LaptopSpot] = [
        LaptopSpot(x: 608, y: 448, dir: "right"),   // idx 0  - conference
        LaptopSpot(x: 640, y: 448, dir: "down"),    // idx 1  - conference
        LaptopSpot(x: 704, y: 448, dir: "down"),    // idx 2  - conference
        LaptopSpot(x: 736, y: 448, dir: "left"),    // idx 3  - conference
        LaptopSpot(x: 96, y: 512, dir: "down"),     // idx 4  - bullpen row 1
        LaptopSpot(x: 160, y: 512, dir: "down"),    // idx 5  - bullpen row 1
        LaptopSpot(x: 288, y: 512, dir: "down"),    // idx 6  - bullpen row 1
        LaptopSpot(x: 352, y: 512, dir: "down"),    // idx 7  - bullpen row 1
        LaptopSpot(x: 608, y: 512, dir: "right"),   // idx 8  - conference
        LaptopSpot(x: 640, y: 512, dir: "up"),      // idx 9  - conference
        LaptopSpot(x: 704, y: 512, dir: "up"),      // idx 10 - conference
        LaptopSpot(x: 736, y: 512, dir: "left"),    // idx 11 - conference
        LaptopSpot(x: 96, y: 576, dir: "up"),       // idx 12 - bullpen row 2
        LaptopSpot(x: 160, y: 576, dir: "up"),      // idx 13 - bullpen row 2
        LaptopSpot(x: 288, y: 576, dir: "up"),      // idx 14 - bullpen row 2
        LaptopSpot(x: 352, y: 576, dir: "up"),      // idx 15 - bullpen row 2
    ]

    /// laptop index → desk seat id (LAPTOP_ID_MAP).
    static let idToSeat: [Int: Int] = [
        0: 10, 1: 8, 2: 9, 3: 11,
        4: 0, 5: 1, 6: 2, 7: 3,
        8: 12, 9: 14, 10: 15, 11: 13,
        12: 4, 13: 5, 14: 6, 15: 7,
    ]

    static func imageName(dir: String, open: Bool) -> String {
        let dirKey = PixelOfficePoints.dirImage(dir)
        return "office_laptop_\(dirKey)_\(open ? "open" : "close")"
    }
}

// MARK: - Collision grid + A* pathfinding
//
// Ported from PixelOffice.tsx lines 144-434. The collision bitmap (parsed from
// office_collision.webp in the RN source) is a 27x25 grid where '1' = walkable
// and '0' = blocked. A* runs 8-directionally and is allowed to terminate on a
// blocked end tile (interaction points sit on/near furniture).

struct GridCoord: Equatable {
    let col: Int
    let row: Int
}

enum PixelOfficePathfinding {
    static let gridCols = Int((PixelOfficeGeo.mapWidth / PixelOfficeGeo.tile).rounded(.up))   // 27
    static let gridRows = Int((PixelOfficeGeo.mapHeight / PixelOfficeGeo.tile).rounded(.up))  // 25

    static let collisionGrid: [String] = [
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
    ]

    /// Blocked tiles keyed by `row * gridCols + col`.
    static let blocked: Set<Int> = {
        var set = Set<Int>()
        for (r, line) in collisionGrid.enumerated() {
            for (c, ch) in line.enumerated() where ch == "0" {
                set.insert(r * gridCols + c)
            }
        }
        return set
    }()

    static func tileCenterX(_ col: Int) -> CGFloat { CGFloat(col) * PixelOfficeGeo.tile + PixelOfficeGeo.tile / 2 }
    static func tileCenterY(_ row: Int) -> CGFloat { CGFloat(row) * PixelOfficeGeo.tile + PixelOfficeGeo.tile / 2 }
    static func pixToCol(_ x: CGFloat) -> Int { max(0, min(gridCols - 1, Int(x / PixelOfficeGeo.tile))) }
    static func pixToRow(_ y: CGFloat) -> Int { max(0, min(gridRows - 1, Int(y / PixelOfficeGeo.tile))) }

    private static func key(_ c: Int, _ r: Int) -> Int { r * gridCols + c }

    private final class ANode {
        let col: Int
        let row: Int
        var g: CGFloat
        var f: CGFloat
        var parent: ANode?
        init(col: Int, row: Int, g: CGFloat, f: CGFloat, parent: ANode?) {
            self.col = col; self.row = row; self.g = g; self.f = f; self.parent = parent
        }
    }

    private struct Dir { let dc: Int; let dr: Int; let cost: CGFloat }
    private static let dirs: [Dir] = [
        Dir(dc: 0, dr: -1, cost: 1), Dir(dc: 0, dr: 1, cost: 1),
        Dir(dc: -1, dr: 0, cost: 1), Dir(dc: 1, dr: 0, cost: 1),
        Dir(dc: -1, dr: -1, cost: 1.4), Dir(dc: 1, dr: -1, cost: 1.4),
        Dir(dc: -1, dr: 1, cost: 1.4), Dir(dc: 1, dr: 1, cost: 1.4),
    ]

    /// 8-directional A*. Returns a list of tile centers to walk (excluding the
    /// start tile). Empty when start == end; a single direct tile when no path
    /// is found (RN's fallback).
    static func aStar(startCol: Int, startRow: Int, endCol: Int, endRow: Int) -> [GridCoord] {
        let sc = max(0, min(gridCols - 1, startCol))
        let sr = max(0, min(gridRows - 1, startRow))
        let ec = max(0, min(gridCols - 1, endCol))
        let er = max(0, min(gridRows - 1, endRow))
        if sc == ec && sr == er { return [] }

        func h(_ c: Int, _ r: Int) -> CGFloat { CGFloat(abs(c - ec) + abs(r - er)) }

        var closed = Set<Int>()
        var openMap: [Int: ANode] = [:]
        let start = ANode(col: sc, row: sr, g: 0, f: h(sc, sr), parent: nil)
        var openList: [ANode] = [start]
        openMap[key(sc, sr)] = start

        while !openList.isEmpty {
            openList.sort { $0.f < $1.f }
            let current = openList.removeFirst()
            let ck = key(current.col, current.row)
            openMap[ck] = nil

            if current.col == ec && current.row == er {
                var path: [GridCoord] = []
                var node: ANode? = current
                while let n = node, !(n.col == sc && n.row == sr) {
                    path.insert(GridCoord(col: n.col, row: n.row), at: 0)
                    node = n.parent
                }
                return path
            }

            closed.insert(ck)

            for d in dirs {
                let nc = current.col + d.dc
                let nr = current.row + d.dr
                if nc < 0 || nc >= gridCols || nr < 0 || nr >= gridRows { continue }
                let nk = key(nc, nr)
                if closed.contains(nk) { continue }
                // Allow the end tile even if blocked (points sit near furniture).
                if blocked.contains(nk) && !(nc == ec && nr == er) { continue }
                // Diagonal: don't cut corners through walls.
                if d.dc != 0 && d.dr != 0 {
                    if blocked.contains(key(current.col + d.dc, current.row)) ||
                       blocked.contains(key(current.col, current.row + d.dr)) {
                        continue
                    }
                }
                let g = current.g + d.cost
                if let existing = openMap[nk] {
                    if g < existing.g {
                        existing.g = g
                        existing.f = g + h(nc, nr)
                        existing.parent = current
                    }
                } else {
                    let node = ANode(col: nc, row: nr, g: g, f: g + h(nc, nr), parent: current)
                    openList.append(node)
                    openMap[nk] = node
                }
            }

            if closed.count > 2000 { break }
        }

        // No path found — direct fallback to the destination tile.
        return [GridCoord(col: ec, row: er)]
    }
}

// MARK: - Particle
//
// Lightweight value type for the canvas particle field (coffee steam, fire
// embers, monitor glow). Mirrors the Particle interface in PixelOffice.tsx
// line 468. `color` bakes the source rgba alpha; `opacity` modulates on top
// (rendered as the SKShapeNode's node alpha).

struct PixelOfficeParticle {
    var x: CGFloat
    var y: CGFloat
    var vx: CGFloat
    var vy: CGFloat
    var life: CGFloat      // 0-1 remaining
    var maxLife: CGFloat
    var radius: CGFloat
    var color: UIColor
    var opacity: CGFloat
}

// MARK: - Texture cache
//
// SpriteKit caches SKTextures aggressively, but each call to
// `SKTexture(imageNamed:)` still re-hits the image-loading pipeline. We
// memoize per-frame textures so the loop doesn't allocate. All assets live in
// the WagerproofDesign module bundle (Resources/PixelOffice).

@MainActor
final class PixelOfficeTextureCache {
    static let shared = PixelOfficeTextureCache()
    private init() {}

    private var sheetCache: [Int: SKTexture] = [:]
    private var frameCache: [String: SKTexture] = [:]
    private var staticCache: [String: SKTexture] = [:]

    /// Load an avatar sprite sheet (avatar_0 .. avatar_7) as one big SKTexture.
    /// We rely on SKTexture(rect:in:) to crop frames on demand.
    func sheet(forAvatarIdx idx: Int) -> SKTexture? {
        let bounded = max(0, min(7, idx))
        if let cached = sheetCache[bounded] { return cached }
        let name = "avatar_\(bounded)"
        guard let img = UIImage(named: name, in: .designModule, with: nil) else {
            return nil
        }
        let tex = SKTexture(image: img)
        // Nearest-neighbour preserves the crisp pixel-art look — bilinear
        // would smear the 48x64 frames into mush at the upscaled display size.
        tex.filteringMode = .nearest
        sheetCache[bounded] = tex
        return tex
    }

    /// Crop a single 48x64 frame out of a sheet. Frames index left-to-right,
    /// top-to-bottom across an 8x9 grid.
    func frame(forAvatarIdx avatarIdx: Int, frameIndex: Int) -> SKTexture? {
        let key = "\(avatarIdx)_\(frameIndex)"
        if let cached = frameCache[key] { return cached }
        guard let sheet = sheet(forAvatarIdx: avatarIdx) else { return nil }
        let col = frameIndex % PixelOfficeGeo.sheetCols
        let row = frameIndex / PixelOfficeGeo.sheetCols
        // SKTexture.rect uses normalized (0..1) coords with origin at the
        // *bottom-left*. Sprite sheets are laid out top-down so we flip Y.
        let fw = 1.0 / CGFloat(PixelOfficeGeo.sheetCols)
        let fh = 1.0 / CGFloat(PixelOfficeGeo.sheetRows)
        let rect = CGRect(
            x: CGFloat(col) * fw,
            y: 1.0 - CGFloat(row + 1) * fh,
            width: fw,
            height: fh
        )
        let cropped = SKTexture(rect: rect, in: sheet)
        cropped.filteringMode = .nearest
        frameCache[key] = cropped
        return cropped
    }

    /// 4-frame animation array for a specific avatar + animation key.
    func frames(forAvatarIdx idx: Int, anim: PixelAnim) -> [SKTexture] {
        anim.frameIndices.compactMap { frame(forAvatarIdx: idx, frameIndex: $0) }
    }

    /// Generic asset lookup (backgrounds, foregrounds, laptops, floors).
    func staticTexture(named name: String) -> SKTexture? {
        if let cached = staticCache[name] { return cached }
        guard let img = UIImage(named: name, in: .designModule, with: nil) else {
            return nil
        }
        let tex = SKTexture(image: img)
        tex.filteringMode = .nearest
        staticCache[name] = tex
        return tex
    }
}

// MARK: - Bundle locator
//
// All pixel-office PNGs are committed under
// `WagerproofKit/Sources/WagerproofDesign/Resources/PixelOffice/` and ship
// inside the WagerproofDesign module bundle. The app target can't address
// that bundle directly, so we use `Bundle.wagerproofDesign` (a public
// alias exported by WagerproofDesign/DesignBundle.swift) which wraps the
// SPM-generated `Bundle.module` accessor.

extension Bundle {
    static var designModule: Bundle { .wagerproofDesign }
}
