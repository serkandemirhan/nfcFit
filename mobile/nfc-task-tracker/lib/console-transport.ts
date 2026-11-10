/** HTTP deadlines start after session preparation. Mutations are never blindly replayed here. */
export class ConsoleTransportError extends Error {
  constructor(message: string, public kind: 'timeout' | 'network' | 'cancelled', public route: string, public elapsedMs: number) {
    super(message);
    this.name = 'ConsoleTransportError';
  }
}
export function readableSyncError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (/^(aborted|the operation was aborted\.?|aborterror.*)$/i.test(message.trim()))
    return 'Sunucu zamanında yanıt vermedi. Telefonundaki kayıtlar korunuyor; yeniden eşitleyebilirsin.';
  if (/^(network request failed|failed to fetch)$/i.test(message.trim()))
    return 'Sunucuya ulaşılamadı. Bağlantını kontrol et; telefonundaki kayıtlar korunuyor.';
  return message || 'İşlem tamamlanamadı. Yeniden deneyebilirsin.';
}
export async function consoleTransport<T>(
  url: string, init: RequestInit, consume: (response: Response) => Promise<T>,
  timeoutMs = 25_000, fetcher: typeof fetch = fetch,
): Promise<T> {
  const control = new AbortController();
  const started = Date.now();
  let timedOut = false;
  const cancelled = () => control.abort();
  const route = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  if (init.signal?.aborted) throw new ConsoleTransportError('İşlem iptal edildi.', 'cancelled', route, 0);
  init.signal?.addEventListener('abort', cancelled, { once: true });
  const timer = setTimeout(() => { timedOut = true; control.abort(); }, timeoutMs);
  try {
    return await consume(await fetcher(url, { ...init, signal: control.signal }));
  } catch (error) {
    const elapsed = Date.now() - started;
    if (timedOut) throw new ConsoleTransportError(
      init.method && init.method !== 'GET'
        ? 'Sunucu yanıtı zamanında alınamadı. Kayıt oluşmuş olabilir; listeyi yenile veya bekleyen kayıtları aynı kimlikle eşitle.'
        : 'Sunucu zamanında yanıt vermedi. Telefonundaki kayıtlar korunuyor; yeniden deneyebilirsin.',
      'timeout', route, elapsed,
    );
    if (init.signal?.aborted) throw new ConsoleTransportError('İşlem iptal edildi.', 'cancelled', route, elapsed);
    if (/^(network request failed|failed to fetch)$/i.test(error instanceof Error ? error.message : ''))
      throw new ConsoleTransportError(readableSyncError(error), 'network', route, elapsed);
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', cancelled);
  }
}
