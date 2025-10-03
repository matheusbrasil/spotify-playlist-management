import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Alert } from 'react-native';
import api, { clearAuth, registerRefreshHandler, setAccessToken } from '../services/api';

WebBrowser.maybeCompleteAuthSession();

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
  expiresAt: number;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  loading: boolean;
  authTokens: AuthTokens | null;
  login: () => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authTokens, setAuthTokens] = useState<AuthTokens | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (!authTokens?.refreshToken) {
      return null;
    }

    try {
      const { data } = await api.post<AuthTokens>('/auth/refresh', {
        refreshToken: authTokens.refreshToken,
      });
      setAuthTokens(data);
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch (error) {
      console.warn('Failed to refresh token', error);
      setAuthTokens(null);
      clearAuth();
      return null;
    }
  }, [authTokens]);

  useEffect(() => {
    if (authTokens) {
      setAccessToken(authTokens.accessToken);
      registerRefreshHandler(refreshAccessToken);
    } else {
      clearAuth();
    }
  }, [authTokens, refreshAccessToken]);

  const login = useCallback(async () => {
    setLoading(true);
    try {
      const redirectUri = Linking.createURL('auth-callback');
      const {
        data: { authorizeUrl, state },
      } = await api.post<{ authorizeUrl: string; state: string }>('/auth/start', {
        redirectUri,
      });

      const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, redirectUri);
      if (result.type !== 'success' || !result.url) {
        throw new Error('Authentication was cancelled');
      }

      const parsed = Linking.parse(result.url);
      const sessionState = parsed.queryParams?.state as string | undefined;
      if (!sessionState) {
        throw new Error('Missing session state');
      }

      const { data } = await api.get<AuthTokens>(`/auth/session/${sessionState}`);
      setAuthTokens(data);
      setAccessToken(data.accessToken);
    } catch (error) {
      console.error('Failed to authenticate with Spotify', error);
      Alert.alert('Spotify Login Failed', 'Please try again.');
      clearAuth();
      setAuthTokens(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setAuthTokens(null);
    clearAuth();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(authTokens?.accessToken),
      loading,
      authTokens,
      login,
      logout,
      refreshAccessToken,
    }),
    [authTokens, loading, login, logout, refreshAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
};
