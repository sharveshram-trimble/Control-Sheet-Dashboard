import React from 'react';

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

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (completionPercentage / 100) * circumference;

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
            />
          </svg>
          <div className="radial-center">
            <span className="radial-value">{completionPercentage}%</span>
            <span className="radial-label">Verified</span>
          </div>
        </div>

        <div className="progress-info">
          <p className="status-rail-kicker">Live sheet</p>
          <h2 className="progress-title">Control sheet status</h2>
          <p className="progress-sub">
            <span className="progress-highlight">{completedControls}</span> of{' '}
            <span className="progress-highlight">{totalControls}</span> ITGC
            controls have ticket numbers verified.
          </p>
        </div>
      </div>

      <dl className="status-metrics">
        <div className="status-metric">
          <dt>Total controls</dt>
          <dd>{totalControls}</dd>
        </div>
        <div className="status-metric is-success">
          <dt>Ticketed</dt>
          <dd>{completedControls}</dd>
        </div>
        <div className="status-metric is-warning">
          <dt>Pending tickets</dt>
          <dd>{pendingControls}</dd>
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
