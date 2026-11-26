import { useCallback, useMemo } from 'react';
import { useAuth } from '@trimble-oss/trimble-id-react';
import { AppShell } from './AppShell.jsx';

const APP_NAME = 'Control sheet dashboard';

/** Shell nav icons use the Modus Icons 1.0 set (modus-icons.css stays loaded). */
const NAV_ITEMS = [
  { path: '/', label: 'Overview', icon: 'dashboard' },
  { path: '/matrix', label: 'Matrix', icon: 'table' },
  { path: '/progress', label: 'Progress', icon: 'bar_graph' },
  { path: '/checklist', label: 'Checklist', icon: 'clipboard_check' },
];

/** Trimble ID account page; override per environment (stage vs prod) with VITE_MY_TRIMBLE_URL. */
const MY_TRIMBLE_URL =
  import.meta.env.VITE_MY_TRIMBLE_URL || 'https://id.trimble.com';

/**
 * Layout route: wires Trimble ID auth (user card, sign out, My Trimble) into the generic AppShell.
 * Without an auth session (DEV ?uiPreview=1 with no TID client) the user menu stays hidden.
 */
export default function DashboardShell() {
  const { user, logout, isAuthenticated } = useAuth() ?? {};

  const name = user?.name || user?.preferred_username || user?.email || '';
  const email = user?.email || '';

  const userCard = useMemo(
    () => (isAuthenticated && name ? { name, email } : undefined),
    [isAuthenticated, name, email],
  );

  const onSignOut = useCallback(() => {
    void logout?.();
  }, [logout]);

  const onMyTrimble = useCallback(() => {
    window.open(MY_TRIMBLE_URL, '_blank', 'noopener,noreferrer');
  }, []);

  const canSignOut = Boolean(isAuthenticated && typeof logout === 'function');

  return (
    <AppShell
      appName={APP_NAME}
      navItems={NAV_ITEMS}
      userCard={userCard}
      onSignOut={canSignOut ? onSignOut : undefined}
      onMyTrimble={canSignOut ? onMyTrimble : undefined}
    />
  );
}
