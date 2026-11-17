import { TIDClient } from '@trimble-oss/trimble-id-react';
import { getTidAuthConfig } from './tidConfig';

const config = getTidAuthConfig();

/** Shared TID client for SPA login (Authorization Code + PKCE via SDK). */
const tidClient = config.configured
  ? new TIDClient({
      config: {
        configurationEndpoint: config.configurationEndpoint,
        clientId: config.clientId,
        redirectUrl: config.redirectUrl,
        logoutRedirectUrl: config.logoutRedirectUrl,
        scopes: config.scopes,
      },
    })
  : null;

export default tidClient;
