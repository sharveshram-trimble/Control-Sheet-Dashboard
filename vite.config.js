import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
      if (process.env[key] == null || process.env[key] === '') {
        process.env[key] = value;
      }
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
  '/agentic/workflows/v1/webhook/control-sheet-live';
const WEBHOOK_TEST_PATH =
  process.env.N8N_WEBHOOK_TEST_PATH ||
  '/agentic/workflows/v1/webhook-test/control-sheet-live';
// Optional gateway JWT. Leave empty in .env if unused (do not force API key here).
const WEBHOOK_AUTH = (process.env.N8N_WEBHOOK_AUTH || '').trim();
// n8n Webhook "Header Auth" credential: Name = header key, Value = secret.
const WEBHOOK_HEADER_NAME = (process.env.N8N_WEBHOOK_HEADER_NAME || '').trim();
const WEBHOOK_HEADER_VALUE = (process.env.N8N_WEBHOOK_HEADER_VALUE || '').trim();

if (!API_KEY || !WORKFLOW_ID) {
  console.warn(
    '[env] Missing N8N_API_KEY or N8N_WORKFLOW_ID in .env — live sync will fail.'
  );
}

function httpsRequest(
  pathString,
  { method = 'GET', headers = {}, body, timeoutMs = 30000, hostname = N8N_HOST } = {}
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
            (parsed && (parsed.message || parsed.error || parsed.hint)) ||
            raw.substring(0, 200) ||
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
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function normalizeControlRows(payload) {
  let rows = payload;

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if (Array.isArray(payload.data)) rows = payload.data;
    else if (Array.isArray(payload.items)) rows = payload.items;
    else if (Array.isArray(payload.controls)) rows = payload.controls;
    else if (Array.isArray(payload.json)) rows = payload.json;
    else if (payload.json && typeof payload.json === 'object') rows = [payload.json];
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
  } catch {
    // Ignore cache write error
  }
}

async function fetchFromWebhook(pathString, label) {
  const headers = {};
  if (API_KEY) headers['X-N8N-API-KEY'] = API_KEY;
  if (WEBHOOK_AUTH) headers.Authorization = WEBHOOK_AUTH;
  if (WEBHOOK_HEADER_NAME && WEBHOOK_HEADER_VALUE) {
    headers[WEBHOOK_HEADER_NAME] = WEBHOOK_HEADER_VALUE;
  }

  let response;
  try {
    response = await httpsRequest(pathString, {
      method: 'GET',
      headers,
      hostname: WEBHOOK_HOST,
      timeoutMs: 45000,
    });
  } catch (getErr) {
    // Some webhook nodes are POST-only
    if (getErr.statusCode === 404 || getErr.statusCode === 405) {
      response = await httpsRequest(pathString, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: {},
        hostname: WEBHOOK_HOST,
        timeoutMs: 45000,
      });
    } else {
      throw getErr;
    }
  }

  const items = normalizeControlRows(response.body);
  if (!items.length) {
    throw new Error(`${label} returned no control rows`);
  }

  cacheItems(items);

  return {
    success: true,
    live: true,
    source: label,
    executionId: response.body?.executionId || null,
    count: items.length,
    completedCount: items.filter((it) => it.isCompleted).length,
    data: items,
    timestamp: new Date().toISOString(),
  };
}

async function fetchFromExecutionsApi() {
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
  cacheItems(items);

  return {
    success: true,
    live: true,
    source: 'trimble_n8n_executions_api',
    executionId: latestExec.id,
    status: latestExec.status,
    createdAt: latestExec.createdAt || detail.body?.createdAt,
    count: items.length,
    completedCount: items.filter((it) => it.isCompleted).length,
    data: items,
    timestamp: new Date().toISOString(),
  };
}

async function fetchLatestWorkflowData() {
  const errors = [];

  // 1) Production webhook — requires workflow Active/Published + correct auth
  try {
    return await fetchFromWebhook(WEBHOOK_PATH, 'n8n_webhook_production');
  } catch (err) {
    errors.push(`prod webhook: ${err.message}`);
    console.warn('[Live Sync] Production webhook failed:', err.message);
  }

  // 2) Test webhook — only while "Execute workflow" / Listen is active in editor
  try {
    return await fetchFromWebhook(WEBHOOK_TEST_PATH, 'n8n_webhook_test');
  } catch (err) {
    errors.push(`test webhook: ${err.message}`);
    console.warn('[Live Sync] Test webhook failed:', err.message);
  }

  // 3) Fallback: previous executions API approach
  try {
    return await fetchFromExecutionsApi();
  } catch (err) {
    errors.push(`executions api: ${err.message}`);
    throw new Error(errors.join(' | '));
  }
}

function n8nLiveApiPlugin() {
  return {
    name: 'n8n-live-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host}`);

        // Live data endpoint
        if (url.pathname === '/api/live-data') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');

          try {
            const result = await fetchLatestWorkflowData();
            res.end(JSON.stringify(result));
          } catch (err) {
            console.error('[Live Sync Error]', err.message);
            // Fallback to local cached data
            try {
              const fallbackPath = path.resolve(__dirname, 'src/data/workflowData.json');
              const localData = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
              res.end(JSON.stringify({
                success: true,
                live: false,
                source: 'cached_snapshot',
                message: 'Live fetch error, served cached snapshot: ' + err.message,
                data: localData,
                timestamp: new Date().toISOString()
              }));
            } catch (fallbackErr) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          }
          return;
        }

        // Health check endpoint
        if (url.pathname === '/api/health') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            status: 'ok',
            workflowId: WORKFLOW_ID,
            webhookProduction: `https://${WEBHOOK_HOST}${WEBHOOK_PATH}`,
            webhookTest: `https://${WEBHOOK_HOST}${WEBHOOK_TEST_PATH}`,
            targetUrl: `https://${N8N_HOST}/workflow/${WORKFLOW_ID}`,
            time: new Date().toISOString()
          }));
          return;
        }

        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), n8nLiveApiPlugin()],
  server: {
    port: 3000,
    open: false,
    host: true
  }
});
