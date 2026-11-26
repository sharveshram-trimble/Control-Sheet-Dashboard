import React, { useCallback, useMemo, useState } from 'react';
import {
  ModusWcAvatar,
  ModusWcBadge,
  ModusWcButton,
  ModusWcCard,
  ModusWcChip,
  ModusWcEmptyState,
  ModusWcIcon,
  ModusWcProgress,
  ModusWcSelect,
  ModusWcTextInput,
  ModusWcTypography,
} from '@trimble-oss/moduswebcomponents-react';
import { readInputString } from '../utils/modusFormEvents';
import { resolveStatusTone } from '../utils/statusTones';

const SORT_OPTIONS = [
  { label: 'Open tickets first', value: 'open' },
  { label: 'Least covered first', value: 'coverage-asc' },
  { label: 'Most covered first', value: 'coverage-desc' },
  { label: 'Most controls', value: 'controls' },
  { label: 'Name A–Z', value: 'name' },
];

const MUTED = 'text-(--modus-wc-color-base-content-low-contrast)';
const TITLE_ROW = 'mb-4 flex w-full min-w-0 items-center justify-between gap-3';
const TILE_CARD = 'box-border flex h-full min-h-0 w-full flex-col';

function ownerState(owner) {
  if (owner.pendingControlsCount === 0) {
    return { key: 'done', tone: 'ok', label: 'Complete' };
  }
  if (owner.completedControlsCount > 0) {
    return { key: 'partial', tone: 'info', label: 'In progress' };
  }
  return { key: 'pending', tone: 'pending', label: 'Not started' };
}

function appState(item) {
  if (item.completed === item.total) return { tone: 'ok', label: 'Complete' };
  if (item.completed > 0) return { tone: 'info', label: 'In progress' };
  return { tone: 'pending', label: 'Not started' };
}

function coverage(owner) {
  return owner.totalControls > 0
    ? owner.completedControlsCount / owner.totalControls
    : 0;
}

function sortOwners(list, sortBy) {
  const next = [...list];
  switch (sortBy) {
    case 'name':
      return next.sort((a, b) => a.name.localeCompare(b.name));
    case 'controls':
      return next.sort(
        (a, b) =>
          b.totalControls - a.totalControls || a.name.localeCompare(b.name)
      );
    case 'coverage-asc':
      return next.sort(
        (a, b) =>
          coverage(a) - coverage(b) ||
          b.pendingControlsCount - a.pendingControlsCount ||
          a.name.localeCompare(b.name)
      );
    case 'coverage-desc':
      return next.sort(
        (a, b) =>
          coverage(b) - coverage(a) ||
          a.pendingControlsCount - b.pendingControlsCount ||
          a.name.localeCompare(b.name)
      );
    case 'open':
    default:
      return next.sort(
        (a, b) =>
          b.pendingControlsCount - a.pendingControlsCount ||
          b.totalControls - a.totalControls ||
          a.name.localeCompare(b.name)
      );
  }
}

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

/** Status = icon + visible label + color. */
function StatusBadge({ tone, label }) {
  const meta = resolveStatusTone(tone);
  return (
    <ModusWcBadge className="status-badge" color={meta.color} size="sm">
      <ModusWcIcon
        name={meta.icon}
        version="2.0"
        size="xs"
        decorative
        customClass="me-1"
      />
      <span>{label || meta.label}</span>
    </ModusWcBadge>
  );
}

function CardTitle({ icon, title, trailing }) {
  return (
    <div slot="title" className={TITLE_ROW}>
      <div className="flex min-w-0 items-center gap-2">
        <ModusWcIcon name={icon} version="2.0" decorative />
        <ModusWcTypography
          hierarchy="h2"
          size="lg"
          weight="semibold"
          label={title}
        />
      </div>
      <ModusWcBadge color="default" size="sm">
        <span>{trailing}</span>
      </ModusWcBadge>
    </div>
  );
}

export default function ProcessAnalytics({ items, stats: _stats, ownerStats }) {
  const [ownerSearch, setOwnerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('open');

  const accessControls = items.filter((i) => i['Sub-Process'] === 'Access Management');
  const changeControls = items.filter((i) => i['Sub-Process'] === 'Change Management');

  const accessCompleted = accessControls.filter((i) => i.isCompleted).length;
  const changeCompleted = changeControls.filter((i) => i.isCompleted).length;

  const subprocesses = [
    {
      id: 'access',
      kicker: '02.05',
      title: 'Access management',
      completed: accessCompleted,
      total: accessControls.length,
      description:
        'Periodic system access reviews across financial and infrastructure applications.',
    },
    {
      id: 'change',
      kicker: '01.04',
      title: 'Change management',
      completed: changeCompleted,
      total: changeControls.length,
      description:
        'Monitoring and approvals of system changes deployed into production environments.',
    },
  ];

  const appMap = {};
  items.forEach((i) => {
    const app = i['Application Name'] || 'Other';
    if (!appMap[app]) appMap[app] = { total: 0, completed: 0 };
    appMap[app].total += 1;
    if (i.isCompleted) appMap[app].completed += 1;
  });

  const appList = Object.entries(appMap)
    .map(([app, data]) => ({ app, ...data }))
    .sort(
      (a, b) =>
        a.completed / a.total - b.completed / b.total ||
        b.total - a.total ||
        a.app.localeCompare(b.app)
    );

  const statusCounts = useMemo(() => {
    const counts = { all: ownerStats.length, done: 0, partial: 0, pending: 0 };
    ownerStats.forEach((o) => {
      counts[ownerState(o).key] += 1;
    });
    return counts;
  }, [ownerStats]);

  const filteredOwners = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase();
    const matched = ownerStats.filter((o) => {
      const state = ownerState(o);
      if (statusFilter !== 'all' && state.key !== statusFilter) return false;
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        o.apps.some((a) => a.toLowerCase().includes(q))
      );
    });
    return sortOwners(matched, sortBy);
  }, [ownerStats, ownerSearch, statusFilter, sortBy]);

  const clearFilters = useCallback(() => {
    setStatusFilter('all');
    setOwnerSearch('');
  }, []);

  const filtersActive = statusFilter !== 'all' || ownerSearch.trim() !== '';
  const ownersEmpty = filteredOwners.length === 0;

  const statusFilters = [
    { id: 'all', label: 'All', count: statusCounts.all },
    { id: 'pending', label: 'Not started', count: statusCounts.pending },
    { id: 'partial', label: 'In progress', count: statusCounts.partial },
    { id: 'done', label: 'Complete', count: statusCounts.done },
  ];

  const ownerCount =
    filteredOwners.length !== ownerStats.length
      ? `${filteredOwners.length} of ${ownerStats.length}`
      : String(filteredOwners.length);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* Owner progress */}
      <ModusWcCard bordered padding="compact">
        <CardTitle icon="users-three" title="Owner progress" trailing={ownerCount} />

        <div className="flex min-w-0 flex-col gap-3">
          <ModusWcTypography
            hierarchy="p"
            size="sm"
            customClass={MUTED}
            label="Filter by status, sort the grid, search owner or application."
          />

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Owner status filter"
            >
              {statusFilters.map((f) => (
                <ModusWcChip
                  key={f.id}
                  size="sm"
                  variant={statusFilter === f.id ? 'filled' : 'outline'}
                  active={statusFilter === f.id}
                  label={`${f.label} (${f.count})`}
                  onChipClick={() => setStatusFilter(f.id)}
                />
              ))}
            </div>

            <div className="min-w-0 sm:w-56">
              <ModusWcSelect
                size="sm"
                bordered
                label=""
                aria-label="Sort owners"
                value={sortBy}
                options={SORT_OPTIONS}
                onInputChange={(e) => setSortBy(readInputString(e) || 'open')}
              />
            </div>

            <div className="w-full min-w-0 sm:w-72">
              <ModusWcTextInput
                size="sm"
                bordered
                includeSearch
                includeClear
                type="search"
                placeholder="Search owner or application…"
                value={ownerSearch}
                aria-label="Search owners"
                onInputChange={(e) => setOwnerSearch(readInputString(e))}
              />
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

          {/* Both branches stay mounted; `hidden` toggles them (no root swaps inside the card). */}
          <div hidden={!ownersEmpty}>
            <ModusWcEmptyState
              variant="compact"
              illustration="add_user"
              heading="No owners found"
              subtitle="No owners match this filter or search."
              actionLabel="Clear filters"
              onActionClick={clearFilters}
            />
          </div>

          <div
            className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3"
            hidden={ownersEmpty}
          >
            {filteredOwners.map((owner) => {
              const state = ownerState(owner);
              const ticketed = owner.completedControlsCount;
              const total = owner.totalControls;

              return (
                <div key={owner.name} className="h-full min-h-0 min-w-0">
                  <ModusWcCard
                    bordered={false}
                    padding="compact"
                    className={TILE_CARD}
                    customClass={TILE_CARD}
                  >
                    <div
                      slot="title"
                      className="mb-2 flex w-full min-w-0 items-center justify-between gap-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <ModusWcAvatar
                          size="sm"
                          imgSrc=""
                          alt={owner.name}
                          initials={getInitials(owner.name)}
                        />
                        <div className="min-w-0">
                          <ModusWcTypography
                            hierarchy="h3"
                            size="md"
                            weight="semibold"
                            label={owner.name}
                          />
                          <ModusWcTypography
                            hierarchy="p"
                            size="xs"
                            customClass={`${MUTED} truncate`}
                            label={owner.apps.join(', ')}
                          />
                        </div>
                      </div>
                      <StatusBadge tone={state.tone} label={state.label} />
                    </div>

                    <div className="flex min-w-0 flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <ModusWcTypography
                          hierarchy="p"
                          size="sm"
                          customClass="tabular-nums"
                          label={`${ticketed} of ${total} ticketed`}
                        />
                        <ModusWcTypography
                          hierarchy="p"
                          size="sm"
                          customClass={MUTED}
                          label={
                            owner.pendingControlsCount > 0
                              ? `${owner.pendingControlsCount} open`
                              : 'All clear'
                          }
                        />
                      </div>
                      <ModusWcProgress
                        value={ticketed}
                        max={total > 0 ? total : 1}
                        aria-label={`${ticketed} of ${total} controls ticketed for ${owner.name}`}
                      />

                      <ul className="surface-list m-0 flex flex-col gap-1 p-0">
                        {owner.controls.map((c) => (
                          <li
                            key={c.id}
                            className="flex min-w-0 items-center justify-between gap-2"
                          >
                            <ModusWcTypography
                              hierarchy="p"
                              size="sm"
                              weight="semibold"
                              customClass="tabular-nums"
                              label={c['Control ID']}
                            />
                            {c.isCompleted ? (
                              <ModusWcTypography
                                hierarchy="p"
                                size="sm"
                                customClass={MUTED}
                                label={c['TICKET NUMBER'] || 'Ticketed'}
                              />
                            ) : (
                              <StatusBadge tone="warn" label="Missing ticket" />
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </ModusWcCard>
                </div>
              );
            })}
          </div>
        </div>
      </ModusWcCard>

      {/* Sub-process coverage (peer tiles) */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {subprocesses.map((sp) => (
          <div key={sp.id} className="h-full min-h-0 min-w-0">
            <ModusWcCard
              bordered
              padding="compact"
              className={TILE_CARD}
              customClass={TILE_CARD}
            >
              <CardTitle icon="folder" title={sp.title} trailing={sp.kicker} />
              <div className="flex min-w-0 flex-col gap-2">
                <ModusWcTypography
                  hierarchy="p"
                  size="sm"
                  customClass="tabular-nums"
                  label={`${sp.completed} of ${sp.total} ticketed`}
                />
                <ModusWcProgress
                  value={sp.completed}
                  max={sp.total > 0 ? sp.total : 1}
                  aria-label={`${sp.completed} of ${sp.total} ${sp.title} controls ticketed`}
                />
                <ModusWcTypography
                  hierarchy="p"
                  size="sm"
                  customClass={MUTED}
                  label={sp.description}
                />
              </div>
            </ModusWcCard>
          </div>
        ))}
      </div>

      {/* Applications */}
      <ModusWcCard bordered padding="compact">
        <CardTitle
          icon="squares-four"
          title="Applications"
          trailing={String(appList.length)}
        />

        <div className="flex min-w-0 flex-col gap-3">
          <ModusWcTypography
            hierarchy="p"
            size="sm"
            customClass={MUTED}
            label="Ticket coverage by application, least covered first."
          />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {appList.map((item) => {
              const state = appState(item);
              return (
                <div key={item.app} className="h-full min-h-0 min-w-0">
                  <ModusWcCard
                    bordered={false}
                    padding="compact"
                    className={TILE_CARD}
                    customClass={TILE_CARD}
                  >
                    <div
                      slot="title"
                      className="mb-2 flex w-full min-w-0 items-center justify-between gap-2"
                    >
                      <ModusWcTypography
                        hierarchy="h3"
                        size="md"
                        weight="semibold"
                        label={item.app}
                      />
                      <StatusBadge tone={state.tone} label={state.label} />
                    </div>
                    <div className="flex min-w-0 flex-col gap-2">
                      <ModusWcTypography
                        hierarchy="p"
                        size="sm"
                        customClass="tabular-nums"
                        label={`${item.completed}/${item.total} controls`}
                      />
                      <ModusWcProgress
                        value={item.completed}
                        max={item.total > 0 ? item.total : 1}
                        aria-label={`${item.completed} of ${item.total} controls ticketed for ${item.app}`}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <ModusWcTypography
                          hierarchy="p"
                          size="xs"
                          customClass={MUTED}
                          label={`${item.completed} ticketed`}
                        />
                        <ModusWcTypography
                          hierarchy="p"
                          size="xs"
                          customClass={MUTED}
                          label={`${item.total - item.completed} pending`}
                        />
                      </div>
                    </div>
                  </ModusWcCard>
                </div>
              );
            })}
          </div>
        </div>
      </ModusWcCard>
    </div>
  );
}
