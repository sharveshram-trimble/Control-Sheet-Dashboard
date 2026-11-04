import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { defineCustomElements } from '@trimble-oss/moduswebcomponents/loader';
import '@trimble-oss/moduswebcomponents/modus-wc-styles.css';
import '@trimble-oss/moduswebcomponents/modus-icons.css';
import '@trimble-oss/moduswebcomponents/modus-icons-2.css';
import './index.css';
import App from './App.jsx';

defineCustomElements();

document.documentElement.setAttribute('data-theme', 'modus-modern-light');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
