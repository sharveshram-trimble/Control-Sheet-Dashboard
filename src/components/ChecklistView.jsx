import React, { useMemo, useState } from 'react';
import {
  ModusWcBadge,
  ModusWcIcon,
  ModusWcTextInput,
} from '@trimble-oss/moduswebcomponents-react';
import { readInputString } from '../utils/modusFormEvents';

function checklistCellValue(raw) {
  const value = String(raw || '')
    .replace(/\u200b/g, '')
    .trim();
  if (!value || value === '-' || value === 'N/A') return null;
  return value;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function ChecklistCell({ value }) {
  const resolved = checklistCellValue(value);
  if (!resolved) {
    return <span className="checklist-empty">—</span>;
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
        Open checklist
      </a>
    );
  }

  return <span className="checklist-text-value">{resolved}</span>;
}

export default function ChecklistView({ items, onSelectControl }) {
  const [search, setSearch] = useState('');

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
        item.CHECKLIST?.toLowerCase().includes(q)
    );
  }, [items, search]);

  return (
    <div className="table-section-card checklist-section">
      <div className="table-controls-bar">
        <div className="checklist-header-copy">
          <h2>Checklist</h2>
          <p>
            Completed controls from the live sheet. Checklist shows each row’s
            CHECKLIST column value; Output is reserved for later.
          </p>
        </div>
        <div className="table-filters-group">
          <ModusWcBadge color="success" size="sm" variant="filled">
            {completedItems.length} completed
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
              <th scope="col">Output</th>
            </tr>
          </thead>
          <tbody>
            {completedItems.length === 0 ? (
              <tr>
                <td colSpan="5" className="table-empty-cell">
                  No completed ticket rows match this view.
                </td>
              </tr>
            ) : (
              completedItems.map((item) => (
                <tr key={item.id || item['Control ID']} className="row-completed">
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
                    <span className="checklist-empty" aria-label="Output pending">
                      {/* Reserved — fill later */}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
