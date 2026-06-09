import Foundation

/// Anon keys and URLs are public client-side constants (mirrors the RN code in
/// wagerproof-mobile/services/supabase.ts and services/collegeFootballClient.ts).
/// Row-level security on Supabase gates everything; the key alone grants no
/// authority. Do not move these into Secrets.swift — keep them visible so
/// the Swift client matches the RN client byte-for-byte.
public enum SupabaseConfig {
    public enum Main {
        public static let url = URL(string: "https://gnjrklxotmbvnxbnnqgq.supabase.co")!
        public static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ"
    }

    public enum CFB {
        public static let url = URL(string: "https://jpxnjuwglavsjbgbasnl.supabase.co")!
        public static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo"
    }
}
