import SwiftUI
import WagerproofDesign
import WagerproofStores

/// Horizontal sport pill bar pinned under the Games header. Mirrors RN
/// `components/SportFilter.tsx` + the inline sport tabs in
/// `(tabs)/index.tsx`: MLB / NBA / NCAAB / NFL / CFB. Selected pill gets
/// bold weight + an underline rule animated via `.matchedGeometryEffect`.
///
/// Pure presentation — the parent owns the selection state.
struct SportPickerBar: View {
    @Binding var selectedSport: GamesStore.Sport
    @Namespace private var pillNamespace

    private let sports: [GamesStore.Sport] = [.mlb, .nba, .ncaab, .nfl, .cfb]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 24) {
                ForEach(sports, id: \.self) { sport in
                    Button {
                        withAnimation(.appQuick) {
                            selectedSport = sport
                        }
                    } label: {
                        VStack(spacing: 4) {
                            Text(sport.label)
                                .font(.system(size: 16, weight: selectedSport == sport ? .bold : .medium))
                                .foregroundStyle(selectedSport == sport ? Color.appTextPrimary : Color.appTextSecondary)
                            ZStack {
                                Capsule()
                                    .fill(.clear)
                                    .frame(height: 3)
                                if selectedSport == sport {
                                    Capsule()
                                        .fill(Color.appPrimary)
                                        .frame(height: 3)
                                        .matchedGeometryEffect(id: "sportPill", in: pillNamespace)
                                }
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Filter to \(sport.label)")
                }
            }
            .padding(.horizontal, 16)
        }
        .frame(height: 48)
        .background(Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.appBorder.opacity(0.3)).frame(height: 1)
        }
        .sensoryFeedback(.selection, trigger: selectedSport)
    }
}

#Preview {
    struct PreviewWrapper: View {
        @State var sport: GamesStore.Sport = .mlb
        var body: some View {
            SportPickerBar(selectedSport: $sport)
        }
    }
    return PreviewWrapper()
}
