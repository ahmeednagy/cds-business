/** Fetch wrapper: JSON + cookie credentials + one-flight refresh on 401. */

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

async function refresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch("/api/auth/refresh/", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) return false;
      const data = await res.json();
      accessToken = data.access;
      return true;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(path, { ...init, headers, credentials: "same-origin" });
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, init);
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    if (await refresh()) res = await rawFetch(path, init);
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "error",
      err?.message ?? `Request failed (${res.status})`,
      err?.details,
    );
  }
  return body as T;
}

/** File download with the same Bearer auth + one-flight refresh as `api` —
 * needed for report exports, which can't ride a plain <a href> (no header). */
export async function downloadFile(
  path: string,
): Promise<{ blob: Blob; filename: string }> {
  let res = await rawFetch(path);
  if (res.status === 401 && (await refresh())) res = await rawFetch(path);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      "error",
      `Request failed (${res.status})`,
    );
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8''|"?)([^";]+)"?/.exec(disposition);
  const filename = match
    ? decodeURIComponent(match[1])
    : path.split("/").filter(Boolean).pop() || "download";
  return { blob: await res.blob(), filename };
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, data?: unknown) =>
  api<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) });
export const patch = <T>(path: string, data: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(data) });
export const del = (path: string) => api(path, { method: "DELETE" });
export const postForm = <T>(path: string, form: FormData) =>
  api<T>(path, { method: "POST", body: form });
