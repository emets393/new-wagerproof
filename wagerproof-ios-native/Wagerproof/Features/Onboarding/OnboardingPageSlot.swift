import SwiftUI

extension EnvironmentValues {
    /// True while a page is the active carousel page. With the button-driven
    /// slide pager only the active page is mounted, so this defaults to true
    /// — pages gate their Lottie playback / chart grow-ins / entrances on it
    /// (`.pageEntrance(index:)`, the ATT prompt) and the trigger fires at
    /// mount, which is exactly when the page starts sliding in.
    @Entry var onboardingPageIsActive: Bool = true
}
