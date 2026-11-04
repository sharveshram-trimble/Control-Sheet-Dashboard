import React, { useEffect } from 'react';
import {
  ModusWcBadge,
  ModusWcButton,
  ModusWcIcon,
  ModusWcModal,
} from '@trimble-oss/moduswebcomponents-react';

const MODAL_ID = 'control-detail-modal';

export default function DetailModal({ control, onClose }) {
  useEffect(() => {
    const dialog = document.getElementById(MODAL_ID);
    if (!dialog) return undefined;

    const handleClose = () => onClose?.();
    dialog.addEventListener('close', handleClose);

    if (control && typeof dialog.showModal === 'function' && !dialog.open) {
      dialog.showModal();
    }

    if (!control && dialog.open) {
      dialog.close();
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, [control, onClose]);

  const closeDialog = () => {
    document.getElementById(MODAL_ID)?.close();
  };

  const hasAudit =
    Boolean(control?.['Audit Issue from FY 25']) &&
    control?.['Audit Issue from FY 25'] !== 'N/A';

  return (
    <ModusWcModal
      modalId={MODAL_ID}
      backdrop="default"
      position="center"
      showClose
      aria-label={
        control
          ? `Control details ${control['Control ID'] || ''}`
          : 'Control details'
      }
      customClass="control-detail-modal"
    >
      <div slot="header" className="detail-modal-header">
        <div className="detail-modal-header-main">
          <div
            className={`detail-modal-status-icon ${control?.isCompleted ? 'done' : 'pending'}`}
          >
            <ModusWcIcon
              name={control?.isCompleted ? 'check_circle' : 'warning'}
              size="md"
              decorative
            />
          </div>
          <div>
            <strong>{control?.['Control ID'] || 'Control'}</strong>
            <p>
              {control?.['Application Name'] || '—'}
              {control?.['Sub-Process'] ? ` • ${control['Sub-Process']}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div slot="content" className="detail-modal-body">
        <div
          className={`detail-ticket-box ${control?.isCompleted ? 'done' : 'pending'}`}
        >
          <div className="detail-ticket-info">
            <ModusWcIcon name="ticket" size="md" decorative />
            <div>
              <span className="detail-field-label">Control Sheet Ticket Number</span>
              <div className="detail-ticket-value">
                {control?.['TICKET NUMBER'] || 'Missing Ticket Number in Sheet'}
              </div>
            </div>
          </div>
          <ModusWcBadge
            size="sm"
            color={control?.isCompleted ? 'success' : 'warning'}
            variant="filled"
          >
            {control?.isCompleted ? 'Verified' : 'Pending Verification'}
          </ModusWcBadge>
        </div>

        <div className="detail-meta-grid">
          <div className="detail-meta-tile">
            <span className="detail-field-label">Control Owner</span>
            <div className="detail-meta-value">
              {control?.['Control Owner'] || '—'}
            </div>
          </div>
          <div className="detail-meta-tile">
            <span className="detail-field-label">Frequency / Type</span>
            <div className="detail-meta-value">
              {control?.['Control Frequency'] || 'N/A'} •{' '}
              {control?.['Control Type'] || 'N/A'}
            </div>
          </div>
        </div>

        <div>
          <h4 className="detail-field-label">Control Title</h4>
          <div className="detail-title-box">
            {control?.['Control Title'] || '—'}
          </div>
        </div>

        <div hidden={!hasAudit}>
          <h4 className="detail-field-label detail-danger-label">
            Audit Issue from FY 25
          </h4>
          <div className="detail-audit-box">
            {control?.['Audit Issue from FY 25']}
          </div>
        </div>

        <div>
          <h4 className="detail-field-label">Evidence Folders (Google Drive)</h4>
          <div className="detail-drive-grid">
            {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
              const link = control?.[`Drive Link ${q}`];
              return (
                <div key={q} className="detail-drive-cell">
                  <a
                    href={link || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="detail-drive-link"
                    hidden={!link}
                  >
                    <span>{q} Folder</span>
                    <ModusWcIcon name="launch" size="xs" decorative />
                  </a>
                  <div className="detail-drive-empty" hidden={Boolean(link)}>
                    {q} N/A
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div slot="footer" className="detail-modal-footer">
        <ModusWcButton
          color="tertiary"
          variant="outlined"
          size="sm"
          onButtonClick={closeDialog}
        >
          Close
        </ModusWcButton>
      </div>
    </ModusWcModal>
  );
}
