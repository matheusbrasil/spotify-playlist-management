import axios from 'axios';
import Constants from 'expo-constants';

const baseURL = Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:4000';

const api = axios.create({
  baseURL,
  timeout: 15000,
});

let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const registerRefreshHandler = (handler: () => Promise<string | null>) => {
  refreshHandler = handler;
};

export const clearAuth = () => {
  accessToken = null;
  refreshHandler = null;
};

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const requestConfig = error.config as typeof error.config & { __isRetry?: boolean };

    if (status === 401 && refreshHandler && !requestConfig.__isRetry) {
      const newToken = await refreshHandler();
      if (newToken) {
        requestConfig.__isRetry = true;
        requestConfig.headers = requestConfig.headers ?? {};
        requestConfig.headers.Authorization = `Bearer ${newToken}`;
        return api(requestConfig);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
