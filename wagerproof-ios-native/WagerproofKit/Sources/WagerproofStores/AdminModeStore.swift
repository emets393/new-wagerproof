import Foundation
import Observation
import WagerproofServices
import WagerproofSharedKit

/// `AdminModeStore` mirrors `wagerproof-mobile/contexts/AdminModeContext.tsx`.
///
/// Two pieces of state:
///   1. `isAdmin` — whether the current user has the `admin` role in
///      Supabase (queried via the `has_role(_user_id, _role)` RPC).
///   2. `adminModeEnabled` — whether the admin has toggled the developer
///      tools on in this session. Persisted to App Group user defaults so
///      it survives launch / re-install for the same user.
///
/// Backend contract — byte-identical to RN's `useIsAdmin` hook:
///   `supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })`
@Observable
@MainActor
public final class AdminModeStore {
    public private(set) var isAdmin: Bool = false
    public private(set) var isCheckingRole: Bool = false
    public private(set) var lastError: String?

    public var adminModeEnabled: Bool {
        didSet {
            AppGroup.defaults.set(adminModeEnabled, forKey: AppGroupKey.adminModeEnabled)
        }
    }

    /// `true` once a role check has completed for the current user. The view
    /// uses this to avoid flashing developer-mode rows for non-admins while
    /// the RPC is in-flight.
    public private(set) var roleResolved: Bool = false

    public init() {
        self.adminModeEnabled = AppGroup.defaults.bool(forKey: AppGroupKey.adminModeEnabled)
    }

    /// Check the admin role for the given user. Called from the auth lifecycle
    /// handler whenever `phase == .authenticated`. Idempotent — re-runs cheaply.
    public func checkRole(for userId: UUID) async {
        isCheckingRole = true
        defer { isCheckingRole = false }
        do {
            let client = await MainSupabase.shared.client
            let response = try await client
                .rpc("has_role", params: HasRoleParams(_user_id: userId, _role: "admin"))
                .execute()
            // Supabase RPC returns the boolean as the body. Decode it directly.
            if let raw = String(data: response.data, encoding: .utf8) {
                let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
                isAdmin = (trimmed == "true")
            } else {
                isAdmin = false
            }
            roleResolved = true
        } catch {
            // Non-fatal: default to non-admin on error. RN does the same.
            isAdmin = false
            roleResolved = true
            lastError = error.localizedDescription
        }
        // Mirror RN: if the user is not (or no longer) an admin, force the
        // local toggle off so the developer drawer doesn't render at all.
        if !isAdmin && adminModeEnabled {
            adminModeEnabled = false
        }
    }

    /// Clear admin state. Called on sign-out.
    public func reset() {
        isAdmin = false
        adminModeEnabled = false
        roleResolved = false
    }

    public func toggleAdminMode() {
        guard isAdmin else { return }
        adminModeEnabled.toggle()
    }

    public var canEnableAdminMode: Bool { isAdmin }

    // MARK: - DEBUG

    #if DEBUG
    public func debugSet(isAdmin: Bool, modeEnabled: Bool = false) {
        self.isAdmin = isAdmin
        self.adminModeEnabled = modeEnabled
        self.roleResolved = true
    }
    #endif

    private struct HasRoleParams: Encodable {
        let _user_id: UUID
        let _role: String
    }
}
