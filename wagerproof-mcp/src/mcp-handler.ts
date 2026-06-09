import {
  buildTools,
  indexByName,
  getTodayInET,
  type Tool,
  type ToolContext,
} from "@wagerproof/tool-core";
import type { Env, Props } from "./types";
import { INSTRUCTIONS, SERVER_INFO } from "./instructions";
import {
  createCfbClient,
  createServiceMainClient,
  createUserMainClient,
  getUserAccessToken,
} from "./supabase";

const LATEST_PROTOCOL = "2025-06-18";

// The connector exposes the user's own data tools + the global sports tools.
const TOOLS: Tool[] = buildTools({ includeUserTools: true });
const TOOLS_BY_NAME = indexByName(TOOLS);

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function ok(id: unknown, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id, error: { code, message } };
}

function serializeTool(t: Tool) {
  return {
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: t.annotations,
  };
}

function corsHeaders(origin: string | null, allowed: Set<string>): Record<string, string> {
  const allowOrigin = !origin ? "*" : allowed.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowOrigin || "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/**
 * Build the per-call ToolContext with the right trust tier:
 *  - user tools  → user-scoped Main client (RLS) + the user's id
 *  - global tools → service-role Main client (no identity)
 * CFB (sports) is always the anon client.
 */
async function buildToolContext(tool: Tool, env: Env, props: Props): Promise<ToolContext> {
  const cfb = createCfbClient(env);
  const today = getTodayInET;

  if (tool.scope === "user") {
    const { accessToken, userId } = await getUserAccessToken(props.grantId, env);
    return { main: createUserMainClient(env, accessToken), cfb, today, userId };
  }
  return { main: createServiceMainClient(env), cfb, today };
}

async function handleMessage(msg: JsonRpcRequest, env: Env, props: Props): Promise<object | null> {
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize": {
      const clientProtocol = (params?.protocolVersion as string) || LATEST_PROTOCOL;
      return ok(id, {
        protocolVersion: clientProtocol,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }

    case "tools/list":
      return ok(id, { tools: TOOLS.map(serializeTool) });

    case "tools/call": {
      const name = params?.name as string;
      const args = (params?.arguments as Record<string, unknown>) ?? {};
      const tool = name ? TOOLS_BY_NAME.get(name) : undefined;
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`);

      try {
        const ctx = await buildToolContext(tool, env, props);
        const result = await tool.execute(args, ctx);
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
          isError: false,
        });
      } catch (err) {
        // Tool-level failure → tool result with isError, not a protocol error.
        const message = err instanceof Error ? err.message : String(err);
        return ok(id, { content: [{ type: "text", text: `Error: ${message}` }], isError: true });
      }
    }

    case "ping":
      return ok(id, {});

    default:
      if (isNotification) return null;
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

/** Stateless Streamable-HTTP MCP endpoint at POST /mcp. */
export const mcpApiHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get("Origin");
    const allowed = new Set(
      env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
    );
    const cors = corsHeaders(origin, allowed);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (origin && !allowed.has(origin)) {
      return new Response("Forbidden origin", { status: 403, headers: cors });
    }
    if (request.method === "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { ...cors, Allow: "POST, OPTIONS" },
      });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: cors });
    }

    const props = (ctx as ExecutionContext & { props?: Props }).props;
    if (!props || !props.grantId) {
      return new Response("Unauthorized", { status: 401, headers: cors });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(rpcError(null, -32700, "Parse error"), { status: 400, headers: cors });
    }

    const jsonHeaders = { ...cors, "content-type": "application/json" };

    if (Array.isArray(body)) {
      const responses = (
        await Promise.all(body.map((m) => handleMessage(m as JsonRpcRequest, env, props)))
      ).filter((r): r is object => r !== null);
      if (responses.length === 0) return new Response(null, { status: 202, headers: cors });
      return Response.json(responses, { headers: jsonHeaders });
    }

    const response = await handleMessage(body as JsonRpcRequest, env, props);
    if (response === null) return new Response(null, { status: 202, headers: cors });
    return Response.json(response, { headers: jsonHeaders });
  },
};
