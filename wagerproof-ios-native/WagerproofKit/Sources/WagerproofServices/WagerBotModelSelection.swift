import Foundation
import WagerproofSharedKit

/// Which LLM the WagerBot chat runs on, selectable from a DEBUG picker in the
/// chat's "more options" menu. Mirrors the `DummyDataMode` pattern: a static
/// accessor backed by App Group defaults, so the (non-view) chat service can
/// read it without an injected store.
///
/// The "default" option routes to the production `wagerbot-chat` edge function
/// (OpenAI Responses API) — unchanged behavior. Every other option routes to
/// the parallel `wagerbot-agent` function (Chat Completions, multi-provider)
/// with the chosen `model`. In RELEASE builds the chat always uses the default;
/// the picker and the override read are DEBUG-gated.
public struct WagerBotModelOption: Identifiable, Sendable, Hashable {
    public let id: String
    /// Human label for the picker.
    public let label: String
    /// Model id sent to the edge function; nil = let the default function decide.
    public let model: String?
    /// Edge function to call for this option.
    public let functionName: String

    public init(id: String, label: String, model: String?, functionName: String) {
        self.id = id
        self.label = label
        self.model = model
        self.functionName = functionName
    }
}

public enum WagerBotModelSelection {
    /// The default routes to the existing production chat untouched.
    public static let defaultOption = WagerBotModelOption(
        id: "default",
        label: "Default · GPT-4o (Responses)",
        model: nil,
        functionName: "wagerbot-chat"
    )

    public static let options: [WagerBotModelOption] = [
        defaultOption,
        WagerBotModelOption(id: "gpt-4o", label: "GPT-4o (Chat)", model: "gpt-4o", functionName: "wagerbot-agent"),
        WagerBotModelOption(id: "deepseek-chat", label: "DeepSeek Chat", model: "deepseek-chat", functionName: "wagerbot-agent"),
        WagerBotModelOption(id: "deepseek-reasoner", label: "DeepSeek Reasoner", model: "deepseek-reasoner", functionName: "wagerbot-agent"),
    ]

    /// Persisted selection id (App Group defaults). Defaults to the production option.
    public static var currentId: String {
        get { AppGroup.defaults.string(forKey: AppGroupKey.wagerBotChatModel) ?? defaultOption.id }
        set { AppGroup.defaults.set(newValue, forKey: AppGroupKey.wagerBotChatModel) }
    }

    /// The resolved option to use for a chat run.
    public static var current: WagerBotModelOption {
        options.first { $0.id == currentId } ?? defaultOption
    }
}
