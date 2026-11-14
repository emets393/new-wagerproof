/// Renderer selection after RevenueCat resolves a placement for the customer.
/// Flags can disable the new catalog, but cannot enroll someone in its audience.
public enum PaywallPlacementRoute: Equatable, Sendable {
    case none, unavailable, legacy, tiered

    public static func resolve(offeringID: String?, tieredEnabled: Bool, catalogReady: Bool) -> Self {
        guard let offeringID else { return .none }
        guard offeringID == "wagerproof_tiers_v1" else { return .legacy }
        return tieredEnabled && catalogReady ? .tiered : .unavailable
    }
}
