import { Router } from 'express';
import { getSiteSetting } from '../middleware/auth.js';

const router = Router();

router.get('/status', async (_req, res) => {
  const comingSoon = await getSiteSetting('site_coming_soon', 'false');
  res.json({ comingSoon: comingSoon === 'true' });
});

export default router;
