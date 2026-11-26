import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ModusWcBadge,
  ModusWcButton,
  ModusWcIcon,
  ModusWcSelect,
  ModusWcTextInput,
} from '@trimble-oss/moduswebcomponents-react';
import AssistPanel from '../assist/AssistPanel';
import {
  checklistLabel,
  checklistOutputStatus,
  currentCalendarQuarter,
  driveLinkForQuarter,
  hasChecklistSheet,
  isGoogleSheetUrl,
  targetSheetForQuarter,
} from '../assist/assistConfig';
import { readInputString } from '../utils/modusFormEvents';
import {
  chipPop,
  drawerSpring,
  fadeUp,
  staggerContainer,
  staggerItem,
} from '../motion/presets';

const QUARTER_OPTIONS = [
  { label: 'Q1', value: 'Q1' },
  { label: 'Q2', value: 'Q2' },
  { label: 'Q3', value: 'Q3' },
  { label: 'Q4', value: 'Q4' },
];

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ready', label: 'Ready to run' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Has OUTPUT' },
];

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function readinessFor(item, quarter) {
  const output = checklistOutputStatus(item);
  const hasChecklist = hasChecklistSheet(item);
  const hasDrive = Boolean(driveLinkForQuarter(item, quarter));
  if (output === 'success' || output === 'failed') {
    return { key: 'done', output, hasChecklist, hasDrive, canRun: false };
  }
  if (hasChecklist && hasDrive) {
    return { key: 'ready', output: null, hasChecklist, hasDrive, canRun: true };
  }
  return { key: 'blocked', output: null, hasChecklist, hasDrive, canRun: false };
}

function SheetLink({ value, missingLabel, openLabel }) {
  const resolved = String(value || '')
    .replace(/\u200b/g, '')
    .trim();

  if (!resolved || resolved === '-' || resolved === '—' || /^n\/?a$/i.test(resolved)) {
    return <span className="checklist-missing">{missingLabel}</span>;
  }

  if (isHttpUrl(resolved)) {
    return (
      <a
        className="checklist-sheet-link"
        href={resolved}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ModusWcIcon name="file" size="xs" decorative />
        {openLabel}
      </a>
    );
  }

  return <span className="checklist-text-value">{resolved}</span>;
}

function OutputChip({ status }) {
  const reduceMotion = useReducedMotion();
  const chip =
    status === 'success'
      ? { className: 'output-chip output-chip--ok', icon: 'check_circle', label: 'Success' }
      : status === 'failed'
        ? { className: 'output-chip output-chip--bad', icon: 'warning', label: 'Failed' }
        : {
            className: 'output-chip output-chip--idle',
            icon: 'time',
            label: 'Pending',
          };
  const pop = chipPop(reduceMotion);

  return (
    <motion.span
      key={chip.label}
      className={chip.className}
      aria-label={status ? undefined : 'Output pending'}
      {...pop}
    >
      <ModusWcIcon name={chip.icon} size="xs" decorative />
      {chip.label}
    </motion.span>
  );
}

export default function ChecklistView({
  items,
  onSelectControl,
  focusControl,
  onFocusControlHandled,
  onChecklistResult,
}) {
  const reduceMotion = useReducedMotion();
  const [search, setSearch] = useState('');
  const [quarter, setQuarter] = useState(() => currentCalendarQuarter());
  const [filter, setFilter] = useState('all');
  const [auditControl, setAuditControl] = useState(null);
  const [assistOpen, setAssistOpen] = useState(false);

  const ticketed = useMemo(
    () => items.filter((i) => i.isCompleted),
    [items]
  );

  const enriched = useMemo(
    () =>
      ticketed.map((item) => ({
        item,
        readiness: readinessFor(item, quarter),
      })),
    [ticketed, quarter]
  );

  const counts = useMemo(() => {
    const ready = enriched.filter((r) => r.readiness.key === 'ready').length;
    const blocked = enriched.filter((r) => r.readiness.key === 'blocked').length;
    const done = enriched.filter((r) => r.readiness.key === 'done').length;
    return { all: enriched.length, ready, blocked, done };
  }, [enriched]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter(({ item, readiness }) => {
      if (filter !== 'all' && readiness.key !== filter) return false;
      if (!q) return true;
      return (
        item['Application Name']?.toLowerCase().includes(q) ||
        item['Control ID']?.toLowerCase().includes(q) ||
        item['Control Owner']?.toLowerCase().includes(q) ||
        item['Control Title']?.toLowerCase().includes(q) ||
        item['TICKET NUMBER']?.toLowerCase().includes(q) ||
        item.CHECKLIST?.toLowerCase().includes(q) ||
        targetSheetForQuarter(item, quarter)?.toLowerCase().includes(q) ||
        String(item.OUTPUT || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [enriched, filter, search, quarter]);

  const openChecklist = (item) => {
    setAuditControl(item);
    setAssistOpen(true);
    onSelectControl?.(item);
  };

  useEffect(() => {
    if (!focusControl) return;
    setAuditControl(focusControl);
    setAssistOpen(true);
    onFocusControlHandled?.();
  }, [focusControl, onFocusControlHandled]);

  const listVariants = staggerContainer(reduceMotion);
  const emptyMotion = fadeUp(reduceMotion, 8);

  return (
    <div className={`checklist-ops${assistOpen ? ' checklist-ops--rail-open' : ''}`}>
      <section className="checklist-ops-main" aria-label="Checklist runs">
        <header className="checklist-ops-hero">
          <div className="checklist-ops-hero-copy">
            <p className="checklist-ops-kicker">Audit action</p>
            <h2>Checklist runs</h2>
            <p>
              Ticketed controls only. Run Checklist is the bold action — OUTPUT
              is success only when every checkpoint passes.
            </p>
          </div>
          <div className="checklist-ops-hero-meta">
            <ModusWcSelect
              label="Quarter"
              size="sm"
              value={quarter}
              options={QUARTER_OPTIONS}
              onInputChange={(e) => {
                const next = readInputString(e);
                if (next) setQuarter(next);
              }}
            />
          </div>
        </header>

        <div className="checklist-kpi-strip" aria-label="Checklist readiness">
          <button
            type="button"
            className={`checklist-kpi${filter === 'ready' ? ' is-active' : ''}`}
            onClick={() => setFilter('ready')}
          >
            <span className="checklist-kpi-value">{counts.ready}</span>
            <span className="checklist-kpi-label">Ready to run</span>
          </button>
          <button
            type="button"
            className={`checklist-kpi checklist-kpi--warn${filter === 'blocked' ? ' is-active' : ''}`}
            onClick={() => setFilter('blocked')}
          >
            <span className="checklist-kpi-value">{counts.blocked}</span>
            <span className="checklist-kpi-label">Blocked</span>
          </button>
          <button
            type="button"
            className={`checklist-kpi checklist-kpi--ok${filter === 'done' ? ' is-active' : ''}`}
            onClick={() => setFilter('done')}
          >
            <span className="checklist-kpi-value">{counts.done}</span>
            <span className="checklist-kpi-label">Has OUTPUT</span>
          </button>
          <button
            type="button"
            className={`checklist-kpi${filter === 'all' ? ' is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <span className="checklist-kpi-value">{counts.all}</span>
            <span className="checklist-kpi-label">Ticketed</span>
          </button>
        </div>

        <div className="checklist-ops-toolbar">
          <div className="checklist-filter-row" role="tablist" aria-label="Readiness filter">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className={`checklist-filter-chip${filter === f.id ? ' is-active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                <span className="checklist-filter-count">{counts[f.id]}</span>
              </button>
            ))}
          </div>
          <ModusWcTextInput
            size="sm"
            bordered
            includeSearch
            includeClear
            type="search"
            placeholder="Search control, owner, ticket…"
            value={search}
            aria-label="Search checklist rows"
            customClass="checklist-search-input"
            onInputChange={(e) => setSearch(readInputString(e))}
          />
        </div>

        <motion.ul
          className="checklist-run-list"
          variants={listVariants}
          initial="hidden"
          animate="show"
        >
          <AnimatePresence mode="popLayout">
            {visible.length === 0 ? (
              <motion.li
                key="empty"
                className="checklist-empty-state"
                {...emptyMotion}
              >
                <h3>No rows match this view</h3>
                <p>
                  {filter === 'ready'
                    ? 'No controls are ready — add a checklist sheet and quarter Drive link.'
                    : 'Clear search or switch readiness filter.'}
                </p>
                {filter !== 'all' ? (
                  <button
                    type="button"
                    className="checklist-empty-action"
                    onClick={() => setFilter('all')}
                  >
                    Show all ticketed
                  </button>
                ) : null}
              </motion.li>
            ) : (
              visible.map(({ item, readiness }, index) => {
                const id = item.id || item['Control ID'];
                const blockReason = !readiness.hasChecklist
                  ? 'Checklist sheet missing'
                  : !readiness.hasDrive
                    ? `${quarter} Drive link missing`
                    : null;

                return (
                  <motion.li
                    key={id}
                    layout={!reduceMotion}
                    variants={staggerItem(reduceMotion, index)}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className={`checklist-run-card checklist-run-card--${readiness.key}${
                      auditControl &&
                      (auditControl.id || auditControl['Control ID']) === id &&
                      assistOpen
                        ? ' is-selected'
                        : ''
                    }`}
                  >
                    <div className="checklist-run-top">
                      <div className="checklist-run-id-block">
                        <button
                          type="button"
                          className="checklist-control-link"
                          onClick={() => onSelectControl?.(item)}
                        >
                          {item['Control ID']}
                        </button>
                        <p className="checklist-run-meta">
                          {item['Application Name']} · {item['Control Owner']}
                        </p>
                        <p className="checklist-run-title">
                          {item['Control Title']}
                        </p>
                      </div>
                      <div className="checklist-run-status">
                        <ModusWcBadge
                          color="primary"
                          size="sm"
                          variant="filled"
                        >
                          {item['TICKET NUMBER'] || 'Ticketed'}
                        </ModusWcBadge>
                        <OutputChip status={readiness.output} />
                      </div>
                    </div>

                    <div className="checklist-run-links">
                      <div>
                        <span className="checklist-field-label">Checklist</span>
                        <SheetLink
                          value={checklistLabel(item)}
                          missingLabel="Checklist is missing"
                          openLabel="Open checklist"
                        />
                      </div>
                      <div>
                        <span className="checklist-field-label">
                          Target ({quarter})
                        </span>
                        <SheetLink
                          value={targetSheetForQuarter(item, quarter)}
                          missingLabel="Target sheet is missing"
                          openLabel={
                            isGoogleSheetUrl(targetSheetForQuarter(item, quarter))
                              ? 'Open Google Sheet'
                              : 'Open Drive folder'
                          }
                        />
                      </div>
                    </div>

                    <div className="checklist-run-actions">
                      {blockReason ? (
                        <span className="checklist-block-reason">
                          <ModusWcIcon name="warning" size="xs" decorative />
                          {blockReason}
                        </span>
                      ) : (
                        <span className="checklist-ready-hint">
                          Ready for {quarter}
                        </span>
                      )}
                      <ModusWcButton
                        variant="filled"
                        color="primary"
                        size="sm"
                        customClass="run-checklist-btn cta-sheen ripple-host"
                        disabled={!readiness.canRun}
                        aria-label={`Run checklist for ${item['Control ID']}`}
                        onButtonClick={() => openChecklist(item)}
                      >
                        <ModusWcIcon name="check_circle" size="xs" decorative />
                        Run Checklist
                      </ModusWcButton>
                    </div>
                  </motion.li>
                );
              })
            )}
          </AnimatePresence>
        </motion.ul>
      </section>

      <AnimatePresence>
        {assistOpen ? (
          <motion.div
            key="assist-rail"
            className="checklist-assist-slot"
            initial={reduceMotion ? false : { opacity: 0, x: 36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 36 }}
            transition={
              reduceMotion ? { duration: 0.12 } : drawerSpring
            }
          >
            <AssistPanel
              open={assistOpen}
              control={auditControl}
              initialQuarter={quarter}
              autoStart
              onClose={() => setAssistOpen(false)}
              onChecklistResult={onChecklistResult}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
