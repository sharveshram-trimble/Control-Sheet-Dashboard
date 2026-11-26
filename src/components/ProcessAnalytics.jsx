import React, { useState } from 'react';
import { ModusWcTextInput } from '@trimble-oss/moduswebcomponents-react';
import { readInputString } from '../utils/modusFormEvents';
import StatusChip from './StatusChip';

function ownerState(owner) {
  if (owner.pendingControlsCount === 0) {
    return { key: 'done', tone: 'ok', label: 'Complete' };
  }
  if (owner.completedControlsCount > 0) {
    return { key: 'partial', tone: 'info', label: 'In progress' };
  }
  return { key: 'pending', tone: 'pending', label: 'Not started' };
}

export default function ProcessAnalytics({ items, stats: _stats, ownerStats }) {
  const [ownerSearch, setOwnerSearch] = useState('');

  const accessControls = items.filter((i) => i['Sub-Process'] === 'Access Management');
  const changeControls = items.filter((i) => i['Sub-Process'] === 'Change Management');

  const accessCompleted = accessControls.filter((i) => i.isCompleted).length;
  const changeCompleted = changeControls.filter((i) => i.isCompleted).length;

  const accessPct = accessControls.length
    ? (accessCompleted / accessControls.length) * 100
    : 0;
  const changePct = changeControls.length
    ? (changeCompleted / changeControls.length) * 100
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
      pct: data.total > 0 ? (data.completed / data.total) * 100 : 0,
    }))
    .sort(
      (a, b) =>
        a.completed / a.total - b.completed / b.total ||
        b.total - a.total ||
        a.app.localeCompare(b.app)
    );

  const filteredOwners = ownerStats
    .filter(
      (o) =>
        o.name.toLowerCase().includes(ownerSearch.toLowerCase()) ||
        o.apps.some((a) => a.toLowerCase().includes(ownerSearch.toLowerCase()))
    )
    .sort(
      (a, b) =>
        b.pendingControlsCount - a.pendingControlsCount ||
        b.totalControls - a.totalControls ||
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
            <h3>Owner progress ({ownerStats.length})</h3>
            <p>
              Ticket coverage by owner — counts first, incomplete owners up top.
            </p>
          </div>

          <ModusWcTextInput
            size="sm"
            bordered
            includeSearch
            includeClear
            type="search"
            placeholder="Search owner or application…"
            value={ownerSearch}
            aria-label="Search owners"
            customClass="analytics-search-input"
            onInputChange={(e) => setOwnerSearch(readInputString(e))}
          />
        </div>

        <div className="owner-progress-grid">
          {filteredOwners.map((owner) => {
            const state = ownerState(owner);
            const ticketed = owner.completedControlsCount;
            const total = owner.totalControls;
            const barPct = total > 0 ? (ticketed / total) * 100 : 0;

            return (
              <div
                key={owner.name}
                className={`owner-progress-card ${state.key}`}
              >
                <div className="owner-card-top">
                  <div className="owner-profile">
                    <div
                      className={`owner-avatar ${
                        state.key === 'done'
                          ? 'completed'
                          : state.key === 'pending'
                            ? 'pending'
                            : ''
                      }`}
                    >
                      {getInitials(owner.name)}
                    </div>
                    <div className="owner-details">
                      <h4>{owner.name}</h4>
                      <div className="owner-app-meta">{owner.apps.join(', ')}</div>
                    </div>
                  </div>

                  <StatusChip tone={state.tone} label={state.label} compact />
                </div>

                <div className="owner-progress-meter">
                  <div className="progress-meta-row">
                    <span>
                      <strong className="num">{ticketed}</strong> of{' '}
                      <strong className="num">{total}</strong> ticketed
                    </span>
                    {owner.pendingControlsCount > 0 ? (
                      <span className="progress-meta-pending">
                        {owner.pendingControlsCount} open
                      </span>
                    ) : (
                      <span className="progress-meta-done">All clear</span>
                    )}
                  </div>
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={ticketed}
                    aria-label={`${ticketed} of ${total} controls ticketed for ${owner.name}`}
                  >
                    <div
                      className={`progress-fill ${
                        state.key === 'done'
                          ? 'success'
                          : state.key === 'partial'
                            ? 'primary'
                            : 'idle'
                      }`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>

                <ul className="owner-control-rows">
                  {owner.controls.map((c) => {
                    const done = c.isCompleted;
                    return (
                      <li
                        key={c.id}
                        className={`owner-control-row ${done ? 'is-done' : 'is-open'}`}
                      >
                        <span className="owner-control-id">{c['Control ID']}</span>
                        <span className="owner-control-status">
                          {done ? c['TICKET NUMBER'] || 'Ticketed' : 'Missing ticket'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className="subprocess-grid">
        <div className="subprocess-tile">
          <p className="subprocess-kicker">02.05</p>
          <h3>Access Management</h3>
          <div className="subprocess-progress">
            <div className="progress-meta-row">
              <span>
                <strong className="num">{accessCompleted}</strong> of{' '}
                <strong className="num">{accessControls.length}</strong> ticketed
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill primary"
                style={{ width: `${accessPct}%` }}
              />
            </div>
          </div>
          <p className="subprocess-desc">
            Periodic system access reviews across financial and infrastructure
            applications.
          </p>
        </div>

        <div className="subprocess-tile">
          <p className="subprocess-kicker">01.04</p>
          <h3>Change Management</h3>
          <div className="subprocess-progress">
            <div className="progress-meta-row">
              <span>
                <strong className="num">{changeCompleted}</strong> of{' '}
                <strong className="num">{changeControls.length}</strong> ticketed
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill primary"
                style={{ width: `${changePct}%` }}
              />
            </div>
          </div>
          <p className="subprocess-desc">
            Monitoring and approvals of system changes deployed into production
            environments.
          </p>
        </div>
      </div>

      <div className="table-section-card analytics-panel">
        <div className="analytics-panel-header">
          <div>
            <h3>Applications ({appList.length})</h3>
            <p>Ticket coverage by application — least covered first.</p>
          </div>
        </div>

        <div className="app-breakdown-grid">
          {appList.map((item) => {
            const done = item.completed === item.total;
            const started = item.completed > 0;
            return (
              <div
                key={item.app}
                className={`app-breakdown-card ${
                  done ? 'done' : started ? 'partial' : 'idle'
                }`}
              >
                <div className="app-breakdown-top">
                  <span className="app-name">{item.app}</span>
                  <span className="app-breakdown-count num">
                    {item.completed}/{item.total}
                  </span>
                </div>
                <div className="progress-track thin">
                  <div
                    className={`progress-fill ${done ? 'success' : started ? 'primary' : 'idle'}`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
                <div className="app-breakdown-meta">
                  <span>{item.completed} ticketed</span>
                  <span>{item.total - item.completed} pending</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
