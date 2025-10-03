import type { Request } from 'express';
import { HttpError } from '../middleware/errorHandler.js';

export const requireAccessToken = (req: Request): string => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new HttpError(401, 'Missing Authorization header');
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new HttpError(401, 'Authorization header must be in the format: Bearer <token>');
  }

  return token;
};
