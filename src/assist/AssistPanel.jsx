import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ModusWcAlert,
  ModusWcBadge,
  ModusWcButton,
  ModusWcCard,
  ModusWcEmptyState,
  ModusWcIcon,
  ModusWcSelect,
  ModusWcTypography,
  ModusWcUtilityPanel,
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
import {
  inspectAccessToken,
  missingAgentsScope,
  runAgentWithUserToken,
} from './agentApi';
import { stashPendingChecklistRun } from './pendingChecklistRun';
import { useMinWidth } from '../components/shell/useMinWidth';
import { PUSH_LAYOUT_MIN_PX } from '../components/shell/shellLayout';
import '../styles/surface-helpers.css';
import '../styles/assist-panel.css';

/** Shell ids/classes the utility panel attaches to (see components/shell/AppShell.jsx). */
const PUSH_TARGET_ID = 'main-content';
const PANEL_HOST_SELECTOR = '.app-body-row';
const PUSHED_CLASS = 'modus-wc-utility-panel-pushed';

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

/** Assist embed with skills:true needs both models + skills on the access token. */
function missingAssistScopes(claims) {
  if (!claims?.scopeSet) return ['models', 'skills'];
  const missing = [];
  if (![...claims.scopeSet].some((s) => s === 'models' || s.endsWith('-models'))) {
    missing.push('models');
  }
  if (![...claims.scopeSet].some((s) => s === 'skills' || s.endsWith('-skills'))) {
    missing.push('skills');
  }
  return missing;
}

function missingScopesForRuntime(runtime, claims) {
  return runtime === 'assist'
    ? missingAssistScopes(claims)
    : missingAgentsScope(claims);
}

/**
 * Sandbox for Assist iframe. Popups + top-nav-by-gesture so TID Sign in can leave
 * the frame (Cursor/embedded browsers often block sandboxed OAuth popups otherwise).
 */
const ASSIST_IFRAME_SANDBOX = `${CHAT_UI_IFRAME_SANDBOX_ATTRIBUTES} allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation`;

/**
 * Side panel that embeds Trimble Assist via the iframe SDK
 * (avoids agentic-chat-react's broken require("react") bundle).
 *
 * Auth: uses the dashboard Trimble ID *user* access token from SPA login
 * (not the n8n client-credentials app token). Default runtime is Agents API
 * (`VITE_AGENT_RUNTIME=api`) with scope `agents`.
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
    loginWithRedirect,
    user,
  } = useAuth();
  const iframeRef = useRef(null);
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);
  const readyRef = useRef(false);
  const pendingAutoStartRef = useRef(false);
  const latestTokenRef = useRef('');
  const tokenRejectedRef = useRef(false);
  const unauthorizedReloadsRef = useRef(0);
  const runAbortRef = useRef(null);
  const runGuardRef = useRef(false);
  const controlRef = useRef(control);
  const quarterRef = useRef(initialQuarter || currentCalendarQuarter());
  const onResultRef = useRef(onChecklistResult);
  const provideTokenRef = useRef(async () => '');
  const buildOnBeforeRunRef = useRef(() => ({
    tools: { runTime: {}, global: {} },
    runContext: { context: [] },
  }));
  const handleUnauthorizedRef = useRef(async () => undefined);
  const [quarter, setQuarter] = useState(
    () => initialQuarter || currentCalendarQuarter()
  );
  const [theme, setTheme] = useState(resolveTheme);
  const [status, setStatus] = useState('');
  const [authBridge, setAuthBridge] = useState('');
  const [iframeReady, setIframeReady] = useState(false);
  const [embedError, setEmbedError] = useState('');
  const [needsAssistReauth, setNeedsAssistReauth] = useState(false);
  const [agentTranscript, setAgentTranscript] = useState('');
  const [agentRunning, setAgentRunning] = useState(false);
  // Keep iframe mounted after first open so Assist TID session can stick.
  const [everOpened, setEverOpened] = useState(false);
  // The shell owns <main> and the body row; the panel docks to the body row and pushes <main>.
  const [dock, setDock] = useState({ host: null, target: null });
  const isPushLayout = useMinWidth(PUSH_LAYOUT_MIN_PX);
  const assist = useMemo(() => getAssistConfig(), []);
  const useAgentsApi = assist.runtime !== 'assist';
  const pageIsHttps =
    typeof window !== 'undefined' && window.location.protocol === 'https:';

  useEffect(() => {
    controlRef.current = control;
    quarterRef.current = quarter;
    onResultRef.current = onChecklistResult;
  }, [control, quarter, onChecklistResult]);

  const reauthToAssist = useCallback(async () => {
    latestTokenRef.current = '';
    tokenRejectedRef.current = false;
    setNeedsAssistReauth(false);
    setStatus(
      useAgentsApi
        ? 'Opening Trimble ID so login can mint a user access token with the agents scope…'
        : 'Opening Trimble ID so the dashboard can mint an Assist-capable access token…'
    );
    try {
      // Re-run Authorization Code + PKCE with current tidClient scopes
      // (VITE_ASSIST_API_SCOPE — agents for API runtime, or models/skills for Assist).
      await loginWithRedirect();
    } catch (err) {
      setStatus(
        err?.message ||
          'Could not start Trimble ID sign-in. Use Sign out on the header, then sign in again.'
      );
    }
  }, [loginWithRedirect, useAgentsApi]);

  // Resolve the shell elements before paint so the panel never renders in the wrong place.
  useLayoutEffect(() => {
    setDock({
      host: document.querySelector(PANEL_HOST_SELECTOR),
      target: document.getElementById(PUSH_TARGET_ID),
    });
  }, []);

  // The utility panel leaves its push class on <main> when it unmounts (route change).
  useEffect(() => {
    const target = dock.target;
    return () => target?.classList.remove(PUSHED_CLASS);
  }, [dock.target]);

  // Push on desktop, overlay below the shell breakpoint. The component only re-evaluates the
  // push class on open/close, so keep it in step when the viewport crosses the breakpoint.
  useEffect(() => {
    const target = dock.target;
    if (!target) return;
    if (open && isPushLayout) {
      target.classList.add('modus-wc-utility-panel-push-target', PUSHED_CLASS);
    } else {
      target.classList.remove(PUSHED_CLASS);
    }
  }, [open, isPushLayout, dock.target]);

  // Focus return: remember the opener, send focus back when the panel closes (Escape, ×, Run again).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open) {
      setEverOpened(true);
      unauthorizedReloadsRef.current = 0;
      returnFocusRef.current = document.activeElement;
    } else if (wasOpenRef.current) {
      const el = returnFocusRef.current;
      if (el && typeof el.focus === 'function' && el.isConnected) {
        window.setTimeout(() => el.focus({ preventScroll: true }), 0);
      }
    }
    wasOpenRef.current = open;
  }, [open]);

  // Move focus into the panel once it opens. preventScroll: the closed panel sits off-canvas.
  const handlePanelOpened = useCallback(() => {
    window.setTimeout(() => {
      const closeHost = panelRef.current?.querySelector?.('[data-assist-close]');
      const control = closeHost?.querySelector?.('button') || closeHost;
      control?.focus?.({ preventScroll: true });
    }, 0);
  }, []);

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

  // Escape is handled by modus-wc-utility-panel itself (it emits panelClosed).
  useEffect(() => {
    if (open) setTheme(resolveTheme());
  }, [open]);

  const resolveAccessToken = useCallback(
    async ({ forceRefresh = false } = {}) => {
      if (!isAuthenticated) {
        throw new Error(
          'Sign in with Trimble ID on the dashboard login screen first.'
        );
      }
      if (forceRefresh) {
        latestTokenRef.current = '';
      }
      if (!forceRefresh && latestTokenRef.current) {
        return latestTokenRef.current;
      }

      let accessToken = '';
      // Prefer silent refresh so scope changes in .env are picked up after re-login.
      if (typeof getAccessTokenSilently === 'function') {
        try {
          accessToken = (await getAccessTokenSilently()) || '';
        } catch {
          accessToken = '';
        }
      }
      if (!accessToken && typeof getTokens === 'function') {
        const tokens = await getTokens();
        accessToken = tokens?.access_token || '';
      }
      if (!accessToken) {
        throw new Error('No Trimble ID access token available.');
      }

      const claims = inspectAccessToken(accessToken);
      const missing = missingScopesForRuntime(assist.runtime, claims);
      if (missing.length) {
        latestTokenRef.current = '';
        setNeedsAssistReauth(true);
        const err = new Error(
          useAgentsApi
            ? `Login token is missing scope(s): ${missing.join(', ')}. Sign out and sign in again so VITE_ASSIST_API_SCOPE includes agents (user token, not the app client-credentials token).`
            : `Dashboard token is missing Assist scope(s): ${missing.join(', ')}. Sign out and sign in again (or use Sign in) so VITE_ASSIST_API_SCOPE=models,skills is on the access token.`
        );
        err.code = 'ASSIST_SCOPES_MISSING';
        err.claims = claims;
        throw err;
      }

      latestTokenRef.current = accessToken;
      tokenRejectedRef.current = false;
      setNeedsAssistReauth(false);
      return accessToken;
    },
    [
      getAccessTokenSilently,
      getTokens,
      isAuthenticated,
      assist.runtime,
      useAgentsApi,
    ]
  );

  // Prefetch dashboard TID access token whenever the panel is used.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    (async () => {
      if (!isAuthenticated) {
        latestTokenRef.current = '';
        setNeedsAssistReauth(false);
        setAuthBridge(
          'Dashboard is not signed in. Sign in with Trimble ID on the main login screen first.'
        );
        return;
      }
      try {
        const accessToken = await resolveAccessToken({ forceRefresh: false });
        if (cancelled) return;
        const claims = inspectAccessToken(accessToken);
        const who =
          user?.email || user?.name || user?.id || 'Trimble ID user';
        const identity = claims?.identityType
          ? ` identity=${claims.identityType}`
          : '';
        setAuthBridge(
          claims
            ? `Dashboard user session: ${who}.${identity} Token aud=${claims.aud || '—'}; scope=${claims.scope || '—'}. Runtime=${assist.runtime}.`
            : `Dashboard user session: ${who}. Access token ready. Runtime=${assist.runtime}.`
        );
      } catch (err) {
        if (cancelled) return;
        latestTokenRef.current = '';
        if (err?.code === 'ASSIST_SCOPES_MISSING') {
          const claims = err.claims;
          const missing = missingScopesForRuntime(assist.runtime, claims);
          setAuthBridge(
            useAgentsApi
              ? `Signed in, but this user token cannot call Agents API (missing ${missing.join(', ') || 'agents'}). Use Reauthorize below, then sign in again.`
              : `Dashboard is signed in, but this access token cannot unlock Assist (missing ${missing.join(', ') || 'required'} scope). Use Sign in below.`
          );
          setStatus(err.message);
          return;
        }
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
    resolveAccessToken,
    user?.email,
    user?.name,
    user?.id,
    assist.runtime,
    useAgentsApi,
  ]);

  // Assist asks the parent for the dashboard access token over postMessage.
  // Do NOT redirect to login from this callback — that aborts the checklist.
  const provideToken = useCallback(async () => {
    const accessToken = await resolveAccessToken({
      forceRefresh: tokenRejectedRef.current,
    });
    return accessToken;
  }, [resolveAccessToken]);

  const handleUnauthorized = useCallback(async () => {
    const previous = latestTokenRef.current;
    const claims = inspectAccessToken(previous);
    const claimHint = claims
      ? ` Current token aud=${claims.aud || '—'}; scope=${claims.scope || '—'}.`
      : '';
    tokenRejectedRef.current = true;
    latestTokenRef.current = '';
    pendingAutoStartRef.current = true;
    // Always offer parent-side re-auth — Assist's own Sign in UI is unreliable
    // in embedded browsers, and a rejected token usually means consent/scopes.
    setNeedsAssistReauth(true);

    try {
      await resolveAccessToken({ forceRefresh: true });
      // One reload so Chat UI re-requests config + the refreshed access token.
      const iframe = iframeRef.current;
      if (iframe && chatUrl && unauthorizedReloadsRef.current < 1) {
        unauthorizedReloadsRef.current += 1;
        readyRef.current = false;
        setIframeReady(false);
        const next = new URL(chatUrl, window.location.href);
        next.searchParams.set('_host', String(Date.now()));
        iframe.src = next.toString();
        setStatus(
          `Assist rejected the previous token; refreshed and reloading Assist.${claimHint}`
        );
        return 'Refreshed dashboard Trimble ID access token — Assist is reloading.';
      }
      setStatus(
        `Assist still rejects this dashboard token.${claimHint} Your SPA app must be allowed to request Assist API scopes (models, skills) in Developer Console, and this stage agent must be usable by your account. Use Sign in to re-consent, or open Assist at assist stage in a normal browser tab.`
      );
      return 'Dashboard Trimble ID token was rejected by Assist.';
    } catch {
      setStatus(
        `Assist rejected the dashboard Trimble ID access token.${claimHint} Use Sign in below so Trimble ID re-issues models+skills, then run the checklist again.`
      );
      return 'Dashboard Trimble ID token was rejected by Assist.';
    }
  }, [resolveAccessToken, chatUrl]);

  useEffect(() => {
    provideTokenRef.current = provideToken;
    handleUnauthorizedRef.current = handleUnauthorized;
  }, [provideToken, handleUnauthorized]);

  const buildOnBeforeRun = useCallback(() => {
    const current = controlRef.current;
    const q = quarterRef.current;
    if (!current) {
      return { tools: { runTime: {}, global: {} }, runContext: { context: [] } };
    }
    const { context } = buildAuditPayload(current, q);
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
  }, [publishResult]);

  useEffect(() => {
    buildOnBeforeRunRef.current = buildOnBeforeRun;
  }, [buildOnBeforeRun]);

  // Wire iframe ↔ host once the iframe exists. Keep listener while everOpened.
  // Callbacks are read from refs so changing control/quarter does NOT tear down
  // the postMessage bridge (that was dropping Assist auth mid-session).
  useLayoutEffect(() => {
    if (useAgentsApi) return undefined;
    if (!everOpened || !assist.configured || !chatOrigin || !chatUrl) {
      return undefined;
    }
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
        features: { skills: true, debugLogging: true },
        uiConfig: {
          theme,
          contentVariant: ContentVariants.Chat,
          variant: ChatUiVariants.Minimal,
          chatInput: { buttons: [], hideModelSelection: true },
          // Must stay false: true shows Assist's own TID Sign in screen and
          // ignores/overlays the parent-provided dashboard access token. That
          // in-iframe Sign in also cannot open a TID popup in this browser.
          showSignIn: false,
        },
      };
    };

    const cleanup = listenToChatUi(
      iframe,
      chatOrigin,
      provideConfig,
      () => provideTokenRef.current(),
      () => buildOnBeforeRunRef.current(),
      () => handleUnauthorizedRef.current()
    );

    // Force Chat UI to re-request config/token with the latest host settings
    // (showSignIn:false). Plain same-src assignment is a no-op in browsers.
    const next = new URL(chatUrl, window.location.href);
    next.searchParams.set('_host', String(Date.now()));
    iframe.src = next.toString();

    const handshakeTimer = window.setTimeout(() => {
      if (handshakeDone || readyRef.current) return;
      const httpHint = pageIsHttps
        ? ''
        : ' This app is on HTTP localhost — Trimble Assist only allows embedding from HTTPS parents (frame-ancestors). Serve the dashboard over HTTPS, or open Assist from an HTTPS-hosted build.';
      setEmbedError(
        `Assist embed at ${chatOrigin} did not connect.${httpHint}`
      );
      setStatus(
        'Assist iframe did not connect — the checklist cannot start until the embed loads.'
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
    chatUrl,
    environment,
    theme,
    pageIsHttps,
    useAgentsApi,
  ]);

  // Fallback: parse CHECKLIST_OUTPUT from chat events if the host tool was not called.
  useEffect(() => {
    if (useAgentsApi) return undefined;
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
  }, [everOpened, assist.configured, chatOrigin, publishResult, useAgentsApi]);

  const startAudit = useCallback(async () => {
    if (runGuardRef.current || agentRunning) return;
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

    if (!isAuthenticated) {
      stashPendingChecklistRun({
        controlId: control.id || control['Control ID'],
        quarter,
        autoStart: true,
      });
      setStatus(
        'Sign-in required — opening Trimble ID, then the checklist run will resume.'
      );
      try {
        await loginWithRedirect();
      } catch (err) {
        setStatus(
          err?.message ||
            'Could not start Trimble ID sign-in. Open the login screen, then run the checklist again.'
        );
      }
      return;
    }

    let accessToken = '';
    try {
      accessToken = await resolveAccessToken({
        forceRefresh: tokenRejectedRef.current,
      });
    } catch (err) {
      setStatus(err?.message || 'Auth is not ready.');
      if (err?.code === 'ASSIST_SCOPES_MISSING') {
        setNeedsAssistReauth(true);
        stashPendingChecklistRun({
          controlId: control.id || control['Control ID'],
          quarter,
          autoStart: true,
        });
      }
      return;
    }

    if (useAgentsApi) {
      runGuardRef.current = true;
      runAbortRef.current?.abort();
      const controller = new AbortController();
      runAbortRef.current = controller;
      setAgentRunning(true);
      setAgentTranscript('');
      setStatus(
        `Starting checklist for ${payload.controlId} (${quarter}) with your login user token…`
      );
      try {
        const result = await runAgentWithUserToken({
          agentId: assist.agentId,
          accessToken,
          message: payload.message,
          context: payload.context,
          environment: assist.environment,
          signal: controller.signal,
          onEvent: (event) => {
            if (event?.type === 'TEXT_MESSAGE_CONTENT' && event.delta) {
              setAgentTranscript((prev) => prev + event.delta);
            }
          },
        });
        setAgentTranscript(result.text || '');
        const parsed = parseOutputFromText(result.text);
        if (parsed) {
          publishResult({ status: parsed });
          setStatus(
            `Checklist finished via Agents API (${parsed}) using your user token.`
          );
        } else {
          setStatus(
            'Agent run finished. No CHECKLIST_OUTPUT line found — check the reply below.'
          );
        }
      } catch (err) {
        if (err?.name === 'AbortError') {
          setStatus('Checklist run cancelled.');
          return;
        }
        if (err?.code === 'AGENTS_SCOPE_MISSING') {
          setNeedsAssistReauth(true);
        }
        if (err?.code === 'AGENTS_NOT_FOUND') {
          setStatus(
            `Agent ${assist.agentId} was not found for your user token. Share the agent with your user/org (Viewer) in Agent Studio — this path does not use the app client-credentials token.`
          );
          return;
        }
        setStatus(err?.message || 'Agent run failed.');
      } finally {
        setAgentRunning(false);
        runGuardRef.current = false;
      }
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
    assist.agentId,
    assist.environment,
    chatOrigin,
    control,
    quarter,
    iframeReady,
    embedError,
    autoStart,
    resolveAccessToken,
    useAgentsApi,
    publishResult,
    agentRunning,
    isAuthenticated,
    loginWithRedirect,
  ]);

  useEffect(() => {
    if (open && autoStart) {
      pendingAutoStartRef.current = true;
    }
    if (!open) {
      pendingAutoStartRef.current = false;
      runAbortRef.current?.abort();
    }
  }, [open, autoStart, control]);

  useEffect(() => {
    if (!open || !pendingAutoStartRef.current) return;
    // Wait for auth + scopes before consuming the auto-start latch.
    if (!isAuthenticated) return;
    if (needsAssistReauth) return;
    if (!useAgentsApi && !iframeReady) return;
    pendingAutoStartRef.current = false;
    void startAudit();
  }, [
    open,
    iframeReady,
    startAudit,
    needsAssistReauth,
    useAgentsApi,
    isAuthenticated,
  ]);

  const drivePreview = control
    ? driveLinkForQuarter(control, quarter)
    : '';
  const checklistName = control ? checklistLabel(control) : '';
  const knownSheet = control?.['TARGET SHEET'] || control?.['Target Sheet'] || '';
  const canRunChecklist = Boolean(
    control &&
      checklistName &&
      drivePreview &&
      assist.configured &&
      (useAgentsApi || iframeReady)
  );

  if (!dock.host) return null;

  const reauthLabel = useAgentsApi ? 'Reauthorize' : 'Sign in';
  const reauthAriaLabel = useAgentsApi
    ? 'Reauthorize for agent scopes'
    : 'Sign in to Assist';
  const subtitle = useAgentsApi
    ? 'Calls the Agents API with your dashboard login user token (not the app client-credentials token). Opens the quarter Drive folder, uses the single Google Sheet inside as the target, and runs your Agent Studio checklist skill.'
    : 'Passes your dashboard Trimble ID access token into Assist. Opens the quarter Drive folder, uses the single Google Sheet inside as the target, and runs your Agent Studio checklist skill.';
  const reauthMessage = useAgentsApi
    ? 'This flow needs your login user Trimble ID token with the agents scope. Sign out and in again, or use Reauthorize above. The n8n app client-credentials token is not used here.'
    : "Assist needs a dashboard Trimble ID token with the models and skills scopes. The Sign in button inside the chat iframe usually can't open a Trimble ID popup in this browser, so use Sign in above instead.";
  const embedErrorMessage = embedError
    ? `${embedError}${
        pageIsHttps
          ? ''
          : ' Restart with npm run dev (HTTPS is enabled in Vite) and open https://localhost:3000. Accept the browser certificate warning, then register the same HTTPS callback URLs on your Trimble ID SPA app.'
      }`
    : '';
  // Collapsed content stays mounted (Modus slots) but must not be tabbable off-canvas.
  const inert = open ? undefined : true;

  const panel = (
    <ModusWcUtilityPanel
      ref={panelRef}
      expanded={open}
      pushContent={isPushLayout}
      targetElement={dock.target}
      customClass="assist-utility-panel"
      aria-label="Run checklist with Trimble agent"
      onPanelOpened={handlePanelOpened}
      onPanelClosed={() => onClose?.()}
    >
      <div
        slot="header"
        inert={inert}
        className="flex w-full min-w-0 items-center justify-between gap-2"
      >
        <ModusWcTypography
          hierarchy="h2"
          size="lg"
          weight="semibold"
          customClass="!m-0"
          label="Run checklist"
        />
        <ModusWcButton
          data-assist-close
          variant="borderless"
          color="tertiary"
          shape="square"
          size="sm"
          aria-label="Close run checklist panel"
          onButtonClick={() => onClose?.()}
        >
          <ModusWcIcon name="x" version="2.0" size="xs" decorative />
        </ModusWcButton>
      </div>

      <div slot="body" inert={inert} className="flex h-full min-h-0 min-w-0 flex-col gap-3">
        <ModusWcTypography
          hierarchy="p"
          size="sm"
          customClass="surface-muted !m-0"
          label={subtitle}
        />

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

        <div className="flex flex-wrap items-center justify-end gap-2">
          <ModusWcButton
            variant="outlined"
            color="tertiary"
            size="sm"
            aria-label={reauthAriaLabel}
            onButtonClick={() => {
              void reauthToAssist();
            }}
          >
            <ModusWcIcon name="user" version="2.0" size="xs" decorative />
            <span>{reauthLabel}</span>
          </ModusWcButton>
          <ModusWcButton
            variant="filled"
            color="primary"
            size="sm"
            disabled={!canRunChecklist || needsAssistReauth || agentRunning}
            aria-busy={agentRunning || undefined}
            onButtonClick={() => {
              if (runGuardRef.current || agentRunning) return;
              void startAudit();
            }}
          >
            <ModusWcIcon name="clipboard-check" version="2.0" size="xs" decorative />
            <span>{agentRunning ? 'Running…' : 'Run checklist'}</span>
          </ModusWcButton>
        </div>

        {/* Alerts mount and unmount inside this plain wrapper, never directly in a Modus slot. */}
        <div className="flex flex-col gap-2 empty:hidden">
          {authBridge ? (
            <ModusWcAlert
              variant="info"
              role="status"
              contentDisplayMode="expandable"
              alertDescription={authBridge}
            />
          ) : null}
          {needsAssistReauth ? (
            <ModusWcAlert
              variant="warning"
              role="alert"
              alertTitle="Sign-in needs a new token"
              alertDescription={reauthMessage}
            />
          ) : null}
          {status ? (
            <ModusWcAlert variant="info" role="status" alertDescription={status} />
          ) : null}
          {embedErrorMessage ? (
            <ModusWcAlert
              variant="error"
              role="alert"
              alertTitle="Assist didn't connect"
              alertDescription={embedErrorMessage}
            />
          ) : null}
        </div>

        <div className={control ? 'surface-hidden' : ''}>
          <ModusWcEmptyState
            variant="compact"
            illustration="selection_plus"
            heading="No control selected"
            subtitle="Choose a ticketed control, then run the checklist."
          />
        </div>

        <div className={control ? '' : 'surface-hidden'}>
          <ModusWcCard bordered padding="compact">
            <div slot="title" className="mb-2 flex w-full min-w-0 items-center gap-2">
              <ModusWcIcon name="clipboard-check" version="2.0" decorative />
              <ModusWcTypography
                hierarchy="h3"
                size="md"
                weight="semibold"
                customClass="!m-0"
                label="Selected control"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <ContextRow label="Control">
                <ModusWcTypography
                  hierarchy="p"
                  size="sm"
                  customClass="!m-0"
                  label={control?.['Control ID'] || '—'}
                />
              </ContextRow>
              <ContextRow label="Checklist">
                {checklistName ? (
                  <ModusWcTypography
                    hierarchy="p"
                    size="sm"
                    customClass="!m-0 break-words"
                    label={checklistName}
                  />
                ) : (
                  <ModusWcBadge color="warning" size="sm">
                    <span>Checklist is missing</span>
                  </ModusWcBadge>
                )}
              </ContextRow>
              <ContextRow label={`${quarter} folder`}>
                {drivePreview ? (
                  <a
                    className="surface-link"
                    href={drivePreview}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Drive
                  </a>
                ) : (
                  <ModusWcBadge color="warning" size="sm">
                    <span>{`${quarter} Drive link is missing`}</span>
                  </ModusWcBadge>
                )}
              </ContextRow>
              <ContextRow label="Target sheet">
                {isGoogleSheetUrl(knownSheet) ? (
                  <a
                    className="surface-link"
                    href={knownSheet}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open sheet
                  </a>
                ) : (
                  <ModusWcTypography
                    hierarchy="p"
                    size="sm"
                    customClass="surface-muted !m-0"
                    label="Resolved from the Drive folder (single Google Sheet)"
                  />
                )}
              </ContextRow>
            </div>
          </ModusWcCard>
        </div>

        <div className="assist-chat flex min-h-64 min-w-0 flex-1 flex-col">
          {!assist.configured ? (
            <ModusWcAlert
              variant="warning"
              role="status"
              alertTitle="Agent isn't configured"
              alertDescription="Set VITE_ASSIST_AGENT_ID in .env to the UUID of your Agent Studio agent (the one with the checklist skill attached)."
            />
          ) : useAgentsApi ? (
            <div role="log" aria-live="polite" className="assist-transcript">
              {agentTranscript ? (
                <pre>{agentTranscript}</pre>
              ) : (
                <ModusWcTypography
                  hierarchy="p"
                  size="sm"
                  customClass="surface-muted !m-0"
                  label="Agent replies stream here. The run uses your login user token against the Agents API (VITE_AGENT_RUNTIME=api)."
                />
              )}
            </div>
          ) : everOpened ? (
            <iframe
              ref={iframeRef}
              title="Trimble Assist"
              src={chatUrl}
              className="assist-chat-frame"
              sandbox={ASSIST_IFRAME_SANDBOX}
              allow="clipboard-read; clipboard-write"
            />
          ) : null}
        </div>
      </div>
    </ModusWcUtilityPanel>
  );

  return createPortal(panel, dock.host);
}

/** Label + value line in the selected-control card. */
function ContextRow({ label, children }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <ModusWcTypography
        hierarchy="p"
        size="sm"
        weight="semibold"
        customClass="!m-0"
        label={`${label}:`}
      />
      {children}
    </div>
  );
}
