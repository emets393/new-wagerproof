import Foundation

/// `WagerproofAPI` is the single Swift entry point that mirrors the RN
/// `services/` directory. Method names mirror the RN function names so a
/// reviewer can grep across both codebases.
///
/// Implementation strategy: most methods delegate to one of the two
/// `SupabaseClient`s via `MainSupabase.shared` or `CFBSupabase.shared`.
/// SSE-streaming methods (chat, voice) bypass the SDK and use
/// `URLSession.bytes(for:)` directly so we can drive an
/// `AsyncThrowingStream<ChatChunk, Error>`.
///
/// The actor exists so callers can fan out concurrent requests safely —
/// the underlying SupabaseClient is itself Sendable; this is a layering
/// convenience, not a correctness fence.
public actor WagerproofAPI {
    public static let shared = WagerproofAPI()

    private init() {}

    // MARK: - Public clients
    //
    // Surface the raw SupabaseClient instances for callers that need
    // table queries / RPC / functions invoke. Phase-2 implementers wire
    // typed methods here as they port each service.

    public var main: MainSupabase { MainSupabase.shared }
    public var cfb: CFBSupabase { CFBSupabase.shared }
}
