import React, { useState } from 'react';
import {
  ModusWcBadge,
  ModusWcIcon,
  ModusWcTextInput,
} from '@trimble-oss/moduswebcomponents-react';
import { readInputString } from '../utils/modusFormEvents';

export default function ProcessAnalytics({ items, stats, ownerStats }) {
  const [ownerSearch, setOwnerSearch] = useState('');

  const accessControls = items.filter((i) => i['Sub-Process'] === 'Access Management');
  const changeControls = items.filter((i) => i['Sub-Process'] === 'Change Management');

  const accessCompleted = accessControls.filter((i) => i.isCompleted).length;
  const changeCompleted = changeControls.filter((i) => i.isCompleted).length;

  const accessPct = accessControls.length
    ? ((accessCompleted / accessControls.length) * 100).toFixed(1)
    : 0;
  const changePct = changeControls.length
    ? ((changeCompleted / changeControls.length) * 100).toFixed(1)
    : 0;

  const appMap = {};
  items.forEach((i) => {
    const app = i['Application Name'] || 'Other';
    if (!appMap[app]) appMap[app] = { total: 0, completed: 0 };
    appMap[app].total += 1;
    if (i.isCompleted) appMap[app].completed += 1;
  });

  const appList = Object.entries(appMap)
    .map(([app, data]) => ({
      app,
      ...data,
      pct: ((data.completed / data.total) * 100).toFixed(0),
    }))
    .sort((a, b) => b.completed - a.completed || b.total - a.total);

  const filteredOwners = ownerStats
    .filter(
      (o) =>
        o.name.toLowerCase().includes(ownerSearch.toLowerCase()) ||
        o.apps.some((a) => a.toLowerCase().includes(ownerSearch.toLowerCase()))
    )
    .sort(
      (a, b) =>
        b.completionPercentage - a.completionPercentage ||
        a.name.localeCompare(b.name)
    );

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="analytics-stack">
      <div className="table-section-card analytics-panel">
        <div className="analytics-panel-header">
          <div>
            <h3>
              Individual Owner Progress ({ownerStats.length} Owners)
            </h3>
            <p>
              Detailed completion percentage and verified ticket status for each
              control owner
            </p>
          </div>

          <ModusWcTextInput
            size="sm"
            bordered
            includeSearch
            includeClear
            type="search"
            placeholder="Search owner or application..."
            value={ownerSearch}
            aria-label="Search owners"
            customClass="analytics-search-input"
            onInputChange={(e) => setOwnerSearch(readInputString(e))}
          />
        </div>

        <div className="owner-progress-grid">
          {filteredOwners.map((owner) => {
            const isFullyDone = owner.pendingControlsCount === 0;
            const hasStarted = owner.completedControlsCount > 0;

            return (
              <div
                key={owner.name}
                className={`owner-progress-card ${isFullyDone ? 'done' : hasStarted ? 'partial' : 'pending'}`}
              >
                <div className="owner-card-top">
                  <div className="owner-profile">
                    <div
                      className={`owner-avatar ${isFullyDone ? 'completed' : hasStarted ? '' : 'pending'}`}
                    >
                      {getInitials(owner.name)}
                    </div>
                    <div className="owner-details">
                      <h4>{owner.name}</h4>
                      <div className="owner-app-meta">{owner.apps.join(', ')}</div>
                    </div>
                  </div>

                  <ModusWcBadge
                    color={isFullyDone ? 'success' : hasStarted ? 'primary' : 'warning'}
                    size="sm"
                    variant="filled"
                  >
                    {isFullyDone ? '100% Done' : `${owner.completionPercentage}%`}
                  </ModusWcBadge>
                </div>

                <div>
                  <div className="progress-meta-row">
                    <span>
                      {owner.completedControlsCount} of {owner.totalControls} Controls
                      Verified
                    </span>
                    <span className={isFullyDone ? 'text-success' : 'text-primary'}>
                      {owner.completionPercentage}%
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill ${isFullyDone ? 'success' : hasStarted ? 'primary' : ''}`}
                      style={{ width: `${owner.completionPercentage}%` }}
                    />
                  </div>
                </div>

                <div className="owner-controls-chips">
                  {owner.controls.map((c) => (
                    <ModusWcBadge
                      key={c.id}
                      color={c.isCompleted ? 'success' : 'warning'}
                      size="sm"
                      variant="outlined"
                    >
                      {c['Control ID']}: {c['TICKET NUMBER'] || 'Missing'}
                    </ModusWcBadge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="subprocess-grid">
        <div className="stat-tile subprocess-tile">
          <div className="stat-header">
            <div>
              <span className="stat-title">Sub-Process 02.05</span>
              <h3>Access Management</h3>
            </div>
            <div className="stat-icon blue">
              <ModusWcIcon name="dashboard" size="md" decorative />
            </div>
          </div>

          <div className="subprocess-progress">
            <div className="progress-meta-row">
              <span>Completion: {accessPct}%</span>
              <span>
                {accessCompleted} of {accessControls.length} Controls
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill primary" style={{ width: `${accessPct}%` }} />
            </div>
          </div>

          <p className="subprocess-desc">
            Periodic system access reviews across financial and infrastructure
            applications.
          </p>
        </div>

        <div className="stat-tile subprocess-tile">
          <div className="stat-header">
            <div>
              <span className="stat-title">Sub-Process 01.04</span>
              <h3>Change Management</h3>
            </div>
            <div className="stat-icon amber">
              <ModusWcIcon name="shield" size="md" decorative />
            </div>
          </div>

          <div className="subprocess-progress">
            <div className="progress-meta-row">
              <span>Completion: {changePct}%</span>
              <span>
                {changeCompleted} of {changeControls.length} Controls
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill warning" style={{ width: `${changePct}%` }} />
            </div>
          </div>

          <p className="subprocess-desc">
            Monitoring and approvals of system changes deployed into production
            environments.
          </p>
        </div>
      </div>

      <div className="table-section-card analytics-panel">
        <h3 className="app-breakdown-title">
          Application-Level Compliance Breakdown ({appList.length} Applications)
        </h3>

        <div className="app-breakdown-grid">
          {appList.map((item) => (
            <div
              key={item.app}
              className={`app-breakdown-card ${
                item.completed === item.total
                  ? 'done'
                  : item.completed > 0
                    ? 'partial'
                    : 'idle'
              }`}
            >
              <div className="app-breakdown-top">
                <span className="app-name">{item.app}</span>
                <span
                  className={
                    item.completed === item.total
                      ? 'text-success'
                      : item.completed > 0
                        ? 'text-primary'
                        : 'text-muted'
                  }
                >
                  {item.pct}%
                </span>
              </div>
              <div className="progress-track thin">
                <div
                  className={`progress-fill ${item.completed === item.total ? 'success' : 'primary'}`}
                  style={{ width: `${item.pct}%` }}
                />
              </div>
              <div className="app-breakdown-meta">
                <span>
                  {item.completed} of {item.total} Done
                </span>
                <span>{item.total - item.completed} Pending</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
