// swift-tools-version: 5.10
//
// WagerproofKit — local Swift package containing the bulk of the Wagerproof iOS app.
//
// Five products, layered top-down per docs/wagerproof-migration/REBUILD_PLAN.md:
//   WagerproofModels    — Codable types only. No SDK calls.
//   WagerproofServices  — Wrap SDKs (Supabase, RevenueCat, Mixpanel). Stateless.
//   WagerproofStores    — @Observable app state. Built on Services.
//   WagerproofDesign    — Design system tokens & primitive views. No deps.
//   WagerproofSharedKit — Shared with extensions. Tiny binary footprint.
//
// Layering rules:
//   - Models: Foundation only.
//   - Services: Models + Supabase + RevenueCat + Mixpanel + GoogleSignIn.
//   - Stores: Models + Services + SharedKit.
//   - Design: nothing.
//   - SharedKit: RevenueCat + Foundation only (extension-safe).
import PackageDescription

let package = Package(
    name: "WagerproofKit",
    // Declare macOS 14 so `swift build` (which defaults to the host platform =
    // macOS) can resolve dependency-version constraints. The app target is
    // iOS-only — Xcode picks iOS 17 from the matching .iOS(.v17) platform.
    // .iOS(.v18) requires swift-tools-version 6.0+; the string-based init
    // available since 5.0 lets us pin to iOS 18 while keeping the package
    // on Swift 5 strict-concurrency rules (which the existing
    // WagerproofDesign Animations.swift `AnyTransition` statics depend on).
    platforms: [.iOS("18.0"), .macOS(.v14)],
    products: [
        .library(name: "WagerproofModels", targets: ["WagerproofModels"]),
        .library(name: "WagerproofServices", targets: ["WagerproofServices"]),
        .library(name: "WagerproofStores", targets: ["WagerproofStores"]),
        .library(name: "WagerproofDesign", targets: ["WagerproofDesign"]),
        .library(name: "WagerproofSharedKit", targets: ["WagerproofSharedKit"]),
    ],
    dependencies: [
        .package(url: "https://github.com/supabase/supabase-swift", from: "2.0.0"),
        // 5.78.0+: older releases fail under Xcode 26 / Swift 6.2 (PaywallColor
        // synthesized memberwise init collision)
        .package(url: "https://github.com/RevenueCat/purchases-ios", from: "5.78.0"),
        .package(url: "https://github.com/google/GoogleSignIn-iOS", from: "7.0.0"),
        .package(url: "https://github.com/mixpanel/mixpanel-swift", from: "4.3.0"),
        // Lottie powers the onboarding animations (PersonalizationIntro,
        // AgentValue3/4, StepAgentBorn). RN uses `lottie-react-native` with
        // the same `.json` files; the Swift port consumes them through
        // `airbnb/lottie-ios` and ships them as bundle resources in
        // `WagerproofDesign/Resources/Lotties`.
        .package(url: "https://github.com/airbnb/lottie-ios", from: "4.4.0"),
        // Facebook App Events SDK powers the install→subscribe attribution
        // funnel (CompleteRegistration, fb_mobile_purchase, Subscribe). RN
        // uses `react-native-fbsdk-next`; the Swift port wraps
        // `facebook-ios-sdk` in `WagerproofServices/MetaAnalyticsService.swift`.
        .package(url: "https://github.com/facebook/facebook-ios-sdk", from: "17.0.0"),
    ],
    targets: [
        .target(
            name: "WagerproofModels",
            dependencies: []
        ),
        .target(
            name: "WagerproofServices",
            dependencies: [
                "WagerproofModels",
                "WagerproofSharedKit",
                .product(name: "Supabase", package: "supabase-swift"),
                .product(name: "RevenueCat", package: "purchases-ios"),
                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS"),
                .product(name: "Mixpanel", package: "mixpanel-swift"),
                .product(name: "FacebookCore", package: "facebook-ios-sdk"),
            ],
            resources: [
                .process("Resources"),
            ]
        ),
        .target(
            name: "WagerproofStores",
            dependencies: [
                "WagerproofModels",
                "WagerproofServices",
                "WagerproofSharedKit",
            ]
        ),
        .target(
            name: "WagerproofDesign",
            dependencies: [
                .product(name: "Lottie", package: "lottie-ios"),
            ],
            resources: [
                .process("Resources"),
            ]
        ),
        .target(
            name: "WagerproofSharedKit",
            dependencies: [
                .product(name: "RevenueCat", package: "purchases-ios"),
            ]
        ),
        .testTarget(
            name: "WagerproofModelsTests",
            dependencies: ["WagerproofModels"]
        ),
        .testTarget(
            name: "WagerproofStoresTests",
            // Services listed explicitly: ParlayGodEngineTests @testable-imports it.
            dependencies: ["WagerproofStores", "WagerproofServices", "WagerproofModels"]
        ),
    ]
)
