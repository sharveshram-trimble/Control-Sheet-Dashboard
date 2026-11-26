import React, { useMemo } from 'react';
import {
  ModusWcButton,
  ModusWcIcon,
  ModusWcTabs,
} from '@trimble-oss/moduswebcomponents-react';
import { useAuth } from '@trimble-oss/trimble-id-react';

const TAB_KEYS = ['overview', 'matrix', 'progress', 'checklist'];

export default function Header({
  activeTab,
  setActiveTab,
  syncState = 'idle',
  lastSyncedAt = null,
  syncError = null,
  onRetrySync,
}) {
  const { user, logout } = useAuth();
  const tabs = useMemo(
    () => [
      { label: 'Overview', icon: 'dashboard', iconPosition: 'left' },
      { label: 'Matrix', icon: 'table', iconPosition: 'left' },
      { label: 'Progress', icon: 'person', iconPosition: 'left' },
      { label: 'Checklist', icon: 'list_bulleted', iconPosition: 'left' },
    ],
    []
  );

  const activeTabIndex = Math.max(0, TAB_KEYS.indexOf(activeTab));
  const displayName =
    user?.name || user?.email || user?.preferred_username || '';

  const syncLabel =
    syncState === 'loading'
      ? 'Syncing…'
      : syncState === 'error'
        ? syncError || 'Sync failed'
        : lastSyncedAt
          ? `Synced ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : 'Waiting for sheet';

  return (
    <header className="top-nav">
      <div className="nav-content">
        <div className="brand-section">
          <img
            className="brand-logo"
            src="/trimble-logo.png"
            alt="Trimble"
            width={132}
            height={40}
          />
          <div className="brand-info">
            <p className="brand-kicker">ITGC · Trimble</p>
            <h1 className="brand-title">Control Sheet Dashboard</h1>
          </div>
        </div>

        <nav className="nav-center-tabs" aria-label="Dashboard views">
          <ModusWcTabs
            aria-label="Dashboard views"
            size="sm"
            tabStyle="boxed"
            tabs={tabs}
            activeTabIndex={activeTabIndex}
            onTabChange={(e) => {
              const idx =
                e?.detail?.newTab ??
                e?.detail?.detail?.newTab ??
                e?.newTab ??
                0;
              setActiveTab(TAB_KEYS[Number(idx)] || 'overview');
            }}
          />
        </nav>

        <div className="nav-actions">
          <div
            className={`nav-sync nav-sync--${syncState}`}
            role="status"
            aria-live="polite"
          >
            <span className="nav-sync-label">{syncLabel}</span>
            {syncState === 'error' && typeof onRetrySync === 'function' ? (
              <ModusWcButton
                color="tertiary"
                variant="outlined"
                size="xs"
                aria-label="Retry sheet sync"
                onButtonClick={onRetrySync}
              >
                Retry
              </ModusWcButton>
            ) : null}
          </div>
          {displayName ? (
            <span className="nav-user-label" title={displayName}>
              {displayName}
            </span>
          ) : null}
          <ModusWcButton
            color="tertiary"
            variant="outlined"
            size="xs"
            aria-label="Sign out"
            onButtonClick={async () => {
              await logout();
            }}
          >
            <ModusWcIcon name="sign_out" size="xs" decorative />
            Sign out
          </ModusWcButton>
        </div>
      </div>
    </header>
  );
}
