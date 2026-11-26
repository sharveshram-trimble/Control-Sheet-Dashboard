import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ModusWcButton,
  ModusWcIcon,
  ModusWcSelect,
  ModusWcTypography,
} from '@trimble-oss/moduswebcomponents-react';
import { useAuth } from '@trimble-oss/trimble-id-react';
import {
  CHAT_UI_IFRAME_SANDBOX_ATTRIBUTES,
  ChatUiVariants,
  ContentVariants,
  getChatUiOrigin,
  getChatUiUrl,
  listenToChatUi,
  sendMessage,
  subscribeToChatEvents,
} from '@trimble-agentic-external-npm-local/agentic-platform-sdk-iframe-typescript';
import { readInputString } from '../utils/modusFormEvents';
import {
  REPORT_CHECKLIST_RESULT_TOOL,
  buildAuditPayload,
  checklistLabel,
  currentCalendarQuarter,
  driveLinkForQuarter,
  getAssistConfig,
  isGoogleSheetUrl,
  normalizeChecklistOutput,
} from './assistConfig';

const QUARTER_OPTIONS = [
  { label: 'Q1', value: 'Q1' },
  { label: 'Q2', value: 'Q2' },
  { label: 'Q3', value: 'Q3' },
  { label: 'Q4', value: 'Q4' },
];

function resolveTheme() {
  try {
    if (document.documentElement.classList.contains('dark')) return 'dark';
    if (document.documentElement.dataset.mode === 'dark') return 'dark';
  } catch {
    /* ignore */
  }
  return 'light';
}

function parseOutputFromText(text) {
  const raw = String(text || '');
  const tagged = raw.match(
    /CHECKLIST_OUTPUT\s*:\s*(success|failed|false|true|passed|pass)/i
  );
  if (tagged?.[1]) return normalizeChecklistOutput(tagged[1]);
  return null;
}

/** Decode JWT payload claims for Assist auth diagnostics (no secrets logged). */
function inspectAccessToken(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    const aud = payload.aud;
    const scope = payload.scope || payload.scp;
    return {
      aud: Array.isArray(aud) ? aud.join(', ') : String(aud || ''),
      scope: Array.isArray(scope) ? scope.join(' ') : String(scope || ''),
    };
  } catch {
    return null;
  }
}

/** Base SDK sandbox + popup escape so Assist's own TID sign-in can open. */
const ASSIST_IFRAME_SANDBOX = `${CHAT_UI_IFRAME_SANDBOX_ATTRIBUTES} allow-popups-to-escape-sandbox`;

/**
 * Side panel that embeds Trimble Assist via the iframe SDK
 * (avoids agentic-chat-react's broken require("react") bundle).
 *
 * Auth: parent must supply the dashboard Trimble ID *access* token. Assist
 * accepts it only when the token audience matches Assist/Agent Studio APIs
 * (set via VITE_TID_SCOPES / VITE_ASSIST_API_SCOPE, then re-login).
 */
export default function AssistPanel({
  open,
  control,
  initialQuarter,
  onClose,
  onChecklistResult,
  /** When true, send the checklist prompt once Assist finishes handshake. */
  autoStart = false,
}) {
  const {
    getAccessTokenSilently,
    getTokens,
    isAuthenticated,
    user,
  } = useAuth();
  const iframeRef = useRef(null);
  const readyRef = useRef(false);
  const pendingAutoStartRef = useRef(false);
  const latestTokenRef = useRef('');
  const controlRef = useRef(control);
  const quarterRef = useRef(initialQuarter || currentCalendarQuarter());
  const onResultRef = useRef(onChecklistResult);
  const [quarter, setQuarter] = useState(
    () => initialQuarter || currentCalendarQuarter()
  );
  const [theme, setTheme] = useState(resolveTheme);
  const [status, setStatus] = useState('');
  const [authBridge, setAuthBridge] = useState('');
  const [iframeReady, setIframeReady] = useState(false);
  const [embedError, setEmbedError] = useState('');
  // Keep iframe mounted after first open so Assist TID session can stick.
  const [everOpened, setEverOpened] = useState(false);
  const assist = useMemo(() => getAssistConfig(), []);
  const pageIsHttps =
    typeof window !== 'undefined' && window.location.protocol === 'https:';

  controlRef.current = control;
  quarterRef.current = quarter;
  onResultRef.current = onChecklistResult;

  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  const environment = assist.environment;
  const chatOrigin = useMemo(
    () => (assist.configured ? getChatUiOrigin(environment) : ''),
    [assist.configured, environment]
  );
  const chatUrl = useMemo(
    () =>
      assist.configured
        ? getChatUiUrl(environment, 'auto', { theme })
        : '',
    [assist.configured, environment, theme]
  );

  const publishResult = useCallback((partial) => {
    const current = controlRef.current;
    if (!current) return;
    const statusValue = normalizeChecklistOutput(partial?.status);
    if (!statusValue) return;

    const targetSheetUrl = String(partial?.targetSheetUrl || '').trim();
    onResultRef.current?.({
      controlId: current.id || current['Control ID'],
      control: current,
      quarter: quarterRef.current,
      status: statusValue,
      targetSheetUrl: isGoogleSheetUrl(targetSheetUrl) ? targetSheetUrl : '',
      summary: String(partial?.summary || '').trim(),
    });
    setStatus(
      statusValue === 'success'
        ? `Checklist finished: Success${partial?.summary ? ` — ${partial.summary}` : ''}`
        : `Checklist finished: Failed${partial?.summary ? ` — ${partial.summary}` : ''}`
    );
  }, []);

  useEffect(() => {
    if (initialQuarter) setQuarter(initialQuarter);
  }, [initialQuarter, control?.id]);

  useEffect(() => {
    if (!open || !control) {
      setStatus('');
      return;
    }
    if (!checklistLabel(control)) {
      setStatus('Checklist is missing on this control row.');
      return;
    }
    const q = initialQuarter || quarter;
    if (!driveLinkForQuarter(control, q)) {
      setStatus(`${q} Drive link is missing on this control row.`);
      return;
    }
    setStatus('');
  }, [open, control, initialQuarter, quarter]);

  useEffect(() => {
    if (!open) return undefined;
    setTheme(resolveTheme());
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Prefetch dashboard TID access token whenever the panel is used.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    (async () => {
      if (!isAuthenticated) {
        latestTokenRef.current = '';
        setAuthBridge(
          'Dashboard is not signed in. Sign in with Trimble ID on the main login screen first.'
        );
        return;
      }
      try {
        const tokens = typeof getTokens === 'function'
          ? await getTokens()
          : { access_token: await getAccessTokenSilently() };
        const accessToken = tokens?.access_token || '';
        if (cancelled) return;
        if (!accessToken) {
          latestTokenRef.current = '';
          setAuthBridge(
            'Signed into the dashboard, but no access token was available. Sign out and sign in again.'
          );
          return;
        }
        latestTokenRef.current = accessToken;
        const claims = inspectAccessToken(accessToken);
        const who =
          user?.email || user?.name || user?.id || 'Trimble ID user';
        setAuthBridge(
          claims
            ? `Dashboard session: ${who}. Token aud=${claims.aud || '—'}; scope=${claims.scope || '—'}.`
            : `Dashboard session: ${who}. Access token ready.`
        );
      } catch (err) {
        if (cancelled) return;
        latestTokenRef.current = '';
        setAuthBridge(
          err?.message ||
            'Could not read the dashboard Trimble ID access token. Sign out and sign in again.'
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    isAuthenticated,
    getAccessTokenSilently,
    getTokens,
    user?.email,
    user?.name,
    user?.id,
  ]);

  // Assist asks the parent for the dashboard access token over postMessage.
  // Do NOT redirect to login from this callback — that aborts the checklist.
  const provideToken = useCallback(async () => {
    if (latestTokenRef.current) {
      return latestTokenRef.current;
    }
    if (!isAuthenticated) {
      throw new Error(
        'Sign in with Trimble ID on the dashboard login screen first.'
      );
    }
    const tokens = typeof getTokens === 'function'
      ? await getTokens()
      : { access_token: await getAccessTokenSilently() };
    const accessToken = tokens?.access_token || '';
    if (!accessToken) {
      throw new Error('No Trimble ID access token available.');
    }
    latestTokenRef.current = accessToken;
    const claims = inspectAccessToken(accessToken);
    if (claims) {
      console.info(
        '[Assist] providing Trimble ID access token:',
        `aud=${claims.aud || '—'}; scope=${claims.scope || '—'}`
      );
    }
    return accessToken;
  }, [getAccessTokenSilently, getTokens, isAuthenticated]);

  const handleUnauthorized = useCallback(async () => {
    const claims = inspectAccessToken(latestTokenRef.current);
    const claimHint = claims
      ? ` Current token aud=${claims.aud || '—'}; scope=${claims.scope || '—'}.`
      : '';
    setStatus(
      `Assist rejected the dashboard Trimble ID access token.${claimHint} Add the Assist/Agent Studio application scope to VITE_TID_SCOPES (or VITE_ASSIST_API_SCOPE), restart, sign out/in on the dashboard, then retry. Or use Sign in inside the Assist chat below, then click Run Checklist again.`
    );
    pendingAutoStartRef.current = true;
    return 'Dashboard Trimble ID token was rejected by Assist.';
  }, []);

  const buildOnBeforeRun = useCallback(() => {
    if (!control) {
      return { tools: { runTime: {}, global: {} }, runContext: { context: [] } };
    }
    const { context } = buildAuditPayload(control, quarter);
    return {
      tools: {
        runTime: {
          report_checklist_result: {
            definition: REPORT_CHECKLIST_RESULT_TOOL,
            callback: async (args) => {
              publishResult({
                status: args?.status,
                targetSheetUrl: args?.targetSheetUrl,
                summary: args?.summary,
              });
              return JSON.stringify({
                recorded: true,
                status: normalizeChecklistOutput(args?.status) || 'unknown',
              });
            },
            timeOutInMs: 15000,
          },
        },
        global: {},
      },
      runContext: { context },
    };
  }, [control, quarter, publishResult]);

  // Wire iframe ↔ host once the iframe exists. Keep listener while everOpened.
  useLayoutEffect(() => {
    if (!everOpened || !assist.configured || !chatOrigin) return undefined;
    const iframe = iframeRef.current;
    if (!iframe) return undefined;

    readyRef.current = false;
    setIframeReady(false);
    setEmbedError('');

    let handshakeDone = false;
    const provideConfig = () => {
      handshakeDone = true;
      readyRef.current = true;
      setIframeReady(true);
      setEmbedError('');
      return {
        environment,
        agentId: assist.agentId,
        localization: { locale: 'en-US' },
        // Checklist agent uses Agent Studio skills — needs `skills` TID scope.
        features: { skills: true },
        uiConfig: {
          theme,
          contentVariant: ContentVariants.Chat,
          variant: ChatUiVariants.Minimal,
          chatInput: { buttons: [], hideModelSelection: true },
          showSignIn: true,
        },
      };
    };

    const cleanup = listenToChatUi(
      iframe,
      chatOrigin,
      provideConfig,
      provideToken,
      buildOnBeforeRun,
      handleUnauthorized
    );

    const handshakeTimer = window.setTimeout(() => {
      if (handshakeDone || readyRef.current) return;
      const httpHint = pageIsHttps
        ? ''
        : ' This app is on HTTP localhost — Trimble Assist only allows embedding from HTTPS parents (frame-ancestors). Serve the dashboard over HTTPS, or open Assist from an HTTPS-hosted build.';
      setEmbedError(
        `Assist embed at ${chatOrigin} did not connect.${httpHint}`
      );
      setStatus(
        'Assist iframe did not connect — Run Checklist cannot start until the embed loads.'
      );
    }, 8000);

    return () => {
      window.clearTimeout(handshakeTimer);
      cleanup();
      readyRef.current = false;
      setIframeReady(false);
    };
  }, [
    everOpened,
    assist.configured,
    assist.agentId,
    chatOrigin,
    environment,
    theme,
    provideToken,
    buildOnBeforeRun,
    handleUnauthorized,
    pageIsHttps,
  ]);

  // Fallback: parse CHECKLIST_OUTPUT from chat events if the host tool was not called.
  useEffect(() => {
    if (!everOpened || !assist.configured || !chatOrigin) return undefined;
    return subscribeToChatEvents(chatOrigin, (event) => {
      if (event?.type !== 'run:ended') return;
      if (event.payload?.status === 'failed') {
        setStatus((prev) =>
          prev?.startsWith('Checklist finished')
            ? prev
            : 'Assist run ended with an error — check the chat for details.'
        );
      }
      const text =
        event.payload?.message ||
        event.payload?.text ||
        event.payload?.content ||
        '';
      const parsed = parseOutputFromText(text);
      if (parsed) {
        publishResult({ status: parsed });
      }
    });
  }, [everOpened, assist.configured, chatOrigin, publishResult]);

  const startAudit = useCallback(() => {
    if (!control) {
      setStatus('Select a completed control first.');
      return;
    }
    const payload = buildAuditPayload(control, quarter);
    if (!payload.checklist) {
      setStatus('Checklist is missing on this control row.');
      return;
    }
    if (!payload.driveFolderUrl) {
      setStatus(`${quarter} Drive link is missing on this control row.`);
      return;
    }
    if (!assist.configured) {
      setStatus('Set VITE_ASSIST_AGENT_ID in .env to your Agent Studio UUID.');
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !chatOrigin || !iframeReady) {
      if (autoStart) pendingAutoStartRef.current = true;
      setStatus(
        embedError ||
          'Assist iframe is not ready yet. Wait for Trimble Assist to connect, then try again.'
      );
      return;
    }

    setStatus(
      `Starting checklist for ${payload.controlId} (${quarter}) — resolving Google Sheet inside Drive folder…`
    );
    try {
      sendMessage(
        iframe,
        chatOrigin,
        { type: 'text', text: payload.message },
        { behavior: 'send' }
      );
      setStatus(
        'Checklist running in Assist. Waiting for Success / Failed result…'
      );
    } catch (err) {
      setStatus(err?.message || 'Failed to send checklist message.');
    }
  }, [
    assist.configured,
    chatOrigin,
    control,
    quarter,
    iframeReady,
    embedError,
    autoStart,
  ]);

  useEffect(() => {
    if (open && autoStart) {
      pendingAutoStartRef.current = true;
    }
    if (!open) {
      pendingAutoStartRef.current = false;
    }
  }, [open, autoStart, control]);

  useEffect(() => {
    if (!open || !iframeReady || !pendingAutoStartRef.current) return;
    pendingAutoStartRef.current = false;
    startAudit();
  }, [open, iframeReady, startAudit]);

  const drivePreview = control
    ? driveLinkForQuarter(control, quarter)
    : '';
  const checklistName = control ? checklistLabel(control) : '';
  const knownSheet = control?.['TARGET SHEET'] || control?.['Target Sheet'] || '';
  const canRunChecklist = Boolean(
    control && checklistName && drivePreview && (!assist.configured || iframeReady)
  );

  if (!everOpened && !open) return null;

  return (
    <aside
      className={`assist-panel${open ? '' : ' assist-panel--collapsed'}`}
      aria-label="Trimble Assist run checklist"
      hidden={!open}
      inert={!open ? true : undefined}
    >
      <div className="assist-panel-header">
        <div className="assist-panel-header-copy">
          <ModusWcTypography
            hierarchy="h2"
            size="md"
            weight="semibold"
            label="Run Checklist"
          />
          <p className="assist-panel-subtitle">
            Passes your dashboard Trimble ID access token into Assist. Opens the
            quarter Drive folder, uses the single Google Sheet inside as the
            target, and runs your Agent Studio checklist skill.
          </p>
        </div>
        <ModusWcButton
          variant="borderless"
          color="tertiary"
          shape="square"
          size="sm"
          aria-label="Close Assist panel"
          onButtonClick={() => onClose?.()}
        >
          <ModusWcIcon name="close" size="xs" decorative />
        </ModusWcButton>
      </div>

      <div className="assist-panel-toolbar">
        <ModusWcSelect
          label="Checklist quarter"
          size="sm"
          value={quarter}
          options={QUARTER_OPTIONS}
          onInputChange={(e) => {
            const next = readInputString(e);
            if (next) setQuarter(next);
          }}
        />
        <ModusWcButton
          variant="filled"
          color="primary"
          size="sm"
          customClass="run-checklist-btn"
          disabled={!canRunChecklist}
          onButtonClick={startAudit}
        >
          <ModusWcIcon name="check_circle" size="xs" decorative />
          Run Checklist
        </ModusWcButton>
      </div>

      {authBridge ? (
        <p className="assist-panel-auth" role="status">
          {authBridge}
        </p>
      ) : null}

      {control ? (
        <div className="assist-panel-context">
          <p>
            <strong>Control:</strong> {control['Control ID']}
          </p>
          <p>
            <strong>Checklist:</strong>{' '}
            {checklistName ? (
              checklistName
            ) : (
              <span className="assist-missing-flag" role="status">
                Checklist is missing
              </span>
            )}
          </p>
          <p className="assist-panel-drive">
            <strong>{quarter} folder:</strong>{' '}
            {drivePreview ? (
              <a href={drivePreview} target="_blank" rel="noopener noreferrer">
                Open Drive
              </a>
            ) : (
              <span className="assist-missing-flag" role="status">
                {quarter} Drive link is missing
              </span>
            )}
          </p>
          <p className="assist-panel-drive">
            <strong>Target sheet:</strong>{' '}
            {isGoogleSheetUrl(knownSheet) ? (
              <a href={knownSheet} target="_blank" rel="noopener noreferrer">
                Open Google Sheet
              </a>
            ) : (
              <span className="assist-missing-flag">
                Resolve from Drive folder (single GSheet)
              </span>
            )}
          </p>
        </div>
      ) : (
        <p className="assist-panel-empty">
          Choose a completed control, then run the checklist.
        </p>
      )}

      {status ? (
        <p className="assist-panel-status" role="status">
          {status}
        </p>
      ) : null}

      {embedError ? (
        <div className="assist-embed-error" role="alert">
          <p>{embedError}</p>
          {!pageIsHttps ? (
            <p>
              Restart with <code>npm run dev</code> (HTTPS is enabled in Vite)
              and open <code>https://localhost:3000</code>. Accept the browser
              certificate warning, then register the same HTTPS callback URLs
              on your Trimble ID SPA app.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="assist-panel-chat">
        {assist.configured ? (
          <iframe
            ref={iframeRef}
            title="Trimble Assist"
            src={chatUrl}
            className="assist-iframe"
            sandbox={ASSIST_IFRAME_SANDBOX}
            allow="clipboard-read; clipboard-write"
          />
        ) : (
          <div className="assist-sdk-stub" role="status">
            <p>
              Set <code>VITE_ASSIST_AGENT_ID</code> in <code>.env</code> to the
              UUID of your Agent Studio agent (the one that has the checklist
              skill attached).
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
