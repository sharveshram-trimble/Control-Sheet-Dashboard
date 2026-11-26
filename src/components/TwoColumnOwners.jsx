import React, { useEffect, useMemo, useState } from 'react';
import {
  ModusWcBadge,
  ModusWcButton,
  ModusWcIcon,
  ModusWcModal,
  ModusWcSelect,
  ModusWcTextInput,
  ModusWcTextarea,
} from '@trimble-oss/moduswebcomponents-react';
import { hasChecklistSheet } from '../assist/assistConfig';
import { readInputString } from '../utils/modusFormEvents';

const DRAFT_MAIL_MODAL_ID = 'draft-incomplete-mail-modal';

const MAIL_TYPE_OPTIONS = [
  { label: 'Reminder mail', value: 'reminder' },
  { label: 'Follow up mail', value: 'follow_up' },
  { label: 'Draft your own mail', value: 'draft' },
];

const MAIL_TEMPLATES = {
  reminder: {
    subject: (name) => `Control review reminder — ${name}`,
    bodyText: (name) =>
      [
        `Hi ${name},`,
        '',
        'This is a reminder for your ongoing control reviews. Please find the list of incomplete controls below:',
        '',
        'Please review, upload documentation to the Drive folder, and reply with the application ticket number.',
        '',
        'Thanks,',
        'Sharvesh Ram',
      ].join('\n'),
  },
  follow_up: {
    subject: (name) => `Follow-up: incomplete control tickets — ${name}`,
    bodyText: (name) =>
      [
        `Hi ${name},`,
        '',
        'This is a follow-up regarding your pending control reviews. The following controls still do not have ticket numbers:',
        '',
        'Please prioritize these items, upload evidence to the Drive folder, and reply with the application ticket numbers at your earliest convenience.',
        '',
        'Thanks,',
        'Sharvesh Ram',
      ].join('\n'),
  },
};

/**
 * Payload for the incomplete-mail n8n workflow.
 * mailType: reminder | follow_up | draft
 * bodyText is the message above the incomplete-controls table (n8n appends the table).
 */
export function buildIncompleteMailPayload(owner, { mailType = 'reminder', subject, bodyText } = {}) {
  const controls = owner.controls.map((c) => ({
    id: c.id,
    controlId: (c['Control ID'] || '').replace(/\u200b/g, '').trim(),
    application: (c['Application Name'] || '').replace(/\u200b/g, '').trim(),
    title: (c['Control Title'] || '').replace(/\u200b/g, '').trim(),
    subProcess: (c['Sub-Process'] || '').replace(/\u200b/g, '').trim(),
    ticketNumber: (c['TICKET NUMBER'] || '').replace(/\u200b/g, '').trim(),
  }));

  const template = MAIL_TEMPLATES[mailType];
  const resolvedSubject =
    subject?.trim() ||
    template?.subject(owner.name) ||
    `Control review reminder — ${owner.name}`;
  const resolvedBody =
    bodyText?.trim() ||
    template?.bodyText(owner.name) ||
    '';

  return {
    event:
      mailType === 'follow_up'
        ? 'incomplete_control_follow_up'
        : mailType === 'draft'
          ? 'incomplete_control_draft'
          : 'incomplete_control_reminder',
    mailType,
    ownerName: owner.name,
    ownerEmail: owner.email || '',
    apps: owner.apps,
    incompleteCount: owner.count,
    subject: resolvedSubject,
    bodyText: resolvedBody,
    controls,
    requestedAt: new Date().toISOString(),
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

function getDraftDialog() {
  return document.getElementById(DRAFT_MAIL_MODAL_ID);
}

export default function TwoColumnOwners({
  ownerStats,
  onSelectControl,
  onRunChecklist,
  onSendIncompleteMail,
  showToast,
}) {
  const [completedSearch, setCompletedSearch] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const [mailingOwner, setMailingOwner] = useState(null);
  const [mailTypeByOwner, setMailTypeByOwner] = useState({});
  const [draftOwner, setDraftOwner] = useState(null);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');

  const { completed: completedOwners, incomplete: pendingOwners } = useMemo(
    () => splitOwnerViews(ownerStats),
    [ownerStats]
  );

  useEffect(() => {
    const dialog = getDraftDialog();
    if (!dialog) return undefined;
    const onClose = () => {
      setDraftOwner(null);
      setDraftSubject('');
      setDraftBody('');
    };
    dialog.addEventListener('close', onClose);
    return () => dialog.removeEventListener('close', onClose);
  }, []);

  const getMailType = (ownerName) => mailTypeByOwner[ownerName] || 'reminder';

  const setMailType = (ownerName, value) => {
    setMailTypeByOwner((prev) => ({ ...prev, [ownerName]: value || 'reminder' }));
  };

  const sendMail = async (owner, options) => {
    const payload = buildIncompleteMailPayload(owner, options);

    if (typeof onSendIncompleteMail !== 'function') {
      if (showToast) {
        showToast(
          'Mail workflow is not wired yet — configure N8N_MAIL_WEBHOOK_PATH',
          'warning'
        );
      }
      return;
    }

    setMailingOwner(owner.name);
    try {
      await onSendIncompleteMail(payload);
    } finally {
      setMailingOwner(null);
    }
  };

  const openDraftModal = (owner) => {
    setDraftOwner(owner);
    setDraftSubject(`Control review — ${owner.name}`);
    setDraftBody(
      `Hi ${owner.name},\n\n` +
        `Please see the incomplete controls listed below.\n\n` +
        `Thanks,\nSharvesh Ram`
    );
    getDraftDialog()?.showModal();
  };

  const closeDraftModal = () => {
    getDraftDialog()?.close();
  };

  const handleEmailClick = async (owner) => {
    const mailType = getMailType(owner.name);

    if (mailType === 'draft') {
      openDraftModal(owner);
      return;
    }

    await sendMail(owner, { mailType });
  };

  const handleSendDraft = async () => {
    if (!draftOwner) return;
    if (!draftSubject.trim()) {
      showToast?.('Enter a subject line for the draft mail', 'warning');
      return;
    }
    if (!draftBody.trim()) {
      showToast?.('Enter the draft mail message', 'warning');
      return;
    }

    await sendMail(draftOwner, {
      mailType: 'draft',
      subject: draftSubject,
      bodyText: draftBody,
    });
    closeDraftModal();
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
            <span className="column-count completed" aria-label={`${completedOwners.length} completed owners`}>
              {completedOwners.length}
            </span>
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
                      <div
                        key={control.id}
                        className="control-chip done"
                      >
                        <button
                          type="button"
                          className="chip-text chip-text-button"
                          onClick={() => onSelectControl?.(control)}
                          title="View control details"
                        >
                          <span className="chip-id">{control['Control ID']}</span>
                          <span className="chip-app">
                            ({control['Application Name']})
                          </span>
                        </button>
                        <div className="chip-actions">
                          <span className="ticket-pill">
                            {control['TICKET NUMBER']}
                          </span>
                          {hasChecklistSheet(control) ? (
                            <ModusWcButton
                              variant="filled"
                              color="primary"
                              size="xs"
                              customClass="run-checklist-btn"
                              aria-label={`Run checklist for ${control['Control ID']}`}
                              onButtonClick={() => onRunChecklist?.(control)}
                            >
                              <ModusWcIcon name="check_circle" size="xs" decorative />
                              Run Checklist
                            </ModusWcButton>
                          ) : (
                            <ModusWcBadge
                              color="warning"
                              size="sm"
                              variant="filled"
                              aria-label={`Checklist is missing for ${control['Control ID']}`}
                            >
                              Checklist is missing
                            </ModusWcBadge>
                          )}
                        </div>
                      </div>
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
            <span className="column-count pending" aria-label={`${pendingOwners.length} incomplete owners`}>
              {pendingOwners.length}
            </span>
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

                    <ModusWcBadge color="warning" size="sm" variant="filled">
                      Incomplete
                    </ModusWcBadge>
                  </div>

                  <div className="owner-mail-actions">
                    <ModusWcSelect
                      size="sm"
                      bordered
                      label=""
                      aria-label={`Mail type for ${owner.name}`}
                      value={getMailType(owner.name)}
                      options={MAIL_TYPE_OPTIONS}
                      customClass="owner-mail-type-select"
                      onInputChange={(e) =>
                        setMailType(owner.name, readInputString(e) || 'reminder')
                      }
                    />
                    <ModusWcButton
                      color="tertiary"
                      variant="outlined"
                      size="sm"
                      disabled={mailingOwner === owner.name}
                      aria-label={`Send mail to ${owner.name}`}
                      title="Send selected mail type with incomplete control table"
                      onButtonClick={() => handleEmailClick(owner)}
                    >
                      <ModusWcIcon name="email" size="xs" decorative />
                      {mailingOwner === owner.name ? 'Sending…' : 'Mail'}
                    </ModusWcButton>
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
                        <span className="chip-text">
                          <span className="chip-id">{control['Control ID']}</span>
                          <span className="chip-app">
                            ({control['Application Name']})
                          </span>
                        </span>
                        <span className="ticket-pill missing">No Ticket</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <ModusWcModal
        modalId={DRAFT_MAIL_MODAL_ID}
        backdrop="default"
        position="center"
        showClose
        aria-label="Draft your own mail"
      >
        <span slot="header">
          Draft mail{draftOwner ? ` — ${draftOwner.name}` : ''}
        </span>
        <div slot="content" className="draft-mail-content">
          <p className="draft-mail-hint">
            Write your subject and message. The incomplete controls table for this
            owner is added automatically by the mail workflow.
          </p>
          <ModusWcTextInput
            size="sm"
            bordered
            label="Subject"
            value={draftSubject}
            aria-label="Draft mail subject"
            onInputChange={(e) => setDraftSubject(readInputString(e))}
          />
          <ModusWcTextarea
            bordered
            label="Message"
            rows={8}
            value={draftBody}
            aria-label="Draft mail message"
            onInputChange={(e) => setDraftBody(readInputString(e))}
          />
          {draftOwner ? (
            <div className="draft-mail-preview">
              <strong>
                Incomplete controls included ({draftOwner.count}):
              </strong>
              <ul>
                {draftOwner.controls.map((c) => (
                  <li key={c.id}>
                    {(c['Control ID'] || '').trim()} —{' '}
                    {(c['Application Name'] || '').trim()}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div slot="footer" className="draft-mail-footer">
          <ModusWcButton
            variant="outlined"
            color="tertiary"
            size="sm"
            onButtonClick={closeDraftModal}
          >
            Cancel
          </ModusWcButton>
          <ModusWcButton
            variant="filled"
            color="primary"
            size="sm"
            disabled={!draftOwner || mailingOwner === draftOwner?.name}
            onButtonClick={handleSendDraft}
          >
            <ModusWcIcon name="email" size="xs" decorative />
            {mailingOwner === draftOwner?.name ? 'Sending…' : 'Send mail'}
          </ModusWcButton>
        </div>
      </ModusWcModal>
    </section>
  );
}
