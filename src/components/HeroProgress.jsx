import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  ModusWcAlert,
  ModusWcBadge,
  ModusWcButton,
  ModusWcCard,
  ModusWcTypography,
} from '@trimble-oss/moduswebcomponents-react';
import '../styles/surface-helpers.css';
import '../styles/hero-progress.css';

function useCountUp(target, { duration = 480, enabled = true } = {}) {
  const [value, setValue] = useState(enabled ? 0 : target);
  const valueRef = useRef(value);
  const prevTarget = useRef(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      prevTarget.current = target;
      return undefined;
    }
    if (prevTarget.current === target) return undefined;

    const from = prevTarget.current == null ? 0 : valueRef.current;
    prevTarget.current = target;
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);

  return value;
}

/** Nested KPI tile: muted label, 3xl number, optional note. Numbers only in the value line. */
function MetricTile({ label, value, note, tone }) {
  return (
    <div className="h-full min-w-0">
      <ModusWcCard bordered={false} padding="compact" customClass="h-full">
        <div className="flex min-w-0 flex-col gap-1">
          <ModusWcTypography hierarchy="p" size="sm" customClass="surface-muted !m-0" label={label} />
          <ModusWcTypography
            hierarchy="p"
            size="3xl"
            weight="semibold"
            customClass={`tabular-nums !m-0${tone ? ` hero-metric--${tone}` : ''}`}
            label={String(value)}
          />
          <ModusWcTypography hierarchy="p" size="xs" customClass="surface-muted !m-0" label={note || '\u00a0'} />
        </div>
      </ModusWcCard>
    </div>
  );
}

export default function HeroProgress({ stats, onSelectControl }) {
  const {
    totalControls,
    completedControls,
    pendingControls,
    completionPercentage,
    totalOwners,
    completedOwnersCount,
    pendingOwnersCount,
    criticalPending = [],
  } = stats;

  const reduceMotion = useReducedMotion();
  const pct = useCountUp(completionPercentage, {
    duration: 480,
    enabled: !reduceMotion,
  });
  const ticketed = useCountUp(completedControls, {
    duration: 480,
    enabled: !reduceMotion,
  });
  const pending = useCountUp(pendingControls, {
    duration: 480,
    enabled: !reduceMotion,
  });
  const total = useCountUp(totalControls, {
    duration: 480,
    enabled: !reduceMotion,
  });

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const displayPct = Math.round(pct * 10) / 10;
  const strokeDashoffset = circumference - (displayPct / 100) * circumference;
  const pctLabel = `${Number.isInteger(displayPct) ? displayPct : displayPct.toFixed(1)}%`;

  return (
    <section aria-label="Control sheet status" className="min-w-0">
      <ModusWcCard bordered padding="compact">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[max-content_minmax(0,1fr)]">
            <div className="hero-radial">
              <svg className="hero-radial-svg" viewBox="0 0 120 120" aria-hidden="true">
                <circle className="hero-radial-bg" cx="60" cy="60" r={radius} />
                <circle
                  className="hero-radial-bar"
                  cx="60"
                  cy="60"
                  r={radius}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <div className="hero-radial-center">
                <ModusWcTypography
                  hierarchy="p"
                  size="xl"
                  weight="semibold"
                  customClass="tabular-nums !m-0"
                  label={pctLabel}
                />
                <ModusWcTypography hierarchy="p" size="xs" customClass="surface-muted !m-0" label="Verified" />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <div>
                <ModusWcBadge color="default" size="sm" variant="outlined">
                  <span>Live sheet</span>
                </ModusWcBadge>
              </div>
              <ModusWcTypography
                hierarchy="h1"
                size="2xl"
                weight="semibold"
                customClass="!m-0"
                label="Control sheet status"
              />
              <ModusWcTypography
                hierarchy="p"
                size="md"
                customClass="!m-0"
                label={`${Math.round(ticketed)} of ${Math.round(total)} ITGC controls have verified ticket numbers.`}
              />

              <div className="min-w-0">
                {criticalPending.length > 0 ? (
                  <ModusWcAlert variant="warning" role="status">
                    <div slot="content" className="flex min-w-0 flex-col gap-1">
                      <ModusWcTypography
                        hierarchy="h2"
                        size="sm"
                        weight="semibold"
                        customClass="!m-0"
                        label="Needs ticket"
                      />
                      <ul className="surface-list flex flex-col gap-1">
                        {criticalPending.map((row) => (
                          <li key={row.id} className="flex flex-wrap items-center gap-x-2">
                            <ModusWcButton
                              variant="borderless"
                              color="tertiary"
                              size="xs"
                              aria-label={`View details for ${row.controlId}`}
                              onButtonClick={() => onSelectControl?.(row.item)}
                            >
                              <span>{row.controlId}</span>
                            </ModusWcButton>
                            <span className="surface-muted text-sm">
                              {row.app} · {row.owner}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </ModusWcAlert>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <MetricTile label="Total controls" value={Math.round(total)} />
            <MetricTile label="Ticketed" value={Math.round(ticketed)} tone="success" />
            <MetricTile label="Pending tickets" value={Math.round(pending)} tone="warning" />
            <MetricTile
              label="Owners"
              value={totalOwners}
              note={`${completedOwnersCount} with tickets · ${pendingOwnersCount} without`}
            />
          </div>
        </div>
      </ModusWcCard>
    </section>
  );
}
