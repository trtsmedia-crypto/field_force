declare global {
  interface Window {
    __FIELDFORCE_API__?: string;
  }
}

/**
 * Resolution order:
 *  1. window.__FIELDFORCE_API__ from public/config.js — editable after deploy
 *  2. VITE_API_URL baked in at build time
 *  3. localhost, for development
 *
 * The first one exists so a hosted build can be pointed at a different API by
 * editing one file, without rebuilding.
 */
const configured = window.__FIELDFORCE_API__;
const BASE =
  configured && !configured.includes('localhost')
    ? configured
    : import.meta.env.VITE_API_URL ?? configured ?? 'http://localhost:4000/api/v1';

const ACCESS_KEY = 'ff_access';
const REFRESH_KEY = 'ff_refresh';

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = 'error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface Options {
  method?: string;
  body?: unknown;
  skipAuth?: boolean;
}

async function raw(path: string, opts: Options = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (!opts.skipAuth && tokens.access) {
    headers.Authorization = `Bearer ${tokens.access}`;
  }
  return fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!tokens.refresh) return false;
  // Several requests can 401 at once; they all wait on the same refresh.
  refreshing ??= (async () => {
    try {
      const res = await raw('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: tokens.refresh },
        skipAuth: true,
      });
      if (!res.ok) return false;
      const json = await res.json();
      tokens.set(json.data.accessToken, json.data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export async function api<T = any>(
  path: string,
  opts: Options = {},
): Promise<T> {
  let res = await raw(path, opts);

  if (res.status === 401 && !opts.skipAuth) {
    const ok = await tryRefresh();
    if (ok) {
      res = await raw(path, opts);
    } else {
      tokens.clear();
      window.dispatchEvent(new Event('ff:signed-out'));
      throw new ApiError(401, 'Your session expired. Sign in again.');
    }
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, 'The server sent an unreadable response.');
  }

  if (!res.ok || json?.success === false) {
    throw new ApiError(
      res.status,
      json?.error?.message ?? 'Something went wrong.',
      json?.error?.code,
    );
  }
  return json.data as T;
}

/** Postgres returns COUNT/SUM as strings; charts and maths need numbers. */
export const num = (v: unknown): number => Number(v ?? 0);

/** Origin of the API, for building URLs to uploaded photos. */
export const apiOrigin = BASE.replace(/\/api\/v1\/?$/, '');
