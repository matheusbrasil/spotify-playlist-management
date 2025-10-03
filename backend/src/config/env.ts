import dotenv from 'dotenv';

const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : undefined;
dotenv.config(envFile ? { path: envFile } : undefined);

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseNumber(process.env.PORT, 4000),
  clientUrl: process.env.CLIENT_URL,
  spotifyClientId: requireEnv('SPOTIFY_CLIENT_ID'),
  spotifyClientSecret: requireEnv('SPOTIFY_CLIENT_SECRET'),
  spotifyRedirectUri: requireEnv('SPOTIFY_REDIRECT_URI'),
  spotifyScopes: process.env.SPOTIFY_SCOPES ?? [
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-private',
    'playlist-modify-public',
    'user-read-private',
  ].join(' '),
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash-latest',
  geminiImageModel: process.env.GEMINI_IMAGE_MODEL ?? 'imagen-3.0-generate-002',
  sessionTtlMinutes: parseNumber(process.env.AUTH_SESSION_TTL_MINUTES, 10),
};

export const isProduction = env.nodeEnv === 'production';
