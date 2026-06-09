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
        self.client = SupabaseClient(
            supabaseURL: SupabaseConfig.Main.url,
            supabaseKey: SupabaseConfig.Main.anonKey
        )
    }
}

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
