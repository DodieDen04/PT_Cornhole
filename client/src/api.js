import { enqueue, listQueue, removeFromQueue } from './lib/syncQueue.js';

const TOKEN_KEY = 'pt_cornhole_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

const QUEUEABLE = new Set(['POST', 'PUT', 'DELETE']);
const QUEUEABLE_PATHS = [/^\/api\/throws/];

function isQueueable(path, method) {
  if (!QUEUEABLE.has(method)) return false;
  return QUEUEABLE_PATHS.some((re) => re.test(path));
}

export async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const bodyJson =
    options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body;

  try {
    const res = await fetch(path, { ...options, headers, body: bodyJson });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error((data && data.error) || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    if (
      err instanceof TypeError &&
      isQueueable(path, method) &&
      !navigator.onLine
    ) {
      await enqueue({ path, method, body: bodyJson, token });
      const offlineErr = new Error('Offline: queued for retry');
      offlineErr.queued = true;
      throw offlineErr;
    }
    throw err;
  }
}

export async function flushQueue() {
  const items = await listQueue();
  let processed = 0;
  for (const item of items) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (item.token) headers.Authorization = `Bearer ${item.token}`;
      const res = await fetch(item.path, { method: item.method, headers, body: item.body });
      if (!res.ok && res.status < 500) {
        await removeFromQueue(item.id);
        processed += 1;
        continue;
      }
      if (res.ok) {
        await removeFromQueue(item.id);
        processed += 1;
      }
    } catch {
      break;
    }
  }
  if (processed > 0) {
    window.dispatchEvent(new CustomEvent('pt-sync-flushed', { detail: { processed } }));
  }
  return processed;
}
