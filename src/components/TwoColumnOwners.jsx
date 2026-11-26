import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ModusWcAvatar,
  ModusWcBadge,
  ModusWcButton,
  ModusWcCard,
  ModusWcEmptyState,
  ModusWcIcon,
  ModusWcModal,
  ModusWcSelect,
  ModusWcTextInput,
  ModusWcTextarea,
  ModusWcTypography,
} from '@trimble-oss/moduswebcomponents-react';
import { hasChecklistSheet } from '../assist/assistConfig';
import { readInputString } from '../utils/modusFormEvents';
import { getDialog, useDialogClose } from '../utils/modalDialog';
import { staggerContainer, staggerItem } from '../motion/presets';
import StatusChip from './StatusChip';
import '../styles/surface-helpers.css';
import '../styles/owners.css';

const DRAFT_MAIL_MODAL_ID = 'draft-incomplete-mail-modal';
const DRAFT_MAIL_TITLE_ID = 'draft-incomplete-mail-title';

const MAIL_TYPE_OPTIONS = [
  { label: 'Reminder mail', value: 'reminder' },
  { label: 'Follow-up mail', value: 'follow_up' },
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

function plural(count, one, many) {
  return count === 1 ? one : many;
}

/** Owner name + status badge + summary line, shared by both columns. */
function OwnerTitle({ owner, tone, badgeLabel }) {
  return (
    <div slot="title" className="flex w-full min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {/* modus-wc-avatar takes the first letter of each word, so pass the full name. */}
        <ModusWcAvatar initials={owner.name} size="sm" aria-hidden="true" />
        <ModusWcTypography hierarchy="h4" size="md" weight="semibold" label={owner.name} />
      </div>
      <StatusChip tone={tone} label={badgeLabel} compact />
    </div>
  );
}

/** One control: opens the detail modal; trailing cluster holds ticket / checklist state. */
function ControlRow({ control, onSelectControl, trailing }) {
  const id = control['Control ID'];
  return (
    <li className="owner-control-row flex flex-wrap items-center justify-between gap-2 py-1">
      <ModusWcButton
        variant="borderless"
        color="tertiary"
        size="sm"
        aria-label={`View details for ${id}`}
        onButtonClick={() => onSelectControl?.(control)}
      >
        <span className="font-semibold">{id}</span>
        <span className="surface-muted">({control['Application Name']})</span>
      </ModusWcButton>
      <div className="flex flex-wrap items-center gap-2">{trailing}</div>
    </li>
  );
}

/** Column card: title, search toolbar, list, and a stable empty state (toggled, never swapped). */
function OwnerColumn({
  icon,
  title,
  description,
  count,
  countNoun,
  searchLabel,
  searchPlaceholder,
  search,
  onSearch,
  emptyState,
  isEmpty,
  listVariants,
  children,
}) {
  return (
    <div className="h-full min-w-0">
      <ModusWcCard bordered padding="compact" customClass="h-full">
        <div slot="title" className="mb-4 flex w-full min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ModusWcIcon name={icon} version="2.0" decorative />
            <ModusWcTypography hierarchy="h3" size="lg" weight="semibold" label={title} />
          </div>
          <ModusWcBadge color="default" size="sm">
            <span>
              {count}
              <span className="sr-only"> {countNoun}</span>
            </span>
          </ModusWcBadge>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <ModusWcTypography hierarchy="p" size="sm" customClass="surface-muted" label={description} />

          <ModusWcTextInput
            size="sm"
            bordered
            includeSearch
            includeClear
            type="search"
            placeholder={searchPlaceholder}
            value={search}
            aria-label={searchLabel}
            onInputChange={(e) => onSearch(readInputString(e))}
          />

          <div className={isEmpty ? '' : 'surface-hidden'}>
            <ModusWcEmptyState
              variant="compact"
              illustration={emptyState.illustration}
              heading={emptyState.heading}
              subtitle={emptyState.subtitle}
              actionLabel={emptyState.actionLabel}
              onActionClick={emptyState.onAction}
            />
          </div>

          <motion.ul
            className={isEmpty ? 'surface-hidden' : 'surface-list flex flex-col gap-2'}
            variants={listVariants}
            initial="hidden"
            animate="show"
          >
            {children}
          </motion.ul>
        </div>
      </ModusWcCard>
    </div>
  );
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

  // Fires for every dismiss path (close button, Escape, backdrop, Cancel, successful send).
  useDialogClose(DRAFT_MAIL_MODAL_ID, () => {
    setDraftOwner(null);
    setDraftSubject('');
    setDraftBody('');
  });

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
    getDialog(DRAFT_MAIL_MODAL_ID)?.showModal();
  };

  const closeDraftModal = () => {
    getDialog(DRAFT_MAIL_MODAL_ID)?.close();
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

  const completedQuery = completedSearch.trim().toLowerCase();
  const filteredCompleted = completedOwners.filter(
    (o) =>
      o.name.toLowerCase().includes(completedQuery) ||
      o.apps.some((a) => a.toLowerCase().includes(completedQuery)) ||
      o.controls.some((c) => c['TICKET NUMBER']?.toLowerCase().includes(completedQuery))
  );

  const pendingQuery = pendingSearch.trim().toLowerCase();
  const filteredPending = pendingOwners.filter(
    (o) =>
      o.name.toLowerCase().includes(pendingQuery) ||
      o.apps.some((a) => a.toLowerCase().includes(pendingQuery)) ||
      o.controls.some((c) => c['Control ID']?.toLowerCase().includes(pendingQuery))
  );

  const reduceMotion = useReducedMotion();
  const listVariants = staggerContainer(reduceMotion);
  const isSendingDraft = Boolean(draftOwner) && mailingOwner === draftOwner?.name;

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="owners-heading">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <ModusWcTypography
          id="owners-heading"
          hierarchy="h2"
          size="xl"
          weight="semibold"
          label="Owners by ticket status"
        />
        <ModusWcBadge color="default" size="sm" variant="outlined">
          <span>From control sheet ticket verification</span>
        </ModusWcBadge>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <OwnerColumn
          icon="check-circle"
          title="Ticketed owners"
          description="Controls with verified ticket numbers. Incomplete items stay on the right."
          count={completedOwners.length}
          countNoun="ticketed owners"
          searchLabel="Search ticketed owners"
          searchPlaceholder="Search owners, apps or tickets"
          search={completedSearch}
          onSearch={setCompletedSearch}
          isEmpty={filteredCompleted.length === 0}
          listVariants={listVariants}
          emptyState={{
            illustration: 'selection_plus',
            heading: completedQuery ? 'No owners found' : 'No ticketed owners yet',
            subtitle: completedQuery
              ? 'Try a different owner, app or ticket number.'
              : 'Owners appear here once their controls have verified tickets.',
            actionLabel: completedQuery ? 'Clear search' : undefined,
            onAction: () => setCompletedSearch(''),
          }}
        >
          {filteredCompleted.map((owner, index) => (
            <motion.li
              key={`completed-${owner.name}`}
              variants={staggerItem(reduceMotion, index)}
            >
              <ModusWcCard
                bordered={false}
                padding="compact"
                customClass="owner-item owner-item--ticketed"
              >
                <OwnerTitle owner={owner} tone="ok" badgeLabel="Ticketed" />
                <div className="flex min-w-0 flex-col gap-1">
                  <ModusWcTypography
                    hierarchy="p"
                    size="sm"
                    customClass="surface-muted"
                    label={`${owner.apps.join(', ')} · ${owner.count} ${plural(owner.count, 'control', 'controls')} completed`}
                  />
                  <ul className="surface-list flex flex-col">
                    {owner.controls.map((control) => (
                      <ControlRow
                        key={control.id}
                        control={control}
                        onSelectControl={onSelectControl}
                        trailing={
                          <>
                            <ModusWcBadge color="default" size="sm" variant="outlined">
                              <span>{control['TICKET NUMBER']}</span>
                            </ModusWcBadge>
                            {hasChecklistSheet(control) ? (
                              <ModusWcButton
                                variant="outlined"
                                color="primary"
                                size="xs"
                                aria-label={`Run checklist for ${control['Control ID']}`}
                                onButtonClick={() => onRunChecklist?.(control)}
                              >
                                <ModusWcIcon name="clipboard-check" version="2.0" size="xs" decorative />
                                <span>Run checklist</span>
                              </ModusWcButton>
                            ) : (
                              <StatusChip tone="idle" label="No checklist" compact />
                            )}
                          </>
                        }
                      />
                    ))}
                  </ul>
                </div>
              </ModusWcCard>
            </motion.li>
          ))}
        </OwnerColumn>

        <OwnerColumn
          icon="warning-circle"
          title="Missing tickets"
          description="Controls without ticket numbers. Ticketed controls stay on the left."
          count={pendingOwners.length}
          countNoun="owners missing tickets"
          searchLabel="Search owners missing tickets"
          searchPlaceholder="Search owners or apps"
          search={pendingSearch}
          onSearch={setPendingSearch}
          isEmpty={filteredPending.length === 0}
          listVariants={listVariants}
          emptyState={{
            illustration: 'symbol_info',
            heading: pendingQuery ? 'No owners found' : 'All owners have tickets',
            subtitle: pendingQuery
              ? 'Try a different owner or app name.'
              : 'Every control has a verified ticket number.',
            actionLabel: pendingQuery ? 'Clear search' : undefined,
            onAction: () => setPendingSearch(''),
          }}
        >
          {filteredPending.map((owner, index) => (
            <motion.li
              key={`incomplete-${owner.name}`}
              variants={staggerItem(reduceMotion, index)}
            >
              <ModusWcCard
                bordered={false}
                padding="compact"
                customClass="owner-item owner-item--missing"
              >
                <OwnerTitle owner={owner} tone="warn" badgeLabel="Missing ticket" />
                <div className="flex min-w-0 flex-col gap-2">
                  <ModusWcTypography
                    hierarchy="p"
                    size="sm"
                    customClass="surface-muted"
                    label={`${owner.apps.join(', ')} · ${owner.count} incomplete ${plural(owner.count, 'ticket', 'tickets')}`}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-40 flex-1 sm:max-w-64">
                      <ModusWcSelect
                        size="sm"
                        bordered
                        label=""
                        aria-label={`Mail type for ${owner.name}`}
                        value={getMailType(owner.name)}
                        options={MAIL_TYPE_OPTIONS}
                        onInputChange={(e) =>
                          setMailType(owner.name, readInputString(e) || 'reminder')
                        }
                      />
                    </div>
                    <ModusWcButton
                      color="tertiary"
                      variant="outlined"
                      size="sm"
                      disabled={mailingOwner === owner.name}
                      aria-label={`Send mail to ${owner.name}`}
                      onButtonClick={() => handleEmailClick(owner)}
                    >
                      <ModusWcIcon name="envelope" version="2.0" size="xs" decorative />
                      <span>{mailingOwner === owner.name ? 'Sending…' : 'Send mail'}</span>
                    </ModusWcButton>
                  </div>

                  <ul className="surface-list flex flex-col">
                    {owner.controls.map((control) => (
                      <ControlRow
                        key={control.id}
                        control={control}
                        onSelectControl={onSelectControl}
                        trailing={<StatusChip tone="warn" label="No ticket" compact />}
                      />
                    ))}
                  </ul>
                </div>
              </ModusWcCard>
            </motion.li>
          ))}
        </OwnerColumn>
      </div>

      <ModusWcModal
        modalId={DRAFT_MAIL_MODAL_ID}
        aria-labelledby={DRAFT_MAIL_TITLE_ID}
        backdrop="default"
        position="center"
        showClose
      >
        <div slot="header">
          <ModusWcTypography
            id={DRAFT_MAIL_TITLE_ID}
            hierarchy="h2"
            size="lg"
            weight="semibold"
            label={draftOwner ? `Draft mail — ${draftOwner.name}` : 'Draft mail'}
          />
        </div>
        <div slot="content" className="flex flex-col gap-3">
          <ModusWcTypography
            hierarchy="p"
            size="sm"
            customClass="surface-muted"
            label="Write your subject and message. The mail workflow adds this owner's incomplete controls table automatically."
          />
          <ModusWcTextInput
            size="sm"
            bordered
            label="Subject"
            value={draftSubject}
            onInputChange={(e) => setDraftSubject(readInputString(e))}
          />
          <ModusWcTextarea
            bordered
            label="Message"
            rows={8}
            value={draftBody}
            onInputChange={(e) => setDraftBody(readInputString(e))}
          />
          <div className="flex flex-col gap-1">
            {draftOwner ? (
              <>
                <ModusWcTypography
                  hierarchy="h3"
                  size="md"
                  weight="semibold"
                  label={`Incomplete controls included (${draftOwner.count})`}
                />
                <ul className="m-0 list-disc ps-5">
                  {draftOwner.controls.map((c) => (
                    <li key={c.id}>
                      {(c['Control ID'] || '').trim()} — {(c['Application Name'] || '').trim()}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
        <div slot="footer" className="flex justify-end gap-2">
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
            disabled={!draftOwner || isSendingDraft}
            onButtonClick={handleSendDraft}
          >
            <ModusWcIcon name="envelope" version="2.0" size="xs" decorative />
            <span>{isSendingDraft ? 'Sending…' : 'Send mail'}</span>
          </ModusWcButton>
        </div>
      </ModusWcModal>
    </section>
  );
}
