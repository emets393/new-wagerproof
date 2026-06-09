import Foundation

public struct Profile: Codable, Identifiable, Sendable, Hashable {
    public let id: UUID
    public let email: String?
    public let displayName: String?
    public let username: String?
    public let avatarUrl: String?
    public let isAdmin: Bool
    public let createdAt: Date?

    public init(
        id: UUID,
        email: String? = nil,
        displayName: String? = nil,
        username: String? = nil,
        avatarUrl: String? = nil,
        isAdmin: Bool = false,
        createdAt: Date? = nil
    ) {
        self.id = id
        self.email = email
        self.displayName = displayName
        self.username = username
        self.avatarUrl = avatarUrl
        self.isAdmin = isAdmin
        self.createdAt = createdAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case displayName = "display_name"
        case username
        case avatarUrl = "avatar_url"
        case isAdmin = "is_admin"
        case createdAt = "created_at"
    }
}
