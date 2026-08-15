import SwiftUI

/// Agent-detail "How did we do?" card. 1:1 port of Honeydew's
/// `ReportRecipeIssueCard` — same `HoneydewOptionCard` treatment, coral
/// palette, decorative symbols, and Report → Submit → Thanks alert flow.
public struct AgentPickFeedbackCard: View {
    /// Called with the optional free-form description. The card owns the
    /// alert chrome; the caller owns the Supabase write.
    public let onSubmit: (String) async throws -> Void

    @State private var showReportDialog: Bool = false
    @State private var reportDescription: String = ""
    @State private var showThanksDialog: Bool = false
    @State private var isSubmitting: Bool = false

    public init(onSubmit: @escaping (String) async throws -> Void) {
        self.onSubmit = onSubmit
    }

    public var body: some View {
        HoneydewOptionCard(
            title: "How did we do?",
            subtitle: "Tap to report a mistake",
            actionWord: "Report",
            primaryColor: Color(red: 1.00, green: 0.25, blue: 0.30),
            secondaryColor: Color(red: 1.00, green: 0.62, blue: 0.50),
            symbols: [
                "exclamationmark.bubble.fill",
                "exclamationmark.triangle.fill",
                "questionmark.circle.fill",
                "bubble.left.and.bubble.right.fill",
                "hand.raised.fill",
                "flag.fill",
                "tray.fill",
                "envelope.fill",
                "checkmark.bubble.fill",
                "ellipsis.bubble.fill",
            ],
            onTap: { showReportDialog = true }
        )
        .alert("Report an Issue", isPresented: $showReportDialog) {
            TextField("Describe the issue (optional)...", text: $reportDescription)
            Button("Submit") {
                guard !isSubmitting else { return }
                isSubmitting = true
                Task { await submitReport() }
            }
            Button("Cancel", role: .cancel) {
                reportDescription = ""
            }
        } message: {
            Text("What went wrong with this agent's picks?")
        }
        .alert("Thanks for the feedback.", isPresented: $showThanksDialog) {
            Button("Ok") {}
        } message: {
            Text("We will review this agent's picks ASAP and implement fixes for next time.")
        }
    }

    private func submitReport() async {
        let description = reportDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            try await onSubmit(description)
            await MainActor.run {
                reportDescription = ""
                isSubmitting = false
                showThanksDialog = true
            }
        } catch {
            // Match Honeydew — no explicit user-facing error when the write fails.
            await MainActor.run {
                reportDescription = ""
                isSubmitting = false
            }
        }
    }
}
