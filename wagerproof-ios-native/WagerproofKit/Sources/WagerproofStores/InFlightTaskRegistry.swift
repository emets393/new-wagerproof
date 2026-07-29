import Foundation

/// Coalesces matching async store loads so multiple view lifecycles can await
/// one request instead of starting duplicate network and transformation work.
///
/// Store state remains MainActor-isolated; the registry only owns task
/// lifetimes and never publishes observable state of its own.
@MainActor
final class InFlightTaskRegistry<Key: Hashable> {
    private var tasks: [Key: Task<Void, Never>] = [:]

    func run(
        key: Key,
        operation: @escaping @MainActor () async -> Void
    ) async {
        if let existing = tasks[key] {
            await existing.value
            return
        }

        let task = Task { @MainActor in
            await operation()
        }
        tasks[key] = task
        await task.value
        tasks[key] = nil
    }
}
