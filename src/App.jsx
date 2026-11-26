import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ModusWcAlert, ModusWcToast } from '@trimble-oss/moduswebcomponents-react';
import Header from './components/Header';
import HeroProgress from './components/HeroProgress';
import TwoColumnOwners from './components/TwoColumnOwners';
import ControlSheetTable from './components/ControlSheetTable';
import ProcessAnalytics from './components/ProcessAnalytics';
import ChecklistView from './components/ChecklistView';
import DetailModal from './components/DetailModal';
import SurfaceSkeleton from './components/SurfaceSkeleton';
import { initialWorkflowData } from './data/initialData';

const isUiPreview =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('uiPreview');

const TOAST_META = {
  success: { variant: 'success', title: 'Success' },
  warning: { variant: 'warning', title: 'Notice' },
  error: { variant: 'error', title: 'Error' },
  info: { variant: 'info', title: 'Info' },
};

export default function App() {
  // Empty until the n8n production webhook responds (no executions-API bootstrap).
  // DEV ?uiPreview=1 seeds sample rows so UI surfaces can be reviewed offline.
  const [items, setItems] = useState(() =>
    isUiPreview ? initialWorkflowData : []
  );
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedControl, setSelectedControl] = useState(null);
  const [checklistFocusControl, setChecklistFocusControl] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [syncState, setSyncState] = useState(isUiPreview ? 'ready' : 'loading');
  const [lastSyncedAt, setLastSyncedAt] = useState(() =>
    isUiPreview ? new Date() : null
  );
  const [syncError, setSyncError] = useState(null);
  const syncInFlightRef = useRef(false);
  const itemsLengthRef = useRef(items.length);

  useEffect(() => {
    itemsLengthRef.current = items.length;
  }, [items.length]);

  const handleRunChecklist = useCallback((control) => {
    setChecklistFocusControl(control);
    setActiveTab('checklist');
  }, []);

  const handleChecklistFocusHandled = useCallback(() => {
    setChecklistFocusControl(null);
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const handleChecklistResult = useCallback(
    ({ controlId, status, targetSheetUrl, summary }) => {
      if (!controlId || !status) return;
      setItems((prev) =>
        prev.map((row) => {
          const id = row.id || row['Control ID'];
          if (id !== controlId) return row;
          return {
            ...row,
            OUTPUT: status,
            ...(targetSheetUrl
              ? {
                  'TARGET SHEET': targetSheetUrl,
                  'Target Sheet': targetSheetUrl,
                }
              : {}),
          };
        })
      );
      showToast(
        status === 'success'
          ? `Checklist Success${summary ? ` — ${summary}` : ''}`
          : `Checklist Failed${summary ? ` — ${summary}` : ''}`,
        status === 'success' ? 'success' : 'error'
      );
    },
    [showToast]
  );

  const fetchLiveData = useCallback(
    async (isManual = false) => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      setSyncState((prev) => (prev === 'ready' && !isManual ? prev : 'loading'));
      setSyncError(null);
      try {
        const res = await fetch('/api/live-data');
        const json = await res.json().catch(() => null);

        if (res.ok && json?.data?.length > 0) {
          // Keep local Assist results (OUTPUT / resolved TARGET SHEET) across webhook refreshes.
          setItems((prev) => {
            const priorById = new Map(
              prev.map((row) => [row.id || row['Control ID'], row])
            );
            return json.data.map((row) => {
              const prior = priorById.get(row.id || row['Control ID']);
              if (!prior) return row;
              return {
                ...row,
                ...(prior.OUTPUT ? { OUTPUT: prior.OUTPUT } : {}),
                ...(prior['TARGET SHEET'] || prior['Target Sheet']
                  ? {
                      'TARGET SHEET':
                        prior['TARGET SHEET'] || prior['Target Sheet'],
                      'Target Sheet':
                        prior['TARGET SHEET'] || prior['Target Sheet'],
                    }
                  : {}),
              };
            });
          });
          setSyncState('ready');
          setLastSyncedAt(new Date());
          setSyncError(null);

          if (isManual) {
            const completed =
              json.completedCount ??
              json.data.filter((it) => it.isCompleted).length;
            const source = json.source || 'unknown';

            if (json.live && source === 'n8n_webhook_production') {
              showToast(
                `Synced ${json.data.length} controls (${completed} with ticket)`,
                'success'
              );
            } else if (
              source === 'cached_snapshot' ||
              source === 'bundled_initial_data'
            ) {
              showToast(
                json.message ||
                  'Webhook unavailable — using offline snapshot',
                'warning'
              );
            } else {
              showToast(
                json.message ||
                  `Synced ${json.data.length} controls from ${source}`,
                json.live ? 'success' : 'warning'
              );
            }
          }
          return;
        }

        const message =
          json?.message ||
          json?.error ||
          (!res.ok
            ? 'Sync failed (no data sources available)'
            : 'No rows returned from sync');
        setSyncState(itemsLengthRef.current ? 'ready' : 'error');
        setSyncError(message);
        if (isManual) {
          showToast(message, res.ok ? 'warning' : 'error');
        } else if (!res.ok) {
          console.warn('[Live Sync] Auto-refresh failed:', message);
        }
      } catch (err) {
        console.warn('Live fetch error:', err.message);
        const message = 'Live endpoint unreachable — keeping current data';
        setSyncState(itemsLengthRef.current ? 'ready' : 'error');
        setSyncError(err.message || message);
        if (isManual) {
          showToast(message, 'error');
        }
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchLiveData(false);
  }, [fetchLiveData]);

  // Background sync every 30s (header refresh controls replaced by Checklist tab)
  useEffect(() => {
    const timer = setInterval(() => {
      fetchLiveData(false);
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchLiveData]);

  const { stats, ownerStats } = useMemo(() => {
    const totalControls = items.length;
    const completedControls = items.filter((i) => i.isCompleted).length;
    const pendingControls = totalControls - completedControls;
    const completionPercentage =
      totalControls > 0
        ? Number(((completedControls / totalControls) * 100).toFixed(1))
        : 0;

    const ownersMap = {};
    items.forEach((item) => {
      const rawOwner = item['Control Owner'] || 'Unassigned';
      const cleanOwner = rawOwner.replace(/\u200b/g, '').trim();

      if (!ownersMap[cleanOwner]) {
        ownersMap[cleanOwner] = {
          name: cleanOwner,
          totalControls: 0,
          completedControlsCount: 0,
          pendingControlsCount: 0,
          apps: new Set(),
          controls: [],
        };
      }

      ownersMap[cleanOwner].totalControls += 1;
      if (item.isCompleted) {
        ownersMap[cleanOwner].completedControlsCount += 1;
      } else {
        ownersMap[cleanOwner].pendingControlsCount += 1;
      }

      if (item['Application Name']) {
        ownersMap[cleanOwner].apps.add(
          item['Application Name'].replace(/\u200b/g, '').trim()
        );
      }
      ownersMap[cleanOwner].controls.push(item);
    });

    const ownerList = Object.values(ownersMap).map((o) => ({
      ...o,
      apps: Array.from(o.apps),
      completionPercentage:
        o.totalControls > 0
          ? Number(((o.completedControlsCount / o.totalControls) * 100).toFixed(1))
          : 0,
    }));

    const completedOwnersList = ownerList
      .filter((o) => o.completedControlsCount > 0)
      .sort(
        (a, b) =>
          b.completedControlsCount - a.completedControlsCount ||
          a.name.localeCompare(b.name)
      );

    const pendingOwnersList = ownerList
      .filter((o) => o.pendingControlsCount > 0)
      .sort(
        (a, b) =>
          b.pendingControlsCount - a.pendingControlsCount ||
          a.name.localeCompare(b.name)
      );

    return {
      stats: {
        totalControls,
        completedControls,
        pendingControls,
        completionPercentage,
        totalOwners: ownerList.length,
        completedOwnersCount: completedOwnersList.length,
        pendingOwnersCount: pendingOwnersList.length,
      },
      ownerStats: ownerList,
    };
  }, [items]);

  const showSkeleton = !isUiPreview && items.length === 0 && syncState === 'loading';
  const showSyncError =
    !isUiPreview && items.length === 0 && syncState === 'error';

  return (
    <div className="app-container">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        syncState={syncState}
        lastSyncedAt={lastSyncedAt}
        syncError={syncError}
        onRetrySync={() => fetchLiveData(true)}
      />

      <main className="main-content">
        {showSkeleton ? (
          <SurfaceSkeleton />
        ) : showSyncError ? (
          <div className="surface-error" role="alert">
            <h2>Control sheet unavailable</h2>
            <p>{syncError || 'Could not load live controls.'}</p>
            <button
              type="button"
              className="surface-error-retry"
              onClick={() => fetchLiveData(true)}
            >
              Retry sync
            </button>
          </div>
        ) : (
          <>
            <HeroProgress stats={stats} />

            <div key={activeTab} className="tab-panel motion-enter">
              {activeTab === 'overview' && (
                <TwoColumnOwners
                  ownerStats={ownerStats}
                  onSelectControl={setSelectedControl}
                  onRunChecklist={handleRunChecklist}
                  showToast={showToast}
                  onSendIncompleteMail={async (payload) => {
                    try {
                      const res = await fetch('/api/send-incomplete-mail', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                      });
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok || json.success === false) {
                        showToast(
                          json.message ||
                            json.error ||
                            'Failed to send reminder email',
                          'error'
                        );
                        return;
                      }
                      const kind =
                        payload.mailType === 'follow_up'
                          ? 'Follow-up'
                          : payload.mailType === 'draft'
                            ? 'Draft'
                            : 'Reminder';
                      showToast(
                        json.message ||
                          `${kind} mail queued for ${payload.ownerName} (${payload.incompleteCount} controls)`,
                        'success'
                      );
                    } catch (err) {
                      showToast(
                        err.message || 'Failed to reach mail workflow',
                        'error'
                      );
                    }
                  }}
                />
              )}

              {activeTab === 'matrix' && (
                <ControlSheetTable
                  items={items}
                  onSelectControl={setSelectedControl}
                  showToast={showToast}
                />
              )}

              {activeTab === 'progress' && (
                <ProcessAnalytics
                  items={items}
                  stats={stats}
                  ownerStats={ownerStats}
                />
              )}

              {activeTab === 'checklist' && (
                <ChecklistView
                  items={items}
                  onSelectControl={setSelectedControl}
                  focusControl={checklistFocusControl}
                  onFocusControlHandled={handleChecklistFocusHandled}
                  onChecklistResult={handleChecklistResult}
                />
              )}
            </div>
          </>
        )}
      </main>

      <DetailModal
        control={selectedControl}
        onClose={() => setSelectedControl(null)}
      />

      <ModusWcToast position="bottom-end" delay={3500}>
        {toasts.map((t) => {
          const meta = TOAST_META[t.type] || TOAST_META.info;
          return (
            <ModusWcAlert
              key={t.id}
              variant={meta.variant}
              alertTitle={meta.title}
              alertDescription={t.message}
              role="status"
            />
          );
        })}
      </ModusWcToast>

      <footer className="app-footer">
        <div className="footer-content">
          <div>
            <strong>Control Sheet Dashboard</strong> • Real-time completion tracking
            by ticket verification
          </div>
          <div className="footer-links">
            <span className="footer-muted">Workflow: LqRIsl66FSC8Nj8Q</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
