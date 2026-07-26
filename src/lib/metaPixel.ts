/**
 * Meta Pixel wrapper for the web conversion funnel.
 *
 * The pixel snippet itself lives in `index.html` (it has to load before React
 * so PageView fires on the first paint). This module is the only place the app
 * should call `fbq` from — it centralizes the event taxonomy and, critically,
 * the `event_id` generation that lets Meta deduplicate a browser event against
 * the same conversion arriving server-side via the Conversions API
 * (`supabase/functions/revenuecat-webhook`).
 *
 * Why dedup matters: without a shared `event_id`, a purchase that fires both in
 * the browser and from the webhook is counted twice, which inflates reported
 * conversions and poisons value-optimization bidding.
 */

const PIXEL_ID = '1731090704521232';

type FbqParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    fbq?: (
      command: string,
      eventName: string,
      params?: FbqParams,
      options?: { eventID?: string }
    ) => void;
  }
}

/**
 * Ad blockers kill the pixel script outright, so `window.fbq` is frequently
 * undefined in the wild. Every call is a silent no-op in that case — the
 * server-side CAPI path is what covers those users.
 */
const isReady = (): boolean => typeof window !== 'undefined' && typeof window.fbq === 'function';

/**
 * ⚠️ We deliberately do NOT send Subscribe / StartTrial from the browser.
 *
 * RevenueCat's Facebook integration reports those conversions server-side and
 * is the single source of truth for them. A browser event would carry no
 * `event_id` that RevenueCat also sends, so Meta could not deduplicate the two
 * and every web subscription would be counted twice.
 *
 * This module therefore covers only the top of the funnel — the events
 * RevenueCat does *not* send: PageView, ViewContent, InitiateCheckout,
 * CompleteRegistration. See `.claude/docs/18_meta_attribution.md`.
 */

const track = (eventName: string, params?: FbqParams, eventId?: string): void => {
  if (!isReady()) return;
  window.fbq!('track', eventName, params, eventId ? { eventID: eventId } : undefined);
};

/** Fired once when a user finishes signup/onboarding. */
export const trackCompleteRegistration = (method: string): void => {
  track('CompleteRegistration', {
    content_name: 'WagerProof Onboarding',
    registration_method: method,
    status: true,
  });
};

/**
 * Paywall impression. `value` is the highlighted plan's price so Meta's value
 * optimization gets a dollar signal ahead of any purchase.
 */
export const trackPaywallView = (
  placement: string,
  value?: number,
  currency = 'USD'
): void => {
  track('ViewContent', {
    content_type: 'paywall',
    content_ids: placement,
    value: value ?? 0,
    currency,
  });
};

/**
 * Purchase button tapped. Fires before the payment sheet resolves so an
 * abandoned checkout still registers as intent — that abandonment signal is the
 * entire reason this event exists.
 */
export const trackInitiateCheckout = (
  productId: string,
  value: number,
  currency = 'USD'
): void => {
  track('InitiateCheckout', {
    content_type: 'subscription',
    content_ids: productId,
    num_items: 1,
    value,
    currency,
  });
};

export const META_PIXEL_ID = PIXEL_ID;
