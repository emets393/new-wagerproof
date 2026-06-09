import SwiftUI
import WagerproofDesign
import WagerproofModels

/// One row inside the `FeatureRequestsView` List. Renders either the
/// community-vote variant (with thumbs up/down) or the roadmap variant
/// (read-only with a "N votes" badge).
///
/// Ports the `renderFeatureCard` inline function in
/// `wagerproof-mobile/app/(drawer)/(tabs)/feature-requests.tsx` (lines
/// 213–374). We keep it a sibling-of-View struct (not a List row directly)
/// so callers can place it inside either a `Section` or a plain VStack
/// (which lets the SubmitFeatureRequestSheet preview reuse it).
struct FeatureRequestRow: View {
    let request: FeatureRequest
    let userVote: FeatureRequestVote.VoteType?
    /// Closure fired when the user taps an upvote/downvote. `nil` means the
    /// row is read-only (roadmap items).
    let onVote: ((FeatureRequestVote.VoteType) -> Void)?

    /// Status visuals — derived from `status` + `roadmap_status`. Mirrors
    /// the RN switch block at lines 220–245 byte-for-byte (icons, colors,
    /// labels).
    private var visuals: Visuals {
        guard request.status == .roadmap else {
            // status == .approved (pending never reaches the user list)
            return Visuals(
                badgeText: "Community",
                badgeColor: Color.appPrimary,
                icon: "lightbulb.fill"
            )
        }
        switch request.roadmapStatus {
        case .planned:
            return Visuals(
                badgeText: "Planned",
                badgeColor: Color.appAccentBlue,
                icon: "clock"
            )
        case .inProgress:
            return Visuals(
                badgeText: "In Progress",
                badgeColor: Color.appAccentPurple,
                icon: "paperplane.circle.fill"
            )
        case .completed:
            return Visuals(
                badgeText: "Completed",
                badgeColor: Color(hex: 0x22C55E),
                icon: "checkmark.circle.fill"
            )
        case nil:
            return Visuals(
                badgeText: "Roadmap",
                badgeColor: Color.appAccentBlue,
                icon: "map.fill"
            )
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            header
            description
            footer
        }
        .padding(.vertical, Spacing.xs)
    }

    @ViewBuilder
    private var header: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            Image(systemName: visuals.icon)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(visuals.badgeColor)
                // `.symbolEffect(.bounce, value:)` on roadmap status changes
                // mirrors the spec §6 animation note.
                .symbolEffect(.bounce, value: request.roadmapStatus)
                .frame(width: 28, alignment: .leading)

            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text(request.title)
                    .font(AppFont.headline)
                    .foregroundStyle(Color.appTextPrimary)
                    .multilineTextAlignment(.leading)
                statusBadge
            }
        }
    }

    @ViewBuilder
    private var statusBadge: some View {
        Text(visuals.badgeText)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(visuals.badgeColor)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, 4)
            .background(visuals.badgeColor.opacity(0.18))
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.sm))
    }

    @ViewBuilder
    private var description: some View {
        Text(request.description)
            .font(AppFont.body)
            .foregroundStyle(Color.appTextSecondary)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
    }

    @ViewBuilder
    private var footer: some View {
        HStack(alignment: .center, spacing: Spacing.md) {
            // "By <name> · <date>" caption. RN uses Date#toLocaleDateString();
            // SwiftUI's relative formatter is HIG-friendlier — we still parse
            // the ISO-8601 string for safety.
            Text(footerCaption)
                .font(AppFont.caption)
                .foregroundStyle(Color.appTextMuted)
                .lineLimit(1)
            Spacer(minLength: 0)
            voteControls
        }
    }

    @ViewBuilder
    private var voteControls: some View {
        if let onVote {
            HStack(spacing: Spacing.xs) {
                voteButton(.upvote, onVote: onVote)
                netBadge
                voteButton(.downvote, onVote: onVote)
            }
        } else {
            // Roadmap items: read-only "N votes" pill (RN lines 364–370).
            Text("\(request.netVotes) \(abs(request.netVotes) == 1 ? "vote" : "votes")")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, 4)
                .background(Color.appSurfaceMuted)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.sm))
        }
    }

    @ViewBuilder
    private func voteButton(
        _ type: FeatureRequestVote.VoteType,
        onVote: @escaping (FeatureRequestVote.VoteType) -> Void
    ) -> some View {
        let isActive = userVote == type
        let activeColor = type == .upvote
            ? Color(hex: 0x22C55E)
            : Color.appLoss

        Button {
            onVote(type)
        } label: {
            Image(systemName: type == .upvote ? "hand.thumbsup.fill" : "hand.thumbsdown.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(isActive ? activeColor : Color.appTextSecondary)
                .frame(width: 32, height: 32)
                .background(isActive ? activeColor.opacity(0.18) : Color.appSurfaceMuted)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.sm))
        }
        // List rows wrap buttons in their own tap target by default — using
        // `.buttonStyle(.borderless)` keeps the row's `.swipeActions` /
        // `.contextMenu` free for surrounding behavior while letting the
        // two vote buttons capture their own taps.
        .buttonStyle(.borderless)
        .accessibilityLabel(type == .upvote ? "Upvote" : "Downvote")
        .accessibilityAddTraits(isActive ? .isSelected : [])
    }

    @ViewBuilder
    private var netBadge: some View {
        let net = request.netVotes
        let color: Color = net > 0
            ? Color(hex: 0x22C55E)
            : (net < 0 ? Color.appLoss : Color.appTextSecondary)
        let background: Color = net > 0
            ? Color(hex: 0x22C55E).opacity(0.18)
            : (net < 0 ? Color.appLoss.opacity(0.18) : Color.appSurfaceMuted)

        Text(net > 0 ? "+\(net)" : "\(net)")
            .font(.system(size: 13, weight: .semibold))
            // `.contentTransition(.numericText())` per spec §6 — gives the
            // tally a slot-machine flip when it changes.
            .contentTransition(.numericText())
            .monospacedDigit()
            .foregroundStyle(color)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, 4)
            .frame(minWidth: 40)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.sm))
    }

    // MARK: - Helpers

    private var footerCaption: String {
        let name = request.submitterDisplayName.isEmpty ? "Anonymous" : request.submitterDisplayName
        let dateStr = Self.formatCreatedAt(request.createdAt)
        return "By \(name) · \(dateStr)"
    }

    /// Parse the ISO-8601 timestamp from Supabase and format it as a short
    /// localized date (e.g. "May 20, 2026"). RN uses
    /// `new Date(x).toLocaleDateString()` which is the platform-default
    /// short style; iOS' `.dateStyle = .medium` is the closest visual match.
    /// Falls back to the raw string if parsing fails (defensive — never
    /// blank out the footer).
    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoFormatterNoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let displayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        return f
    }()

    private static func formatCreatedAt(_ raw: String) -> String {
        if let d = isoFormatter.date(from: raw) ?? isoFormatterNoFractional.date(from: raw) {
            return displayFormatter.string(from: d)
        }
        return raw
    }

    private struct Visuals {
        let badgeText: String
        let badgeColor: Color
        let icon: String
    }
}

#if DEBUG
#Preview("Approved + upvoted") {
    List {
        FeatureRequestRow(
            request: FeatureRequest(
                id: "1",
                title: "Add late-night NBA props",
                description: "Would love overnight prop feed for the West Coast tip-offs.",
                submittedBy: "u1",
                submitterDisplayName: "Sam",
                status: .approved,
                roadmapStatus: nil,
                upvotes: 14,
                downvotes: 2,
                createdAt: "2026-05-19T18:00:00Z",
                updatedAt: "2026-05-19T18:00:00Z"
            ),
            userVote: .upvote,
            onVote: { _ in }
        )
    }
}

#Preview("In Progress (roadmap)") {
    List {
        FeatureRequestRow(
            request: FeatureRequest(
                id: "2",
                title: "MLB park-factor calibration",
                description: "Tune the regression model to match the new humidor data.",
                submittedBy: "u2",
                submitterDisplayName: "Editor",
                status: .roadmap,
                roadmapStatus: .inProgress,
                upvotes: 28,
                downvotes: 0,
                createdAt: "2026-04-12T18:00:00Z",
                updatedAt: "2026-05-01T18:00:00Z"
            ),
            userVote: nil,
            onVote: nil
        )
    }
}
#endif
