import SwiftUI
import UIKit
import WagerproofDesign
import WagerproofModels

/// Renders an agent's pixel-office character as an avatar — the front-idle
/// animation cropped from its `avatar_hd_N` (else `avatar_N`) sprite sheet — for use in the agent
/// cards/headers/leaderboard in place of the emoji. Nearest-neighbor scaling
/// keeps the pixel art crisp; the cropped frames are cached per sheet so list
/// scrolling never re-crops.
///
/// By default it plays a gentle idle loop (the same 4 front-idle frames the
/// office cycles), so the little character bobs/breathes on the card. With the
/// HD emote sheet (`avatar_hd_fx_N`) it also blinks/smiles now and then, and — when
/// given a `mood` — plays that mood's expressions every ~10s with a pixel icon
/// popping off the top corner. Pass `animated: false` for a frozen pose.
///
/// `spriteIndex` is the agent's STABLE character index (see `AgentSpriteIndex` /
/// `Agent.spriteIndex`), so this is the same character that walks the office.
struct PixelSpriteAvatar: View {
    /// How an HD character is cropped. Tiles are small squares/discs, where a full-height HD figure
    /// (realistic proportions, unlike the chibi originals) leaves a face a few pixels wide — so the
    /// default is head-and-shoulders. Character pickers with 3:4 frames pass `.fullBody`.
    enum Framing { case portrait, fullBody }

    let spriteIndex: Int
    /// Play the front-idle loop. Off → frozen on frame 0.
    var animated: Bool = true
    var framing: Framing = .portrait
    /// Drives the occasional performance expression. `.neutral` = idle + standby only.
    var mood: AgentMood = .neutral

    var body: some View {
        let frames = Self.frames(for: spriteIndex, framing: framing)
        if frames.isEmpty {
            // Asset missing (shouldn't happen — the 8 sheets ship in the design
            // bundle). Render nothing so the caller's colored tile still shows.
            Color.clear
        } else if animated && frames.count > 1 {
            // TimelineView re-renders only this closure — the rest of the card
            // never recomputes. The schedule is a pure function of the clock, so
            // there's no per-avatar state to keep in sync while a list scrolls.
            TimelineView(AvatarSchedule(sprite: spriteIndex, mood: mood)) { context in
                let beat = AvatarTiming.beat(at: context.date, sprite: spriteIndex, mood: mood)
                let clip = beat.clip.map { Self.emoteFrames(for: spriteIndex, framing: framing, emote: $0.emote) } ?? []
                let frame = beat.clip.flatMap { c in clip.indices.contains(c.frame) ? clip[c.frame] : nil }
                    ?? frames[beat.idleFrame % frames.count]
                Self.image(frame)
                    .overlay {
                        if let icon = beat.icon {
                            MoodIconBurst(name: icon.name, progress: icon.progress)
                        }
                    }
            }
        } else {
            Self.image(frames[0])
        }
    }

    private static func image(_ ui: UIImage) -> some View {
        Image(uiImage: ui)
            .interpolation(.none)   // nearest-neighbor — keep pixels crisp
            .resizable()
            .scaledToFit()
    }

    // MARK: - Frame crops + cache

    /// Front-idle frames keyed by sprite index (8 sheets max). MainActor because
    /// SwiftUI bodies render on the main thread — mirrors the office's
    /// `PixelOfficeTextureCache` isolation.
    @MainActor private static var cache: [String: [UIImage]] = [:]
    @MainActor private static var boxes: [String: CGRect] = [:]

    /// Crop the front-idle frames (`PixelAnim.frontIdle`) out of `avatar_hd_{idx}`,
    /// falling back to the original `avatar_{idx}` sheet.
    @MainActor
    static func frames(for index: Int, framing: Framing = .portrait) -> [UIImage] {
        let idx = max(0, min(7, index))
        let key = "\(idx)-\(framing)"
        if let cached = cache[key] { return cached }
        let hd = UIImage(named: "avatar_hd_\(idx)", in: .wagerproofDesign, with: nil)
        guard let sheet = hd ?? UIImage(named: "avatar_\(idx)", in: .wagerproofDesign, with: nil),
              let cg = sheet.cgImage else { return [] }

        // Reuse the office's geometry + animation tables so the frame layout
        // stays a single source of truth (8×9 sheet; 48×64 or 96×96 cells).
        let cols = PixelOfficeGeo.sheetCols
        let fw = cg.width / cols
        let fh = cg.height / PixelOfficeGeo.sheetRows
        // Crop in cgImage *pixel* space (scale-safe for the loose @1x PNGs).
        var rects = PixelAnim.frontIdle.frameIndices.map { fi in
            CGRect(x: (fi % cols) * fw, y: (fi / cols) * fh, width: fw, height: fh)
        }
        if hd != nil, let box = figureBox(in: cg, cells: rects, framing: framing) {
            boxes[key] = box
            rects = rects.map { CGRect(x: $0.minX + box.minX, y: $0.minY + box.minY, width: box.width, height: box.height) }
        }
        let result: [UIImage] = rects.compactMap { rect in
            cg.cropping(to: rect).map { UIImage(cgImage: $0, scale: sheet.scale, orientation: .up) }
        }
        cache[key] = result
        return result
    }

    /// One expression's 9 frames from `avatar_hd_fx_{idx}` (a row per `AgentEmote`), cropped with the
    /// idle loop's box so the figure doesn't jump when an emote starts. Empty without the HD sheets.
    @MainActor
    static func emoteFrames(for index: Int, framing: Framing, emote: AgentEmote) -> [UIImage] {
        let idx = max(0, min(7, index))
        let key = "fx\(idx)-\(framing)-\(emote.rawValue)"
        if let cached = cache[key] { return cached }
        _ = frames(for: idx, framing: framing)   // computes the shared crop box
        guard let box = boxes["\(idx)-\(framing)"],
              let sheet = UIImage(named: "avatar_hd_fx_\(idx)", in: .wagerproofDesign, with: nil),
              let cg = sheet.cgImage else {
            cache[key] = []
            return []
        }
        let cell = cg.width / 9
        let result: [UIImage] = (0..<9).compactMap { col in
            let rect = CGRect(x: CGFloat(col * cell) + box.minX, y: CGFloat(emote.rawValue * cell) + box.minY,
                              width: box.width, height: box.height)
            return cg.cropping(to: rect).map { UIImage(cgImage: $0, scale: sheet.scale, orientation: .up) }
        }
        cache[key] = result
        return result
    }

    /// HD cells are mostly empty canvas (a ~26×66 figure in 96×96). One shared box for all frames, from
    /// the figure's union bounds, so the loop doesn't jitter: `.fullBody` grows it to the legacy 3:4
    /// framing (figure at 75% height); `.portrait` is a square from just above the hair to mid-chest.
    private static func figureBox(in cg: CGImage, cells: [CGRect], framing: Framing) -> CGRect? {
        guard let cell = cells.first, let bounds = alphaBounds(in: cg, cells: cells) else { return nil }
        let minX = Int(bounds.minX), minY = Int(bounds.minY), maxX = Int(bounds.maxX) - 1, maxY = Int(bounds.maxY) - 1
        let figH = CGFloat(maxY - minY + 1), cx = CGFloat(minX + maxX + 1) / 2
        if framing == .portrait {
            let side = min(cell.width, (figH * 0.74).rounded())
            return CGRect(x: max(0, min(cell.width - side, (cx - side / 2).rounded())),
                          y: max(0, CGFloat(minY) - (side * 0.06).rounded()),
                          width: side, height: side)
        }
        let boxH = min(cell.height, (figH / 0.75).rounded())
        let boxW = min(cell.width, (boxH * 0.75).rounded())
        let cy = CGFloat(minY + maxY + 1) / 2
        return CGRect(x: max(0, min(cell.width - boxW, (cx - boxW / 2).rounded())),
                      y: max(0, min(cell.height - boxH, (cy - boxH / 2).rounded())),
                      width: boxW, height: boxH)
    }

    /// Union of the opaque pixels across `cells`, in cell-local coordinates (nil if all empty). Shared
    /// by the avatar crops and `AgentDeskSprite`, which both need one stable box for a whole loop.
    static func alphaBounds(in cg: CGImage, cells: [CGRect]) -> CGRect? {
        let w = cg.width, h = cg.height
        var px = [UInt8](repeating: 0, count: w * h * 4)
        let drew: Bool = px.withUnsafeMutableBytes { buf in
            guard let ctx = CGContext(data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8,
                                      bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
            return true
        }
        guard drew else { return nil }
        var minX = Int.max, minY = Int.max, maxX = -1, maxY = -1
        for c in cells {
            for y in max(0, Int(c.minY))..<min(h, Int(c.maxY)) {
                for x in max(0, Int(c.minX))..<min(w, Int(c.maxX)) where px[(y * w + x) * 4 + 3] > 24 {
                    let lx = x - Int(c.minX), ly = y - Int(c.minY)
                    minX = min(minX, lx); maxX = max(maxX, lx)
                    minY = min(minY, ly); maxY = max(maxY, ly)
                }
            }
        }
        guard maxX >= 0 else { return nil }
        return CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
    }
}

// MARK: - Expression timing

/// When each avatar blinks, emotes and pops its icon — a pure function of the clock, shared by the
/// render (`beat`) and the TimelineView schedule (`tickInterval`) so the two can't drift apart.
enum AvatarTiming {
    /// Idle loop speed. Matches the office's slow idle (`idleAnimFps = 2`), nudged a touch livelier.
    static let fps: Double = 2.5
    static let clipFps: Double = 7        // 9-frame emote ≈ 1.3s
    static let iconFps: Double = 15       // the icon moves every tick while it floats
    static let iconLife: Double = 2.1
    static var clipLen: Double { 9 / clipFps }

    struct Beat {
        var idleFrame: Int
        var clip: (emote: AgentEmote, frame: Int)?
        var icon: (name: String, progress: Double)?
    }

    private struct Window { let start: Double, end: Double, rate: Double }

    /// Each agent runs a ~9–12s cycle, phase-shifted by sprite so a list of cards never emotes in
    /// unison: the mood's expression opens the cycle (alternating when the mood has two), and a standby
    /// blink/smile lands mid-cycle — twice for agents with no mood to show.
    private static func cycle(sprite: Int, mood: AgentMood) -> (length: Double, windows: [Window]) {
        let length = 9.0 + Double(sprite % 4) * 0.8
        if mood.emotes.isEmpty {
            return (length, [0.2, 0.65].map { Window(start: length * $0, end: length * $0 + clipLen, rate: clipFps) })
        }
        return (length, [Window(start: 0, end: iconLife, rate: iconFps),
                         Window(start: length * 0.6, end: length * 0.6 + clipLen, rate: clipFps)])
    }

    private static func clock(_ date: Date, sprite: Int) -> Double {
        date.timeIntervalSinceReferenceDate + Double(sprite) * 2.37
    }

    static func beat(at date: Date, sprite: Int, mood: AgentMood) -> Beat {
        let now = clock(date, sprite: sprite)
        var beat = Beat(idleFrame: Int(now * fps))
        let (length, windows) = cycle(sprite: sprite, mood: mood)
        let n = Int(now / length), t = now.truncatingRemainder(dividingBy: length)
        let emotes = mood.emotes
        if !emotes.isEmpty {
            let emote = emotes[n % emotes.count]
            if t < clipLen { beat.clip = (emote, Int(t * clipFps)) }
            if let icon = emote.icon, t < iconLife { beat.icon = (icon, t / iconLife) }
        }
        for w in windows where w.rate == clipFps && t >= w.start && t < w.end {
            beat.clip = (.standby, Int((t - w.start) * clipFps))
        }
        return beat
    }

    /// Seconds until the picture can next change: the window's rate while an expression or icon plays,
    /// otherwise the next idle-frame boundary (or the next window, if sooner). Ticking 15/s all the time
    /// re-rendered every visible tile continuously and kept the main thread ~80% busy.
    static func tickInterval(at date: Date, sprite: Int, mood: AgentMood) -> TimeInterval {
        let now = clock(date, sprite: sprite)
        let (length, windows) = cycle(sprite: sprite, mood: mood)
        let t = now.truncatingRemainder(dividingBy: length)
        var next = 1 / fps - now.truncatingRemainder(dividingBy: 1 / fps)
        for w in windows {
            if t >= w.start && t < w.end { return 1 / w.rate }
            next = min(next, w.start > t ? w.start - t : length - t + w.start)
        }
        return max(next, 0.02)
    }
}

/// Wakes the avatar's TimelineView only when its picture changes (see `AvatarTiming.tickInterval`);
/// in low-frequency mode (Always-On, backgrounded) it drops to once a second.
private struct AvatarSchedule: TimelineSchedule {
    let sprite: Int
    let mood: AgentMood

    func entries(from startDate: Date, mode: TimelineScheduleMode) -> AnyIterator<Date> {
        var next = startDate
        return AnyIterator {
            let current = next
            let step = mode == .lowFrequency ? 1 : AvatarTiming.tickInterval(at: current, sprite: sprite, mood: mood)
            next = current.addingTimeInterval(step)
            return current
        }
    }
}

// MARK: - Mood

/// How an agent's record makes it feel, which picks the expressions its avatar
/// cycles through. Streaks outrank the overall win rate.
enum AgentMood: Equatable, Sendable {
    case neutral, good, hot, bad, cold

    /// A run this long, either way, is a hot or cold streak.
    static let streakThreshold = 5

    init(winRate: Double?, streak: Int) {
        if streak >= Self.streakThreshold { self = .hot }
        else if streak <= -Self.streakThreshold { self = .cold }
        else if let winRate, winRate > 0.5 { self = .good }
        else if let winRate, winRate < 0.5 { self = .bad }
        else { self = .neutral }
    }

    init(_ performance: AgentPerformance?) {
        self.init(winRate: Self.winRate(performance), streak: performance?.currentStreak ?? 0)
    }

    /// `win_rate` can be absent on a row; the record is what the card shows, so fall back to W / (W + L).
    static func winRate(_ performance: AgentPerformance?) -> Double? {
        guard let performance else { return nil }
        let graded = performance.wins + performance.losses
        return performance.winRate ?? (graded > 0 ? Double(performance.wins) / Double(graded) : nil)
    }

    /// The 1–2 expressions this mood alternates between.
    var emotes: [AgentEmote] {
        switch self {
        case .neutral: return []
        case .good: return [.happy]
        case .hot: return [.celebrate, .happy]
        case .bad: return [.sigh]
        case .cold: return [.facepalm, .sigh]
        }
    }
}

/// Rows of `avatar_hd_fx_N`, in sheet order (see scripts/build_hd_agent_sheets.py).
enum AgentEmote: Int, Sendable {
    case standby, happy, celebrate, sigh, facepalm

    /// The pixel icon that pops off the avatar while this expression plays.
    var icon: String? {
        switch self {
        case .standby: return nil
        case .happy: return "mood_sparkle"
        case .celebrate: return "mood_flame"
        case .sigh: return "mood_sweat"
        case .facepalm: return "mood_cloud"
        }
    }
}

/// A mood icon popping off the avatar's top-trailing corner: springs in, floats up
/// and fades. `progress` (0…1) comes from the avatar's clock, so it needs no state.
private struct MoodIconBurst: View {
    let name: String
    let progress: Double

    @MainActor private static var images: [String: UIImage] = [:]

    var body: some View {
        GeometryReader { geo in
            if let ui = Self.image(name) {
                let side = geo.size.width * 0.42
                let p = progress
                // Pop past full size, settle, then drift up and fade over the last third.
                let scale = p < 0.12 ? 1.2 * (p / 0.12) : (p < 0.22 ? 1.2 - 0.2 * ((p - 0.12) / 0.1) : 1)
                let fade = p < 0.7 ? 1 : max(0, 1 - (p - 0.7) / 0.3)
                Image(uiImage: ui)
                    .interpolation(.none)
                    .resizable()
                    .frame(width: side, height: side)
                    .scaleEffect(scale)
                    .rotationEffect(.degrees(sin(p * .pi * 6) * 8 * (1 - p)))
                    .opacity(fade)
                    .position(x: geo.size.width - side * 0.2, y: side * 0.2 - CGFloat(p) * side * 0.45)
            }
        }
        .allowsHitTesting(false)
    }

    @MainActor private static func image(_ name: String) -> UIImage? {
        if let cached = images[name] { return cached }
        let ui = UIImage(named: name, in: .wagerproofDesign, with: nil)
        images[name] = ui
        return ui
    }
}

/// Shared rounded-square identity tile for agent surfaces. This is the visual
/// treatment established by My Agents: elevated base, brand gradient, crisp
/// pixel-office sprite, inset border, and a soft color-matched halo.
struct AgentPixelAvatarTile: View {
    let spriteIndex: Int
    let avatarColor: String
    var size: CGFloat = 52
    var cornerRadius: CGFloat = 14
    var animated: Bool = true
    var mood: AgentMood = .neutral

    private var primary: Color {
        AgentColorPalette.primary(for: avatarColor)
    }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        ZStack {
            shape
                .fill(Color.appSurfaceElevated)
                .overlay {
                    shape
                        .fill(
                            LinearGradient(
                                colors: AgentColorPalette.avatarGradient(for: avatarColor),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .opacity(0.85)
                }
                .overlay {
                    shape.strokeBorder(Color.appSurfaceElevated, lineWidth: 1.5)
                }
                // Halo on the static tile only: shadowing the whole stack re-blurred it on every sprite frame.
                .shadow(color: primary.opacity(0.32), radius: 6)
                .shadow(color: primary.opacity(0.18), radius: 10, y: 2)

            PixelSpriteAvatar(spriteIndex: spriteIndex, animated: animated, mood: mood)
                .padding(3)
        }
        .frame(width: size, height: size)
    }
}

#Preview {
    HStack(spacing: 12) {
        ForEach(0..<8, id: \.self) { i in
            AgentPixelAvatarTile(
                spriteIndex: i,
                avatarColor: "#6366f1",
                size: 48,
                cornerRadius: 12
            )
        }
    }
    .padding()
}
