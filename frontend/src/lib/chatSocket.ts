/** Shared chat WebSocket — one connection per authenticated session.
 * Auth: JWT access token as `?token=` (browsers can't set WS headers).
 * Reconnects with backoff; before retrying we hit the API so the
 * one-flight refresh in api.ts can renew an expired token first. */

import { get, getAccessToken } from "./api";

export type ChatEvent = { type: string; [k: string]: unknown };

type Listener = (ev: ChatEvent) => void;

let ws: WebSocket | null = null;
const listeners = new Set<Listener>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let attempts = 0;
let started = false;

function url(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws/chat/?token=${getAccessToken()}`;
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING))
    return;
  if (!getAccessToken()) return;
  ws = new WebSocket(url());
  ws.onopen = () => {
    attempts = 0;
  };
  ws.onmessage = (e) => {
    try {
      const ev = JSON.parse(e.data) as ChatEvent;
      listeners.forEach((l) => l(ev));
    } catch {
      /* malformed frame — ignore */
    }
  };
  ws.onclose = () => {
    ws = null;
    scheduleReconnect();
  };
  ws.onerror = () => {
    ws?.close();
  };
}

function scheduleReconnect() {
  if (!started || reconnectTimer) return;
  const delay = Math.min(15000, 1000 * 2 ** attempts);
  attempts += 1;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (!started) return;
    // Triggers the one-flight token refresh if the access token expired.
    try {
      await get("/api/chat/unread/");
    } catch {
      /* offline — retry anyway */
    }
    connect();
  }, delay);
}

export const chatSocket = {
  start() {
    started = true;
    connect();
  },
  stop() {
    started = false;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    ws?.close();
    ws = null;
  },
  send(payload: Record<string, unknown>) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
    else return false;
    return true;
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  get connected() {
    return ws?.readyState === WebSocket.OPEN;
  },
};
