/**
 * Browser-side Trimble ID (user login) settings.
 * Must use VITE_* keys so Vite exposes them to the client.
 * Never put TID_CLIENT_SECRET here — that stays server-only for n8n.
 */

function trim(value) {
  return String(value || '').trim();
}

function parseScopes(raw) {
  return trim(raw)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Keep path from env/absolute URL, but always use the current origin (port-safe). */
function resolveAppUrl(configured, fallbackPath) {
  const origin = window.location.origin;
  const raw = trim(configured);
  if (!raw) return `${origin}${fallbackPath}`;
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      return `${origin}${u.pathname}${u.search}`;
    }
  } catch {
    /* fall through */
  }
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${origin}${path}`;
}

export function getTidAuthConfig() {
  const configurationEndpoint = trim(
    import.meta.env.VITE_TID_CONFIGURATION_ENDPOINT
  );
  const clientId = trim(import.meta.env.VITE_TID_CLIENT_ID);
  const redirectUrl = resolveAppUrl(
    import.meta.env.VITE_TID_REDIRECT_URL,
    '/callback'
  );
  const logoutRedirectUrl = resolveAppUrl(
    import.meta.env.VITE_TID_LOGOUT_REDIRECT_URL,
    '/logout-callback'
  );
  // Assist embed needs an access token whose `aud` Assist accepts. Append any
  // Assist/Agent Studio API scopes here (Developer Console → API products).
  const scopes = [
    ...parseScopes(import.meta.env.VITE_TID_SCOPES),
    ...parseScopes(import.meta.env.VITE_ASSIST_API_SCOPE),
  ].filter((scope, index, all) => all.indexOf(scope) === index);

  const configured = Boolean(
    configurationEndpoint && clientId && scopes.length > 0
  );

  return {
    configured,
    configurationEndpoint,
    clientId,
    redirectUrl,
    logoutRedirectUrl,
    scopes,
  };
}

export function isCallbackPath(pathname = window.location.pathname) {
  return pathname === '/callback' || pathname.endsWith('/callback');
}

export function isLogoutCallbackPath(pathname = window.location.pathname) {
  return (
    pathname === '/logout-callback' || pathname.endsWith('/logout-callback')
  );
}
