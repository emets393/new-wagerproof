// DesignBundle.swift
//
// SPM auto-generates `Bundle.module` for `.process("Resources")` targets,
// but that accessor is `internal` to the module. The app target needs to
// load images shipped here (Lottie JSON, pixel-office PNGs, etc.), so we
// expose a public alias the app can reach via `Bundle.wagerproofDesign`.

import Foundation

public extension Bundle {
    /// Module bundle for `WagerproofDesign`. Backed by the SPM-generated
    /// `.module` accessor so callers don't have to crawl `Bundle.allBundles`.
    static var wagerproofDesign: Bundle { .module }
}
