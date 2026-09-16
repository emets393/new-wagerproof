import { getVerifiedEntitlementState, syncEntitlementCache } from './entitlements.ts';

export interface RevenueCatEvent {
  type: string;
  app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
}
const ACCESS_EVENTS = new Set([
  'INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED', 'TRANSFER', 'CANCELLATION', 'EXPIRATION',
  'BILLING_ISSUE', 'SUBSCRIBER_ALIAS', 'SUBSCRIPTION_PAUSED', 'UNCANCELLATION',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

async function findUser(service: any, customerId: string): Promise<string | null> {
  if (isUuid(customerId)) {
    const { data, error } = await service.from('profiles').select('user_id')
      .eq('user_id', customerId.toLowerCase()).maybeSingle();
    if (error) throw new Error(`Profile lookup failed: ${error.message}`);
    if (data) return data.user_id;
  }
  const { data, error } = await service.from('profiles').select('user_id')
    .eq('revenuecat_customer_id', customerId).maybeSingle();
  if (error) throw new Error(`RevenueCat identity lookup failed: ${error.message}`);
  return data?.user_id ?? null;
}

export async function reconcileRevenueCatEvent(service: any, event: RevenueCatEvent) {
  if (!ACCESS_EVENTS.has(event.type)) return { ok: true, reconciled: 0 };
  const transfer = event.type === 'TRANSFER';
  const identities = [...new Set((transfer
    ? [...(event.transferred_from ?? []), ...(event.transferred_to ?? [])]
    : [event.app_user_id, ...(event.aliases ?? [])]).filter((id): id is string => typeof id === 'string' && id.length > 0))];
  if (!identities.length) throw new Error('Subscription event has no customer identity');
  const users = new Map<string, string>();
  for (const id of identities) {
    const userId = await findUser(service, id);
    if (userId) {
      users.set(userId, transfer ? id : event.app_user_id ?? id);
      if (!transfer) break;
    }
  }
  if (!users.size) throw new Error('Profile not found; retry subscription reconciliation');
  // Transfers have no app_user_id. Reconcile both sides independently, never
  // use the recipient's entitlement as a candidate for the previous owner.
  for (const [userId, id] of users) {
    const state = await getVerifiedEntitlementState(service, userId, id);
    if (state.source !== 'live') throw new Error('Live subscription verification unavailable; retry webhook');
    await syncEntitlementCache(service, userId, state);
  }
  return { ok: true, reconciled: users.size };
}
