/**
 * Status tones shared by StatusChip (React) and table cell renderers (DOM).
 *
 * Badge colors follow modus-core §5: success = done, warning = at risk / missing,
 * danger = failed, primary = the one active state, default = neutral / not started.
 * Status is always icon + visible label + color (never hue only). Icons are Modus Icons 2.0.
 */
export const STATUS_TONES = {
  ok: { color: 'success', icon: 'check-circle', label: 'Ticketed' },
  warn: { color: 'warning', icon: 'clock', label: 'Missing ticket' },
  bad: { color: 'danger', icon: 'warning-circle', label: 'Failed' },
  info: { color: 'primary', icon: 'info', label: 'In progress' },
  pending: { color: 'default', icon: 'circle-dashed', label: 'Not started' },
  idle: { color: 'default', icon: 'circle-dashed', label: 'Not started' },
};

export function resolveStatusTone(tone) {
  return STATUS_TONES[tone] || STATUS_TONES.pending;
}

/**
 * Build a `modus-wc-badge` element (with a 2.0 icon) for use inside a modus-wc-table
 * `cellRenderer`, which can only return a string or an HTMLElement.
 */
export function createStatusBadgeElement(tone, label, { compact = true } = {}) {
  const meta = resolveStatusTone(tone);

  const badge = document.createElement('modus-wc-badge');
  badge.color = meta.color;
  badge.size = compact ? 'sm' : 'md';

  const icon = document.createElement('modus-wc-icon');
  icon.name = meta.icon;
  icon.version = '2.0';
  icon.size = 'xs';
  icon.decorative = true;
  icon.customClass = 'me-1';

  const text = document.createElement('span');
  text.textContent = label || meta.label;

  badge.append(icon, text);
  return badge;
}
