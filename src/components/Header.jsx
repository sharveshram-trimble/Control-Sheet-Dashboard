import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import {
  ModusWcButton,
  ModusWcIcon,
  ModusWcTabs,
} from '@trimble-oss/moduswebcomponents-react';
import { useAuth } from '@trimble-oss/trimble-id-react';
import { bootDrop, duration, easeBrand } from '../motion/presets';

const TAB_KEYS = ['overview', 'matrix', 'progress', 'checklist'];
const TAB_LABELS = ['Overview', 'Matrix', 'Progress', 'Checklist'];

export default function Header({
  activeTab,
  setActiveTab,
  syncState = 'idle',
  lastSyncedAt = null,
  syncError = null,
  onRetrySync,
}) {
  const { user, logout } = useAuth();
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progressX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
    mass: 0.35,
  });
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setBooted(true));
    return () => cancelAnimationFrame(id);
  }, []);

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

  const boot = bootDrop(reduceMotion);

  return (
    <motion.header
      className="top-nav"
      initial={boot.initial}
      animate={booted ? boot.animate : boot.initial}
      transition={boot.transition}
    >
      {!reduceMotion ? (
        <motion.div
          className="nav-scroll-progress"
          style={{ scaleX: progressX }}
          aria-hidden="true"
        />
      ) : null}

      <div className="nav-brand-row">
        <div className="brand-section">
          <img
            className="brand-logo brand-logo--on-dark"
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

      <div className="nav-subnav">
        <nav className="nav-center-tabs" aria-label="Dashboard views">
          <div className="nav-tabs-shell">
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
            <div className="nav-tab-ink-track" aria-hidden="true">
              {TAB_LABELS.map((label, i) => (
                <div key={label} className="nav-tab-ink-slot">
                  {i === activeTabIndex ? (
                    <motion.span
                      className="nav-tab-ink"
                      layoutId="tab-ink"
                      transition={
                        reduceMotion
                          ? { duration: duration.micro }
                          : { duration: duration.ui, ease: easeBrand }
                      }
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </motion.header>
  );
}
