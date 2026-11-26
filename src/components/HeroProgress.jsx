import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

function useCountUp(target, { duration = 480, enabled = true } = {}) {
  const [value, setValue] = useState(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
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

export default function HeroProgress({ stats }) {
  const {
    totalControls,
    completedControls,
    pendingControls,
    completionPercentage,
    totalOwners,
    completedOwnersCount,
    pendingOwnersCount,
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

  return (
    <section className="status-rail" aria-label="Control sheet status">
      <div className="status-rail-primary">
        <div className="radial-container" aria-hidden="true">
          <svg className="radial-svg" viewBox="0 0 120 120">
            <circle className="radial-bg" cx="60" cy="60" r={radius} />
            <circle
              className="radial-bar"
              cx="60"
              cy="60"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: reduceMotion
                  ? 'none'
                  : 'stroke-dashoffset 480ms cubic-bezier(0.2, 0, 0, 1)',
              }}
            />
          </svg>
          <div className="radial-center">
            <span className="radial-value">
              {Number.isInteger(displayPct) ? displayPct : displayPct.toFixed(1)}%
            </span>
            <span className="radial-label">Verified</span>
          </div>
        </div>

        <div className="progress-info">
          <p className="status-rail-kicker">Live sheet</p>
          <h2 className="progress-title">Control sheet status</h2>
          <p className="progress-sub">
            <span className="progress-highlight">{Math.round(ticketed)}</span> of{' '}
            <span className="progress-highlight">{Math.round(total)}</span> ITGC
            controls have ticket numbers verified.
          </p>
        </div>
      </div>

      <dl className="status-metrics">
        <div className="status-metric">
          <dt>Total controls</dt>
          <dd>{Math.round(total)}</dd>
        </div>
        <div className="status-metric is-success">
          <dt>Ticketed</dt>
          <dd>{Math.round(ticketed)}</dd>
        </div>
        <div className="status-metric is-warning">
          <dt>Pending tickets</dt>
          <dd>{Math.round(pending)}</dd>
        </div>
        <div className="status-metric">
          <dt>Owners</dt>
          <dd>
            {totalOwners}
            <span className="status-metric-note">
              {completedOwnersCount} with tickets · {pendingOwnersCount} without
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
