import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ModusWcButton,
  ModusWcIcon,
  ModusWcModal,
} from '@trimble-oss/moduswebcomponents-react';
import { modalContent } from '../motion/presets';
import StatusChip from './StatusChip';

const MODAL_ID = 'control-detail-modal';

export default function DetailModal({ control, onClose }) {
  const reduceMotion = useReducedMotion();
  const returnFocusRef = useRef(null);
  const contentMotion = modalContent(reduceMotion);

  useEffect(() => {
    const dialog = document.getElementById(MODAL_ID);
    if (!dialog) return undefined;

    const handleClose = () => {
      onClose?.();
      const el = returnFocusRef.current;
      if (el && typeof el.focus === 'function') {
        window.setTimeout(() => el.focus(), 0);
      }
    };
    dialog.addEventListener('close', handleClose);

    if (control && typeof dialog.showModal === 'function' && !dialog.open) {
      returnFocusRef.current = document.activeElement;
      dialog.showModal();
      dialog.classList.add('control-detail-modal--enter');
    }

    if (!control && dialog.open) {
      dialog.classList.remove('control-detail-modal--enter');
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
        <AnimatePresence mode="wait">
          {control ? (
            <motion.div
              key={control.id || control['Control ID'] || 'detail'}
              className="detail-modal-header-main"
              {...contentMotion}
            >
              <div>
                <p className="detail-modal-kicker">
                  {control?.['Application Name'] || '—'}
                  {control?.['Sub-Process']
                    ? ` · ${control['Sub-Process']}`
                    : ''}
                </p>
                <strong className="detail-modal-id">
                  {control?.['Control ID'] || 'Control'}
                </strong>
              </div>
              <StatusChip
                tone={control?.isCompleted ? 'ok' : 'warn'}
                label={control?.isCompleted ? 'Ticketed' : 'Missing ticket'}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div slot="content" className="detail-modal-body">
        <AnimatePresence mode="wait">
          {control ? (
            <motion.div
              key={`body-${control.id || control['Control ID']}`}
              {...contentMotion}
            >
              <div
                className={`detail-ticket-box ${control?.isCompleted ? 'done' : 'pending'}`}
              >
                <div className="detail-ticket-info">
                  <ModusWcIcon name="ticket" size="md" decorative />
                  <div>
                    <span className="detail-field-label">Ticket number</span>
                    <div className="detail-ticket-value">
                      {control?.['TICKET NUMBER'] || 'Not on control sheet'}
                    </div>
                  </div>
                </div>
              </div>

              <dl className="detail-meta-grid">
                <div className="detail-meta-tile">
                  <dt className="detail-field-label">Control owner</dt>
                  <dd className="detail-meta-value">
                    {control?.['Control Owner'] || '—'}
                  </dd>
                </div>
                <div className="detail-meta-tile">
                  <dt className="detail-field-label">Frequency / type</dt>
                  <dd className="detail-meta-value">
                    {control?.['Control Frequency'] || 'N/A'} ·{' '}
                    {control?.['Control Type'] || 'N/A'}
                  </dd>
                </div>
              </dl>

              <div className="detail-block">
                <h4 className="detail-field-label">Control title</h4>
                <div className="detail-title-box">
                  {control?.['Control Title'] || '—'}
                </div>
              </div>

              <div className="detail-block" hidden={!hasAudit}>
                <h4 className="detail-field-label detail-danger-label">
                  Audit issue (FY 25)
                </h4>
                <div className="detail-audit-box">
                  {control?.['Audit Issue from FY 25']}
                </div>
              </div>

              <div className="detail-block">
                <h4 className="detail-field-label">Evidence folders</h4>
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
                          <span>{q}</span>
                          <ModusWcIcon name="launch" size="xs" decorative />
                        </a>
                        <div className="detail-drive-empty" hidden={Boolean(link)}>
                          {q} — none
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
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
