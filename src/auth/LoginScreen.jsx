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
        <img
          className="tid-login-logo"
          src="/trimble-logo.png"
          alt="Trimble"
          width={168}
          height={52}
        />
        <p className="tid-login-kicker">ITGC operations</p>
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
