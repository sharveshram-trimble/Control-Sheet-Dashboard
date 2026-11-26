import { createRoot } from 'react-dom/client';
import { defineCustomElements } from '@trimble-oss/moduswebcomponents/loader';
import {
  ModusWcThemeProvider,
  setAssetPath,
} from '@trimble-oss/moduswebcomponents-react';

// CSS order matters: Modus styles → Modus Icons 2.0 → Modus Icons 1.0 (shell nav icons) →
// Tailwind → app tokens/base → shell (unlayered, must follow Tailwind) → screen surfaces.
import '@trimble-oss/moduswebcomponents/modus-wc-styles.css';
import '@trimble-oss/moduswebcomponents/modus-icons-regular.css';
import '@trimble-oss/moduswebcomponents/modus-icons.css';
import './styles/tailwind.css';
import './styles/tokens.css';
import './index.css';
import './components/shell/shell.css';
import './styles/surface-helpers.css';
import './styles/owners.css';
import './styles/checklist.css';
import './styles/assist-panel.css';
import './styles/hero-progress.css';
import './styles/login.css';
import './styles/dashboard-surfaces.css';

import AuthRoot from './auth/AuthRoot.jsx';

setAssetPath(window.location.origin + import.meta.env.BASE_URL);
defineCustomElements();

// The inline script in index.html already set data-theme / data-mode / class before first paint;
// hand the same resolved mode to the provider so it doesn't flip it back.
const resolvedMode =
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

// No StrictMode: it double-mounts Modus slotted hosts and would double-run the one-time OAuth
// code exchange in the Trimble ID callback.
createRoot(document.getElementById('root')).render(
  <ModusWcThemeProvider
    initialTheme={{ theme: 'modus-modern', mode: resolvedMode }}
  >
    <AuthRoot />
  </ModusWcThemeProvider>
);
