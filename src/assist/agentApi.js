/**
 * Direct Agent Service calls using the dashboard user's Trimble ID access token
 * (Auth Code + PKCE from SPA login) — not the n8n client-credentials app token.
 */

function trim(value) {
  return String(value || '').trim();
}

/** Stage/prod Agent Service hosts (see docs Agents API servers). */
export function getAgentsApiBase(environment = 'stage') {
  const override = trim(import.meta.env.VITE_AGENTS_API_BASE);
  if (override) return override.replace(/\/$/, '');

  // Dev server proxies this path to avoid localhost CORS (see vite.config.js).
  if (import.meta.env.DEV) {
    return '/api/agents-proxy';
  }

  const env = String(environment || 'stage').toLowerCase();
  if (env === 'prod' || env === 'production') {
    return 'https://agents.ai.trimble.com';
  }

  return 'https://agents.stage.trimble-ai.com';
}

/**
 * @param {string} token
 * @returns {{ scope: string, scopeSet: Set<string>, aud: string } | null}
 */
export function inspectAccessToken(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    const aud = payload.aud;
    const scope = payload.scope || payload.scp;
    const scopeText = Array.isArray(scope)
      ? scope.join(' ')
      : String(scope || '');
    return {
      aud: Array.isArray(aud) ? aud.join(', ') : String(aud || ''),
      scope: scopeText,
      scopeSet: new Set(
        scopeText
          .split(/[,\s]+/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      ),
      identityType: String(payload.identity_type || ''),
      sub: String(payload.sub || ''),
    };
  } catch {
    return null;
  }
}

/** Agent Service run needs `agents` on the user access token. */
export function missingAgentsScope(claims) {
  if (!claims?.scopeSet) return ['agents'];
  if (
    ![...claims.scopeSet].some((s) => s === 'agents' || s.endsWith('-agents'))
  ) {
    return ['agents'];
  }
  return [];
}

/**
 * Parse one SSE block (`data: {...}`) from Agents API run stream.
 * @param {string} raw
 */
function parseSseDataLines(chunk) {
  const events = [];
  const blocks = String(chunk || '').split(/\n\n/);
  for (const block of blocks) {
    const dataLines = block
      .split(/\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());
    if (!dataLines.length) continue;
    const payload = dataLines.join('\n');
    if (!payload || payload === '[DONE]') continue;
    try {
      events.push(JSON.parse(payload));
    } catch {
      /* ignore non-JSON keepalive */
    }
  }
  return events;
}

/**
 * Run an agent with the caller's user access token. Streams SSE events.
 *
 * @param {object} options
 * @param {string} options.agentId
 * @param {string} options.accessToken - SPA user TID access token
 * @param {string} options.message - user prompt text
 * @param {Array<{description: string, value: string}>} [options.context]
 * @param {'stage'|'prod'|string} [options.environment]
 * @param {AbortSignal} [options.signal]
 * @param {(event: object) => void} [options.onEvent]
 * @returns {Promise<{ text: string, runId?: string, threadId?: string, events: object[] }>}
 */
export async function runAgentWithUserToken({
  agentId,
  accessToken,
  message,
  context = [],
  environment = 'stage',
  signal,
  onEvent,
}) {
  const id = trim(agentId);
  const token = trim(accessToken);
  if (!id) throw new Error('Missing agent id.');
  if (!token) throw new Error('Missing user access token.');

  const claims = inspectAccessToken(token);
  const missing = missingAgentsScope(claims);
  if (missing.length) {
    const err = new Error(
      `Login token is missing scope(s): ${missing.join(', ')}. Sign out and sign in again so VITE_ASSIST_API_SCOPE includes agents.`
    );
    err.code = 'AGENTS_SCOPE_MISSING';
    err.claims = claims;
    throw err;
  }

  const base = getAgentsApiBase(environment);
  const url = `${base}/v2/agents/${encodeURIComponent(id)}/runs`;
  const body = {
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: String(message || '') }],
      },
    ],
  };
  if (Array.isArray(context) && context.length) {
    body.context = context;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {
      detail = '';
    }
    let parsed = null;
    try {
      parsed = detail ? JSON.parse(detail) : null;
    } catch {
      parsed = null;
    }
    const err = new Error(
      parsed?.detail ||
        parsed?.title ||
        detail?.slice(0, 300) ||
        `Agent run failed (HTTP ${response.status})`
    );
    err.status = response.status;
    err.code =
      response.status === 401 || response.status === 403
        ? 'AGENTS_UNAUTHORIZED'
        : response.status === 404
          ? 'AGENTS_NOT_FOUND'
          : 'AGENTS_RUN_FAILED';
    err.body = parsed || detail;
    err.claims = claims;
    throw err;
  }

  const events = [];
  let text = '';
  let runId;
  let threadId;
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Agent run returned no response body.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\n\n/);
    buffer = parts.pop() || '';
    for (const part of parts) {
      for (const event of parseSseDataLines(part)) {
        events.push(event);
        onEvent?.(event);
        if (event.type === 'RUN_STARTED') {
          runId = event.runId || runId;
          threadId = event.threadId || threadId;
        }
        if (event.type === 'TEXT_MESSAGE_CONTENT' && event.delta) {
          text += event.delta;
        }
      }
    }
  }
  if (buffer.trim()) {
    for (const event of parseSseDataLines(buffer)) {
      events.push(event);
      onEvent?.(event);
      if (event.type === 'TEXT_MESSAGE_CONTENT' && event.delta) {
        text += event.delta;
      }
    }
  }

  return { text, runId, threadId, events, claims };
}
