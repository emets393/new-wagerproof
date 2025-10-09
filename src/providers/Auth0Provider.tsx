import React from 'react';
import { Auth0Provider } from '@auth0/auth0-react';

interface Auth0ProviderProps {
  children: React.ReactNode;
}

export function Auth0ProviderWrapper({ children }: Auth0ProviderProps) {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_AUTH0_REDIRECT_URI;

  console.log('Auth0 Config:', { domain, clientId, redirectUri });

  if (!domain || !clientId || !redirectUri) {
    console.error('Missing Auth0 environment variables:', { domain, clientId, redirectUri });
    throw new Error('Missing Auth0 environment variables');
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
      }}
    >
      {children}
    </Auth0Provider>
  );
}
