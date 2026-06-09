// Core abstractions for the WagerProof tool-core.
//
// This package is deliberately runtime-agnostic and dependency-free: it never
// imports @supabase/supabase-js, Deno URL modules, or any Node/Workers API. A
// tool only ever touches the structural `SupabaseLikeClient` (which the real
// supabase-js client satisfies) plus an injected `today()` clock. That's what
// lets the SAME tool source run on three surfaces:
//   1. the public MCP connector (Cloudflare Worker),
//   2. the WagerBot chat agent loop (Supabase Edge Function / Deno),
//   3. backend agent pick-generation.
// Each surface builds the clients its own way and passes them in via ToolContext.

// ---- Structural Supabase client -------------------------------------------
// A permissive structural subset of supabase-js's query builder — only the
// methods the tools actually use. Callers pass their real client cast to this
// type at the boundary (`client as unknown as SupabaseLikeClient`), so tool-core
// stays free of the supabase-js dependency.

export interface PostgrestResult<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

export interface QueryBuilder<T = Record<string, unknown>>
  extends PromiseLike<PostgrestResult<T[]>> {
  select(columns?: string): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  neq(column: string, value: unknown): QueryBuilder<T>;
  in(column: string, values: readonly unknown[]): QueryBuilder<T>;
  or(filters: string): QueryBuilder<T>;
  ilike(column: string, pattern: string): QueryBuilder<T>;
  gte(column: string, value: unknown): QueryBuilder<T>;
  lte(column: string, value: unknown): QueryBuilder<T>;
  order(column: string, opts?: { ascending?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  single(): PromiseLike<PostgrestResult<T>>;
  maybeSingle(): PromiseLike<PostgrestResult<T>>;
}

export interface SupabaseLikeClient {
  from<T = Record<string, unknown>>(table: string): QueryBuilder<T>;
  rpc<T = unknown>(
    fn: string,
    params?: Record<string, unknown>,
  ): PromiseLike<PostgrestResult<T>>;
}

// ---- Tool context ----------------------------------------------------------

/** Always present. `main` is the Main Supabase project, `cfb` the predictions
 *  project. For user-scoped tools the connector passes a user-JWT (RLS) `main`
 *  client; for global tools it passes a service-role `main`. `cfb` is always the
 *  global (anon) predictions client. */
export interface DataContext {
  main: SupabaseLikeClient;
  cfb: SupabaseLikeClient;
  /** Today's date (YYYY-MM-DD, ET) — injected so each surface controls "now". */
  today: () => string;
}

/** Present only for `scope: "user"` tools — the RLS subject. */
export interface UserContext {
  userId: string;
}

/** Present only on the chat surface — used by presentation-only tools. */
export interface PresentationContext {
  emit: (event: string, data: unknown) => void;
  getBlocks: () => unknown[];
}

export type ToolContext = DataContext &
  Partial<UserContext> &
  Partial<PresentationContext>;

// ---- Tool shape ------------------------------------------------------------

/** "global" = public sports data (no user identity). "user" = the signed-in
 *  user's own data, served via an RLS-scoped client. Drives both which client
 *  the host hands the tool and which surfaces expose it. */
export type ToolScope = "global" | "user";

export interface ToolAnnotations {
  title: string;
  readOnlyHint: boolean;
  openWorldHint: boolean;
  destructiveHint?: boolean;
}

/**
 * A single transport-agnostic tool. `inputSchema` + `annotations` are the
 * MCP-facing fields (every read tool sets `readOnlyHint: true` + a human
 * `title` — the #1 Connectors-Directory rejection cause is missing annotations).
 * `execute` returns plain data; each host serializes it to its own convention.
 */
export interface Tool {
  name: string;
  title: string;
  description: string;
  scope: ToolScope;
  inputSchema: Record<string, unknown>;
  annotations: ToolAnnotations;
  execute(input: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
}

/** Build a read-only annotation block consistently. */
export function readOnly(title: string): ToolAnnotations {
  return { title, readOnlyHint: true, openWorldHint: false };
}

// ---- Small shared input helpers -------------------------------------------

export function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export function asOptString(v: unknown): string | undefined {
  const s = asString(v).trim();
  return s.length > 0 ? s : undefined;
}

export function asOptNumber(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export const SPORTS = ["nfl", "nba", "cfb", "ncaab", "mlb"] as const;
export type Sport = (typeof SPORTS)[number];

export function asSport(v: unknown): Sport | undefined {
  const s = asString(v).toLowerCase().trim();
  return (SPORTS as readonly string[]).includes(s) ? (s as Sport) : undefined;
}
