import SpriteKit
import UIKit
import WagerproofModels

/// One agent in the pixel office. Holds the agent's full simulation state
/// (map-space position, walk path, facing, animation key/frame, logical state)
/// and a floating name-tag + speech-bubble overlay. The owning
/// `PixelOfficeScene` drives every field from its `update(_:)` game loop —
/// this node is a "data + render" container, not a self-animating actor.
///
/// **Why manual frame stepping instead of `SKAction.animate`?** The agent's
/// animation key changes mid-motion (walk ↔ sit ↔ done) and depends on the
/// facing direction computed each frame. A single scene-driven loop that swaps
/// the texture per tick mirrors the RN `requestAnimationFrame` loop exactly and
/// avoids tearing down / rebuilding `SKAction`s on every state flip.
@MainActor
final class PixelOfficeAgentNode: SKSpriteNode {

    // MARK: - Stable identity

    let agentIndex: Int
    /// 0..7 — which avatar_N sheet drives this character's animation.
    let avatarIdx: Int
    /// Hex color from `agent.avatar_color`, used for the name-tag border accent.
    let accentColor: UIColor
    let displayName: String
    let emoji: String

    // MARK: - Simulation state (map space, RN top-down coords)
    //
    // All positions are in the 0..864 / 0..800 map coordinate space the RN
    // source uses (y grows downward). The scene flips Y when placing the node.

    var mapX: CGFloat = 0
    var mapY: CGFloat = 0
    var targetX: CGFloat = 0
    var targetY: CGFloat = 0
    var fromX: CGFloat = 0
    var fromY: CGFloat = 0
    var toX: CGFloat = 0
    var toY: CGFloat = 0

    var facing: String = "down"           // down | up | left | right
    var arrived: Bool = true
    var path: [GridCoord] = []
    var pathIdx: Int = 0
    var moveProgress: CGFloat = 0          // 0-1 between current tile centers

    var state: String = "idle"            // working | thinking | done | idle | error
    var isActive: Bool = true
    var claimedPointKey: String = ""
    var bubbleEmoji: String = ""

    var animKey: String = "front_idle"
    var frameIdx: Int = 0
    var animTimer: TimeInterval = 0        // accumulates dt for fps-gated frame steps

    /// Skip redundant texture swaps — only re-fetch when (animKey, frameIdx) moves.
    private var lastTextureKey: String = ""

    /// Scene-Y lift applied to the center-anchored sprite so it foot-anchors to
    /// the map point like RN (`destY = y - FH + 8`). FH/2 - 8 = 24px.
    static let footAnchorLift: CGFloat = PixelOfficeGeo.frameHeight / 2 - 8

    // MARK: - Child nodes

    private let nameTagNode: SKNode
    private let statePillNode: SKShapeNode
    private let statePillLabel: SKLabelNode
    private let nameLabel: SKLabelNode
    private let bubbleNode: SKNode
    private let bubbleLabel: SKLabelNode

    // MARK: - Init

    init(
        agentIndex: Int,
        avatarIdx: Int,
        displayName: String,
        emoji: String,
        accentColorHex: String?
    ) {
        self.agentIndex = agentIndex
        self.avatarIdx = avatarIdx
        self.displayName = displayName
        self.emoji = emoji
        self.accentColor = Self.parseAccentColor(accentColorHex)

        // ── Name tag container ──
        // Font/box sizes are in scene space (the 864-wide map), which the card
        // scales down to ~0.43×, so these read smaller on screen — sized up here
        // for legibility above the sprite's head.
        nameTagNode = SKNode()
        statePillLabel = SKLabelNode(fontNamed: "AvenirNext-Heavy")
        statePillLabel.fontSize = 13
        statePillLabel.fontColor = .white
        statePillLabel.text = "WORKING"
        statePillLabel.verticalAlignmentMode = .center
        statePillLabel.horizontalAlignmentMode = .center

        statePillNode = SKShapeNode(rectOf: CGSize(width: 84, height: 21), cornerRadius: 5)
        statePillNode.fillColor = PixelOfficeStateColor.working
        statePillNode.strokeColor = .clear
        statePillNode.addChild(statePillLabel)

        nameLabel = SKLabelNode(fontNamed: "AvenirNext-Bold")
        nameLabel.fontSize = 15
        nameLabel.fontColor = UIColor(red: 0xe0 / 255.0, green: 0xe4 / 255.0, blue: 0xec / 255.0, alpha: 1)
        nameLabel.verticalAlignmentMode = .center
        nameLabel.horizontalAlignmentMode = .center
        nameLabel.text = emoji.isEmpty ? displayName : "\(emoji) \(displayName)"
        if (nameLabel.text?.count ?? 0) > 13 {
            nameLabel.text = String(nameLabel.text!.prefix(12)) + "…"
        }

        let nameBox = SKShapeNode(rectOf: CGSize(width: 116, height: 22), cornerRadius: 4)
        nameBox.fillColor = UIColor(red: 0x0a / 255.0, green: 0x0c / 255.0, blue: 0x12 / 255.0, alpha: 0.85)
        nameBox.strokeColor = accentColor
        nameBox.lineWidth = 1.5
        nameBox.addChild(nameLabel)

        statePillNode.position = CGPoint(x: 0, y: 82)
        nameBox.position = CGPoint(x: 0, y: 56)
        nameTagNode.addChild(statePillNode)
        nameTagNode.addChild(nameBox)
        // Render the tag (and bubble) above the office foreground (z=4) so a
        // walking agent's label is never occluded by plants/chairs. zPosition
        // is relative to the parent, so this sits ~100 above the agent's z.
        nameTagNode.zPosition = 100

        // ── Speech bubble (dormant unless a named activity assigns an emoji) ──
        bubbleNode = SKNode()
        let bubbleBg = SKShapeNode(circleOfRadius: 15)
        bubbleBg.fillColor = UIColor(white: 1, alpha: 0.92)
        bubbleBg.strokeColor = UIColor(white: 0, alpha: 0.15)
        bubbleBg.lineWidth = 1
        bubbleLabel = SKLabelNode(fontNamed: "AppleColorEmoji")
        bubbleLabel.fontSize = 17
        bubbleLabel.verticalAlignmentMode = .center
        bubbleLabel.horizontalAlignmentMode = .center
        bubbleBg.addChild(bubbleLabel)
        bubbleNode.addChild(bubbleBg)
        bubbleNode.position = CGPoint(x: 0, y: 108)
        bubbleNode.zPosition = 100
        bubbleNode.isHidden = true

        // ── Sprite init ──
        let frames = PixelOfficeTextureCache.shared.frames(forAvatarIdx: avatarIdx, anim: .frontIdle)
        let firstTexture = frames.first ?? SKTexture()
        super.init(
            texture: firstTexture,
            color: .clear,
            size: CGSize(width: PixelOfficeGeo.frameWidth, height: PixelOfficeGeo.frameHeight)
        )
        texture?.filteringMode = .nearest
        anchorPoint = CGPoint(x: 0.5, y: 0.5)
        addChild(nameTagNode)
        addChild(bubbleNode)
        lastTextureKey = "front_idle#0"
    }

    required init?(coder aDecoder: NSCoder) {
        fatalError("PixelOfficeAgentNode does not support NSCoder")
    }

    // MARK: - State / render

    /// Update the logical state plus the name-tag pill color + label. Movement
    /// targeting (claim a point, compute the A* path) is the scene's job —
    /// see `PixelOfficeScene.setAgentState`.
    func setState(_ newState: String, label: String) {
        state = newState
        statePillNode.fillColor = PixelOfficeStateColor.forState(newState)
        statePillLabel.text = label
    }

    /// Swap the sprite to the current (animKey, frameIdx). No-ops when nothing
    /// changed since the last call so the loop doesn't churn textures.
    func applyTextureFrame() {
        let texKey = "\(animKey)#\(frameIdx)"
        if texKey == lastTextureKey { return }
        lastTextureKey = texKey
        guard let anim = PixelAnim(rawValue: animKey) else { return }
        let frames = PixelOfficeTextureCache.shared.frames(forAvatarIdx: avatarIdx, anim: anim)
        guard !frames.isEmpty else { return }
        texture = frames[frameIdx % frames.count]
    }

    /// Push the simulation position into the SpriteKit node + depth-sort by Y
    /// (agents lower on screen draw in front) and toggle the speech bubble.
    func syncSceneNode() {
        // RN anchors the character at its feet — `destY = y - FH + 8` (top-left),
        // so the sprite center sits FH/2 - 8 = 24px above the map point (toward
        // the top of the map). We center-anchor here, so lift the node by that
        // same amount; without it agents render ~24px too low (feet sinking below
        // their desks/seats). Particles/laptops keep the plain flip — RN draws
        // those un-anchored.
        position = CGPoint(x: mapX, y: PixelOfficeGeo.mapHeight - mapY + Self.footAnchorLift)
        // Keep agents between the laptop layer (z=2) and foreground (z=4).
        zPosition = 3 + (mapY / PixelOfficeGeo.mapHeight) * 0.9
        let showBubble = arrived && !bubbleEmoji.isEmpty
        bubbleNode.isHidden = !showBubble
        if showBubble { bubbleLabel.text = bubbleEmoji }
    }

    /// De-collision offset applied to the floating name tag by the scene's label
    /// relaxation so neighbouring tags don't overlap. (0,0) = directly above the
    /// head. Driven each frame in `PixelOfficeScene.relaxLabels`.
    var nameTagOffset: CGPoint {
        get { nameTagNode.position }
        set { nameTagNode.position = newValue }
    }

    // MARK: - Helpers

    /// Parse a hex string like `#6366f1` or `gradient:#6366f1,#ec4899` into
    /// a UIColor. Falls back to slate-grey so the name-tag border never vanishes.
    private static func parseAccentColor(_ raw: String?) -> UIColor {
        let fallback = UIColor(red: 0x94 / 255.0, green: 0xa3 / 255.0, blue: 0xb8 / 255.0, alpha: 1)
        guard var input = raw, !input.isEmpty else { return fallback }
        if input.hasPrefix("gradient:") {
            input = String(input.dropFirst("gradient:".count))
            if let first = input.split(separator: ",").first {
                input = String(first)
            }
        }
        var hex = input.trimmingCharacters(in: .whitespaces)
        if hex.hasPrefix("#") { hex = String(hex.dropFirst()) }
        guard hex.count == 6, let value = UInt32(hex, radix: 16) else { return fallback }
        return UIColor(
            red: CGFloat((value >> 16) & 0xff) / 255.0,
            green: CGFloat((value >> 8) & 0xff) / 255.0,
            blue: CGFloat(value & 0xff) / 255.0,
            alpha: 1
        )
    }
}
