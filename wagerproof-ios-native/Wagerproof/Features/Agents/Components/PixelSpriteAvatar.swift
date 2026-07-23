import SwiftUI
import UIKit
import WagerproofDesign
import WagerproofModels

/// Renders an agent's pixel-office character as an avatar — the front-idle
/// animation cropped from its `avatar_N` sprite sheet — for use in the agent
/// cards/headers/leaderboard in place of the emoji. Nearest-neighbor scaling
/// keeps the pixel art crisp; the cropped frames are cached per sheet so list
/// scrolling never re-crops.
///
/// By default it plays a gentle idle loop (the same 4 front-idle frames the
/// office cycles), so the little character bobs/breathes on the card. Pass
/// `animated: false` for a frozen pose.
///
/// `spriteIndex` is the agent's STABLE character index (see `AgentSpriteIndex` /
/// `Agent.spriteIndex`), so this is the same character that walks the office.
struct PixelSpriteAvatar: View {
    let spriteIndex: Int
    /// Play the front-idle loop. Off → frozen on frame 0.
    var animated: Bool = true

    var body: some View {
        let frames = Self.frames(for: spriteIndex)
        if frames.isEmpty {
            // Asset missing (shouldn't happen — the 8 sheets ship in the design
            // bundle). Render nothing so the caller's colored tile still shows.
            Color.clear
        } else if animated && frames.count > 1 {
            // TimelineView re-renders only this closure at the idle fps — the
            // rest of the card never recomputes. Phase-offset by spriteIndex so
            // different agents bob out of sync (a row of cards looks alive, not
            // like a synchronized chorus line).
            TimelineView(.periodic(from: .now, by: 1.0 / Self.fps)) { context in
                Self.image(frames[Self.frameIndex(at: context.date, count: frames.count, phase: spriteIndex)])
            }
        } else {
            Self.image(frames[0])
        }
    }

    /// Idle cycle speed. Matches the office's slow idle (`idleAnimFps = 2`),
    /// nudged a touch livelier for a standalone avatar.
    private static let fps: Double = 2.5

    private static func image(_ ui: UIImage) -> some View {
        Image(uiImage: ui)
            .interpolation(.none)   // nearest-neighbor — keep pixels crisp
            .resizable()
            .scaledToFit()
    }

    /// Frame to show at `date` — advances one frame per `1/fps`, offset by phase.
    private static func frameIndex(at date: Date, count: Int, phase: Int) -> Int {
        let tick = Int(date.timeIntervalSinceReferenceDate * fps)
        return (tick + phase) % count
    }

    // MARK: - Frame crops + cache

    /// Front-idle frames keyed by sprite index (8 sheets max). MainActor because
    /// SwiftUI bodies render on the main thread — mirrors the office's
    /// `PixelOfficeTextureCache` isolation.
    @MainActor private static var cache: [Int: [UIImage]] = [:]

    /// Crop the front-idle frames (`PixelAnim.frontIdle`) out of `avatar_{idx}`.
    @MainActor
    static func frames(for index: Int) -> [UIImage] {
        let idx = max(0, min(7, index))
        if let cached = cache[idx] { return cached }
        guard let sheet = UIImage(named: "avatar_\(idx)", in: .wagerproofDesign, with: nil),
              let cg = sheet.cgImage else { return [] }

        // Reuse the office's geometry + animation tables so the frame layout
        // stays a single source of truth (8×9 sheet, 48×64 frames).
        let cols = PixelOfficeGeo.sheetCols
        let fw = cg.width / cols
        let fh = cg.height / PixelOfficeGeo.sheetRows
        let result: [UIImage] = PixelAnim.frontIdle.frameIndices.compactMap { fi in
            let col = fi % cols
            let row = fi / cols
            // Crop in cgImage *pixel* space (scale-safe for the loose @1x PNGs).
            let rect = CGRect(x: col * fw, y: row * fh, width: fw, height: fh)
            guard let cropped = cg.cropping(to: rect) else { return nil }
            return UIImage(cgImage: cropped, scale: sheet.scale, orientation: .up)
        }
        cache[idx] = result
        return result
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

            PixelSpriteAvatar(spriteIndex: spriteIndex, animated: animated)
                .padding(3)
        }
        .frame(width: size, height: size)
        .shadow(color: primary.opacity(0.32), radius: 6)
        .shadow(color: primary.opacity(0.18), radius: 10, y: 2)
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
