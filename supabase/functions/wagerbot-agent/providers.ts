// Provider registry for the multi-provider WagerBot agent. Both OpenAI and
// DeepSeek speak the OpenAI Chat Completions wire format, so a provider is just
// a base URL + API-key env var + a cheap title model. Adding another
// OpenAI-compatible provider (e.g. Gemini's OpenAI-compat endpoint) is one entry.

export interface ProviderConfig {
  id: string;
  chatCompletionsUrl: string;
  apiKeyEnv: string;
  /** Cheap model on this provider used for thread auto-titling. */
  titleModel: string;
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  openai: {
    id: "openai",
    chatCompletionsUrl: "https://api.openai.com/v1/chat/completions",
    apiKeyEnv: "OPENAI_API_KEY",
    titleModel: "gpt-4o-mini",
  },
  deepseek: {
    id: "deepseek",
    // DeepSeek's OpenAI-compatible endpoint (the `/v1` is unrelated to model version).
    chatCompletionsUrl: "https://api.deepseek.com/v1/chat/completions",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    titleModel: "deepseek-chat",
  },
};

// Allowlisted models → provider. Keeps arbitrary model strings out and lets the
// iOS debug picker offer a known set.
const MODEL_PROVIDER: Record<string, string> = {
  "gpt-4o": "openai",
  "gpt-4o-mini": "openai",
  "deepseek-chat": "deepseek",
  "deepseek-reasoner": "deepseek",
};

export const DEFAULT_MODEL = "gpt-4o";

export interface ResolvedModel {
  model: string;
  provider: ProviderConfig;
}

/** Resolve a (possibly absent/unknown) requested model to a known model +
 *  provider, defaulting to gpt-4o. */
export function resolveModel(requested?: string | null): ResolvedModel {
  const model = requested && MODEL_PROVIDER[requested] ? requested : DEFAULT_MODEL;
  const provider = PROVIDERS[MODEL_PROVIDER[model]];
  return { model, provider };
}
