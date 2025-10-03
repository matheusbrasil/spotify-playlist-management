import { Router } from 'express';
import {
  getSessionTokens,
  handleCallback,
  refreshToken,
  startAuth,
} from '../controllers/authController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.post('/start', asyncHandler(startAuth));
router.get('/callback', asyncHandler(handleCallback));
router.get('/session/:state', asyncHandler(getSessionTokens));
router.post('/refresh', asyncHandler(refreshToken));

export default router;
