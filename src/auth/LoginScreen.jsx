import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ModusWcButton, ModusWcIcon } from '@trimble-oss/moduswebcomponents-react';
import { fadeUp } from '../motion/presets';

export default function LoginScreen({
  onLogin,
  error,
  configured = true,
  missingHint = '',
}) {
  const reduceMotion = useReducedMotion();
  const enter = fadeUp(reduceMotion, 12);

  return (
    <div className="tid-login-screen">
      <motion.div
        className="tid-login-stage"
        initial={enter.initial}
        animate={enter.animate}
        transition={{ ...enter.transition, duration: 0.48 }}
      >
        <div className="tid-login-brand">
          <span className="brand-emblem">
            <img src="/brand/trimble-emblem.svg" alt="" width={28} height={27} />
          </span>
          <span className="tid-login-brand-copy">
            <span className="brand-title">Trimble</span>
            <span className="brand-kicker">Control Sheet · ITGC</span>
          </span>
        </div>
        <p className="tid-login-kicker">Control operations</p>
        <h1>Control Sheet Dashboard</h1>
        <p className="tid-login-lead">
          Sign in with Trimble ID to view live control status, owners, and run
          checklist audits with your user token.
        </p>

        {!configured ? (
          <p className="tid-login-error" role="alert">
            {missingHint ||
              'Trimble ID login is not configured. Add VITE_TID_* values to .env and restart the dev server.'}
          </p>
        ) : null}

        {error ? (
          <p className="tid-login-error" role="alert">
            {error.message || String(error)}
          </p>
        ) : null}

        <ModusWcButton
          color="primary"
          variant="filled"
          size="md"
          disabled={!configured}
          onButtonClick={onLogin}
        >
          <ModusWcIcon name="person" size="sm" decorative />
          Sign in with Trimble ID
        </ModusWcButton>
      </motion.div>
    </div>
  );
}
