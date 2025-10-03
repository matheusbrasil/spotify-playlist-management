import crypto from 'crypto';
import { env } from '../config/env.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
  expiresAt: number;
}

interface SessionRecord {
  state: string;
  redirectUri?: string;
  createdAt: number;
  tokens?: AuthTokens;
}

const sessions = new Map<string, SessionRecord>();

export const createState = (): string => crypto.randomBytes(16).toString('hex');

export const createSession = (state: string, redirectUri?: string): SessionRecord => {
  const record: SessionRecord = {
    state,
    redirectUri,
    createdAt: Date.now(),
  };
  sessions.set(state, record);
  return record;
};

export const getSession = (state: string): SessionRecord | undefined => sessions.get(state);

export const storeTokens = (state: string, tokens: AuthTokens): void => {
  const record = sessions.get(state);
  if (!record) {
    throw new Error('Invalid state parameter');
  }
  record.tokens = tokens;
  sessions.set(state, record);
};

export const consumeSessionTokens = (state: string): AuthTokens | undefined => {
  const record = sessions.get(state);
  if (!record?.tokens) {
    return undefined;
  }
  sessions.delete(state);
  return record.tokens;
};

const cleanup = () => {
  const ttlMs = env.sessionTtlMinutes * 60 * 1000;
  const now = Date.now();
  for (const [state, record] of sessions.entries()) {
    if (now - record.createdAt > ttlMs) {
      sessions.delete(state);
    }
  }
};

setInterval(cleanup, 60_000).unref();
