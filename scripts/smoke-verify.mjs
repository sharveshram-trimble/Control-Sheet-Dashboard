/**
 * Non-secret smoke checks for local HTTPS Vite + Agents proxy.
 * Usage: node scripts/smoke-verify.mjs
 */
import https from 'https';

const base = process.env.SMOKE_BASE || 'https://localhost:3000';

function get(path) {
  return new Promise((resolve, reject) => {
    https
      .get(
        `${base}${path}`,
        { rejectUnauthorized: false, headers: { Accept: 'application/json' } },
        (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => {
            resolve({ status: res.statusCode, raw });
          });
        }
      )
      .on('error', reject);
  });
}

const results = [];
function pass(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const health = await get('/api/health');
pass('GET /api/health', health.status === 200);
let healthJson = {};
try {
  healthJson = JSON.parse(health.raw);
} catch {
  /* ignore */
}
pass(
  'health.mailWebhook not doubled',
  !String(healthJson.mailWebhook || '').includes(
    'trimble-ai.comhttps://'
  ),
  healthJson.mailWebhook || 'null'
);
pass('health.tidConfigured', healthJson.tidConfigured === true);

const live = await get('/api/live-data');
pass('GET /api/live-data', live.status === 200);
let liveJson = {};
try {
  liveJson = JSON.parse(live.raw);
} catch {
  /* ignore */
}
pass(
  'live-data returns controls',
  Array.isArray(liveJson.data) && liveJson.data.length > 0,
  `count=${liveJson.count ?? liveJson.data?.length}`
);

const agents = await get('/api/agents-proxy/v2/agents');
pass(
  'agents proxy requires auth',
  agents.status === 401,
  `HTTP ${agents.status}`
);

const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `\n${failed.length} failure(s)`
    : `\nAll ${results.length} smoke checks passed`
);
process.exit(failed.length ? 1 : 0);
