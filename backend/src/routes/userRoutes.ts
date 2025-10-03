import { Router } from 'express';
import { getCurrentUser } from '../controllers/userController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.get('/me', asyncHandler(getCurrentUser));

export default router;
