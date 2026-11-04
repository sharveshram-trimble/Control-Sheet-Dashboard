import React, { useMemo, useState } from 'react';
import {
  ModusWcBadge,
  ModusWcButton,
  ModusWcIcon,
  ModusWcTextInput,
} from '@trimble-oss/moduswebcomponents-react';
import { readInputString } from '../utils/modusFormEvents';

/** Payload shape for a future n8n / mail automation webhook. */
export function buildIncompleteMailPayload(owner) {
  return {
    ownerName: owner.name,
    apps: owner.apps,
    incompleteCount: owner.count,
    controls: owner.controls.map((c) => ({
      id: c.id,
      controlId: c['Control ID'],
      application: c['Application Name'],
      title: c['Control Title'],
      subProcess: c['Sub-Process'],
      ticketNumber: c['TICKET NUMBER'] || '',
    })),
  };
}

function uniqueApps(controls) {
  return [
    ...new Set(
      controls
        .map((c) => (c['Application Name'] || '').replace(/\u200b/g, '').trim())
        .filter(Boolean)
    ),
  ];
}

function splitOwnerViews(ownerStats) {
  const completed = [];
  const incomplete = [];

  ownerStats.forEach((owner) => {
    const completedControls = owner.controls.filter((c) => c.isCompleted);
    const pendingControls = owner.controls.filter((c) => !c.isCompleted);

    if (completedControls.length > 0) {
      completed.push({
        name: owner.name,
        controls: completedControls,
        apps: uniqueApps(completedControls),
        count: completedControls.length,
      });
    }

    if (pendingControls.length > 0) {
      incomplete.push({
        name: owner.name,
        controls: pendingControls,
        apps: uniqueApps(pendingControls),
        count: pendingControls.length,
      });
    }
  });

  completed.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  incomplete.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return { completed, incomplete };
}

export default function TwoColumnOwners({
  ownerStats,
  onSelectControl,
  onSendIncompleteMail,
  showToast,
}) {
  const [completedSearch, setCompletedSearch] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');

  const { completed: completedOwners, incomplete: pendingOwners } = useMemo(
    () => splitOwnerViews(ownerStats),
    [ownerStats]
  );

  const handleEmailIncomplete = (owner) => {
    const payload = buildIncompleteMailPayload(owner);

    // Future: call your automation webhook here (e.g. n8n mail workflow).
    if (typeof onSendIncompleteMail === 'function') {
      onSendIncompleteMail(payload);
      return;
    }

    const lines = [
      `Hi ${payload.ownerName},`,
      '',
      'The following control sheet items are still missing ticket numbers:',
      '',
      ...payload.controls.map(
        (c, i) =>
          `${i + 1}. ${c.controlId} (${c.application}) — ${c.title || 'No title'}`
      ),
      '',
      'Please add the ticket number in the control sheet when complete.',
      '',
      '— Control Sheet Dashboard',
    ];

    const subject = encodeURIComponent(
      `Incomplete control tickets — ${payload.ownerName}`
    );
    const body = encodeURIComponent(lines.join('\n'));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;

    if (showToast) {
      showToast(
        `Email draft ready for ${payload.ownerName} (${payload.incompleteCount} incomplete)`,
        'info'
      );
    }
  };

  const filteredCompleted = completedOwners.filter(
    (o) =>
      o.name.toLowerCase().includes(completedSearch.toLowerCase()) ||
      o.apps.some((a) => a.toLowerCase().includes(completedSearch.toLowerCase())) ||
      o.controls.some((c) =>
        c['TICKET NUMBER']?.toLowerCase().includes(completedSearch.toLowerCase())
      )
  );

  const filteredPending = pendingOwners.filter(
    (o) =>
      o.name.toLowerCase().includes(pendingSearch.toLowerCase()) ||
      o.apps.some((a) => a.toLowerCase().includes(pendingSearch.toLowerCase())) ||
      o.controls.some((c) =>
        c['Control ID']?.toLowerCase().includes(pendingSearch.toLowerCase())
      )
  );

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <section className="owner-breakdown-section">
      <div className="section-header-row">
        <div className="section-header-title">
          <h2>Control Owner Compliance Separation</h2>
          <ModusWcBadge color="default" size="sm" variant="outlined">
            Populated by Ticket Verification in Control Sheet
          </ModusWcBadge>
        </div>
      </div>

      <div className="two-column-owners-grid">
        <div className="owner-column-card completed-column">
          <div className="column-header completed-head">
            <div className="column-header-title">
              <div className="column-icon-bubble completed">
                <ModusWcIcon name="shield" size="md" decorative />
              </div>
              <div className="column-header-text">
                <h3>Completed Owners</h3>
                <p>Verified ticket numbers only — incomplete controls are listed on the right</p>
              </div>
            </div>
            <ModusWcBadge color="success" size="sm" variant="filled">
              {completedOwners.length} Completed
            </ModusWcBadge>
          </div>

          <div className="column-search-wrap">
            <ModusWcTextInput
              size="sm"
              bordered
              includeSearch
              includeClear
              type="search"
              placeholder="Search completed owners, apps, or tickets..."
              value={completedSearch}
              aria-label="Search completed owners"
              onInputChange={(e) => setCompletedSearch(readInputString(e))}
            />
          </div>

          <div className="owner-cards-list">
            {filteredCompleted.length === 0 ? (
              <div className="owner-empty-state">
                <ModusWcIcon name="check_circle" size="lg" decorative />
                <p>No completed owners match search</p>
              </div>
            ) : (
              filteredCompleted.map((owner) => (
                <div key={`completed-${owner.name}`} className="owner-item-card is-completed">
                  <div className="owner-card-top">
                    <div className="owner-profile">
                      <div className="owner-avatar completed">
                        {getInitials(owner.name)}
                      </div>
                      <div className="owner-details">
                        <h4>{owner.name}</h4>
                        <div className="owner-app-meta">
                          {owner.apps.join(', ')} • {owner.count} Control
                          {owner.count > 1 ? 's' : ''} Completed
                        </div>
                      </div>
                    </div>

                    <ModusWcBadge color="success" size="sm" variant="filled">
                      Completed
                    </ModusWcBadge>
                  </div>

                  <div className="owner-controls-chips">
                    {owner.controls.map((control) => (
                      <button
                        type="button"
                        key={control.id}
                        className="control-chip done"
                        onClick={() => onSelectControl && onSelectControl(control)}
                        title="Click to view control details"
                      >
                        <span className="chip-id">{control['Control ID']}</span>
                        <span>({control['Application Name']})</span>
                        <ModusWcBadge color="primary" size="sm" variant="filled">
                          {control['TICKET NUMBER']}
                        </ModusWcBadge>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="owner-column-card pending-column">
          <div className="column-header pending-head">
            <div className="column-header-title">
              <div className="column-icon-bubble pending">
                <ModusWcIcon name="warning" size="md" decorative />
              </div>
              <div className="column-header-text">
                <h3>Didn't Complete Owners</h3>
                <p>Missing ticket numbers only — completed controls are listed on the left</p>
              </div>
            </div>
            <ModusWcBadge color="warning" size="sm" variant="filled">
              {pendingOwners.length} Incomplete
            </ModusWcBadge>
          </div>

          <div className="column-search-wrap">
            <ModusWcTextInput
              size="sm"
              bordered
              includeSearch
              includeClear
              type="search"
              placeholder="Search incomplete owners or application names..."
              value={pendingSearch}
              aria-label="Search incomplete owners"
              onInputChange={(e) => setPendingSearch(readInputString(e))}
            />
          </div>

          <div className="owner-cards-list">
            {filteredPending.length === 0 ? (
              <div className="owner-empty-state success">
                <ModusWcIcon name="check_circle" size="lg" decorative />
                <p>All owners have verified tickets!</p>
              </div>
            ) : (
              filteredPending.map((owner) => (
                <div key={`incomplete-${owner.name}`} className="owner-item-card is-pending">
                  <div className="owner-card-top">
                    <div className="owner-profile">
                      <div className="owner-avatar pending">
                        {getInitials(owner.name)}
                      </div>
                      <div className="owner-details">
                        <h4>{owner.name}</h4>
                        <div className="owner-app-meta">
                          {owner.apps.join(', ')} • {owner.count} Incomplete
                          Ticket{owner.count > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    <div className="owner-card-actions">
                      <ModusWcButton
                        color="tertiary"
                        variant="outlined"
                        size="sm"
                        aria-label={`Email ${owner.name} about incomplete controls`}
                        title="Send reminder email with incomplete control details"
                        onButtonClick={() => handleEmailIncomplete(owner)}
                      >
                        <ModusWcIcon name="email" size="xs" decorative />
                        Email
                      </ModusWcButton>
                      <ModusWcBadge color="warning" size="sm" variant="filled">
                        Incomplete
                      </ModusWcBadge>
                    </div>
                  </div>

                  <div className="owner-controls-chips">
                    {owner.controls.map((control) => (
                      <button
                        type="button"
                        key={control.id}
                        className="control-chip missing"
                        onClick={() => onSelectControl && onSelectControl(control)}
                        title="Click to view details"
                      >
                        <span className="chip-id">{control['Control ID']}</span>
                        <span>({control['Application Name']})</span>
                        <ModusWcBadge color="danger" size="sm" variant="outlined">
                          No Ticket
                        </ModusWcBadge>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
