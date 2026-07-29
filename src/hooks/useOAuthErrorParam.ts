import { useEffect, useState } from 'react';

/**
 * Reads an OAuth failure that Supabase handed back on the redirect.
 *
 * When a provider handshake fails (expired Apple client secret, revoked
 * consent, bad state), GoTrue does NOT throw on the client — signInWithOAuth
 * already resolved when we left the page. It 303s the browser back with
 * `error` / `error_code` / `error_description`, and without this the user
 * just lands on the sign-in page logged out with no explanation.
 *
 * Params arrive in the query string on the code flow and in the hash on the
 * implicit flow, so both are checked. The params are stripped once read so a
 * refresh doesn't resurrect a stale error.
 */
export function useOAuthErrorParam(): string {
  const [oauthError, setOauthError] = useState('');

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const source = query.get('error') ? query : hash.get('error') ? hash : null;
    if (!source) return;

    const description = source.get('error_description');
    const code = source.get('error_code');
    setOauthError(
      // error_description is URL-encoded with `+` for spaces by GoTrue
      description?.replace(/\+/g, ' ') ||
        `Sign-in failed${code ? ` (${code})` : ''}. Please try again.`
    );

    // Drop the params so a reload doesn't re-show a resolved error.
    ['error', 'error_code', 'error_description'].forEach((k) => query.delete(k));
    const search = query.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${search ? `?${search}` : ''}`
    );
  }, []);

  return oauthError;
}
