import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ModusWcButton, ModusWcIcon } from '@trimble-oss/moduswebcomponents-react';

export default function LoginScreen({
  onLogin,
  error,
  configured = true,
  missingHint = '',
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="tid-login-screen">
      <motion.div
        className="tid-login-stage"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.48, ease: [0.2, 0, 0, 1] }}
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
