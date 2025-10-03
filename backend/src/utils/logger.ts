/* eslint-disable no-console */
export const logger = {
  info: (message: string, meta?: unknown) => {
    if (meta) {
      console.log(`[info] ${message}`, meta);
    } else {
      console.log(`[info] ${message}`);
    }
  },
  warn: (message: string, meta?: unknown) => {
    if (meta) {
      console.warn(`[warn] ${message}`, meta);
    } else {
      console.warn(`[warn] ${message}`);
    }
  },
  error: (message: string, meta?: unknown) => {
    if (meta) {
      console.error(`[error] ${message}`, meta);
    } else {
      console.error(`[error] ${message}`);
    }
  },
};
