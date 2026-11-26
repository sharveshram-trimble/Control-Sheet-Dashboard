import { createRoot } from 'react-dom/client';
import { defineCustomElements } from '@trimble-oss/moduswebcomponents/loader';
import '@trimble-oss/moduswebcomponents/modus-wc-styles.css';
import '@trimble-oss/moduswebcomponents/modus-icons.css';
import '@trimble-oss/moduswebcomponents/modus-icons-2.css';
import './styles/tokens.css';
import './index.css';
import './styles/dashboard-surfaces.css';
import AuthRoot from './auth/AuthRoot.jsx';

defineCustomElements();

document.documentElement.setAttribute('data-theme', 'modus-modern-light');

// Avoid React StrictMode double-mount during OAuth code exchange (code is one-time use).
createRoot(document.getElementById('root')).render(<AuthRoot />);
