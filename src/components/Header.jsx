import React, { useMemo } from 'react';
import { ModusWcTabs } from '@trimble-oss/moduswebcomponents-react';

const TAB_KEYS = ['overview', 'matrix', 'progress', 'checklist'];

export default function Header({ activeTab, setActiveTab }) {
  const tabs = useMemo(
    () => [
      { label: 'Overview & Owners', icon: 'dashboard', iconPosition: 'left' },
      { label: 'Control Sheet Matrix', icon: 'table', iconPosition: 'left' },
      { label: 'Individual Progress', icon: 'person', iconPosition: 'left' },
      { label: 'Checklist', icon: 'list_bulleted', iconPosition: 'left' },
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

        {/* Sync / 30s controls removed — Checklist tab occupies this header area */}
        <div className="nav-actions nav-actions-spacer" aria-hidden="true" />
      </div>
    </header>
  );
}
