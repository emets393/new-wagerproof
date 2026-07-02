import WidgetKit
import SwiftUI

/// Two independently-addable Home Screen widgets — no configuration picker.
/// Replaces the old RN-era single configurable widget (Editor Picks / Fade
/// Alerts / Market Value / Top Agents); Editor Picks is retired and Market
/// Value was deferred, leaving these two as first-class, separately
/// discoverable widgets in the gallery.
@main
struct WagerProofWidgetBundle: WidgetBundle {
    var body: some Widget {
        TopOutliersWidget()
        AgentMonitorWidget()
    }
}
