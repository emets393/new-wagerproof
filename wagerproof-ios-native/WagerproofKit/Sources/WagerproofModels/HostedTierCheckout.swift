import Foundation

/// Identified RevenueCat checkout. The hosted link owns plan selection and prices.
public enum HostedTierCheckout {
    public static func url(baseURL: String?, appUserID: String, authenticatedUserID: UUID) -> URL? {
        guard appUserID == authenticatedUserID.uuidString.lowercased(),
              let baseURL,
              var components = URLComponents(string: baseURL),
              components.scheme == "https", components.host == "pay.rev.cat",
              components.user == nil, components.password == nil, components.port == nil,
              components.query == nil, components.fragment == nil else { return nil }
        let segments = components.path.split(separator: "/")
        guard segments.count == 1, !segments[0].isEmpty else { return nil }
        components.path = "/\(segments[0])/\(appUserID)"
        // Match the USD prices used for the advertised 30% discount.
        // Omit package_id so RevenueCat displays all six web plan options.
        components.queryItems = [URLQueryItem(name: "currency", value: "USD")]
        return components.url
    }
}
