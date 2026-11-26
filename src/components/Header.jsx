import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import {
  ModusWcButton,
  ModusWcIcon,
} from '@trimble-oss/moduswebcomponents-react';
import { useAuth } from '@trimble-oss/trimble-id-react';
import { bootDrop, duration, easeBrand } from '../motion/presets';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'matrix', label: 'Matrix' },
  { key: 'progress', label: 'Progress' },
  { key: 'checklist', label: 'Checklist' },
];

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
  const tabRefs = useRef([]);
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

  const activeTabIndex = Math.max(
    0,
    TABS.findIndex((t) => t.key === activeTab)
  );
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

  const moveTab = (from, delta) => {
    const next = (from + delta + TABS.length) % TABS.length;
    setActiveTab(TABS[next].key);
    tabRefs.current[next]?.focus();
  };

  return (
    <motion.header
      className="top-nav"
      initial={boot.initial}
      animate={booted ? boot.animate : boot.initial}
      transition={boot.transition}
    >
      <div className="ledger-rule nav-ledger-rule" aria-hidden="true" />

      {!reduceMotion ? (
        <motion.div
          className="nav-scroll-progress"
          style={{ scaleX: progressX }}
          aria-hidden="true"
        />
      ) : null}

      <div className="nav-masthead">
        <a className="brand-section lift" href="/" onClick={(e) => e.preventDefault()}>
          <span className="brand-emblem">
            <img
              src="/brand/trimble-emblem.svg"
              alt=""
              width={24}
              height={23}
            />
          </span>
          <span className="brand-info">
            <span className="brand-title">Trimble</span>
            <span className="brand-kicker">Control Sheet · ITGC</span>
          </span>
        </a>

        <nav className="nav-masthead-tabs" aria-label="Dashboard views">
          <div role="tablist" aria-label="Dashboard views" className="nav-tablist">
            {TABS.map((tab, i) => {
              const selected = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`dash-tab-${tab.key}`}
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  className={`nav-tab${selected ? ' is-active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      moveTab(i, 1);
                    } else if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      moveTab(i, -1);
                    } else if (e.key === 'Home') {
                      e.preventDefault();
                      setActiveTab(TABS[0].key);
                      tabRefs.current[0]?.focus();
                    } else if (e.key === 'End') {
                      e.preventDefault();
                      setActiveTab(TABS[TABS.length - 1].key);
                      tabRefs.current[TABS.length - 1]?.focus();
                    }
                  }}
                >
                  {tab.label}
                  {selected ? (
                    <motion.span
                      className="nav-tab-ink"
                      layoutId="tab-ink"
                      transition={
                        reduceMotion
                          ? { duration: duration.micro }
                          : { duration: duration.ui, ease: easeBrand }
                      }
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
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

      {/* Keep index available for any legacy selectors */}
      <span className="visually-hidden" aria-hidden="true">
        {activeTabIndex}
      </span>
    </motion.header>
  );
}
