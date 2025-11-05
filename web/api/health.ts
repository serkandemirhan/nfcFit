import type { ApiRequest, ApiResponse } from './_supabase.js';
import { ensureOriginAllowed } from './_supabase.js';

export default function handler(_req: ApiRequest, res: ApiResponse) {
  if (!ensureOriginAllowed(_req, res)) return;
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}
