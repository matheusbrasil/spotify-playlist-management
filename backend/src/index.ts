import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const server = http.createServer(app);

server.listen(env.port, () => {
  logger.info(`Server listening on port ${env.port}`);
});

const shutdown = () => {
  logger.info('Shutting down server');
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
