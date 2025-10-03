import type { Request, Response } from 'express';
import { getAuthorizeUrl, exchangeCodeForTokens, refreshAccessToken } from '../services/spotifyService.js';
import {
  createSession,
  createState,
  consumeSessionTokens,
  getSession,
  storeTokens,
} from '../store/sessionStore.js';
import { HttpError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

interface StartAuthBody {
  redirectUri?: string;
}

export const startAuth = async (req: Request<unknown, unknown, StartAuthBody>, res: Response) => {
  const redirectUri = req.body?.redirectUri;
  const state = createState();
  createSession(state, redirectUri);
  const authorizeUrl = getAuthorizeUrl(state);

  res.json({
    authorizeUrl,
    state,
  });
};

export const handleCallback = async (req: Request, res: Response) => {
  const { code, state } = req.query as { code?: string; state?: string };
  if (!code || !state) {
    throw new HttpError(400, 'Missing code or state');
  }

  const session = getSession(state);
  if (!session) {
    throw new HttpError(400, 'Invalid or expired state parameter');
  }

  const tokens = await exchangeCodeForTokens(code);
  storeTokens(state, tokens);
  logger.info('Stored Spotify auth tokens for state', { state });

  if (session.redirectUri) {
    const redirectUrl = new URL(session.redirectUri);
    redirectUrl.searchParams.set('state', state);
    res.redirect(redirectUrl.toString());
    return;
  }

  res.send(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Spotify Auth Complete</title>
  </head>
  <body>
    <p>Authentication complete. You may close this window.</p>
    <script>
      window.close();
    </script>
  </body>
</html>`);
};

export const getSessionTokens = async (req: Request<{ state: string }>, res: Response) => {
  const { state } = req.params;
  const tokens = consumeSessionTokens(state);
  if (!tokens) {
    throw new HttpError(404, 'Session not found or already consumed');
  }

  res.json(tokens);
};

interface RefreshBody {
  refreshToken?: string;
}

export const refreshToken = async (req: Request<unknown, unknown, RefreshBody>, res: Response) => {
  const refreshTokenValue = req.body?.refreshToken;
  if (!refreshTokenValue) {
    throw new HttpError(400, 'refreshToken is required');
  }

  const tokens = await refreshAccessToken(refreshTokenValue);
  res.json(tokens);
};
