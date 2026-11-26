/**
 * Modus app shell — navbar + responsive side navigation (React 19 + react-router).
 * Adapted from the modus-wc-side-navigation skill template (AppShell.tsx).
 *
 * Use as a layout route:  <Route element={<AppShell appName="…" navItems={…} />}> …child routes… </Route>
 * Navbar buttons (search, help, …) appear only when a handler is passed. The user menu needs
 * userCard + onSignOut + onMyTrimble together.
 *
 * Every non-obvious line is tagged [WHY-n]; see the modus-wc-side-navigation skill → "Why each piece exists".
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ModusWcIcon,
  ModusWcMenu,
  ModusWcMenuItem,
  ModusWcNavbar,
  ModusWcSideNavigation,
  ModusWcThemeSwitcher,
  ModusWcTypography,
} from '@trimble-oss/moduswebcomponents-react';
import {
  APP_SHELL_ROOT_CLASS,
  NAVBAR_CENTER_MIN_PX,
  PUSH_LAYOUT_MIN_PX,
  RAIL_MAX_WIDTH,
  RAIL_MIN_WIDTH,
  XL_MIN_PX,
} from './shellLayout';
import { useMinWidth } from './useMinWidth';

/**
 * @typedef {{ path: string, label: string, icon: string }} ShellNavItem
 *   `path` is the route ('/' for home); the first path segment drives the active match.
 *   `icon` is a Modus Icons 1.0 name (shell nav icons stay 1.0, see modus-core §6).
 */

/**
 * @param {object} props
 * @param {string} props.appName
 * @param {readonly ShellNavItem[]} props.navItems
 * @param {{ name: string, email: string }} [props.userCard] Shown only with onSignOut and onMyTrimble.
 * @param {() => void} [props.onSearch]
 * @param {() => void} [props.onNotifications]
 * @param {() => void} [props.onHelp]
 * @param {() => void} [props.onApps]
 * @param {() => void} [props.onSignOut]
 * @param {() => void} [props.onMyTrimble]
 */
export function AppShell({
  appName,
  navItems,
  userCard,
  onSearch,
  onNotifications,
  onHelp,
  onApps,
  onSignOut,
  onMyTrimble,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useMinWidth(PUSH_LAYOUT_MIN_PX); // push ≥ 1024, overlay below
  const isXl = useMinWidth(XL_MIN_PX); // default-expanded rail ≥ 1280
  const isWide = useMinWidth(NAVBAR_CENTER_MIN_PX); // navbar center + full tray ≥ 768
  const mode = isDesktop ? 'push' : 'overlay';

  // [WHY-1] Read XL in the initializer so the first client frame is already correct.
  const [sideNavExpanded, setSideNavExpanded] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(min-width: ${XL_MIN_PX}px)`).matches,
  );

  const shellRef = useRef(null);
  const navbarHostRef = useRef(null);
  const navbarRef = useRef(null);
  const railWrapperRef = useRef(null);
  const mainRef = useRef(null);

  // [WHY-2] Re-default only when crossing XL, so a manual collapse on XL sticks.
  useEffect(() => {
    setSideNavExpanded(isXl);
  }, [isXl]);

  // [WHY-3] SPA navigation never fires collapseOnClickOutside — close the overlay drawer on route change.
  useEffect(() => {
    if (isDesktop) return undefined;
    const id = requestAnimationFrame(() => setSideNavExpanded(false));
    return () => cancelAnimationFrame(id);
  }, [location.pathname, isDesktop]);

  // [WHY-4] Fixed rail sits under the navbar: measure, don't hardcode.
  useLayoutEffect(() => {
    const host = navbarHostRef.current;
    const shell = shellRef.current;
    if (!host || !shell) return undefined;
    const apply = () => shell.style.setProperty('--app-navbar-height', `${host.offsetHeight || 56}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  // [WHY-5] Push inset: write before paint, then re-apply after Stencil's setTargetContentMargin races it.
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return undefined;
    if (!isDesktop) {
      main.style.removeProperty('margin-left');
      return undefined;
    }
    const value = sideNavExpanded ? RAIL_MAX_WIDTH : RAIL_MIN_WIDTH;
    main.style.marginLeft = value;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        main.style.marginLeft = value;
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [isDesktop, sideNavExpanded]);

  // [WHY-6] Collapsed overlay rail becomes `inert`; move focus out first (aria-hidden would be blocked).
  const overlayCollapsed = !isDesktop && !sideNavExpanded;
  useLayoutEffect(() => {
    if (overlayCollapsed && railWrapperRef.current?.contains(document.activeElement)) {
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [overlayCollapsed]);

  // [WHY-7] Push: keep the navbar's own main-menu flyout closed (an empty one blocks clicks on main).
  // Overlay: mirror the drawer. Re-sync after navigation because navbar click-outside doesn't emit.
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (navbarRef.current) navbarRef.current.mainMenuOpen = isDesktop ? false : sideNavExpanded;
    }, 0);
    return () => window.clearTimeout(id);
  }, [isDesktop, sideNavExpanded, location.pathname]);

  const shellClass = [
    APP_SHELL_ROOT_CLASS,
    sideNavExpanded ? 'side-nav-expanded' : '',
    isDesktop ? 'side-nav-push' : 'side-nav-overlay',
    overlayCollapsed ? 'side-nav-overlay-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const activePath = '/' + (location.pathname.split('/')[1] ?? '');
  const pageTitle = navItems.find((i) => i.path === activePath)?.label ?? '';

  // Every route sets its tab title: "<Page> | <App>" (modus-core §3.6).
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} | ${appName}` : appName;
  }, [pageTitle, appName]);

  return (
    <div ref={shellRef} className={shellClass}>
      <div ref={navbarHostRef} className="app-navbar-host">
        <ModusWcNavbar
          ref={navbarRef}
          userCard={userCard}
          condensed={!isWide}
          mainMenuOpen={isDesktop ? false : sideNavExpanded}
          visibility={{
            logo: true,
            mainMenu: true,
            // A button shows only when the app handles it (never a control that does nothing).
            apps: isWide && Boolean(onApps),
            search: isWide && Boolean(onSearch),
            searchInput: false,
            notifications: isWide && Boolean(onNotifications),
            help: isWide && Boolean(onHelp),
            user: Boolean(userCard && onSignOut && onMyTrimble),
            ai: false,
          }}
          onAppsClick={onApps}
          onSearchClick={onSearch}
          onNotificationsClick={onNotifications}
          onHelpClick={onHelp}
          onSignOutClick={onSignOut}
          onMyTrimbleClick={onMyTrimble}
          onMainMenuOpenChange={(e) => {
            // [WHY-7] push: toggle (navbar's internal flag is forced false); overlay: mirror detail.
            if (isDesktop) setSideNavExpanded((prev) => !prev);
            else setSideNavExpanded(Boolean(e.detail));
          }}
        >
          {/* [WHY-8] Stable slot root; Modus wraps it, so hide with a class, not `hidden`. */}
          <div
            slot="center"
            className={
              isWide
                ? 'app-shell-navbar-center flex min-w-0 items-center gap-2'
                : 'app-shell-navbar-center is-collapsed'
            }
          >
            <ModusWcTypography hierarchy="p" size="md" weight="semibold" label={appName} />
            <span className="app-shell-page-title">
              <ModusWcTypography
                hierarchy="p"
                size="md"
                label={pageTitle ? `/ ${pageTitle}` : ''}
                customClass="text-[var(--modus-wc-color-base-content-low-contrast)]"
              />
            </span>
          </div>
          <div slot="end" className="flex items-center">
            <ModusWcThemeSwitcher aria-label="Toggle light and dark theme" />
          </div>
        </ModusWcNavbar>
      </div>

      <div className="app-body-row">
        <div ref={railWrapperRef} className="side-rail-wrapper" inert={overlayCollapsed}>
          {/* [WHY-9] key={mode}: remount on push↔overlay so the element drops stale internal layout. */}
          <ModusWcSideNavigation
            key={mode}
            mode={mode}
            expanded={sideNavExpanded}
            maxWidth={RAIL_MAX_WIDTH}
            targetContent="#main-content"
            collapseOnClickOutside={!isDesktop}
            onExpandedChange={(e) => setSideNavExpanded(Boolean(e.detail))}
          >
            {/* [WHY-10] Items must sit inside modus-wc-menu (its <ul> removes stray bullets). */}
            <ModusWcMenu size="md" customClass="w-full">
              {navItems.map((item) => (
                <ModusWcMenuItem
                  key={item.path}
                  label={item.label}
                  value={item.path}
                  size="md"
                  selected={activePath === item.path}
                  tooltipContent={sideNavExpanded ? undefined : item.label}
                  tooltipPosition="right"
                  onItemSelect={() => navigate({ pathname: item.path, search: location.search })}
                >
                  <ModusWcIcon slot="start-icon" name={item.icon} size="md" decorative />
                </ModusWcMenuItem>
              ))}
            </ModusWcMenu>
          </ModusWcSideNavigation>
        </div>

        {/* tabIndex=-1 only so [WHY-6] can move focus here. */}
        <main id="main-content" ref={mainRef} tabIndex={-1} className="outline-none">
          <div className="page-main mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default AppShell;
