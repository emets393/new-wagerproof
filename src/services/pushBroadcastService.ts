import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export const PUSH_DEEP_LINK_ROUTES = ['feed', 'agents', 'outliers'] as const;
export type PushDeepLinkRoute = (typeof PUSH_DEEP_LINK_ROUTES)[number];
export type PushSubscriptionFilter = 'all' | 'pro' | 'free';
export type PushPlatform = 'ios' | 'android';
export type PushBroadcastStatus =
  | 'draft'
  | 'scheduled'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'canceled'
  | 'failed';

export interface PushBroadcastDraftInput {
  title: string;
  body: string;
  deep_link_route: PushDeepLinkRoute;
  target_platforms: PushPlatform[];
  target_subscription: PushSubscriptionFilter;
}

export interface PushBroadcastStatusRow extends PushBroadcastDraftInput {
  id: string;
  extra_data: Record<string, unknown>;
  status: PushBroadcastStatus;
  scheduled_for: string | null;
  recipients_total: number | null;
  last_test_at: string | null;
  last_test_result: Record<string, unknown> | null;
  created_by: string | null;
  sent_by: string | null;
  created_at: string;
  updated_at: string;
  pending_count: number;
  leased_count: number;
  sent_count: number;
  skipped_count: number;
  failed_count: number;
  retryable_count: number;
  tokens_attempted: number;
  tokens_succeeded: number;
  tokens_failed: number;
}

export interface AudienceCount {
  users: number;
  ios_users: number;
  android_users: number;
  tokens: number;
  opted_out: number;
}

export interface RecipientFailure {
  id: string;
  user_id: string;
  status: string;
  skip_reason: string | null;
  tokens_attempted: number;
  tokens_succeeded: number;
  tokens_failed: number;
  provider_response: unknown;
  updated_at: string;
}

function unwrapFunctionsError(error: any): Error {
  if (error?.context?.body) {
    try {
      const errorBody = typeof error.context.body === 'string'
        ? JSON.parse(error.context.body)
        : error.context.body;
      if (errorBody?.error) {
        return new Error(errorBody.error);
      }
    } catch {
      // fall through
    }
  }
  return error instanceof Error ? error : new Error(error?.message || 'Unknown error');
}

async function invokeBroadcast(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-push-broadcast', { body });
  if (error) throw unwrapFunctionsError(error);
  if (data && data.success === false && data.error) {
    throw new Error(data.error);
  }
  return data;
}

export async function listBroadcasts(): Promise<PushBroadcastStatusRow[]> {
  const { data, error } = await db
    .from('push_broadcast_status_v')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []) as PushBroadcastStatusRow[];
}

export async function createBroadcastDraft(
  input: PushBroadcastDraftInput,
): Promise<{ id: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await db
    .from('push_broadcasts')
    .insert({
      title: input.title.trim(),
      body: input.body.trim(),
      deep_link_route: input.deep_link_route,
      target_platforms: input.target_platforms,
      target_subscription: input.target_subscription,
      created_by: userData.user?.id ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data as { id: string };
}

export async function updateBroadcastDraft(
  id: string,
  input: PushBroadcastDraftInput,
): Promise<void> {
  const { error } = await db
    .from('push_broadcasts')
    .update({
      title: input.title.trim(),
      body: input.body.trim(),
      deep_link_route: input.deep_link_route,
      target_platforms: input.target_platforms,
      target_subscription: input.target_subscription,
    })
    .eq('id', id)
    .eq('status', 'draft');
  if (error) throw error;
}

export async function countAudience(
  platforms: PushPlatform[],
  subscription: PushSubscriptionFilter,
): Promise<AudienceCount> {
  const { data, error } = await db.rpc('count_push_broadcast_audience', {
    p_platforms: platforms,
    p_subscription: subscription,
  });
  if (error) throw error;
  return {
    users: Number(data?.users ?? 0),
    ios_users: Number(data?.ios_users ?? 0),
    android_users: Number(data?.android_users ?? 0),
    tokens: Number(data?.tokens ?? 0),
    opted_out: Number(data?.opted_out ?? 0),
  };
}

export async function testSendBroadcast(broadcastId: string) {
  return invokeBroadcast({ action: 'test_send', broadcast_id: broadcastId });
}

export async function sendBroadcastNow(broadcastId: string) {
  return invokeBroadcast({ action: 'send_now', broadcast_id: broadcastId });
}

export async function scheduleBroadcast(broadcastId: string, scheduledForIso: string) {
  return invokeBroadcast({
    action: 'schedule',
    broadcast_id: broadcastId,
    scheduled_for: scheduledForIso,
  });
}

export async function cancelBroadcast(broadcastId: string) {
  return invokeBroadcast({ action: 'cancel', broadcast_id: broadcastId });
}

export async function listRecipientFailures(broadcastId: string): Promise<RecipientFailure[]> {
  const { data, error } = await db
    .from('push_broadcast_recipients')
    .select('id, user_id, status, skip_reason, tokens_attempted, tokens_succeeded, tokens_failed, provider_response, updated_at')
    .eq('broadcast_id', broadcastId)
    .in('status', ['failed', 'failed_retryable'])
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as RecipientFailure[];
}
