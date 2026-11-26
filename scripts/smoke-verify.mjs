/**
 * Non-secret smoke checks for local Vite + Agents proxy.
 *
 * Usage:
 *   node scripts/smoke-verify.mjs
 *
 * Defaults to https://localhost:3000 with normal TLS verification.
 * For Vite basic-ssl (self-signed), either trust the cert via
 * NODE_EXTRA_CA_CERTS, or point SMOKE_BASE at a trusted URL.
 */
const base = process.env.SMOKE_BASE || 'https://localhost:3000';

async function get(path) {
  const res = await fetch(`${base}${path}`, {
    headers: { Accept: 'application/json' },
  });
  const raw = await res.text();
  return { status: res.status, raw };
}

const results = [];
function pass(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

try {
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
    !String(healthJson.mailWebhook || '').includes('trimble-ai.comhttps://'),
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
} catch (err) {
  pass(
    'reach SMOKE_BASE',
    false,
    err?.cause?.code || err?.message || String(err)
  );
}

const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `\n${failed.length} failure(s)`
    : `\nAll ${results.length} smoke checks passed`
);
process.exit(failed.length ? 1 : 0);
