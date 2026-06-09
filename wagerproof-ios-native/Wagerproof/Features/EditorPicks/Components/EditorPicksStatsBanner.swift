import SwiftUI
import WagerproofDesign

/// Two-page horizontally-paged banner pinned at the top of the picks list.
/// Mirrors RN `EditorPicksStatsBanner.tsx`:
/// - Page 1: Editor's Picks gradient card (blue→teal) — taps to push stats
/// - Page 2: Model History gradient card (purple→pink) — taps to "Coming soon"
///
/// Uses `TabView(.page)` for native paging (no JS scroll math). The page
/// indicator dots ride on top, recoloring to the active page's brand color.
struct EditorPicksStatsBanner: View {
    // Tapping the banner pushes `EditorPicksStatsView` (the transparency
    // dashboard) — `PicksView` flips its `showStats` navigation flag.
    var onEditorPicksTap: () -> Void = {}

    @State private var page: Int = 0
    @State private var showComingSoon: Bool = false

    var body: some View {
        VStack(spacing: 12) {
            TabView(selection: $page) {
                editorPicksCard
                    .padding(.horizontal, 0)
                    .tag(0)
                modelHistoryCard
                    .padding(.horizontal, 0)
                    .tag(1)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 92)
            // Center dots; tinted per active page.
            HStack(spacing: 8) {
                Circle().fill(page == 0 ? Color.appAccentBlue : Color.appTextMuted.opacity(0.3))
                    .frame(width: page == 0 ? 8 : 6, height: page == 0 ? 8 : 6)
                Circle().fill(page == 1 ? Color.appAccentPurple : Color.appTextMuted.opacity(0.3))
                    .frame(width: page == 1 ? 8 : 6, height: page == 1 ? 8 : 6)
            }
            .animation(.appQuick, value: page)
        }
        .padding(.vertical, 8)
        .alert("Coming Soon", isPresented: $showComingSoon) {
            Button("Got it", role: .cancel) {}
        } message: {
            Text("Model History statistics are currently in development. Check back soon to see the performance of our ML predictions!")
        }
    }

    @ViewBuilder
    private var editorPicksCard: some View {
        Button(action: onEditorPicksTap) {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(Color.white)
                    Image(systemName: "person.crop.circle.fill")
                        .resizable()
                        .scaledToFit()
                        .foregroundStyle(Color.appAccentBlue)
                        .padding(4)
                }
                .frame(width: 48, height: 48)
                .overlay(Circle().stroke(Color.appAccentBlue, lineWidth: 2))

                VStack(alignment: .leading, spacing: 2) {
                    Text("Editor's Picks")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.appAccentBlue)
                    Text("View Stats")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                }
                Spacer()
                Text("Follow the creator's\npersonal picks")
                    .font(.system(size: 12, weight: .medium))
                    .multilineTextAlignment(.trailing)
                    .foregroundStyle(Color.appTextSecondary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            .padding(14)
            .frame(maxWidth: .infinity)
            .background(
                LinearGradient(
                    colors: [Color.appAccentBlue.opacity(0.15), Color.appPrimary.opacity(0.12)],
                    startPoint: .leading,
                    endPoint: .trailing
                ),
                in: RoundedRectangle(cornerRadius: 16)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16).stroke(Color.appAccentBlue.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
    }

    @ViewBuilder
    private var modelHistoryCard: some View {
        Button { showComingSoon = true } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(Color.appAccentPurple.opacity(0.15))
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(Color.appAccentPurple)
                }
                .frame(width: 48, height: 48)
                .overlay(Circle().stroke(Color.appAccentPurple, lineWidth: 2))

                VStack(alignment: .leading, spacing: 2) {
                    Text("Model History")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.appAccentPurple)
                    Text("View Stats")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                }
                Spacer()
                Text("Statistical performance\nof the underlying ML model")
                    .font(.system(size: 12, weight: .medium))
                    .multilineTextAlignment(.trailing)
                    .foregroundStyle(Color.appTextSecondary)
            }
            .padding(14)
            .frame(maxWidth: .infinity)
            .background(
                LinearGradient(
                    colors: [Color.appAccentPurple.opacity(0.18), Color.pink.opacity(0.12)],
                    startPoint: .leading,
                    endPoint: .trailing
                ),
                in: RoundedRectangle(cornerRadius: 16)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16).stroke(Color.appAccentPurple.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
    }
}

#Preview {
    EditorPicksStatsBanner()
        .padding(.vertical)
        .background(Color.appSurface)
}
