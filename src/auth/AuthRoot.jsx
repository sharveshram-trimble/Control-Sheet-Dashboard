import React, { useCallback, useEffect, useState } from 'react';
import {
  AuthenticationGuard,
  TIDProvider,
  useAuth,
} from '@trimble-oss/trimble-id-react';
import App from '../App';
import tidClient from './tidClient';
import { getTidAuthConfig } from './tidConfig';
import LoginScreen from './LoginScreen';

function AuthLoading({ message = 'Checking Trimble ID session…' }) {
  return (
    <div className="tid-login-screen">
      <div className="tid-login-card tid-login-card-muted">
        <p>{message}</p>
      </div>
    </div>
  );
}

function normalizePath(returnTo = '/') {
  const raw =
    returnTo && returnTo.startsWith('/') ? returnTo.split('?')[0] : '/';
  if (raw === '/callback' || raw === '/logout-callback') return '/';
  return raw || '/';
}

/**
 * Soft navigate only — NEVER window.location.replace after login.
 * TID v1 stores tokens in memory; a full reload drops the session.
 */
function useSoftPath() {
  const [path, setPath] = useState(
    () => window.location.pathname || '/'
  );

  const navigate = useCallback((next) => {
    const target = normalizePath(next);
    if (`${window.location.pathname}` !== target) {
      window.history.replaceState({}, document.title, target);
    }
    setPath(target);
  }, []);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return { path, navigate };
}

function LogoutCallbackView({ onGoHome }) {
  const { loginWithRedirect } = useAuth();
  return (
    <LoginScreen
      onLogin={async () => {
        onGoHome('/');
        await loginWithRedirect();
      }}
    />
  );
}

function CallbackView({ onGoHome }) {
  const { isLoading, isAuthenticated, error, loginWithRedirect } = useAuth();

  // Provider already ran handleCallback; once authenticated, leave /callback in-app.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      onGoHome('/');
    }
  }, [isLoading, isAuthenticated, onGoHome]);

  if (error) {
    return (
      <LoginScreen
        onLogin={async () => {
          onGoHome('/');
          await loginWithRedirect();
        }}
        error={error}
      />
    );
  }

  return <AuthLoading message="Signing you in with Trimble ID…" />;
}

function AuthenticatedApp({ path, navigate }) {
  const { isLoading, isAuthenticated, loginWithRedirect, error } = useAuth();

  if (path === '/logout-callback' || path.endsWith('/logout-callback')) {
    return <LogoutCallbackView onGoHome={navigate} />;
  }

  if (path === '/callback' || path.endsWith('/callback')) {
    return <CallbackView onGoHome={navigate} />;
  }

  if (isLoading) {
    return <AuthLoading />;
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        onLogin={async () => {
          await loginWithRedirect();
        }}
        error={error}
      />
    );
  }

  return (
    <AuthenticationGuard
      renderComponent={<App />}
      loader={<AuthLoading />}
    />
  );
}

function MissingConfigApp() {
  const config = getTidAuthConfig();
  const missing = [];
  if (!config.configurationEndpoint) missing.push('VITE_TID_CONFIGURATION_ENDPOINT');
  if (!config.clientId) missing.push('VITE_TID_CLIENT_ID');
  if (!config.scopes.length) missing.push('VITE_TID_SCOPES');

  return (
    <LoginScreen
      configured={false}
      missingHint={`Missing: ${missing.join(', ')}. Add them to .env (see .env.example), then restart npm run dev.`}
      onLogin={() => {}}
    />
  );
}

function AuthApp() {
  const { path, navigate } = useSoftPath();

  const handleRedirect = useCallback(
    (authState) => {
      navigate(authState?.returnTo || '/');
    },
    [navigate]
  );

  return (
    <TIDProvider
      tidClient={tidClient}
      checkRedirectUrlMatch={false}
      onRedirectCallback={handleRedirect}
    >
      <AuthenticatedApp path={path} navigate={navigate} />
    </TIDProvider>
  );
}

export default function AuthRoot() {
  if (!tidClient) {
    return <MissingConfigApp />;
  }

  return <AuthApp />;
}
