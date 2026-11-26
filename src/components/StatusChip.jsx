import React from 'react';
import { ModusWcIcon } from '@trimble-oss/moduswebcomponents-react';

const MAP = {
  ok: { className: 'status-chip status-chip--ok', icon: 'check_circle', label: 'Ticketed' },
  warn: { className: 'status-chip status-chip--warn', icon: 'warning', label: 'Missing ticket' },
  bad: { className: 'status-chip status-chip--bad', icon: 'warning', label: 'Failed' },
  info: { className: 'status-chip status-chip--info', icon: 'info', label: 'In progress' },
  pending: { className: 'status-chip status-chip--idle', icon: 'time', label: 'Pending' },
};

/** Status always = icon + visible label + color (never hue-only). */
export default function StatusChip({ tone = 'pending', label, compact = false }) {
  const meta = MAP[tone] || MAP.pending;
  return (
    <span className={`${meta.className}${compact ? ' status-chip--compact' : ''}`}>
      <ModusWcIcon name={meta.icon} size="xs" decorative />
      <span className="status-chip-label">{label || meta.label}</span>
    </span>
  );
}
