import { Router } from 'express';
import {
  previewSmartSplit,
  applySmartSplit,
  filterPlaylistByGenres,
  createPlaylistFromGenres,
} from '../controllers/smartSplitController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.get('/:playlistId/preview', asyncHandler(previewSmartSplit));
router.post('/:playlistId/apply', asyncHandler(applySmartSplit));
router.post('/:playlistId/filter', asyncHandler(filterPlaylistByGenres));
router.post('/:playlistId/create', asyncHandler(createPlaylistFromGenres));

export default router;
