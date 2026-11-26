/**
 * Survive Trimble ID login redirects so Run Checklist can resume afterward.
 * TID SPA tokens live in memory — a full OAuth round-trip remounts the app.
 */

const KEY = 'itgc.pendingChecklistRun';
const MAX_AGE_MS = 15 * 60 * 1000;

export function stashPendingChecklistRun({ controlId, quarter, autoStart = true }) {
  const id = String(controlId || '').trim();
  if (!id || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        controlId: id,
        quarter: String(quarter || '').trim() || undefined,
        autoStart: Boolean(autoStart),
        ts: Date.now(),
      })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/** Read and clear a pending run if still fresh. */
export function takePendingChecklistRun() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.controlId) return null;
    if (Date.now() - Number(parsed.ts || 0) > MAX_AGE_MS) return null;
    return {
      controlId: String(parsed.controlId),
      quarter: parsed.quarter ? String(parsed.quarter) : undefined,
      autoStart: parsed.autoStart !== false,
    };
  } catch {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}
