import SwiftUI
import UIKit
import RealityKit
import simd
import QuartzCore
#if DEBUG
import WagerproofModels
#endif

/// Raw bundle thumbnails are cached independently from the decoded 3D families.
@MainActor enum AchievementThumbnail {
    private static let cache = NSCache<NSString, UIImage>()
    static func image(named name: String, earned: Bool = true) -> UIImage {
        let name = earned ? name : name + "_locked"
        if let image = cache.object(forKey: name as NSString) { return image }
        let url = Bundle.main.url(forResource: name, withExtension: "png", subdirectory: "Achievements")
            ?? Bundle.main.url(forResource: name, withExtension: "png")
        if let url, let image = UIImage(contentsOfFile: url.path) {
            cache.setObject(image, forKey: name as NSString)
            return image
        }
        return UIImage(systemName: "medal") ?? UIImage()
    }
}

/// Detail-only renderer. Collection rows use bundled PNGs rather than ARViews.
struct AchievementMedalView: UIViewRepresentable {
    let familyAsset: String
    let variantRoot: String
    let earned: Bool
    let recipientName: String
    let earnedAt: Date?
    let caption: String
    var onInteractionBegan: (() -> Void)? = nil
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeUIView(context: Context) -> AchievementMedalHost { AchievementMedalHost() }
    func updateUIView(_ view: AchievementMedalHost, context: Context) {
        view.onInteractionBegan = onInteractionBegan
        view.update(.init(family: familyAsset, variant: variantRoot, earned: earned,
                          name: recipientName, date: earnedAt, caption: caption,
                          reduceMotion: reduceMotion))
    }
    static func dismantleUIView(_ view: AchievementMedalHost, coordinator: ()) { view.releaseRenderer() }
}

fileprivate struct MedalPresentation: Equatable {
    var family: String
    var variant: String
    var earned: Bool
    var name: String
    var date: Date?
    var caption: String
    var reduceMotion: Bool
}

/// Decodes each family once, coalesces simultaneous requests, and only hands out clones.
@MainActor private enum MedalEntityCache {
    static var models: [String: Entity] = [:]
    static var requests: [String: Task<Void, Never>] = [:]
    static var listeners: [String: [UUID: (Entity?) -> Void]] = [:]
    static var environment: EnvironmentResource?

    static func load(_ family: String, id: UUID, completion: @escaping (Entity?) -> Void) {
        if let model = models[family] { completion(model.clone(recursive: true)); return }
        listeners[family, default: [:]][id] = completion
        guard requests[family] == nil else { return }
        let name = (family as NSString).deletingPathExtension
        guard let url = Bundle.main.url(forResource: name, withExtension: "usdz", subdirectory: "Achievements")
                ?? Bundle.main.url(forResource: name, withExtension: "usdz") else {
            finish(family, model: nil); return
        }
        requests[family] = Task { @MainActor in
            do {
                let model = try await Entity(contentsOf: url)
                models[family] = model
                if environment == nil { environment = try? await EnvironmentResource(named: "achievement_studio") }
                finish(family, model: model)
            } catch { finish(family, model: nil) }
            requests[family] = nil
        }
    }
    static func cancel(_ id: UUID) {
        for family in Array(listeners.keys) { listeners[family]?[id] = nil }
        // Shared decode continues for other consumers and future opens.
    }
    private static func finish(_ family: String, model: Entity?) {
        let callbacks = listeners.removeValue(forKey: family)?.values
        callbacks?.forEach { $0(model?.clone(recursive: true)) }
    }
}

/// Hosts borrow one renderer. A disappearing fullscreen host restores the previous
/// still-visible detail host; stale dismantle callbacks cannot detach the new owner.
@MainActor final class AchievementMedalHost: UIView {
    fileprivate var onInteractionBegan: (() -> Void)?
    fileprivate var presentation: MedalPresentation?
    fileprivate let fallback = UIImageView()
    fileprivate let status = UILabel()
    fileprivate var disposed = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        fallback.contentMode = .scaleAspectFit
        fallback.translatesAutoresizingMaskIntoConstraints = false
        addSubview(fallback)
        status.textAlignment = .center
        status.font = .preferredFont(forTextStyle: .caption1)
        status.textColor = .secondaryLabel
        status.numberOfLines = 0
        status.translatesAutoresizingMaskIntoConstraints = false
        addSubview(status)
        NSLayoutConstraint.activate([
            fallback.leadingAnchor.constraint(equalTo: leadingAnchor), fallback.trailingAnchor.constraint(equalTo: trailingAnchor),
            fallback.topAnchor.constraint(equalTo: topAnchor), fallback.bottomAnchor.constraint(equalTo: bottomAnchor),
            status.centerXAnchor.constraint(equalTo: centerXAnchor), status.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
            status.widthAnchor.constraint(lessThanOrEqualTo: widthAnchor, multiplier: 0.9),
        ])
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    fileprivate func update(_ value: MedalPresentation) {
        guard presentation != value else { return }
        presentation = value
        fallback.image = AchievementThumbnail.image(named: "achievement_\(value.variant)", earned: value.earned)
        fallback.alpha = 1
        if SharedMedalRenderer.shared.owner === self { SharedMedalRenderer.shared.renderer.update(value) }
    }
    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil && !disposed { SharedMedalRenderer.shared.attach(self) }
        else { SharedMedalRenderer.shared.detach(self) }
    }
    func releaseRenderer() { disposed = true; SharedMedalRenderer.shared.detach(self) }
}

@MainActor private final class SharedMedalRenderer {
    static let shared = SharedMedalRenderer()
    let renderer = MedalRealitySurface()
    weak var owner: AchievementMedalHost?
    private final class WeakHost {
        weak var value: AchievementMedalHost?
        init(_ value: AchievementMedalHost) { self.value = value }
    }
    private var hosts: [WeakHost] = []
    func attach(_ host: AchievementMedalHost) {
        hosts.removeAll { $0.value == nil || $0.value === host }
        hosts.append(WeakHost(host))
        claim(host)
    }
    private func claim(_ host: AchievementMedalHost) {
        if owner !== host {
            owner?.fallback.isHidden = false
            renderer.suspend()
            renderer.removeFromSuperview()
            owner = host
            host.addSubview(renderer)
            renderer.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                renderer.leadingAnchor.constraint(equalTo: host.leadingAnchor), renderer.trailingAnchor.constraint(equalTo: host.trailingAnchor),
                renderer.topAnchor.constraint(equalTo: host.topAnchor), renderer.bottomAnchor.constraint(equalTo: host.bottomAnchor),
            ])
        }
        renderer.onInteractionBegan = { [weak host] in host?.onInteractionBegan?() }
        renderer.onState = { [weak host] loaded, failed in
            guard let host else { return }
            host.fallback.isHidden = loaded
            host.status.isHidden = loaded
            host.status.text = failed ? "3D preview unavailable" : "Loading medal…"
        }
        if let presentation = host.presentation { renderer.update(presentation) }
    }
    func detach(_ host: AchievementMedalHost) {
        hosts.removeAll { $0.value == nil || $0.value === host }
        guard owner === host else { return }
        owner = nil
        renderer.suspend()
        renderer.removeFromSuperview()
        if let next = hosts.reversed().compactMap(\.value).first(where: { $0.window != nil && !$0.disposed }) { claim(next) }
    }
}

@MainActor private final class MedalRealitySurface: UIView {
    private let arView = ARView(frame: .zero, cameraMode: .nonAR, automaticallyConfigureSession: false)
    private let anchor = AnchorEntity(world: .zero)
    private let pivot = Entity()
    private let camera = PerspectiveCamera()
    private var config: MedalPresentation?
    private var requestID: UUID?
    private var radius: Float = 1.5
    private var yaw: Float = 0
    private let haptic = UIImpactFeedbackGenerator(style: .light)
    private let settleHaptic = UIImpactFeedbackGenerator(style: .rigid)
    private var detentIndex = 0
    private var motionLink: CADisplayLink?
    private var motionStart: CFTimeInterval = 0
    private var revealing = true
    private func stopMotion() { motionLink?.invalidate(); motionLink = nil }
    private func startReveal() {
        stopMotion()
        guard config?.reduceMotion == false else { return }
        revealing = true
        motionStart = CACurrentMediaTime()
        let link = CADisplayLink(target: self, selector: #selector(stepMotion(_:)))
        link.add(to: .main, forMode: .common)
        motionLink = link
    }
    @objc private func stepMotion(_ link: CADisplayLink) {
        let elapsed = CACurrentMediaTime() - motionStart
        if revealing {
            let t = min(1, Float(elapsed / 0.65))
            yaw = t * t * (3 - 2 * t) * 2 * .pi
            if t >= 1 { revealing = false; motionStart = CACurrentMediaTime(); yaw = 0 }
        } else { yaw = sin(Float(elapsed) * 1.5) * 0.34 }
        pivot.orientation = simd_quatf(angle: yaw, axis: [0, 1, 0])
    }
    private var notificationTokens: [NSObjectProtocol] = []
    var onInteractionBegan: (() -> Void)?
    var onState: ((Bool, Bool) -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        arView.environment.background = .color(.clear)
        arView.backgroundColor = .clear
        arView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(arView)
        NSLayoutConstraint.activate([
            arView.leadingAnchor.constraint(equalTo: leadingAnchor), arView.trailingAnchor.constraint(equalTo: trailingAnchor),
            arView.topAnchor.constraint(equalTo: topAnchor), arView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
        anchor.addChild(pivot); anchor.addChild(camera); arView.scene.addAnchor(anchor)
        camera.camera.fieldOfViewInDegrees = 50
        for (position, intensity): (SIMD3<Float>, Float) in [([-0.5, 0.6, 2], 1800), ([0.8, -0.25, 2], 900), ([0.2, -0.6, -1.2], 1100)] {
            let light = DirectionalLight(); light.light.intensity = intensity
            light.look(at: .zero, from: position, relativeTo: nil); anchor.addChild(light)
        }
        let pan = UIPanGestureRecognizer(target: self, action: #selector(drag(_:)))
        pan.maximumNumberOfTouches = 1; arView.addGestureRecognizer(pan)
        let flip = UITapGestureRecognizer(target: self, action: #selector(flipMedal))
        flip.numberOfTapsRequired = 2
        arView.addGestureRecognizer(flip)
        isAccessibilityElement = true
        accessibilityTraits = [.adjustable]
        notificationTokens.append(NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.arView.isHidden = true; self?.stopMotion(); self?.pivot.stopAllAnimations() }
        })
        notificationTokens.append(NotificationCenter.default.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { if self?.window != nil { self?.arView.isHidden = false } }
        })
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func layoutSubviews() { super.layoutSubviews(); frameCamera() }

    func suspend() {
        if let id = requestID { MedalEntityCache.cancel(id) }
        stopMotion()
        requestID = nil; config = nil
        pivot.stopAllAnimations(); pivot.children.removeAll()
        arView.isHidden = true
        onState = nil; onInteractionBegan = nil
    }
    func update(_ value: MedalPresentation) {
        guard config != value else { return }
        if let id = requestID { MedalEntityCache.cancel(id) }
        stopMotion()
        config = value
        arView.isHidden = false
        pivot.stopAllAnimations(); pivot.children.removeAll(); yaw = 0
        pivot.orientation = simd_quatf(angle: 0, axis: [0, 1, 0])
        onState?(false, false)
        accessibilityLabel = value.caption + (value.earned ? ", earned medal" : ", locked medal")
        accessibilityHint = "Swipe up or down to turn the medal."
        accessibilityValue = "Front"
        let token = UUID(); requestID = token
        MedalEntityCache.load(value.family, id: token) { [weak self] family in
            guard let self, self.requestID == token, self.config == value, self.window != nil else { return }
            guard let family, let variant = family.findEntity(named: value.variant),
                  let frame = variant.findEntity(named: value.variant + "_Front_Frame") else {
                self.onState?(false, true); return
            }
            // Extract only the selected variant from the instance clone. Siblings
            // never enter the scene or expand its bounds; the cache stays pristine.
            variant.removeFromParent()
            let oriented = Entity()
            oriented.addChild(variant)
            oriented.orientation = frame.orientation(relativeTo: oriented).inverse
            self.applyFinishes(to: variant, earned: value.earned)
            if value.earned { self.addEngraving(value, variant: variant, front: frame) }
            let bounds = oriented.visualBounds(relativeTo: nil)
            oriented.position = -bounds.center
            self.radius = max(0.1, simd_length(bounds.extents) * 0.5)
            self.pivot.addChild(oriented)
            if let environment = MedalEntityCache.environment { self.arView.environment.lighting.resource = environment }
            self.arView.environment.lighting.intensityExponent = 0
            self.frameCamera(); self.onState?(true, false); self.startReveal()
        }
    }
    private func frameCamera() {
        let aspect = max(0.1, Float(bounds.width / max(1, bounds.height)))
        let vertical = camera.camera.fieldOfViewInDegrees * .pi / 360
        let horizontal = atan(tan(vertical) * aspect)
        let distance = radius / sin(min(vertical, horizontal)) * 1.06
        // Tight clip planes retain precision between the authored shallow metal layers.
        camera.camera.near = max(0.01, distance - radius * 1.25)
        camera.camera.far = distance + radius * 1.25
        camera.look(at: .zero, from: [0, 0, max(0.3, distance)], relativeTo: nil)
    }
    /// Honeydew's explicit PBR roles, preserving WagerProof's authored family colors.
    private func applyFinishes(to entity: Entity, earned: Bool, inheritedRole: String = "") {
        let name = entity.name.lowercased()
        let role = ["acrylic", "ivory", "satin", "metal"].first(where: { name.hasPrefix($0 + "_") }) ?? inheritedRole
        if var component = entity.components[ModelComponent.self], !role.isEmpty {
            component.materials = component.materials.map { original in
                guard var material = original as? PhysicallyBasedMaterial else { return original }
                switch role {
                case "acrylic":
                    material.metallic = 0.0
                    material.roughness = .init(floatLiteral: earned ? 0.085 : 0.4)
                    material.clearcoat = .init(floatLiteral: earned ? 1 : 0.2)
                    material.clearcoatRoughness = .init(floatLiteral: 0.065)
                case "ivory":
                    material.metallic = 0.0
                    material.roughness = .init(floatLiteral: 0.27)
                    material.clearcoat = .init(floatLiteral: 0.35)
                default:
                    material.metallic = 1.0
                    material.roughness = .init(floatLiteral: !earned ? 0.4 : role == "satin" ? 0.38 : 0.22)
                    material.clearcoat = 0.0
                }
                if !earned {
                    let rgb: [CGFloat] = role == "acrylic" ? [61, 68, 73] : role == "ivory" ? [155, 158, 160] : [114, 117, 122]
                    material.baseColor = .init(tint: UIColor(red: rgb[0]/255, green: rgb[1]/255, blue: rgb[2]/255, alpha: 1))
                }
                return material
            }
            entity.components.set(component)
        }
        for child in entity.children { applyFinishes(to: child, earned: earned, inheritedRole: role) }
    }
    @objc private func drag(_ gesture: UIPanGestureRecognizer) {
        switch gesture.state {
        case .began:
            onInteractionBegan?()
            stopMotion(); pivot.stopAllAnimations(); haptic.prepare(); settleHaptic.prepare()
            detentIndex = Int((yaw / .pi).rounded())
        case .changed:
            yaw += Float(gesture.translation(in: self).x) * 0.01
            gesture.setTranslation(.zero, in: self)
            let detent = Int((yaw / .pi).rounded())
            if detent != detentIndex { detentIndex = detent; haptic.impactOccurred(intensity: 0.6); haptic.prepare() }
            pivot.orientation = simd_quatf(angle: yaw, axis: [0, 1, 0])
        case .ended, .cancelled, .failed: settle(to: (yaw / .pi).rounded() * .pi)
        default: break
        }
    }
    private func settle(to angle: Float) {
        stopMotion()
        yaw = angle.truncatingRemainder(dividingBy: 2 * .pi)
        var target = pivot.transform; target.rotation = simd_quatf(angle: yaw, axis: [0, 1, 0])
        if config?.reduceMotion == true { pivot.transform = target }
        else { pivot.move(to: target, relativeTo: anchor, duration: 0.35, timingFunction: .easeInOut) }
        accessibilityValue = abs(cos(yaw)) > 0.5 && cos(yaw) > 0 ? "Front" : "Back"
        settleHaptic.impactOccurred()
    }
    @objc private func flipMedal() { onInteractionBegan?(); settle(to: yaw + .pi) }
    override func accessibilityIncrement() { settle(to: yaw + .pi) }
    override func accessibilityDecrement() { settle(to: yaw - .pi) }

    fileprivate func capture(_ completion: @escaping (UIImage?) -> Void) { arView.snapshot(saveToHDR: false, completion: completion) }

    private func addEngraving(_ value: MedalPresentation, variant: Entity, front: Entity) {
        let date = value.date.map { $0.formatted(.dateTime.day().month(.abbreviated).year()).uppercased() } ?? ""
        let name = String(value.name.split(whereSeparator: \.isWhitespace).joined(separator: " ").prefix(80))
        let lines: [(String, String, Float, Float)] = [
            ("Name", name, 1.12, 0.115), ("Caption", value.caption, 1.08, 0.102), ("Date", date, 0.86, 0.09),
        ]
        for (suffix, string, width, height) in lines {
            guard !string.isEmpty, let attachment = variant.findEntity(named: value.variant + "_Back_" + suffix) else { continue }
            let mesh = MeshResource.generateText(string, extrusionDepth: 0.0015,
                font: .systemFont(ofSize: CGFloat(height), weight: .semibold),
                containerFrame: .zero, alignment: .center, lineBreakMode: .byClipping)
            let text = ModelEntity(mesh: mesh, materials: [SimpleMaterial(color: UIColor(white: 0.12, alpha: 1), roughness: 0.6, isMetallic: false)])
            let bounds = text.visualBounds(relativeTo: text)
            let scale = min(1, min(width / max(bounds.extents.x, 0.0001), height / max(bounds.extents.y, 0.0001)))
            text.scale = .init(repeating: scale)
            text.position = [-bounds.center.x * scale, -bounds.center.y * scale, -bounds.min.z * scale]
            attachment.addChild(text)
            conformText(text, front: front)
        }
    }
    /// Honeydew's instance-preserving mesh projection onto WagerProof's exact rear shell.
    private func conformText(_ text: ModelEntity, front: Entity) {
        guard var component = text.model else { return }
        let contents = component.mesh.contents
        let floor = text.visualBounds(relativeTo: text).min.z
        var descriptors: [MeshDescriptor] = []
        for instance in contents.instances {
            guard let source = contents.models.first(where: { $0.id == instance.model }) else { continue }
            for part in source.parts {
                guard let indices = part.triangleIndices?.elements else { continue }
                let positions = part.positions.elements.map { vertex -> SIMD3<Float> in
                    let transformed = instance.transform * SIMD4<Float>(vertex, 1)
                    let point = SIMD3<Float>(transformed.x, transformed.y, transformed.z)
                    var projected = front.convert(position: point, from: text)
                    let inner = front.convert(position: [point.x, point.y, floor], from: text)
                    let relief = projected.z - inner.z
                    projected.z = 0.135 + sqrt(max(0, 5.6 * 5.6 - 3.8 * projected.x * projected.x - projected.y * projected.y)) - 5.6 - 0.095 - 0.0008 + relief
                    return text.convert(position: projected, from: front)
                }
                var normals = Array(repeating: SIMD3<Float>.zero, count: positions.count)
                for i in stride(from: 0, to: indices.count, by: 3) {
                    let a = Int(indices[i]), b = Int(indices[i + 1]), c = Int(indices[i + 2])
                    let normal = simd_cross(positions[b] - positions[a], positions[c] - positions[a])
                    normals[a] += normal; normals[b] += normal; normals[c] += normal
                }
                var descriptor = MeshDescriptor(name: instance.id + "_" + part.id)
                descriptor.positions = MeshBuffers.Positions(positions)
                descriptor.normals = MeshBuffers.Normals(normals.map { simd_length_squared($0) > 0 ? simd_normalize($0) : [0, 0, 1] })
                descriptor.primitives = .triangles(indices); descriptor.materials = .allFaces(0)
                descriptors.append(descriptor)
            }
        }
        do { component.mesh = try MeshResource.generate(from: descriptors); text.model = component }
        catch { text.isEnabled = false }
    }
}

#if DEBUG
@MainActor enum AchievementNativeBake {
    static func run() async throws {
        guard let window = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows }).first(where: { $0.isKeyWindow }) else { return }
        let surface = MedalRealitySurface(frame: CGRect(x: 0, y: 0, width: 512, height: 512))
        window.addSubview(surface)
        defer { surface.suspend(); surface.removeFromSuperview() }
        let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("AchievementBakes")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        for definition in AchievementCatalog.definitions {
            for earned in [true, false] {
                let loaded: Bool = await withCheckedContinuation { continuation in
                    surface.onState = { loaded, failed in
                        if loaded || failed { continuation.resume(returning: loaded) }
                    }
                    surface.update(.init(family: definition.group.asset, variant: definition.variantRoot,
                        earned: earned, name: "", date: nil, caption: "", reduceMotion: true))
                }
                surface.onState = nil
                guard loaded else { throw CocoaError(.fileReadCorruptFile) }
                try await Task.sleep(for: .milliseconds(350))
                let snapshot: UIImage? = await withCheckedContinuation { continuation in
                    surface.capture { continuation.resume(returning: $0) }
                }
                guard let data = snapshot?.pngData() else { throw CocoaError(.fileWriteUnknown) }
                try data.write(to: directory.appendingPathComponent(definition.thumbnail + (earned ? "" : "_locked") + ".png"))
            }
        }
        try Data("48 native thumbnails complete".utf8).write(to: directory.appendingPathComponent("complete.txt"))
    }
}
#endif
