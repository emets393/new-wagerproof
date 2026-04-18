import { supabase } from './supabase';

type AgentAuthorizedActionRequest =
  | {
      action: 'detail_snapshot';
      agent_id: string;
    }
  | {
      action: 'picks_page';
      agent_id: string;
      filter?: 'all' | 'won' | 'lost' | 'pending' | 'push';
      page_size?: number;
      cursor?: string | null;
      include_overlap?: boolean;
      game_date?: string | null;
    }
  | {
      action: 'create_agent';
      data: Record<string, unknown>;
    }
  | {
      action: 'update_agent';
      agent_id: string;
      data: Record<string, unknown>;
    }
  | {
      action: 'request_generation';
      agent_id: string;
      idempotency_key?: string | null;
    };

interface AgentAuthorizedActionSuccess<T> {
  success: true;
  data: T;
}

interface AgentAuthorizedActionFailure {
  success: false;
  error: string;
  details?: unknown;
}

async function extractInvokeErrorMessage(error: any, fallbackMessage: string): Promise<string> {
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      return body?.error || body?.message || fallbackMessage;
    }
  } catch (_parseError) {
    // Fall back to the generic error message below.
  }

  return error?.message || fallbackMessage;
}

export async function invokeAgentAuthorizedAction<T>(
  body: AgentAuthorizedActionRequest,
  fallbackMessage: string,
): Promise<T> {
  // Explicitly attach the bearer token. supabase.functions.invoke auto-attaches
  // from the session in most cases, but the behavior has regressed in certain
  // SDK versions and verify_jwt=false functions, leaving write actions without
  // the Authorization header and returning 401 server-side. Explicit wins.
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  console.log(
    `[invokeAgentAuthorizedAction] action=${(body as any).action} hasSession=${!!session} hasToken=${!!session?.access_token} tokenLen=${session?.access_token?.length ?? 0}`,
  );

  const { data, error } = await (supabase as any).functions.invoke('agent-authorized-action-v1', {
    body,
    headers,
  });

  if (error) {
    throw new Error(await extractInvokeErrorMessage(error, fallbackMessage));
  }

  const payload = data as AgentAuthorizedActionSuccess<T> | AgentAuthorizedActionFailure | null;
  if (!payload?.success) {
    throw new Error(payload?.error || fallbackMessage);
  }

  return payload.data;
}
