import React, { useEffect, useMemo, useState } from 'react';
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

const QUARTER_OPTIONS = [
  { label: 'Q1', value: 'Q1' },
  { label: 'Q2', value: 'Q2' },
  { label: 'Q3', value: 'Q3' },
  { label: 'Q4', value: 'Q4' },
];

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function SheetLinkCell({ value, missingLabel, openLabel }) {
  const resolved = String(value || '')
    .replace(/\u200b/g, '')
    .trim();

  if (!resolved || resolved === '-' || resolved === '—' || /^n\/?a$/i.test(resolved)) {
    return (
      <ModusWcBadge color="warning" size="sm" variant="filled">
        {missingLabel}
      </ModusWcBadge>
    );
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

function ChecklistCell({ value }) {
  return (
    <SheetLinkCell
      value={checklistLabel({ CHECKLIST: value })}
      missingLabel="Checklist is missing"
      openLabel="Open checklist"
    />
  );
}

function TargetSheetCell({ control, quarter }) {
  const value = targetSheetForQuarter(control, quarter);
  const isSheet = isGoogleSheetUrl(value);
  return (
    <SheetLinkCell
      value={value}
      missingLabel="Target sheet is missing"
      openLabel={isSheet ? 'Open Google Sheet' : 'Open Drive folder'}
    />
  );
}

function OutputCell({ control }) {
  const status = checklistOutputStatus(control);

  if (status === 'success') {
    return (
      <ModusWcBadge color="success" size="sm" variant="filled">
        Success
      </ModusWcBadge>
    );
  }

  if (status === 'failed') {
    return (
      <ModusWcBadge color="danger" size="sm" variant="filled">
        Failed
      </ModusWcBadge>
    );
  }

  return (
    <span className="checklist-empty" aria-label="Output pending">
      —
    </span>
  );
}

export default function ChecklistView({
  items,
  onSelectControl,
  focusControl,
  onFocusControlHandled,
  onChecklistResult,
}) {
  const [search, setSearch] = useState('');
  const [quarter, setQuarter] = useState(() => currentCalendarQuarter());
  const [auditControl, setAuditControl] = useState(null);
  const [assistOpen, setAssistOpen] = useState(false);

  const completedItems = useMemo(() => {
    const rows = items.filter((i) => i.isCompleted);
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (item) =>
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
  }, [items, search, quarter]);

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

  return (
    <div className="checklist-layout">
      <div className="table-section-card checklist-section">
        <div className="table-controls-bar">
          <div className="checklist-header-copy">
            <h2>Checklist runs</h2>
            <p>
              Ticketed controls from the live sheet. Run checklist uses your
              Trimble ID user token against the Agents API. Output is success
              only when every checkpoint passes.
            </p>
          </div>
          <div className="table-filters-group checklist-header-actions">
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
            <ModusWcBadge color="success" size="sm" variant="filled">
              {completedItems.length} ticketed
            </ModusWcBadge>
          </div>
        </div>

        <div className="checklist-search-bar">
          <ModusWcTextInput
            size="sm"
            bordered
            includeSearch
            includeClear
            type="search"
            placeholder="Search completed controls, owners, tickets, or checklist..."
            value={search}
            aria-label="Search checklist completed tickets"
            customClass="matrix-search-input"
            onInputChange={(e) => setSearch(readInputString(e))}
          />
        </div>

        <div className="data-table-wrapper">
          <table className="data-table checklist-table">
            <thead>
              <tr>
                <th scope="col">Control ID</th>
                <th scope="col">Application</th>
                <th scope="col">Owner</th>
                <th scope="col">Checklist</th>
                <th scope="col">Target sheet</th>
                <th scope="col">Output</th>
                <th scope="col">Run checklist</th>
              </tr>
            </thead>
            <tbody>
              {completedItems.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty-cell">
                    No completed ticket rows match this view.
                  </td>
                </tr>
              ) : (
                completedItems.map((item) => {
                  const hasChecklist = hasChecklistSheet(item);
                  const hasDrive = Boolean(driveLinkForQuarter(item, quarter));
                  return (
                    <tr
                      key={item.id || item['Control ID']}
                      className="row-completed"
                    >
                      <td>
                        <button
                          type="button"
                          className="checklist-control-link"
                          onClick={() => onSelectControl?.(item)}
                        >
                          {item['Control ID']}
                        </button>
                      </td>
                      <td>
                        <span className="cell-app-name">
                          {item['Application Name']}
                        </span>
                      </td>
                      <td>
                        <span className="cell-owner-tag">
                          {item['Control Owner']}
                        </span>
                      </td>
                      <td>
                        <ChecklistCell value={item.CHECKLIST} />
                      </td>
                      <td>
                        <TargetSheetCell control={item} quarter={quarter} />
                      </td>
                      <td>
                        <OutputCell control={item} />
                      </td>
                      <td>
                        {!hasChecklist ? (
                          <ModusWcBadge
                            color="warning"
                            size="sm"
                            variant="filled"
                            aria-label={`Checklist is missing for ${item['Control ID']}`}
                          >
                            Checklist is missing
                          </ModusWcBadge>
                        ) : !hasDrive ? (
                          <ModusWcBadge
                            color="warning"
                            size="sm"
                            variant="filled"
                            aria-label={`${quarter} Drive link is missing for ${item['Control ID']}`}
                          >
                            {quarter} Drive link is missing
                          </ModusWcBadge>
                        ) : (
                          <ModusWcButton
                            variant="filled"
                            color="primary"
                            size="sm"
                            customClass="run-checklist-btn"
                            aria-label={`Run checklist for ${item['Control ID']}`}
                            onButtonClick={() => openChecklist(item)}
                          >
                            <ModusWcIcon
                              name="check_circle"
                              size="xs"
                              decorative
                            />
                            Run Checklist
                          </ModusWcButton>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
