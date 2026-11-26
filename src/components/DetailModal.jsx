import React, { useEffect, useRef } from 'react';
import {
  ModusWcAlert,
  ModusWcButton,
  ModusWcCard,
  ModusWcIcon,
  ModusWcModal,
  ModusWcTypography,
} from '@trimble-oss/moduswebcomponents-react';
import { getDialog, showDialogWhenReady, useDialogClose } from '../utils/modalDialog';
import StatusChip from './StatusChip';
import '../styles/surface-helpers.css';

const MODAL_ID = 'control-detail-modal';
const TITLE_ID = 'control-detail-modal-title';
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

/** Label + value tile used for the ticket, owner and frequency facts. */
function FactTile({ label, value, icon }) {
  return (
    <div className="min-w-0">
      <ModusWcCard bordered padding="compact" customClass="h-full">
        <div className="flex min-w-0 items-start gap-2">
          {icon ? <ModusWcIcon name={icon} version="2.0" size="md" decorative /> : null}
          <div className="flex min-w-0 flex-col gap-1">
            <ModusWcTypography hierarchy="p" size="sm" customClass="surface-muted !m-0" label={label} />
            <ModusWcTypography
              hierarchy="p"
              size="md"
              weight="semibold"
              customClass="!m-0 break-words"
              label={value}
            />
          </div>
        </div>
      </ModusWcCard>
    </div>
  );
}

export default function DetailModal({ control, onClose }) {
  const returnFocusRef = useRef(null);

  // Open from the prop (App owns `selectedControl`); the native <dialog> closes itself on Escape.
  useEffect(() => {
    if (!control) {
      const dialog = getDialog(MODAL_ID);
      if (dialog?.open) dialog.close();
      return undefined;
    }
    const dialog = getDialog(MODAL_ID);
    if (!dialog?.open) returnFocusRef.current = document.activeElement;
    return showDialogWhenReady(MODAL_ID);
  }, [control]);

  // Every dismiss path (×, Escape, backdrop, Close) lands here: sync App state, then return focus.
  useDialogClose(MODAL_ID, () => {
    onClose?.();
    const el = returnFocusRef.current;
    window.setTimeout(() => {
      if (el && typeof el.focus === 'function' && el.isConnected) el.focus();
    }, 0);
  });

  const closeDialog = () => {
    getDialog(MODAL_ID)?.close();
  };

  const auditIssue = control?.['Audit Issue from FY 25'];
  const hasAudit = Boolean(auditIssue) && auditIssue !== 'N/A';
  const kicker = [control?.['Application Name'], control?.['Sub-Process']]
    .filter(Boolean)
    .join(' · ');

  return (
    <ModusWcModal
      modalId={MODAL_ID}
      aria-labelledby={TITLE_ID}
      backdrop="default"
      position="center"
      showClose
    >
      <div slot="header" className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-col">
          <ModusWcTypography
            hierarchy="p"
            size="sm"
            customClass="surface-muted !m-0"
            label={kicker || '\u00a0'}
          />
          <ModusWcTypography
            id={TITLE_ID}
            hierarchy="h2"
            size="lg"
            weight="semibold"
            customClass="!m-0"
            label={control?.['Control ID'] || 'Control details'}
          />
        </div>
        <div>
          {control ? (
            <StatusChip
              tone={control.isCompleted ? 'ok' : 'warn'}
              label={control.isCompleted ? 'Ticketed' : 'Missing ticket'}
            />
          ) : null}
        </div>
      </div>

      <div slot="content" className="flex min-w-0 flex-col gap-4">
        {control ? (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <FactTile
                icon="ticket"
                label="Ticket number"
                value={control['TICKET NUMBER'] || 'Not on control sheet'}
              />
              <FactTile label="Control owner" value={control['Control Owner'] || '—'} />
              <FactTile
                label="Frequency and type"
                value={`${control['Control Frequency'] || 'N/A'} · ${control['Control Type'] || 'N/A'}`}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <ModusWcTypography
                hierarchy="h3"
                size="md"
                weight="semibold"
                customClass="!m-0"
                label="Control title"
              />
              <ModusWcTypography
                hierarchy="p"
                size="md"
                customClass="!m-0"
                label={control['Control Title'] || '—'}
              />
            </div>

            <div>
              {hasAudit ? (
                <ModusWcAlert
                  variant="error"
                  role="status"
                  alertTitle="Audit issue (FY 25)"
                  alertDescription={auditIssue}
                />
              ) : null}
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <ModusWcTypography
                hierarchy="h3"
                size="md"
                weight="semibold"
                customClass="!m-0"
                label="Evidence folders"
              />
              <ul className="surface-list grid grid-cols-2 gap-2 sm:grid-cols-4">
                {QUARTERS.map((q) => {
                  const link = control[`Drive Link ${q}`];
                  return (
                    <li key={q} className="min-w-0">
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="surface-link"
                          aria-label={`Open ${q} evidence folder (opens in a new tab)`}
                        >
                          <span>{q}</span>
                          <ModusWcIcon name="arrow-square-out" version="2.0" size="xs" decorative />
                        </a>
                      ) : (
                        <span className="surface-muted">{q} — none</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        ) : null}
      </div>

      <div slot="footer" className="flex justify-end gap-2">
        <ModusWcButton color="tertiary" variant="outlined" size="sm" onButtonClick={closeDialog}>
          Close
        </ModusWcButton>
      </div>
    </ModusWcModal>
  );
}
