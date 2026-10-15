export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type ApiCaller = <T = unknown>(method: string, path: string, body?: unknown) => Promise<T>;

export const authHeaders = (token?: string | null): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {};

/** The server's `error` message when the body carries one, else `fallback`. */
export async function responseError(res: Response, fallback: string): Promise<ApiError> {
  try {
    const data = await res.json();
    if (data?.error) return new ApiError(data.error, res.status);
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(fallback, res.status);
}

export async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(path, {
    method,
    signal: signal ?? (method === 'GET' ? AbortSignal.timeout(8000) : undefined),
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await responseError(res, `Server error (${res.status})`);
  try {
    return await res.json() as T;
  } catch {
    throw new ApiError('Invalid response from server', res.status);
  }
}

export interface ImportResult {
  imported: number;
  skipped: { index: number; reason: string }[];
  errors: { index: number; error: string }[];
}

export function importSongs(songs: { content: string }[], token: string): Promise<ImportResult> {
  return api<ImportResult>('POST', '/api/songs/import', { songs }, token);
}

export function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const m = /filename="?([^";]+)"?/.exec(header);
  return m ? m[1] : fallback;
}

export async function exportSongsBlob(token: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch('/api/songs/export', { headers: authHeaders(token) });
  if (!res.ok) throw await responseError(res, `Export failed (${res.status})`);
  const blob = await res.blob();
  const filename = filenameFromDisposition(res.headers.get('Content-Disposition'), 'chordvault-export.zip');
  return { blob, filename };
}
