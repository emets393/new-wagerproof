import SwiftUI
import WagerproofDesign

/// Standard iOS list row used by every `SearchView` result section. One row
/// type for all four result kinds (games, agents, outliers, scores) so the
/// search list reads as a uniform surface — only the icon color and the
/// secondary label change between kinds.
///
/// Layout (matches Honeydew's settings-row + system Spotlight rhythm):
///   - 28pt leading icon in a tinted rounded square
///   - Two-line text stack (primary 17pt, secondary 13pt secondary)
///   - Trailing chevron (system standard) — search results always push or
///     present, so the chevron is non-negotiable
///
/// The accessory is rendered as a `Image(systemName: "chevron.right")`
/// rather than relying on `NavigationLink`'s built-in chevron because the
/// SearchView's result rows fire imperative actions (switch tab + open
/// sheet) instead of pushing a child view on the local stack.
struct SearchResultRow: View {
    /// SF Symbol name. `trophy.fill` for games, `brain.head.profile` for
    /// agents, `bell.badge.fill` for outliers, `sportscourt.fill` for scores.
    let icon: String
    /// Tint applied to the leading icon's background. Each kind picks its
    /// own brand-aligned tint so a glance at the column tells the user what
    /// surface a row belongs to.
    let tint: Color
    let primary: String
    let secondary: String?
    /// Optional trailing micro-label (e.g. live score "21-7" or agent net
    /// units "+12.4u"). Rendered between the secondary text and the
    /// chevron, smaller and monospaced.
    let trailingDetail: String?
    let onTap: () -> Void

    init(
        icon: String,
        tint: Color,
        primary: String,
        secondary: String? = nil,
        trailingDetail: String? = nil,
        onTap: @escaping () -> Void
    ) {
        self.icon = icon
        self.tint = tint
        self.primary = primary
        self.secondary = secondary
        self.trailingDetail = trailingDetail
        self.onTap = onTap
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                iconBadge
                VStack(alignment: .leading, spacing: 2) {
                    Text(primary)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                    if let secondary, !secondary.isEmpty {
                        Text(secondary)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.appTextSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 8)
                if let trailingDetail, !trailingDetail.isEmpty {
                    Text(trailingDetail)
                        .font(.system(size: 13, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(1)
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
            }
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// Tinted rounded-square icon container. 36pt outer square, 18pt symbol.
    /// Same shape language as the Settings rows so search results feel
    /// native to the system UI.
    private var iconBadge: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(tint.opacity(0.16))
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(tint)
        }
        .frame(width: 36, height: 36)
    }
}

#Preview("Search result rows") {
    List {
        SearchResultRow(
            icon: "trophy.fill",
            tint: Color.appPrimary,
            primary: "Lakers @ Warriors",
            secondary: "NBA \u{00B7} Sun 1:30 PM",
            onTap: {}
        )
        SearchResultRow(
            icon: "brain.head.profile",
            tint: Color.appAccentPurple,
            primary: "Sharp Sam",
            secondary: "Public agent \u{00B7} 58% W",
            trailingDetail: "+12.4u",
            onTap: {}
        )
        SearchResultRow(
            icon: "bell.badge.fill",
            tint: Color.appAccentAmber,
            primary: "Fade Lakers",
            secondary: "NBA \u{00B7} Spread \u{00B7} 78% model",
            onTap: {}
        )
        SearchResultRow(
            icon: "sportscourt.fill",
            tint: Color.appAccentBlue,
            primary: "LAL 88 vs GSW 82",
            secondary: "NBA \u{00B7} Q4 4:21",
            trailingDetail: "LIVE",
            onTap: {}
        )
    }
    .listStyle(.insetGrouped)
}
