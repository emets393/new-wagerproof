import Foundation
import Supabase

/// Two Supabase clients, one per project. Both wrapped in actors so callers
/// from any thread are safe. URLs/keys come from `SupabaseConfig`.
///
/// - `main` is the auth + user data + chat threads + Polymarket cache project.
/// - `cfb` is the predictions / sports data project. **No auth needed** — RLS
///   policies on that project expose the prediction views to the anon role.
///
/// The actors hold the SupabaseClient instance (which itself is internally
/// thread-safe per supabase-swift docs), but we route every call through the
/// actor so we can layer audit logging / retries / circuit-breaking later
/// without touching call sites.
public actor MainSupabase {
    public static let shared = MainSupabase()

    public let client: SupabaseClient

    private init() {
        // Explicit auth session storage. The SDK default is Keychain, which
        // throws `errSecMissingEntitlement` on unsigned Simulator builds (no
        // application-identifier entitlement, e.g. `CODE_SIGNING_ALLOWED=NO`) —
        // the session then fails to persist and `client.auth.session` returns nil
        // right after sign-in, so every write action fails with "Not signed in".
        // DEBUG uses UserDefaults (no entitlement needed → works everywhere in
        // dev/sim); RELEASE keeps the secure Keychain default.
        self.client = SupabaseClient(
            supabaseURL: SupabaseConfig.Main.url,
            supabaseKey: SupabaseConfig.Main.anonKey,
            options: SupabaseClientOptions(auth: .init(storage: Self.authStorage))
        )
    }

    private static var authStorage: any AuthLocalStorage {
        #if DEBUG
        return UserDefaultsAuthStorage()
        #else
        return AuthClient.Configuration.defaultLocalStorage
        #endif
    }
}

#if DEBUG
/// A `UserDefaults`-backed auth session store for DEBUG / Simulator builds — it
/// needs no Keychain entitlement, so the Supabase session persists reliably even
/// in unsigned sim builds. NOT used in RELEASE (which keeps the secure Keychain
/// default).
struct UserDefaultsAuthStorage: AuthLocalStorage {
    private let defaults = UserDefaults.standard
    func store(key: String, value: Data) throws { defaults.set(value, forKey: key) }
    func retrieve(key: String) throws -> Data? { defaults.data(forKey: key) }
    func remove(key: String) throws { defaults.removeObject(forKey: key) }
}
#endif

public actor CFBSupabase {
    public static let shared = CFBSupabase()

    public let client: SupabaseClient

    private init() {
        self.client = SupabaseClient(
            supabaseURL: SupabaseConfig.CFB.url,
            supabaseKey: SupabaseConfig.CFB.anonKey
        )
    }
}
