// compactDeepFetch — bounds a deep-tool result before it re-enters the
// conversation. The chat loop's compactToolOutput only reshapes objects with a
// `.games` array (wagerbot-agent/agent.ts), so single-game deep payloads
// (get_game_data, statcast, perfect_storm) would be re-sent raw on EVERY
// subsequent turn → near-quadratic input growth that trips the token ceiling.
//
// Per-tool reshapers (registered as each deep tool lands in Phase 2) keep only
// the essential fields; everything else falls back to a generic recursive prune
// that caps string/array sizes and serialized length. Output is always valid
// JSON (we prune the structure, never slice the serialized string).

type Json = unknown;

/** Per-tool essential-field reshapers. Filled in as Phase-2 deep tools land;
 *  the generic prune is a safe default until then. */
export const DEEP_COMPACTORS: Record<string, (out: Json) => Json> = {};

const MAX_STRING = 240;
const MAX_ARRAY = 12;
const MAX_DEPTH = 5;
const TARGET_CHARS = 4000;

function prune(value: Json, depth: number, arrayCap: number): Json {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + "…" : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? `[${(value as Json[]).length} items]` : "{…}";
  if (Array.isArray(value)) {
    const arr = value as Json[];
    const kept = arr.slice(0, arrayCap).map((v) => prune(v, depth + 1, arrayCap));
    if (arr.length > arrayCap) kept.push(`…+${arr.length - arrayCap} more`);
    return kept;
  }
  if (typeof value === "object") {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value as Record<string, Json>)) {
      out[k] = prune(v, depth + 1, arrayCap);
    }
    return out;
  }
  return String(value);
}

/** Compact a deep-tool result to a bounded, valid-JSON string for the tool
 *  message content. Uses a per-tool reshaper when registered, else generic
 *  prune, tightening the array cap until under TARGET_CHARS. */
export function compactDeepFetch(toolName: string, out: Json, targetChars = TARGET_CHARS): string {
  const reshaper = DEEP_COMPACTORS[toolName];
  const base = reshaper ? reshaper(out) : out;

  for (const cap of [MAX_ARRAY, 6, 3, 1]) {
    const pruned = prune(base, 0, cap);
    const s = JSON.stringify(pruned);
    if (s.length <= targetChars) return s;
  }
  // Last resort: keep top-level keys with type/size hints only.
  if (base && typeof base === "object" && !Array.isArray(base)) {
    const summary: Record<string, string> = {};
    for (const [k, v] of Object.entries(base as Record<string, Json>)) {
      summary[k] = Array.isArray(v)
        ? `[${v.length} items]`
        : v && typeof v === "object"
          ? "{…}"
          : String(v).slice(0, 80);
    }
    return JSON.stringify({ _compacted: true, ...summary });
  }
  return JSON.stringify(prune(base, 0, 1)).slice(0, targetChars);
}
