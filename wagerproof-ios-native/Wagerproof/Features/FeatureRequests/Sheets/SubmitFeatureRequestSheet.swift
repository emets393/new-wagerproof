import SwiftUI
import WagerproofDesign
import WagerproofStores

/// Modal form to submit a new feature request. Ports the half-sheet
/// `Modal` at the bottom of `wagerproof-mobile/app/(drawer)/(tabs)/feature-requests.tsx`
/// (lines 559–645).
///
/// Native primitives — replaces the RN custom modal:
/// - `Form` with two sections (Title, Description) for HIG-correct field
///   chrome (system inset background, dark-mode aware borders, free
///   focus management).
/// - `.presentationDetents([.medium, .large])` + `.presentationDragIndicator(.visible)`
///   matches the spec §6 sheet detents.
/// - `.submitLabel(.send)` / multi-line description via `axis: .vertical`.
///
/// Wiring:
/// - `FeatureRequestsStore.submit(...)` does the actual Supabase insert.
///   On success we dismiss; on failure we surface `lastError` inline.
/// - The user id + display name are passed in from the parent view since
///   the sheet doesn't need its own `AuthStore` subscription.
struct SubmitFeatureRequestSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(FeatureRequestsStore.self) private var store

    let userId: UUID
    let displayName: String?

    @State private var title: String = ""
    @State private var description: String = ""
    @FocusState private var focusedField: Field?

    private enum Field: Hashable { case title, description }

    /// Mirrors RN's basic required-field check (line 131). Disables Submit
    /// until both fields have non-whitespace content.
    private var canSubmit: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !store.isSubmitting
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(
                        "Brief description of your feature idea",
                        text: $title
                    )
                    .focused($focusedField, equals: .title)
                    .submitLabel(.next)
                    .onSubmit { focusedField = .description }
                    .autocorrectionDisabled(false)
                } header: {
                    Text("Title")
                }

                Section {
                    // `axis: .vertical` + `lineLimit(4...10)` gives an auto-
                    // expanding textarea that matches the RN multiline input.
                    TextField(
                        "Provide more details about your feature request…",
                        text: $description,
                        axis: .vertical
                    )
                    .focused($focusedField, equals: .description)
                    .lineLimit(4...10)
                    .submitLabel(.send)
                    .onSubmit {
                        Task { await submit() }
                    }
                } header: {
                    Text("Description")
                } footer: {
                    Text("Share your ideas to help us improve WagerProof. Our team will review pending submissions.")
                        .font(AppFont.caption)
                }

                if let lastError = store.lastError {
                    Section {
                        Label(lastError, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(Color.appAccentAmber)
                            .font(AppFont.caption)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.appSurface)
            .navigationTitle("Submit Feature Request")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .tint(Color.appTextPrimary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await submit() }
                    } label: {
                        if store.isSubmitting {
                            ProgressView()
                        } else {
                            Text("Submit")
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(!canSubmit)
                    .tint(Color.appPrimary)
                }
            }
            .onAppear { focusedField = .title }
            // Hint to users that validation failed via warning haptic.
            .sensoryFeedback(.warning, trigger: store.lastError)
        }
    }

    private func submit() async {
        let ok = await store.submit(
            title: title,
            description: description,
            userId: userId,
            displayName: displayName
        )
        if ok {
            // RN shows an Alert.alert("Success", …) success toast. iOS-native
            // approach: rely on the sheet dismiss + .sensoryFeedback(.success)
            // on the parent view (driven by store.justSubmittedAt). Avoid
            // toast-on-top-of-dismissed-sheet jitter.
            dismiss()
        }
    }
}

#if DEBUG
#Preview("Empty form") {
    Text("…").sheet(isPresented: .constant(true)) {
        SubmitFeatureRequestSheet(
            userId: UUID(),
            displayName: "Preview"
        )
        .environment(FeatureRequestsStore())
        .presentationDetents([.medium, .large])
    }
}
#endif
