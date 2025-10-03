import { Router } from 'express';
import { listPlaylists, getPlaylistDetail } from '../controllers/playlistController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.get('/', asyncHandler(listPlaylists));
router.get('/:playlistId', asyncHandler(getPlaylistDetail));

export default router;
