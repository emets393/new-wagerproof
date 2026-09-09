import SwiftUI
import UIKit
import RealityKit
import simd

/// Raw bundle thumbnails are cached independently from the decoded 3D families.
@MainActor enum AchievementThumbnail {
    private static let cache = NSCache<NSString, UIImage>()
    static func image(named name: String) -> UIImage {
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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeUIView(context: Context) -> AchievementMedalHost { AchievementMedalHost() }
    func updateUIView(_ view: AchievementMedalHost, context: Context) {
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
        fallback.image = AchievementThumbnail.image(named: "achievement_\(value.variant)")
        fallback.alpha = value.earned ? 1 : 0.35
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
    private var notificationTokens: [NSObjectProtocol] = []
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
        camera.camera.fieldOfViewInDegrees = 45
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
            MainActor.assumeIsolated { self?.arView.isHidden = true; self?.pivot.stopAllAnimations() }
        })
        notificationTokens.append(NotificationCenter.default.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { if self?.window != nil { self?.arView.isHidden = false } }
        })
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func layoutSubviews() { super.layoutSubviews(); frameCamera() }

    func suspend() {
        if let id = requestID { MedalEntityCache.cancel(id) }
        requestID = nil; config = nil
        pivot.stopAllAnimations(); pivot.children.removeAll()
        arView.isHidden = true
        onState = nil
    }
    func update(_ value: MedalPresentation) {
        guard config != value else { return }
        if let id = requestID { MedalEntityCache.cancel(id) }
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
            if !value.earned { self.applyLocked(to: variant) }
            else { self.addEngraving(value, variant: variant, front: frame) }
            let bounds = oriented.visualBounds(relativeTo: nil)
            oriented.position = -bounds.center
            self.radius = max(0.1, simd_length(bounds.extents) * 0.5)
            self.pivot.addChild(oriented)
            if let environment = MedalEntityCache.environment { self.arView.environment.lighting.resource = environment }
            self.frameCamera(); self.onState?(true, false)
        }
    }
    private func frameCamera() {
        let aspect = max(0.1, Float(bounds.width / max(1, bounds.height)))
        let vertical = camera.camera.fieldOfViewInDegrees * .pi / 360
        let horizontal = atan(tan(vertical) * aspect)
        let distance = radius / sin(min(vertical, horizontal)) * 1.08
        // Tight clip planes retain precision between the authored shallow metal layers.
        camera.camera.near = max(0.01, distance - radius * 1.25)
        camera.camera.far = distance + radius * 1.25
        camera.look(at: .zero, from: [0, 0, max(0.3, distance)], relativeTo: nil)
    }
    private func applyLocked(to entity: Entity) {
        if var component = entity.components[ModelComponent.self] {
            component.materials = component.materials.map { original in
                if var material = original as? PhysicallyBasedMaterial {
                    let source = material.baseColor.tint
                    var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
                    source.getRed(&r, green: &g, blue: &b, alpha: &a)
                    let gray = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 0.55 + 0.12
                    material.baseColor.tint = UIColor(white: gray, alpha: 1)
                    material.roughness = .init(floatLiteral: 0.45)
                    return material
                }
                return SimpleMaterial(color: UIColor(white: 0.42, alpha: 1), roughness: 0.5, isMetallic: entity.name.hasPrefix("metal"))
            }
            entity.components.set(component)
        }
        for child in entity.children { applyLocked(to: child) }
    }
    @objc private func drag(_ gesture: UIPanGestureRecognizer) {
        switch gesture.state {
        case .began: pivot.stopAllAnimations(); haptic.prepare()
        case .changed:
            yaw += Float(gesture.translation(in: self).x) * 0.01
            gesture.setTranslation(.zero, in: self)
            pivot.orientation = simd_quatf(angle: yaw, axis: [0, 1, 0])
        case .ended, .cancelled, .failed: settle(to: (yaw / .pi).rounded() * .pi)
        default: break
        }
    }
    private func settle(to angle: Float) {
        yaw = angle.truncatingRemainder(dividingBy: 2 * .pi)
        var target = pivot.transform; target.rotation = simd_quatf(angle: yaw, axis: [0, 1, 0])
        if config?.reduceMotion == true { pivot.transform = target }
        else { pivot.move(to: target, relativeTo: anchor, duration: 0.3, timingFunction: .easeInOut) }
        accessibilityValue = abs(cos(yaw)) > 0.5 && cos(yaw) > 0 ? "Front" : "Back"
        haptic.impactOccurred(intensity: 0.6)
    }
    @objc private func flipMedal() { settle(to: yaw + .pi) }
    override func accessibilityIncrement() { settle(to: yaw + .pi) }
    override func accessibilityDecrement() { settle(to: yaw - .pi) }

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
