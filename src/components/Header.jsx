import React, { useMemo } from 'react';
import {
  ModusWcButton,
  ModusWcIcon,
  ModusWcSelect,
  ModusWcTabs,
} from '@trimble-oss/moduswebcomponents-react';
import { readInputString } from '../utils/modusFormEvents';

const TAB_KEYS = ['overview', 'matrix', 'progress'];

const REFRESH_OPTIONS = [
  { label: 'Manual', value: 'off' },
  { label: '15s', value: '15s' },
  { label: '30s', value: '30s' },
  { label: '60s', value: '60s' },
];

export default function Header({
  activeTab,
  setActiveTab,
  isSyncing,
  onSync,
  lastSyncTime,
  autoRefresh,
  setAutoRefresh,
}) {
  const tabs = useMemo(
    () => [
      { label: 'Overview & Owners', icon: 'dashboard', iconPosition: 'left' },
      { label: 'Control Sheet Matrix', icon: 'table', iconPosition: 'left' },
      { label: 'Individual Progress', icon: 'person', iconPosition: 'left' },
    ],
    []
  );

  const activeTabIndex = Math.max(0, TAB_KEYS.indexOf(activeTab));

  return (
    <header className="top-nav">
      <div className="nav-content">
        <div className="brand-section">
          <img
            className="brand-logo"
            src="/trimble-logo.png"
            alt="Trimble"
            width={132}
            height={46}
          />
          <div className="brand-info">
            <h1>Control Sheet Dashboard</h1>
          </div>
        </div>

        <nav className="nav-center-tabs" aria-label="Dashboard views">
          <ModusWcTabs
            aria-label="Dashboard views"
            size="md"
            tabStyle="boxed"
            tabs={tabs}
            activeTabIndex={activeTabIndex}
            onTabChange={(e) => {
              const idx = e.detail?.newTab ?? 0;
              setActiveTab(TAB_KEYS[idx] || 'overview');
            }}
          />
        </nav>

        <div className="nav-actions">
          <ModusWcSelect
            size="sm"
            bordered
            label=""
            aria-label="Auto refresh interval"
            value={autoRefresh}
            options={REFRESH_OPTIONS}
            customClass="header-refresh-select"
            onInputChange={(e) => setAutoRefresh(readInputString(e) || 'off')}
          />

          <ModusWcButton
            color="primary"
            variant="filled"
            size="sm"
            disabled={isSyncing}
            onButtonClick={onSync}
            title={`Last sync: ${lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Just now'}`}
          >
            <ModusWcIcon
              name="refresh"
              size="sm"
              decorative
              customClass={isSyncing ? 'spinning-icon' : undefined}
            />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </ModusWcButton>
        </div>
      </div>
    </header>
  );
}
