import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ModusWcButton,
  ModusWcIcon,
  ModusWcTextInput,
} from '@trimble-oss/moduswebcomponents-react';
import { readInputString } from '../utils/modusFormEvents';
import {
  STAGGER_CAP,
  chipPop,
  staggerContainer,
  staggerItem,
} from '../motion/presets';
import StatusChip from './StatusChip';

export default function ControlSheetTable({ items, showToast, onSelectControl }) {
  const reduceMotion = useReducedMotion();
  const searchRef = useRef(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [processFilter, setProcessFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  const completedCount = items.filter((i) => i.isCompleted).length;
  const pendingCount = items.length - completedCount;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) {
        return;
      }
      e.preventDefault();
      const host = searchRef.current;
      const input =
        host?.querySelector?.('input') ||
        host?.shadowRoot?.querySelector?.('input');
      input?.focus?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === 'completed' && !item.isCompleted) return false;
      if (statusFilter === 'pending' && item.isCompleted) return false;
      if (processFilter !== 'all' && item['Sub-Process'] !== processFilter) {
        return false;
      }

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

  const filters = [
    { id: 'all', label: `All (${items.length})`, active: statusFilter === 'all', on: () => setStatusFilter('all') },
    {
      id: 'completed',
      label: `Ticketed (${completedCount})`,
      active: statusFilter === 'completed',
      on: () => setStatusFilter('completed'),
    },
    {
      id: 'pending',
      label: `Pending (${pendingCount})`,
      active: statusFilter === 'pending',
      on: () => setStatusFilter('pending'),
    },
  ];

  const listVariants = staggerContainer(reduceMotion);
  const pop = chipPop(reduceMotion);

  return (
    <div className="table-section-card">
      <div className="table-controls-bar">
        <div className="table-controls-heading">
          <h2>Control sheet matrix</h2>
          <p>
            {filteredItems.length} of {items.length} controls shown · press{' '}
            <kbd>/</kbd> to search
          </p>
        </div>
        <div className="table-filters-group">
          <AnimatePresence mode="popLayout" initial={false}>
            {filters.map((f) => (
              <motion.span key={f.id} layout {...pop}>
                <ModusWcButton
                  color={f.active ? 'primary' : 'tertiary'}
                  variant={f.active ? 'filled' : 'outlined'}
                  size="sm"
                  onButtonClick={f.on}
                >
                  {f.label}
                </ModusWcButton>
              </motion.span>
            ))}
          </AnimatePresence>

          <span className="filter-divider" aria-hidden="true">
            |
          </span>

          <ModusWcButton
            color={processFilter === 'all' ? 'primary' : 'tertiary'}
            variant={processFilter === 'all' ? 'filled' : 'outlined'}
            size="sm"
            onButtonClick={() => setProcessFilter('all')}
          >
            All processes
          </ModusWcButton>
          <ModusWcButton
            color={processFilter === 'Access Management' ? 'primary' : 'tertiary'}
            variant={processFilter === 'Access Management' ? 'filled' : 'outlined'}
            size="sm"
            onButtonClick={() => setProcessFilter('Access Management')}
          >
            Access (02.05)
          </ModusWcButton>
          <ModusWcButton
            color={processFilter === 'Change Management' ? 'primary' : 'tertiary'}
            variant={processFilter === 'Change Management' ? 'filled' : 'outlined'}
            size="sm"
            onButtonClick={() => setProcessFilter('Change Management')}
          >
            Change (01.04)
          </ModusWcButton>
        </div>

        <div className="table-actions-group">
          <span ref={searchRef}>
            <ModusWcTextInput
              size="sm"
              bordered
              includeSearch
              includeClear
              type="search"
              placeholder="Search application, control, owner, ticket…"
              value={search}
              aria-label="Search control sheet"
              customClass="matrix-search-input"
              onInputChange={(e) => setSearch(readInputString(e))}
            />
          </span>

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
              <th style={{ width: '7.5rem' }}>Status</th>
              <th>Application</th>
              <th>Control ID</th>
              <th>Sub-Process</th>
              <th>Control Title</th>
              <th>Control Owner</th>
              <th>Ticket Number</th>
            </tr>
          </thead>
          <motion.tbody
            variants={listVariants}
            initial="hidden"
            animate="show"
            key={`${statusFilter}-${processFilter}-${search}`}
          >
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan="7" className="table-empty-cell">
                  No controls match the selected filters or search query.
                </td>
              </tr>
            ) : (
              filteredItems.map((item, index) => {
                const id = item.id || item['Control ID'];
                const itemMotion = staggerItem(reduceMotion, index);
                return (
                  <motion.tr
                    key={id}
                    variants={itemMotion}
                    className={`data-row${item.isCompleted ? ' row-completed' : ''}${
                      selectedId === id ? ' is-selected' : ''
                    }`}
                    tabIndex={0}
                    onClick={() => {
                      setSelectedId(id);
                      onSelectControl?.(item);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(id);
                        onSelectControl?.(item);
                      }
                    }}
                    style={
                      index >= STAGGER_CAP
                        ? undefined
                        : { willChange: 'transform, opacity' }
                    }
                  >
                    <td>
                      <StatusChip
                        tone={item.isCompleted ? 'ok' : 'warn'}
                        label={item.isCompleted ? 'Ticketed' : 'Missing ticket'}
                        compact
                      />
                    </td>
                    <td>
                      <span className="cell-app-name">
                        {item['Application Name']}
                      </span>
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
                        <StatusChip
                          tone="info"
                          label={item['TICKET NUMBER']}
                          compact
                        />
                      ) : (
                        <StatusChip tone="warn" label="Missing" compact />
                      )}
                    </td>
                  </motion.tr>
                );
              })
            )}
          </motion.tbody>
        </table>
      </div>
    </div>
  );
}
