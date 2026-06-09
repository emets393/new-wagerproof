import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Step 2 of the wizard — name, emoji, color/gradient. Ports
/// `components/agents/creation/Screen2_Identity.tsx`.
///
/// Converted to native Form/Section — the custom `section(title:subtitle:)`
/// helper is gone; all name-validation logic, bindings, and the gradient
/// wire format are preserved verbatim.
struct Step2IdentityView: View {
    @Bindable var store: AgentCreationStore

    /// Gradient color options from RN COLOR_OPTIONS in Screen2_Identity.tsx:29-46.
    /// Stored as "gradient:#hex1,#hex2" — same wire format as Supabase.
    private static let gradients: [String] = [
        "gradient:#6366f1,#ec4899",
        "gradient:#8b5cf6,#06b6d4",
        "gradient:#ef4444,#f97316",
        "gradient:#22c55e,#06b6d4",
        "gradient:#f97316,#eab308",
        "gradient:#ec4899,#8b5cf6",
        "gradient:#06b6d4,#6366f1",
        "gradient:#22c55e,#eab308",
        "gradient:#ef4444,#ec4899",
        "gradient:#8b5cf6,#f97316",
        "gradient:#3b82f6,#22c55e",
        "gradient:#f59e0b,#ef4444",
        "gradient:#14b8a6,#8b5cf6",
        "gradient:#6366f1,#3b82f6",
        "gradient:#dc2626,#7c3aed",
        "gradient:#0ea5e9,#22d3ee",
    ]

    var body: some View {
        Form {
            // Preview row — transparent background so gradient shows through.
            Section {
                VStack(spacing: 12) {
                    ZStack {
                        avatarGradient
                            .frame(width: 80, height: 80)
                            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 24, style: .continuous)
                                    .strokeBorder(primaryColor, lineWidth: 3)
                            )
                        PixelSpriteAvatar(spriteIndex: AgentSpriteIndex.forSeed(store.draft.name))
                            .padding(6)
                    }

                    Text(store.draft.name.isEmpty ? "Agent Name" : store.draft.name)
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .opacity(store.draft.name.isEmpty ? 0.5 : 1)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                // Clear row bg so the avatar gradient stands out.
                .listRowBackground(Color.clear)
            }

            // Agent name field — char count + duplicate warning in footer.
            Section {
                TextField("e.g., Sharp Shooter, The Oracle", text: $store.draft.name)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled(true)
                    .font(.system(size: 16, weight: .medium))
            } header: {
                Text("Agent Name")
            } footer: {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Spacer()
                        Text("\(store.draft.name.count)/50")
                            .font(.system(size: 12))
                            .foregroundStyle(nameOverLimit ? Color(hex: 0xEF4444) : Color.secondary)
                    }
                    if nameIsDuplicate {
                        Text("You already have an agent with this name")
                            .font(.system(size: 13))
                            .foregroundStyle(Color(hex: 0xEF4444))
                    }
                    if store.draft.name.isEmpty {
                        Text("Give your agent a unique name (required)")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.secondary)
                    }
                }
            }

            // Emoji picker — fixed height so paged TabView fits in the row.
            Section {
                SwipeableEmojiPicker(
                    selectedEmoji: $store.draft.avatarEmoji,
                    selectedColor: primaryColor
                )
                .frame(height: 200)
                .listRowInsets(EdgeInsets())
                if store.draft.avatarEmoji.isEmpty {
                    Text("Please select an emoji")
                        .font(.system(size: 13))
                        .foregroundStyle(Color(hex: 0xEF4444))
                }
            } header: {
                Text("Choose an Emoji")
            } footer: {
                Text("Select an emoji to represent your agent (required)")
                    .font(.system(size: 13))
            }

            // Gradient color grid.
            Section {
                colorGrid
                    .listRowInsets(EdgeInsets(top: 12, leading: 12, bottom: 12, trailing: 12))
            } header: {
                Text("Choose a Color")
            } footer: {
                Text("Select a gradient color for your agent")
            }
        }
    }

    // MARK: - Color grid

    private var colorGrid: some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 4)
        return LazyVGrid(columns: columns, spacing: 12) {
            ForEach(Self.gradients, id: \.self) { gradient in
                let isSelected = store.draft.avatarColor == gradient
                Button {
                    store.draft.avatarColor = gradient
                } label: {
                    ZStack {
                        gradientView(for: gradient)
                            .frame(width: 48, height: 48)
                            .clipShape(Circle())
                        if isSelected {
                            ZStack {
                                Circle()
                                    .fill(Color.white.opacity(0.9))
                                    .frame(width: 24, height: 24)
                                Image(systemName: "checkmark")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(.black)
                            }
                        }
                    }
                    .overlay(
                        Circle()
                            .strokeBorder(isSelected ? Color.white : Color.clear, lineWidth: 3)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Helpers

    private var primaryColor: Color {
        Color(hexString: primaryHex(from: store.draft.avatarColor)) ?? Color(hex: 0x6366F1)
    }

    private var avatarGradient: some View {
        gradientView(for: store.draft.avatarColor)
    }

    @ViewBuilder
    private func gradientView(for raw: String) -> some View {
        if raw.hasPrefix("gradient:") {
            let stripped = String(raw.dropFirst("gradient:".count))
            let parts = stripped.split(separator: ",")
            let colors: [Color] = parts.compactMap { Color(hexString: String($0)) }
            if colors.count >= 2 {
                LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
            } else if let first = colors.first {
                first
            } else {
                Color(hex: 0x6366F1)
            }
        } else {
            Color(hexString: raw) ?? Color(hex: 0x6366F1)
        }
    }

    private func primaryHex(from raw: String) -> String {
        if raw.hasPrefix("gradient:") {
            let stripped = String(raw.dropFirst("gradient:".count))
            return stripped.split(separator: ",").first.map(String.init) ?? "#6366f1"
        }
        return raw
    }

    private var nameOverLimit: Bool {
        store.draft.name.count > 50
    }

    private var nameIsDuplicate: Bool {
        let trimmed = store.draft.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else { return false }
        return store.existingAgentNames.contains(where: { $0.lowercased() == trimmed })
    }
}
