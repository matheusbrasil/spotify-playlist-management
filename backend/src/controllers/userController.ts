import type { Request, Response } from 'express';
import { requireAccessToken } from '../utils/auth.js';
import { getCurrentUserProfile } from '../services/spotifyService.js';

export const getCurrentUser = async (req: Request, res: Response) => {
  const accessToken = requireAccessToken(req);
  const user = await getCurrentUserProfile(accessToken);
  res.json({
    id: user.id,
    name: user.display_name ?? user.id,
  });
};
