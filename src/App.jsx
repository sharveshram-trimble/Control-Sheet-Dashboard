import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ModusWcAlert, ModusWcToast } from '@trimble-oss/moduswebcomponents-react';
import Header from './components/Header';
import HeroProgress from './components/HeroProgress';
import TwoColumnOwners from './components/TwoColumnOwners';
import ControlSheetTable from './components/ControlSheetTable';
import ProcessAnalytics from './components/ProcessAnalytics';
import DetailModal from './components/DetailModal';
import { initialWorkflowData } from './data/initialData';

export default function App() {
  const [items, setItems] = useState(initialWorkflowData);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLive, setIsLive] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toISOString());
  const [executionId, setExecutionId] = useState('10456638');
  const [autoRefresh, setAutoRefresh] = useState('30s');
  const [selectedControl, setSelectedControl] = useState(null);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const fetchLiveData = useCallback(
    async (isManual = false) => {
      setIsSyncing(true);
      try {
        const res = await fetch('/api/live-data');
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setItems(json.data);
            setIsLive(Boolean(json.live !== false));
            setLastSyncTime(json.timestamp || new Date().toISOString());
            if (json.executionId) setExecutionId(json.executionId);
            if (isManual) {
              const completed = json.data.filter((it) => it.isCompleted).length;
              showToast(
                `Synced ${json.data.length} controls! (${completed} completed with ticket)`,
                'success'
              );
            }
          }
        } else {
          setIsLive(false);
          if (isManual) showToast('Using cached snapshot (offline mode)', 'info');
        }
      } catch (err) {
        console.warn('Live fetch error, falling back to local snapshot:', err.message);
        setIsLive(false);
        if (isManual) showToast('Live endpoint unreachable, using local snapshot', 'info');
      } finally {
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
        isLive={isLive}
        isSyncing={isSyncing}
        onSync={() => fetchLiveData(true)}
        lastSyncTime={lastSyncTime}
        executionId={executionId}
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
        {toasts.map((t) => (
          <ModusWcAlert
            key={t.id}
            variant={t.type === 'success' ? 'success' : 'info'}
            alertTitle={t.type === 'success' ? 'Success' : 'Info'}
            alertDescription={t.message}
            role="status"
          />
        ))}
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
