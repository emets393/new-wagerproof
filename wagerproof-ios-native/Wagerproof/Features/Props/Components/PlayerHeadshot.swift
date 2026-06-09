import SwiftUI
import WagerproofModels
import WagerproofDesign

/// Circular MLB player headshot from the MLB CDN, with a neutral fallback
/// disk while loading or on failure. Mirrors RN's `Image` headshots.
struct PlayerHeadshot: View {
    let playerId: Int
    var size: CGFloat = 44

    var body: some View {
        let url = URL(string: MLBPlayerProps.headshotURL(playerId))
        ZStack {
            Circle().fill(Color.appSurfaceMuted)
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                case .failure:
                    Image(systemName: "person.fill")
                        .font(.system(size: size * 0.45))
                        .foregroundStyle(Color.appTextMuted)
                default:
                    ProgressView().controlSize(.mini)
                }
            }
            .frame(width: size, height: size)
            .clipShape(Circle())
        }
        .frame(width: size, height: size)
        .overlay(Circle().strokeBorder(Color.appBorder, lineWidth: 1))
    }
}
