import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ModusWcBadge,
  ModusWcButton,
  ModusWcCard,
  ModusWcChip,
  ModusWcEmptyState,
  ModusWcIcon,
  ModusWcSelect,
  ModusWcTextInput,
  ModusWcTypography,
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
import { chipPop, staggerContainer, staggerItem } from '../motion/presets';
import '../styles/surface-helpers.css';
import '../styles/checklist.css';

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
  { id: 'done', label: 'Has output' },
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

/** Link to a checklist or target sheet, a missing-state badge, or plain text. */
function SheetLink({ value, missingLabel, openLabel }) {
  const resolved = String(value || '')
    .replace(/\u200b/g, '')
    .trim();

  if (!resolved || resolved === '-' || resolved === '—' || /^n\/?a$/i.test(resolved)) {
    return (
      <ModusWcBadge color="warning" size="sm">
        <span>{missingLabel}</span>
      </ModusWcBadge>
    );
  }

  if (isHttpUrl(resolved)) {
    return (
      <a className="surface-link" href={resolved} target="_blank" rel="noopener noreferrer">
        <ModusWcIcon name="file-text" version="2.0" size="xs" decorative />
        <span>{openLabel}</span>
      </a>
    );
  }

  return (
    <ModusWcTypography hierarchy="p" size="sm" customClass="!m-0 break-words" label={resolved} />
  );
}

const OUTPUT_BADGES = {
  success: { color: 'success', icon: 'check-circle', label: 'Success' },
  failed: { color: 'danger', icon: 'warning-circle', label: 'Failed' },
  pending: { color: 'default', icon: 'clock', label: 'Pending' },
};

function OutputBadge({ status }) {
  const reduceMotion = useReducedMotion();
  const badge = OUTPUT_BADGES[status] || OUTPUT_BADGES.pending;
  const pop = chipPop(reduceMotion);

  return (
    <motion.span key={badge.label} className="inline-flex" {...pop}>
      <ModusWcBadge color={badge.color} size="sm">
        <span className="inline-flex items-center gap-1">
          <ModusWcIcon name={badge.icon} version="2.0" size="xs" decorative />
          <span>{status ? badge.label : 'Output pending'}</span>
        </span>
      </ModusWcBadge>
    </motion.span>
  );
}

function ReadinessTile({ label, value, tone }) {
  return (
    <div className="h-full min-w-0">
      <ModusWcCard bordered padding="compact" customClass="h-full">
        <div slot="title" className="flex w-full min-w-0 items-center">
          <ModusWcTypography
            hierarchy="h3"
            size="md"
            weight="semibold"
            customClass="!m-0"
            label={label}
          />
        </div>
        <ModusWcTypography
          hierarchy="p"
          size="3xl"
          weight="semibold"
          customClass={`tabular-nums !m-0${tone ? ` checklist-kpi--${tone}` : ''}`}
          label={String(value)}
        />
      </ModusWcCard>
    </div>
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

  // Open the run drawer for a row. Selecting the row for the detail modal is a separate action.
  const openChecklist = (item) => {
    setAuditControl(item);
    setAssistOpen(true);
  };

  useEffect(() => {
    if (!focusControl) return;
    setAuditControl(focusControl);
    setAssistOpen(true);
    onFocusControlHandled?.();
  }, [focusControl, onFocusControlHandled]);

  const hasFilters = filter !== 'all' || search.trim() !== '';
  const clearFilters = () => {
    setFilter('all');
    setSearch('');
  };
  const activeFilterLabel = FILTERS.find((f) => f.id === filter)?.label || 'All';

  const listVariants = staggerContainer(reduceMotion);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <header className="grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_max-content]">
        <div className="flex min-w-0 flex-col gap-2">
          <div>
            <ModusWcBadge color="default" size="sm" variant="outlined">
              <span>Audit action</span>
            </ModusWcBadge>
          </div>
          <ModusWcTypography
            hierarchy="h1"
            size="2xl"
            weight="semibold"
            customClass="!m-0"
            label="Checklist runs"
          />
          <ModusWcTypography
            hierarchy="p"
            size="md"
            customClass="surface-muted !m-0"
            label="Ticketed controls only. A run succeeds only when every checkpoint passes."
          />
        </div>
        <div className="w-full md:w-48">
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

      <section aria-labelledby="checklist-readiness-heading" className="flex min-w-0 flex-col">
        <ModusWcTypography
          id="checklist-readiness-heading"
          hierarchy="h2"
          size="md"
          customClass="sr-only"
          label="Checklist readiness"
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ReadinessTile label="Ready to run" value={counts.ready} />
          <ReadinessTile label="Blocked" value={counts.blocked} tone="warning" />
          <ReadinessTile label="Has output" value={counts.done} tone="success" />
          <ReadinessTile label="Ticketed" value={counts.all} />
        </div>
      </section>

      <ModusWcCard bordered padding="compact">
        <div slot="title" className="mb-4 flex w-full min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ModusWcIcon name="clipboard-check" version="2.0" decorative />
            <ModusWcTypography
              hierarchy="h2"
              size="lg"
              weight="semibold"
              label="Ticketed controls"
            />
          </div>
          <ModusWcBadge color="default" size="sm">
            <span>{`${visible.length} of ${counts.all}`}</span>
          </ModusWcBadge>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Readiness filter"
              className="flex min-w-0 flex-wrap items-center gap-2"
            >
              {FILTERS.map((f) => (
                <ModusWcChip
                  key={f.id}
                  size="sm"
                  variant="outline"
                  active={filter === f.id}
                  label={`${f.label} (${counts[f.id]})`}
                  onChipClick={() => setFilter(f.id)}
                />
              ))}
              <span className={hasFilters ? '' : 'surface-hidden'}>
                <ModusWcButton
                  variant="borderless"
                  color="tertiary"
                  size="sm"
                  onButtonClick={clearFilters}
                >
                  Clear filters
                </ModusWcButton>
              </span>
            </div>
            <div className="w-full sm:w-72">
              <ModusWcTextInput
                size="sm"
                bordered
                includeSearch
                includeClear
                type="search"
                placeholder="Search control, owner or ticket"
                value={search}
                aria-label="Search checklist rows"
                onInputChange={(e) => setSearch(readInputString(e))}
              />
            </div>
          </div>

          <p className="sr-only" role="status">
            {`${visible.length} of ${counts.all} controls shown. Filter: ${activeFilterLabel}.`}
          </p>

          <div className={visible.length === 0 ? '' : 'surface-hidden'}>
            <ModusWcEmptyState
              variant="compact"
              illustration="selection_plus"
              heading="No controls match this view"
              subtitle={
                filter === 'ready'
                  ? 'None are ready. Add a checklist sheet and a quarter Drive link first.'
                  : 'Clear the search or switch the readiness filter.'
              }
              actionLabel={hasFilters ? 'Clear filters' : undefined}
              onActionClick={clearFilters}
            />
          </div>

          <motion.ul
            className={
              visible.length === 0 ? 'surface-hidden' : 'surface-list flex flex-col gap-2'
            }
            variants={listVariants}
            initial="hidden"
            animate="show"
          >
            <AnimatePresence mode="popLayout">
              {visible.map(({ item, readiness }, index) => {
                const id = item.id || item['Control ID'];
                const blockReason = !readiness.hasChecklist
                  ? 'Checklist sheet missing'
                  : !readiness.hasDrive
                    ? `${quarter} Drive link missing`
                    : null;
                const isSelected =
                  assistOpen &&
                  auditControl &&
                  (auditControl.id || auditControl['Control ID']) === id;

                return (
                  <motion.li
                    key={id}
                    layout={!reduceMotion}
                    variants={staggerItem(reduceMotion, index)}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                  >
                    <ModusWcCard
                      bordered={false}
                      padding="compact"
                      customClass={`checklist-run checklist-run--${readiness.key}${
                        isSelected ? ' is-selected' : ''
                      }`}
                    >
                      <div
                        slot="title"
                        className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2"
                      >
                        <ModusWcTypography
                          hierarchy="h3"
                          size="md"
                          weight="semibold"
                          customClass="!m-0"
                          label={item['Control ID']}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <ModusWcBadge color="default" size="sm" variant="outlined">
                            <span>{item['TICKET NUMBER'] || 'Ticketed'}</span>
                          </ModusWcBadge>
                          <OutputBadge status={readiness.output} />
                        </div>
                      </div>

                      <div className="flex min-w-0 flex-col gap-2">
                        <ModusWcTypography
                          hierarchy="p"
                          size="sm"
                          customClass="surface-muted !m-0"
                          label={`${item['Application Name']} · ${item['Control Owner']}`}
                        />
                        <ModusWcTypography
                          hierarchy="p"
                          size="md"
                          customClass="!m-0"
                          label={item['Control Title'] || '—'}
                        />

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="flex min-w-0 flex-col gap-1">
                            <ModusWcTypography
                              hierarchy="p"
                              size="sm"
                              weight="semibold"
                              customClass="!m-0"
                              label="Checklist"
                            />
                            <div>
                              <SheetLink
                                value={checklistLabel(item)}
                                missingLabel="Checklist is missing"
                                openLabel="Open checklist"
                              />
                            </div>
                          </div>
                          <div className="flex min-w-0 flex-col gap-1">
                            <ModusWcTypography
                              hierarchy="p"
                              size="sm"
                              weight="semibold"
                              customClass="!m-0"
                              label={`Target (${quarter})`}
                            />
                            <div>
                              <SheetLink
                                value={targetSheetForQuarter(item, quarter)}
                                missingLabel="Target sheet is missing"
                                openLabel={
                                  isGoogleSheetUrl(targetSheetForQuarter(item, quarter))
                                    ? 'Open sheet'
                                    : 'Open folder'
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          {blockReason ? (
                            <ModusWcBadge color="warning" size="sm">
                              <span className="inline-flex items-center gap-1">
                                <ModusWcIcon
                                  name="warning-circle"
                                  version="2.0"
                                  size="xs"
                                  decorative
                                />
                                <span>{blockReason}</span>
                              </span>
                            </ModusWcBadge>
                          ) : (
                            <ModusWcTypography
                              hierarchy="p"
                              size="sm"
                              customClass="surface-muted !m-0"
                              label={`Ready for ${quarter}`}
                            />
                          )}
                        </div>
                      </div>

                      <div slot="actions" className="modus-wc-justify-end flex w-full flex-wrap gap-2">
                        <ModusWcButton
                          variant="outlined"
                          color="tertiary"
                          size="sm"
                          aria-label={`View details for ${item['Control ID']}`}
                          onButtonClick={() => onSelectControl?.(item)}
                        >
                          View details
                        </ModusWcButton>
                        <ModusWcButton
                          variant="filled"
                          color="primary"
                          size="sm"
                          disabled={!readiness.canRun}
                          aria-label={`Run checklist for ${item['Control ID']}`}
                          onButtonClick={() => openChecklist(item)}
                        >
                          <ModusWcIcon name="clipboard-check" version="2.0" size="xs" decorative />
                          <span>Run checklist</span>
                        </ModusWcButton>
                      </div>
                    </ModusWcCard>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        </div>
      </ModusWcCard>

      <AssistPanel
        open={assistOpen}
        control={auditControl}
        initialQuarter={quarter}
        autoStart
        onClose={() => setAssistOpen(false)}
        onChecklistResult={onChecklistResult}
      />
    </div>
  );
}
