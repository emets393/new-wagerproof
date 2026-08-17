// CachedAsyncImage.swift
//
// Drop-in replacement for SwiftUI's `AsyncImage(url:content:)` that keeps
// decoded images in memory for the life of the process.
//
// Why this exists: the app had NO image cache at all. `AsyncImage` holds
// nothing between view identities, so the same ~30 immutable team logos were
// re-requested and re-decoded every time a card scrolled in, a carousel page
// was admitted, or a hero rebuilt — the single biggest source of stutter on the
// game detail page.

import SwiftUI
import UIKit

/// Process-wide store of decoded remote images, keyed by URL.
///
/// Nothing is ever evicted: the only callers are team logos, sportsbook marks
/// and player headshots — a bounded, immutable set whose whole point is to
/// never be fetched twice. An LRU here would reintroduce exactly the re-decode
/// this cache exists to remove.
@MainActor
public final class RemoteImageCache {
    public static let shared = RemoteImageCache()

    private var images: [URL: Image] = [:]
    /// Coalesces concurrent requests for the same URL — two logos on screen for
    /// the same team must not become two network fetches.
    private var inFlight: [URL: Task<UIImage?, Never>] = [:]

    /// Private session with its own `URLCache`, so a cold launch reads logos off
    /// disk instead of the network. The shared cache is sized for API JSON.
    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.urlCache = URLCache(
            memoryCapacity: 32 * 1024 * 1024,
            diskCapacity: 128 * 1024 * 1024,
            diskPath: "wagerproof-remote-images"
        )
        // Honour HTTP cache headers. `.returnCacheDataElseLoad` would forever
        // replay a failed favicon body and starve later ESPN headshot fetches
        // on the same session.
        config.requestCachePolicy = .useProtocolCachePolicy
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 20
        config.httpMaximumConnectionsPerHost = 8
        return URLSession(configuration: config)
    }()

    private init() {}

    /// Synchronous hit test, so a view already holding the image can seed its
    /// first frame with `.success` instead of flashing its fallback.
    public func cached(_ url: URL) -> Image? { images[url] }

    public func image(for url: URL) async -> Image? {
        if let hit = images[url] { return hit }

        let task: Task<UIImage?, Never>
        if let existing = inFlight[url] {
            task = existing
        } else {
            // Detached: fetching AND decoding happen off the main actor. A
            // main-thread `UIImage(data:)` on a 500px PNG is a dropped frame.
            task = Task.detached(priority: .userInitiated) { [session] in
                guard
                    let (data, _) = try? await session.data(from: url),
                    let ui = UIImage(data: data)
                else { return nil }
                // Force the decode now rather than at first draw.
                return await ui.byPreparingForDisplay() ?? ui
            }
            inFlight[url] = task
        }

        let ui = await task.value
        inFlight[url] = nil
        guard let ui else { return nil }
        let image = Image(uiImage: ui)
        images[url] = image
        return image
    }
}

/// Cached counterpart to `AsyncImage(url:content:)`.
///
/// Signature-compatible on purpose: it hands the same `AsyncImagePhase` to the
/// same content closure, so every existing `.success` / `default` fallback
/// branch (initials on the team-color disc) behaves identically.
public struct CachedAsyncImage<Content: View>: View {
    private let url: URL?
    private let content: (AsyncImagePhase) -> Content

    @State private var phase: AsyncImagePhase

    @MainActor
    public init(url: URL?, @ViewBuilder content: @escaping (AsyncImagePhase) -> Content) {
        self.url = url
        self.content = content
        // Seed from the cache in `init` — waiting for `.task` would render one
        // frame of the fallback on every already-loaded logo.
        if let url, let hit = RemoteImageCache.shared.cached(url) {
            _phase = State(initialValue: .success(hit))
        } else {
            _phase = State(initialValue: .empty)
        }
    }

    public var body: some View {
        content(phase)
            .task(id: url) { await load() }
    }

    private func load() async {
        guard let url else {
            phase = .empty
            return
        }
        // Always assign for *this* URL. Skipping when `phase` is already
        // `.success` leaves the previous book's mark on screen — Outliers
        // remaps FanDuel → DraftKings on the same view identity, so the
        // leftover success was a FanDuel spark next to the word DraftKings.
        if let hit = RemoteImageCache.shared.cached(url) {
            phase = .success(hit)
            return
        }
        if let image = await RemoteImageCache.shared.image(for: url) {
            phase = .success(image)
        } else {
            // Same shape as AsyncImage's 404 path, so callers' `default` branch
            // (initials fallback) still fires.
            phase = .failure(URLError(.cannotDecodeContentData))
        }
    }
}
