import SwiftUI
import WagerproofStores

/// View-side alias for `OnboardingStore.Step`. Kept as a thin alias so view
/// files can reference steps without dragging the store dependency into
/// every component file. Carousel mapping helpers (`carouselIndex`,
/// `carouselPageCount`, `progress`) live on the enum itself in
/// `OnboardingStore.swift`.
typealias OnboardingStep = OnboardingStore.Step
