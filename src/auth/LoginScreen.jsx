import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ModusWcAlert,
  ModusWcBadge,
  ModusWcButton,
  ModusWcCard,
  ModusWcIcon,
  ModusWcLogo,
  ModusWcTypography,
} from '@trimble-oss/moduswebcomponents-react';
import { fadeUp } from '../motion/presets';
import '../styles/surface-helpers.css';
import '../styles/login.css';

/** Full-height canvas + centered column shared by the sign-in and session-check screens. */
function LoginFrame({ children }) {
  const reduceMotion = useReducedMotion();
  const enter = fadeUp(reduceMotion, 12);

  return (
    <main className="login-screen">
      <motion.div
        className="login-stage"
        initial={enter.initial}
        animate={enter.animate}
        transition={{ ...enter.transition, duration: 0.48 }}
      >
        <ModusWcCard bordered padding="comfortable">
          <div className="flex min-w-0 flex-col gap-4">
            <ModusWcLogo name="trimble" customClass="login-logo" />
            {children}
          </div>
        </ModusWcCard>
      </motion.div>
    </main>
  );
}

/** Shown while Trimble ID resolves the session or finishes the redirect callback. */
export function AuthStatusScreen({ message = 'Checking your Trimble ID session…' }) {
  return (
    <LoginFrame>
      <div role="status" aria-live="polite">
        <ModusWcTypography hierarchy="p" size="md" label={message} />
      </div>
    </LoginFrame>
  );
}

export default function LoginScreen({
  onLogin,
  error,
  configured = true,
  missingHint = '',
}) {
  const errorMessage = error ? error.message || String(error) : '';

  return (
    <LoginFrame>
      <div className="flex min-w-0 flex-col gap-2">
        <div>
          <ModusWcBadge color="default" size="sm" variant="outlined">
            <span>Control operations</span>
          </ModusWcBadge>
        </div>
        <ModusWcTypography
          hierarchy="h1"
          size="2xl"
          weight="semibold"
          customClass="!m-0"
          label="Control sheet dashboard"
        />
        <ModusWcTypography
          hierarchy="p"
          size="md"
          customClass="surface-muted !m-0"
          label="Sign in with Trimble ID to view live control status and owners, and to run checklist audits with your user token."
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        {!configured ? (
          <ModusWcAlert
            variant="error"
            role="alert"
            alertTitle="Trimble ID isn't set up"
            alertDescription={
              missingHint ||
              'Add the VITE_TID_* values to .env, then restart the dev server.'
            }
          />
        ) : null}

        {errorMessage ? (
          <ModusWcAlert
            variant="error"
            role="alert"
            alertTitle="We couldn't sign you in"
            alertDescription={errorMessage}
          />
        ) : null}
      </div>

      <div className="flex justify-end">
        <ModusWcButton
          color="primary"
          variant="filled"
          size="sm"
          disabled={!configured}
          aria-label="Sign in with Trimble ID"
          onButtonClick={onLogin}
        >
          <ModusWcIcon name="sign-in" version="2.0" size="xs" decorative />
          <span>Sign in</span>
        </ModusWcButton>
      </div>
    </LoginFrame>
  );
}
