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

/** Use the caller's JWT and public key: a club role never grants a global service-role client. */
export async function getSupabase(req: ApiRequest, res: ApiResponse): Promise<SupabaseClient | null> {
  const authorization = req.headers?.authorization ?? req.headers?.Authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ') || !authorization.slice(7).trim()) {
    err(res,401,'Giriş yapmanız gerekiyor.');return null;
  }
  const url=process.env.SUPABASE_URL??process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_ANON_KEY??process.env.VITE_SUPABASE_ANON_KEY;
  if(!url||!key){err(res,503,'Hesap doğrulama servisi yapılandırılmamış.');return null;}
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
  try {
    const {data,error}=await client.auth.getUser(authorization.slice(7).trim());
    if(error||!data.user){err(res,401,'Oturum geçersiz veya süresi dolmuş.');return null;}
    if(!data.user.email_confirmed_at){err(res,403,'Önce e-posta adresinizi doğrulayın.');return null;}
    return client;
  }catch{err(res,503,'Oturum doğrulanamadı. Bağlantınızı kontrol edin.');return null;}
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
