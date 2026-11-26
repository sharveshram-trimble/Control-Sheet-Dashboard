import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ModusWcButton,
  ModusWcCard,
  ModusWcChip,
  ModusWcEmptyState,
  ModusWcIcon,
  ModusWcTable,
  ModusWcTextInput,
  ModusWcTypography,
} from '@trimble-oss/moduswebcomponents-react';
import { readInputString } from '../utils/modusFormEvents';
import { createStatusBadgeElement } from '../utils/statusTones';

const PROCESS_FILTERS = [
  { id: 'all', label: 'All processes' },
  { id: 'Access Management', label: 'Access (02.05)' },
  { id: 'Change Management', label: 'Change (01.04)' },
];

const MUTED = 'text-(--modus-wc-color-base-content-low-contrast)';

const controlId = (item) => String(item.id ?? item['Control ID'] ?? '');

export default function ControlSheetTable({ items, showToast, onSelectControl }) {
  const searchRef = useRef(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [processFilter, setProcessFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  const completedCount = items.filter((i) => i.isCompleted).length;
  const pendingCount = items.length - completedCount;

  // "/" focuses the search field (unless the user is already typing somewhere).
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

  const filtersActive =
    statusFilter !== 'all' || processFilter !== 'all' || search.trim() !== '';
  const isEmpty = filteredItems.length === 0;

  const clearFilters = useCallback(() => {
    setStatusFilter('all');
    setProcessFilter('all');
    setSearch('');
  }, []);

  // Flat, dot-free keys so sorting and cell renderers never depend on the sheet's column names.
  const rows = useMemo(
    () =>
      filteredItems.map((item) => ({
        id: controlId(item),
        status: item.isCompleted ? 'Ticketed' : 'Missing ticket',
        application: item['Application Name'] || '',
        controlId: item['Control ID'] || '',
        subProcess: item['Sub-Process'] || '',
        title: item['Control Title'] || '',
        owner: item['Control Owner'] || '',
        ticket: item['TICKET NUMBER'] || '',
      })),
    [filteredItems]
  );

  // The table hands back the row it was given; resolve the full control from the id so
  // onSelectControl always receives the original item.
  const itemsById = useRef(new Map());
  const onSelectRef = useRef(onSelectControl);
  useEffect(() => {
    itemsById.current = new Map(items.map((item) => [controlId(item), item]));
    onSelectRef.current = onSelectControl;
  }, [items, onSelectControl]);

  const openControl = useCallback((id) => {
    const item = itemsById.current.get(String(id));
    if (!item) return;
    setSelectedId(String(id));
    onSelectRef.current?.(item);
  }, []);

  // Rows aren't keyboard-reachable, so each row gets a named Open button that does what a
  // row click does.
  const columns = useMemo(
    () => [
      {
        id: 'status',
        header: 'Status',
        accessor: 'status',
        width: '10rem',
        sortable: true,
        cellRenderer: (value) =>
          createStatusBadgeElement(value === 'Ticketed' ? 'ok' : 'warn', value),
      },
      { id: 'application', header: 'Application', accessor: 'application', sortable: true },
      { id: 'controlId', header: 'Control ID', accessor: 'controlId', sortable: true },
      { id: 'subProcess', header: 'Sub-process', accessor: 'subProcess', sortable: true },
      { id: 'title', header: 'Control title', accessor: 'title', sortable: true },
      { id: 'owner', header: 'Control owner', accessor: 'owner', sortable: true },
      {
        id: 'ticket',
        header: 'Ticket number',
        accessor: 'ticket',
        sortable: true,
        cellRenderer: (value) =>
          value ? String(value) : createStatusBadgeElement('warn', 'Missing'),
      },
      {
        id: 'actions',
        header: 'Actions',
        accessor: 'id',
        width: '7rem',
        sortable: false,
        cellRenderer: (value, row) => {
          const button = document.createElement('modus-wc-button');
          button.color = 'tertiary';
          button.variant = 'outlined';
          button.size = 'sm';
          button.buttonAriaLabel = `Open ${row?.controlId || value}`;
          button.textContent = 'Open';
          // Keep the click from also reaching the row (the table would open the control twice).
          button.addEventListener('click', (e) => e.stopPropagation());
          button.addEventListener('buttonClick', () => openControl(value));
          return button;
        },
      },
    ],
    [openControl]
  );

  const handleRowClick = useCallback(
    (e) => {
      const id = e.detail?.row?.id;
      if (id != null) openControl(id);
    },
    [openControl]
  );

  const handleSelectionChange = useCallback((e) => {
    const ids = e.detail?.selectedRowIds ?? [];
    setSelectedId(ids.length ? String(ids[0]) : null);
  }, []);

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

    const rowsCsv = filteredItems.map((i) => [
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
      [headers.join(','), ...rowsCsv.map((e) => e.join(','))].join('\n');
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

  const statusFilters = [
    { id: 'all', label: `All (${items.length})` },
    { id: 'completed', label: `Ticketed (${completedCount})` },
    { id: 'pending', label: `Pending (${pendingCount})` },
  ];

  return (
    <ModusWcCard bordered padding="compact">
      <div slot="title" className="mb-4 flex w-full min-w-0 items-center justify-start gap-2">
        <ModusWcIcon name="clipboard-check" version="2.0" decorative />
        <ModusWcTypography
          hierarchy="h2"
          size="lg"
          weight="semibold"
          label="Control sheet matrix"
        />
      </div>

      {/* One stable body wrapper: empty state and table are both mounted and toggled with `hidden`. */}
      <div className="flex min-w-0 flex-col gap-3">
        <ModusWcTypography
          hierarchy="p"
          size="sm"
          customClass={MUTED}
          label={`${filteredItems.length} of ${items.length} controls shown. Press / to search.`}
        />

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div ref={searchRef} className="w-full min-w-0 sm:w-80">
            <ModusWcTextInput
              size="sm"
              bordered
              includeSearch
              includeClear
              type="search"
              placeholder="Search application, control, owner, ticket…"
              value={search}
              aria-label="Search control sheet"
              onInputChange={(e) => setSearch(readInputString(e))}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ticket status filter">
            {statusFilters.map((f) => (
              <ModusWcChip
                key={f.id}
                size="sm"
                variant={statusFilter === f.id ? 'filled' : 'outline'}
                active={statusFilter === f.id}
                label={f.label}
                onChipClick={() => setStatusFilter(f.id)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sub-process filter">
            {PROCESS_FILTERS.map((f) => (
              <ModusWcChip
                key={f.id}
                size="sm"
                variant={processFilter === f.id ? 'filled' : 'outline'}
                active={processFilter === f.id}
                label={f.label}
                onChipClick={() => setProcessFilter(f.id)}
              />
            ))}
          </div>

          <div hidden={!filtersActive}>
            <ModusWcButton
              size="sm"
              color="tertiary"
              variant="borderless"
              onButtonClick={clearFilters}
            >
              <span>Clear filters</span>
            </ModusWcButton>
          </div>
        </div>

        <div className="min-w-0 overflow-x-auto" hidden={isEmpty}>
          <ModusWcTable
            caption="Control sheet matrix"
            columns={columns}
            data={rows}
            density="comfortable"
            zebra
            hover
            sortable
            selectable="single"
            selectedRowIds={selectedId ? [selectedId] : []}
            onRowClick={handleRowClick}
            onRowSelectionChange={handleSelectionChange}
          />
        </div>

        <div hidden={!isEmpty}>
          <ModusWcEmptyState
            variant="compact"
            illustration="selection_plus"
            heading="No controls found"
            subtitle="Try a different search or clear the filters."
            actionLabel="Clear filters"
            onActionClick={clearFilters}
          />
        </div>
      </div>

      <div slot="actions" className="modus-wc-justify-end flex w-full flex-wrap gap-2">
        <ModusWcButton
          size="sm"
          color="tertiary"
          variant="outlined"
          disabled={isEmpty}
          onButtonClick={handleExportCSV}
        >
          <ModusWcIcon name="download-simple" version="2.0" size="xs" decorative />
          Export CSV
        </ModusWcButton>
      </div>
    </ModusWcCard>
  );
}
