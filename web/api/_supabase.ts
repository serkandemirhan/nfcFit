import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[]>;
  body?: any;
  text?: () => Promise<string>;
  headers?: Record<string, any>;
  [key: string]: any;
};

export type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: any) => ApiResponse | void;
  setHeader?: (name: string, value: string) => void;
  [key: string]: any;
};

export function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missidng SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

export async function readJson<T = any>(req: ApiRequest): Promise<T> {
  try {
    if (req.body && typeof req.body === 'object') return req.body as T;
    if (typeof req.text === 'function') {
      const data = await req.text();
      return data ? JSON.parse(data) : ({} as any);
    }
    const chunks: Uint8Array[] = [];
    if (typeof (req as any)[Symbol.asyncIterator] === 'function') {
      for await (const chunk of req as any) chunks.push(chunk);
    }
    if (!chunks.length) return {} as any;
    const text = Buffer.concat(chunks as any).toString('utf8');
    return text ? JSON.parse(text) : ({} as any);
  } catch {
    return {} as any;
  }
}

export function ok(res: ApiResponse, data: any, status = 200) {
  res.setHeader?.('Cache-Control', 'no-store');
  res.status(status).json(data);
}

export function err(res: ApiResponse, status = 500, message = 'Server error') {
  res.setHeader?.('Cache-Control', 'no-store');
  res.status(status).json({ error: message });
}

const allowedOrigins = (process.env.API_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export function ensureOriginAllowed(req: ApiRequest, res: ApiResponse): boolean {
  if (allowedOrigins.length === 0) {
    return true;
  }

  const originHeader = req.headers?.origin;
  let origin = originHeader;

  if (!origin && req.headers?.referer) {
    try {
      origin = new URL(req.headers.referer).origin;
    } catch {
      origin = null;
    }
  }

  if (!origin || allowedOrigins.includes(origin)) {
    return true;
  }

  res.setHeader?.('Cache-Control', 'no-store');
  res.status(403).json({ error: 'Forbidden' });
  return false;
}
