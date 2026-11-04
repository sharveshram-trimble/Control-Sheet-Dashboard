import React, { useState, useMemo } from 'react';
import {
  ModusWcBadge,
  ModusWcButton,
  ModusWcIcon,
  ModusWcTextInput,
} from '@trimble-oss/moduswebcomponents-react';
import { readInputString } from '../utils/modusFormEvents';

export default function ControlSheetTable({ items, showToast }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [processFilter, setProcessFilter] = useState('all');

  const completedCount = items.filter((i) => i.isCompleted).length;
  const pendingCount = items.length - completedCount;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === 'completed' && !item.isCompleted) return false;
      if (statusFilter === 'pending' && item.isCompleted) return false;
      if (processFilter !== 'all' && item['Sub-Process'] !== processFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          item['Application Name']?.toLowerCase().includes(q) ||
          item['Control ID']?.toLowerCase().includes(q) ||
          item['Control Owner']?.toLowerCase().includes(q) ||
          item['Control Title']?.toLowerCase().includes(q) ||
          item['TICKET NUMBER']?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [items, search, statusFilter, processFilter]);

  const handleExportCSV = () => {
    if (!filteredItems.length) return;
    const headers = [
      'Row Number',
      'Application Name',
      'Sub-Process',
      'Control ID',
      'Control Title',
      'Control Owner',
      'TICKET NUMBER',
      'Status',
    ];

    const rows = filteredItems.map((i) => [
      `"${i.row_number || ''}"`,
      `"${(i['Application Name'] || '').replace(/"/g, '""')}"`,
      `"${(i['Sub-Process'] || '').replace(/"/g, '""')}"`,
      `"${(i['Control ID'] || '').replace(/"/g, '""')}"`,
      `"${(i['Control Title'] || '').replace(/"/g, '""')}"`,
      `"${(i['Control Owner'] || '').replace(/"/g, '""')}"`,
      `"${(i['TICKET NUMBER'] || '').replace(/"/g, '""')}"`,
      `"${i.isCompleted ? 'Completed' : 'Pending'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `trimble_control_sheet_matrix_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (showToast) showToast('Exported control sheet matrix to CSV!', 'success');
  };

  const filterBtn = (active, onClick, label) => (
    <ModusWcButton
      color={active ? 'primary' : 'tertiary'}
      variant={active ? 'filled' : 'outlined'}
      size="sm"
      onButtonClick={onClick}
    >
      {label}
    </ModusWcButton>
  );

  return (
    <div className="table-section-card">
      <div className="table-controls-bar">
        <div className="table-filters-group">
          {filterBtn(statusFilter === 'all', () => setStatusFilter('all'), `All Controls (${items.length})`)}
          {filterBtn(statusFilter === 'completed', () => setStatusFilter('completed'), `Completed (${completedCount})`)}
          {filterBtn(statusFilter === 'pending', () => setStatusFilter('pending'), `Pending (${pendingCount})`)}

          <span className="filter-divider" aria-hidden="true">
            |
          </span>

          {filterBtn(processFilter === 'all', () => setProcessFilter('all'), 'All Sub-Processes')}
          {filterBtn(
            processFilter === 'Access Management',
            () => setProcessFilter('Access Management'),
            'Access Management (02.05)'
          )}
          {filterBtn(
            processFilter === 'Change Management',
            () => setProcessFilter('Change Management'),
            'Change Management (01.04)'
          )}
        </div>

        <div className="table-actions-group">
          <ModusWcTextInput
            size="sm"
            bordered
            includeSearch
            includeClear
            type="search"
            placeholder="Search application, control, owner, ticket..."
            value={search}
            aria-label="Search control sheet"
            customClass="matrix-search-input"
            onInputChange={(e) => setSearch(readInputString(e))}
          />

          <ModusWcButton
            color="tertiary"
            variant="outlined"
            size="sm"
            onButtonClick={handleExportCSV}
            title="Download CSV report"
          >
            <ModusWcIcon name="download" size="sm" decorative />
            Export CSV
          </ModusWcButton>
        </div>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>Status</th>
              <th>Application</th>
              <th>Control ID</th>
              <th>Sub-Process</th>
              <th>Control Title</th>
              <th>Control Owner</th>
              <th>Ticket Number</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan="7" className="table-empty-cell">
                  No controls match the selected filters or search query.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className={item.isCompleted ? 'row-completed' : ''}
                >
                  <td>
                    {item.isCompleted ? (
                      <span title="Ticket Verified in Control Sheet">
                        <ModusWcIcon name="check_circle" size="sm" decorative />
                      </span>
                    ) : (
                      <span title="Ticket Missing">
                        <ModusWcIcon name="warning" size="sm" decorative />
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="cell-app-name">{item['Application Name']}</span>
                  </td>
                  <td>
                    <span className="cell-control-id">{item['Control ID']}</span>
                  </td>
                  <td>
                    <span
                      className={
                        item['Sub-Process'] === 'Access Management'
                          ? 'subprocess-access'
                          : 'subprocess-change'
                      }
                    >
                      {item['Sub-Process']}
                    </span>
                  </td>
                  <td className="cell-title" title={item['Control Title']}>
                    <div className="cell-title-text">{item['Control Title']}</div>
                  </td>
                  <td>
                    <span className="cell-owner-tag">{item['Control Owner']}</span>
                  </td>
                  <td>
                    {item['TICKET NUMBER'] ? (
                      <ModusWcBadge color="primary" size="sm" variant="filled">
                        {item['TICKET NUMBER']}
                      </ModusWcBadge>
                    ) : (
                      <ModusWcBadge color="danger" size="sm" variant="outlined">
                        Missing Ticket
                      </ModusWcBadge>
                    )}
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
