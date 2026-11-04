import React from 'react';
import { ModusWcIcon } from '@trimble-oss/moduswebcomponents-react';

export default function HeroProgress({ items, stats }) {
  const {
    totalControls,
    completedControls,
    pendingControls,
    completionPercentage,
    totalOwners,
    completedOwnersCount,
    pendingOwnersCount,
  } = stats;

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completionPercentage / 100) * circumference;

  return (
    <div className="hero-card">
      <div className="hero-grid">
        <div className="progress-showcase">
          <div className="radial-container">
            <svg className="radial-svg" viewBox="0 0 130 130">
              <defs>
                <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--primary-blue)" />
                  <stop offset="50%" stopColor="var(--accent-cyan)" />
                  <stop offset="100%" stopColor="var(--primary-dark)" />
                </linearGradient>
              </defs>
              <circle className="radial-bg" cx="65" cy="65" r={radius} />
              <circle
                className="radial-bar"
                cx="65"
                cy="65"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <div className="radial-center">
              <span className="radial-value">{completionPercentage}%</span>
              <span className="radial-label">Completed</span>
            </div>
          </div>

          <div className="progress-info">
            <h2 className="progress-title">Control Sheet Status</h2>
            <p className="progress-sub">
              <span className="progress-highlight">{completedControls}</span> of{' '}
              <span className="progress-highlight">{totalControls}</span> ITGC
              controls have ticket numbers verified.
            </p>
          </div>
        </div>

        <div className="stats-tiles-grid">
          <div className="stat-tile">
            <div className="stat-header">
              <span className="stat-title">Total Controls</span>
              <div className="stat-icon blue">
                <ModusWcIcon name="folder" size="sm" decorative />
              </div>
            </div>
            <div className="stat-number">{totalControls}</div>
          </div>

          <div className="stat-tile">
            <div className="stat-header">
              <span className="stat-title">Completed (Ticketed)</span>
              <div className="stat-icon green">
                <ModusWcIcon name="check_circle" size="sm" decorative />
              </div>
            </div>
            <div className="stat-number text-success">{completedControls}</div>
          </div>

          <div className="stat-tile">
            <div className="stat-header">
              <span className="stat-title">Pending Tickets</span>
              <div className="stat-icon amber">
                <ModusWcIcon name="timer" size="sm" decorative />
              </div>
            </div>
            <div className="stat-number text-warning">{pendingControls}</div>
          </div>

          <div className="stat-tile">
            <div className="stat-header">
              <span className="stat-title">Control Owners</span>
              <div className="stat-icon purple">
                <ModusWcIcon name="person" size="sm" decorative />
              </div>
            </div>
            <div className="stat-number">{totalOwners}</div>
            <div className="stat-footer">
              <span>
                {completedOwnersCount} active / {pendingOwnersCount} pending
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}






