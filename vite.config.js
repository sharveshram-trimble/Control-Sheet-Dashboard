import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initialWorkflowData } from './src/data/initialData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load local secrets from `.env`
function loadDotEnv() {
  try {
    const envPath = path.resolve(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // .env wins so clearing a key (e.g. N8N_WEBHOOK_AUTH=) takes effect on restart
      process.env[key] = value;
    }
  } catch {
    // ignore missing/unreadable .env
  }
}
loadDotEnv();

const API_KEY = process.env.N8N_API_KEY || '';
const WORKFLOW_ID = process.env.N8N_WORKFLOW_ID || '';
const N8N_HOST = process.env.N8N_HOST || 'flows.stage.trimble-ai.com';
const WEBHOOK_HOST =
  process.env.N8N_WEBHOOK_HOST || 'flows-webhook.stage.trimble-ai.com';
const WEBHOOK_PATH =
  process.env.N8N_WEBHOOK_PATH ||
  '/agentic/workflows/v1/webhook/2c05024d-a533-4f74-92bd-3c99c88095b4';
const WEBHOOK_TEST_PATH =
  process.env.N8N_WEBHOOK_TEST_PATH ||
  '/agentic/workflows/v1/webhook-test/2c05024d-a533-4f74-92bd-3c99c88095b4';
const MAIL_WEBHOOK_PATH = (process.env.N8N_MAIL_WEBHOOK_PATH || '').trim();
// Optional static Bearer (pasted access_token). Prefer Trimble ID client credentials.
const WEBHOOK_AUTH_STATIC = (process.env.N8N_WEBHOOK_AUTH || '').trim();
// n8n Webhook "Header Auth" credential: Name = header key, Value = secret.
const WEBHOOK_HEADER_NAME = (process.env.N8N_WEBHOOK_HEADER_NAME || '').trim();
const WEBHOOK_HEADER_VALUE = (process.env.N8N_WEBHOOK_HEADER_VALUE || '').trim();

const TID_TOKEN_URL =
  process.env.TID_TOKEN_URL || 'https://stage.id.trimblecloud.com/oauth/token';
const TID_CLIENT_ID = (process.env.TID_CLIENT_ID || '').trim();
const TID_CLIENT_SECRET = (process.env.TID_CLIENT_SECRET || '').trim();
const TID_SCOPE = (process.env.TID_SCOPE || 'Agentic-N8N-Webhook').trim();

/** @type {{ accessToken: string, expiresAt: number } | null} */
let tidTokenCache = null;
const TOKEN_EXPIRY_SKEW_MS = 60_000;

if (!API_KEY || !WORKFLOW_ID) {
  console.warn(
    '[env] Missing N8N_API_KEY or N8N_WORKFLOW_ID in .env — executions API fallback will fail.'
  );
}

if (!TID_CLIENT_ID || !TID_CLIENT_SECRET) {
  if (WEBHOOK_AUTH_STATIC) {
    console.warn(
      '[env] TID_CLIENT_ID / TID_CLIENT_SECRET missing — using static N8N_WEBHOOK_AUTH (no auto-refresh).'
    );
  } else {
    console.warn(
      '[env] Missing TID_CLIENT_ID or TID_CLIENT_SECRET — production webhook auth not configured.'
    );
  }
}

function httpsRequest(
  pathString,
  {
    method = 'GET',
    headers = {},
    body,
    timeoutMs = 30000,
    hostname = N8N_HOST,
  } = {}
) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: 443,
      path: pathString,
      method,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
        ...headers,
      },
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          parsed = raw;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: parsed, raw });
        } else {
          const msg =
            (parsed &&
              (parsed.message ||
                parsed.error_description ||
                parsed.error ||
                parsed.hint)) ||
            (typeof raw === 'string' ? raw.substring(0, 200) : '') ||
            `HTTP ${res.statusCode}`;
          const err = new Error(`HTTP ${res.statusCode}: ${msg}`);
          err.statusCode = res.statusCode;
          err.body = parsed;
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms for ${pathString}`));
    });
    if (body != null) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(payload);
    }
    req.end();
  });
}

function invalidateTidToken() {
  tidTokenCache = null;
}

async function mintTrimbleIdToken() {
  if (!TID_CLIENT_ID || !TID_CLIENT_SECRET) {
    const err = new Error(
      'Auth not configured: missing TID_CLIENT_ID or TID_CLIENT_SECRET'
    );
    err.code = 'AUTH_NOT_CONFIGURED';
    throw err;
  }

  let tokenUrl;
  try {
    tokenUrl = new URL(TID_TOKEN_URL);
  } catch {
    const err = new Error(`Invalid TID_TOKEN_URL: ${TID_TOKEN_URL}`);
    err.code = 'AUTH_CONFIG';
    throw err;
  }

  const basic = Buffer.from(`${TID_CLIENT_ID}:${TID_CLIENT_SECRET}`).toString(
    'base64'
  );
  const formBody = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: TID_SCOPE,
  }).toString();

  try {
    const response = await httpsRequest(tokenUrl.pathname + tokenUrl.search, {
      method: 'POST',
      hostname: tokenUrl.hostname,
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formBody),
      },
      body: formBody,
      timeoutMs: 20000,
    });

    const accessToken = response.body?.access_token;
    const expiresIn = Number(response.body?.expires_in) || 3600;
    if (!accessToken) {
      const err = new Error('Token response missing access_token');
      err.code = 'AUTH_TOKEN';
      throw err;
    }

    tidTokenCache = {
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    return accessToken;
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      err.code = 'AUTH_CREDENTIALS';
      err.message = `Invalid client credentials: ${err.message}`;
    } else if (err.statusCode === 400) {
      err.code = 'AUTH_SCOPE';
      err.message = `Token request rejected (check scope): ${err.message}`;
    }
    throw err;
  }
}

async function getAccessToken(forceRefresh = false) {
  if (!forceRefresh && tidTokenCache?.accessToken) {
    if (Date.now() < tidTokenCache.expiresAt - TOKEN_EXPIRY_SKEW_MS) {
      return tidTokenCache.accessToken;
    }
  }

  if (TID_CLIENT_ID && TID_CLIENT_SECRET) {
    return mintTrimbleIdToken();
  }

  if (WEBHOOK_AUTH_STATIC) {
    const raw = WEBHOOK_AUTH_STATIC.replace(/^Bearer\s+/i, '').trim();
    if (raw) return raw;
  }

  const err = new Error(
    'Auth not configured: set TID_CLIENT_ID / TID_CLIENT_SECRET (or N8N_WEBHOOK_AUTH)'
  );
  err.code = 'AUTH_NOT_CONFIGURED';
  throw err;
}

function looksLikeControlRow(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return (
    obj['Control ID'] != null ||
    obj['TICKET NUMBER'] != null ||
    obj['Control Owner'] != null ||
    obj.row_number != null ||
    obj['Application Name'] != null
  );
}

function normalizeControlRows(payload) {
  let rows = payload;

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if (Array.isArray(payload.data)) rows = payload.data;
    else if (Array.isArray(payload.items)) rows = payload.items;
    else if (Array.isArray(payload.controls)) rows = payload.controls;
    else if (Array.isArray(payload.json)) rows = payload.json;
    else if (Array.isArray(payload.body)) rows = payload.body;
    else if (Array.isArray(payload.result)) rows = payload.result;
    else if (payload.json && typeof payload.json === 'object') rows = [payload.json];
    else if (looksLikeControlRow(payload)) rows = [payload];
  }

  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry, idx) => {
      const row = entry?.json && typeof entry.json === 'object' ? entry.json : entry;
      if (!row || typeof row !== 'object') return null;

      const cleaned = {};
      for (const [k, v] of Object.entries(row)) {
        cleaned[String(k).replace(/\u200b/g, '').trim()] =
          v != null ? String(v).replace(/\u200b/g, '').trim() : '';
      }
      const ticket = cleaned['TICKET NUMBER'] || '';
      cleaned.id = cleaned.id || `control-${cleaned.row_number || idx}`;
      cleaned.isCompleted = Boolean(ticket && ticket !== '-' && ticket !== 'N/A');
      return cleaned;
    })
    .filter(Boolean);
}

function cacheItems(items) {
  try {
    const fallbackPath = path.resolve(__dirname, 'src/data/workflowData.json');
    fs.writeFileSync(fallbackPath, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Live Sync] Cache write failed:', err.message);
  }
}

function buildResult({ live, source, message, items, executionId = null, extra = {} }) {
  return {
    success: true,
    live,
    source,
    message: message || undefined,
    executionId,
    count: items.length,
    completedCount: items.filter((it) => it.isCompleted).length,
    data: items,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

async function callWebhookOnce(pathString, bearerToken) {
  const headers = {
    Authorization: `Bearer ${bearerToken}`,
  };
  if (API_KEY) headers['X-N8N-API-KEY'] = API_KEY;
  if (WEBHOOK_HEADER_NAME && WEBHOOK_HEADER_VALUE) {
    headers[WEBHOOK_HEADER_NAME] = WEBHOOK_HEADER_VALUE;
  }

  try {
    return await httpsRequest(pathString, {
      method: 'GET',
      headers,
      hostname: WEBHOOK_HOST,
      timeoutMs: 45000,
    });
  } catch (getErr) {
    if (getErr.statusCode === 404 || getErr.statusCode === 405) {
      return httpsRequest(pathString, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: {},
        hostname: WEBHOOK_HOST,
        timeoutMs: 45000,
      });
    }
    throw getErr;
  }
}

async function fetchFromProductionWebhook() {
  const label = 'n8n_webhook_production';
  let bearer = await getAccessToken(false);

  let response;
  try {
    response = await callWebhookOnce(WEBHOOK_PATH, bearer);
  } catch (err) {
    if (err.statusCode === 401 && TID_CLIENT_ID && TID_CLIENT_SECRET) {
      console.warn('[Live Sync] Webhook 401 — refreshing Trimble ID token and retrying once');
      invalidateTidToken();
      bearer = await getAccessToken(true);
      try {
        response = await callWebhookOnce(WEBHOOK_PATH, bearer);
      } catch (retryErr) {
        if (retryErr.statusCode === 401 || retryErr.statusCode === 403) {
          retryErr.code = 'WEBHOOK_HEADER_AUTH';
          retryErr.message = `Webhook header auth rejected: ${retryErr.message}`;
        }
        throw retryErr;
      }
    } else if (err.statusCode === 401 || err.statusCode === 403) {
      err.code = 'WEBHOOK_AUTH';
      throw err;
    } else {
      throw err;
    }
  }

  const items = normalizeControlRows(response.body);
  if (!items.length) {
    const err = new Error(`${label} returned no control rows`);
    err.code = 'EMPTY_ROWS';
    throw err;
  }
  // Respond to Webhook often defaults to "first item only" — that would wipe the UI.
  if (items.length === 1) {
    const err = new Error(
      `${label} returned only 1 row — set Respond to Webhook to return all items as a JSON array`
    );
    err.code = 'PARTIAL_ROWS';
    throw err;
  }

  cacheItems(items);

  return buildResult({
    live: true,
    source: label,
    message: `Live webhook synced ${items.length} controls`,
    items,
    executionId: response.body?.executionId || null,
  });
}

async function fetchFromExecutionsApi() {
  if (!API_KEY || !WORKFLOW_ID) {
    const err = new Error('Executions API not configured (N8N_API_KEY / N8N_WORKFLOW_ID)');
    err.code = 'EXEC_CONFIG';
    throw err;
  }

  const meta = await httpsRequest(
    `/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=1`,
    { headers: { 'X-N8N-API-KEY': API_KEY }, timeoutMs: 15000 }
  );
  const latestExec = meta.body?.data?.[0];

  if (!latestExec?.id) {
    throw new Error('No execution history found for workflow ' + WORKFLOW_ID);
  }

  const detail = await httpsRequest(
    `/api/v1/executions/${latestExec.id}?includeData=true`,
    { headers: { 'X-N8N-API-KEY': API_KEY }, timeoutMs: 25000 }
  );
  const runData = detail.body?.data?.resultData?.runData;
  const codeOutput = runData?.['Code in JavaScript']?.[0]?.data?.main?.[0] || [];

  if (!codeOutput.length) {
    throw new Error(`Execution #${latestExec.id} has no items in 'Code in JavaScript'`);
  }

  const items = normalizeControlRows(codeOutput);
  if (!items.length) {
    throw new Error(`Execution #${latestExec.id} normalized to 0 control rows`);
  }

  cacheItems(items);

  return buildResult({
    live: false,
    source: 'trimble_n8n_executions_api',
    message:
      'Showing last workflow run (not live webhook)',
    items,
    executionId: latestExec.id,
    extra: {
      status: latestExec.status,
      createdAt: latestExec.createdAt || detail.body?.createdAt,
    },
  });
}

function loadCachedSnapshot(priorErrors = []) {
  const fallbackPath = path.resolve(__dirname, 'src/data/workflowData.json');
  try {
    const localData = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
    const items = normalizeControlRows(localData);
    if (items.length) {
      return buildResult({
        live: false,
        source: 'cached_snapshot',
        message:
          'Live fetch error, served cached snapshot' +
          (priorErrors.length ? `: ${priorErrors.join(' | ')}` : ''),
        items,
      });
    }
  } catch (err) {
    console.warn('[Live Sync] Cached snapshot unreadable:', err.message);
  }

  const bundled = normalizeControlRows(initialWorkflowData);
  if (bundled.length) {
    return buildResult({
      live: false,
      source: 'bundled_initial_data',
      message:
        'Live and cache unavailable, served bundled snapshot' +
        (priorErrors.length ? `: ${priorErrors.join(' | ')}` : ''),
      items: bundled,
    });
  }

  const err = new Error(
    priorErrors.length
      ? priorErrors.join(' | ')
      : 'No live, cached, or bundled control data available'
  );
  err.code = 'NO_DATA';
  throw err;
}

async function fetchLatestWorkflowData() {
  const errors = [];

  // 1) Production webhook (Trimble ID token + Header Auth)
  try {
    return await fetchFromProductionWebhook();
  } catch (err) {
    errors.push(`prod webhook: ${err.message}`);
    console.warn('[Live Sync] Production webhook failed:', err.message);
  }

  // 2) Executions API (stale but structured) — test webhook intentionally skipped
  try {
    return await fetchFromExecutionsApi();
  } catch (err) {
    errors.push(`executions api: ${err.message}`);
    console.warn('[Live Sync] Executions API failed:', err.message);
  }

  // 3) Cache → bundled initial data
  return loadCachedSnapshot(errors);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function triggerIncompleteMailWebhook(payload) {
  if (!MAIL_WEBHOOK_PATH) {
    const err = new Error(
      'Mail webhook not configured — set N8N_MAIL_WEBHOOK_PATH in .env'
    );
    err.code = 'MAIL_NOT_CONFIGURED';
    throw err;
  }
  if (!payload?.ownerName || !Array.isArray(payload.controls) || !payload.controls.length) {
    const err = new Error('Mail payload must include ownerName and incomplete controls');
    err.code = 'MAIL_BAD_PAYLOAD';
    throw err;
  }

  let bearer = await getAccessToken(false);
  const headers = {
    Authorization: `Bearer ${bearer}`,
    'Content-Type': 'application/json',
  };
  if (WEBHOOK_HEADER_NAME && WEBHOOK_HEADER_VALUE) {
    headers[WEBHOOK_HEADER_NAME] = WEBHOOK_HEADER_VALUE;
  }

  const postOnce = async (token) =>
    httpsRequest(MAIL_WEBHOOK_PATH, {
      method: 'POST',
      hostname: WEBHOOK_HOST,
      headers: { ...headers, Authorization: `Bearer ${token}` },
      body: payload,
      timeoutMs: 60000,
    });

  try {
    return await postOnce(bearer);
  } catch (err) {
    if (err.statusCode === 401 && TID_CLIENT_ID && TID_CLIENT_SECRET) {
      invalidateTidToken();
      bearer = await getAccessToken(true);
      return postOnce(bearer);
    }
    throw err;
  }
}

function n8nLiveApiPlugin() {
  return {
    name: 'n8n-live-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host}`);

        if (url.pathname === '/api/live-data') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');

          try {
            const result = await fetchLatestWorkflowData();
            res.end(JSON.stringify(result));
          } catch (err) {
            console.error('[Live Sync Error]', err.message);
            res.statusCode = 500;
            res.end(
              JSON.stringify({
                success: false,
                live: false,
                source: 'error',
                error: err.message,
                message: err.message,
                data: [],
                timestamp: new Date().toISOString(),
              })
            );
          }
          return;
        }

        if (url.pathname === '/api/send-incomplete-mail') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.statusCode = 204;
            res.end();
            return;
          }
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end(JSON.stringify({ success: false, error: 'POST required' }));
            return;
          }

          try {
            const payload = await readJsonBody(req);
            const upstream = await triggerIncompleteMailWebhook(payload);
            res.end(
              JSON.stringify({
                success: true,
                source: 'n8n_mail_webhook',
                ownerName: payload.ownerName,
                incompleteCount: payload.incompleteCount,
                upstreamStatus: upstream.statusCode,
                message: `Reminder queued for ${payload.ownerName}`,
                timestamp: new Date().toISOString(),
              })
            );
          } catch (err) {
            console.error('[Mail Webhook Error]', err.message);
            const status =
              err.code === 'MAIL_NOT_CONFIGURED' || err.code === 'MAIL_BAD_PAYLOAD'
                ? 400
                : err.statusCode && err.statusCode < 600
                  ? err.statusCode
                  : 502;
            res.statusCode = status;
            res.end(
              JSON.stringify({
                success: false,
                error: err.message,
                message: err.message,
                timestamp: new Date().toISOString(),
              })
            );
          }
          return;
        }

        if (url.pathname === '/api/health') {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              status: 'ok',
              workflowId: WORKFLOW_ID,
              webhookProduction: `https://${WEBHOOK_HOST}${WEBHOOK_PATH}`,
              webhookTest: `https://${WEBHOOK_HOST}${WEBHOOK_TEST_PATH}`,
              mailWebhook: MAIL_WEBHOOK_PATH
                ? `https://${WEBHOOK_HOST}${MAIL_WEBHOOK_PATH}`
                : null,
              tidConfigured: Boolean(TID_CLIENT_ID && TID_CLIENT_SECRET),
              staticWebhookAuth: Boolean(WEBHOOK_AUTH_STATIC),
              targetUrl: `https://${N8N_HOST}/workflow/${WORKFLOW_ID}`,
              time: new Date().toISOString(),
            })
          );
          return;
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), n8nLiveApiPlugin()],
  server: {
    port: 3000,
    open: false,
    host: true,
  },
});
