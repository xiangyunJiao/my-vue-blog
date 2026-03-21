import { Router } from 'express';
import { registerJsonRoute } from '../lib/apiRoute';

const router = Router();

registerJsonRoute(router, 'get', '/health', async () => ({
  ok: true,
  time: new Date().toISOString(),
}));

export default router;
