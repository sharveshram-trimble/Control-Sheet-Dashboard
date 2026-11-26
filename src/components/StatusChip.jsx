import React from 'react';
import { ModusWcBadge, ModusWcIcon } from '@trimble-oss/moduswebcomponents-react';
import { resolveStatusTone } from '../utils/statusTones';

/**
 * Thin wrapper over ModusWcBadge so older call sites keep their `tone` / `label` / `compact`
 * props. New code should render ModusWcBadge directly. Status is icon + label + color.
 */
export default function StatusChip({ tone = 'pending', label, compact = false }) {
  const meta = resolveStatusTone(tone);
  return (
    <ModusWcBadge
      className="status-badge"
      color={meta.color}
      size={compact ? 'sm' : 'md'}
    >
      <ModusWcIcon
        name={meta.icon}
        version="2.0"
        size="xs"
        decorative
        customClass="me-1"
      />
      <span>{label || meta.label}</span>
    </ModusWcBadge>
  );
}
