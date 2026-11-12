import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ModusWcAlert, ModusWcToast } from '@trimble-oss/moduswebcomponents-react';
import Header from './components/Header';
import HeroProgress from './components/HeroProgress';
import TwoColumnOwners from './components/TwoColumnOwners';
import ControlSheetTable from './components/ControlSheetTable';
import ProcessAnalytics from './components/ProcessAnalytics';
import DetailModal from './components/DetailModal';
import { initialWorkflowData } from './data/initialData';

const TOAST_META = {
  success: { variant: 'success', title: 'Success' },
  warning: { variant: 'warning', title: 'Notice' },
  error: { variant: 'error', title: 'Error' },
  info: { variant: 'info', title: 'Info' },
};

export default function App() {
  const [items, setItems] = useState(initialWorkflowData);
  const [activeTab, setActiveTab] = useState('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toISOString());
  const [autoRefresh, setAutoRefresh] = useState('30s');
  const [selectedControl, setSelectedControl] = useState(null);
  const [toasts, setToasts] = useState([]);
  const syncInFlightRef = useRef(false);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const fetchLiveData = useCallback(
    async (isManual = false) => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      setIsSyncing(true);
      try {
        const res = await fetch('/api/live-data');
        const json = await res.json().catch(() => null);

        if (res.ok && json?.data?.length > 0) {
          setItems(json.data);
          setLastSyncTime(json.timestamp || new Date().toISOString());

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
            } else if (source === 'trimble_n8n_executions_api') {
              showToast(
                json.message ||
                  'Showing last workflow run (not live webhook)',
                'warning'
              );
            } else if (
              source === 'cached_snapshot' ||
              source === 'bundled_initial_data'
            ) {
              showToast(
                json.message ||
                  'Using offline snapshot (live sync unavailable)',
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

        if (isManual) {
          if (!res.ok) {
            showToast(
              json?.message || json?.error || 'Sync failed (no data sources available)',
              'error'
            );
          } else {
            showToast('No rows returned from sync', 'warning');
          }
        } else if (!res.ok) {
          console.warn('[Live Sync] Auto-refresh failed:', json?.message || json?.error);
        }
      } catch (err) {
        console.warn('Live fetch error:', err.message);
        if (isManual) {
          showToast('Live endpoint unreachable — keeping current data', 'error');
        }
      } finally {
        syncInFlightRef.current = false;
        setIsSyncing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchLiveData(false);
  }, [fetchLiveData]);

  useEffect(() => {
    if (autoRefresh === 'off') return;
    const msMap = { '15s': 15000, '30s': 30000, '60s': 60000 };
    const intervalMs = msMap[autoRefresh] || 30000;

    const timer = setInterval(() => {
      fetchLiveData(false);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [autoRefresh, fetchLiveData]);

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

  return (
    <div className="app-container">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSyncing={isSyncing}
        onSync={() => fetchLiveData(true)}
        lastSyncTime={lastSyncTime}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
      />

      <main className="main-content">
        <HeroProgress items={items} stats={stats} />

        {activeTab === 'overview' && (
          <TwoColumnOwners
            ownerStats={ownerStats}
            onSelectControl={setSelectedControl}
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
                    json.message || json.error || 'Failed to send reminder email',
                    'error'
                  );
                  return;
                }
                showToast(
                  json.message ||
                    `Reminder queued for ${payload.ownerName} (${payload.incompleteCount} controls)`,
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
          <ProcessAnalytics items={items} stats={stats} ownerStats={ownerStats} />
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
