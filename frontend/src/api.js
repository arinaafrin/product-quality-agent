import { io as ioClient } from 'socket.io-client';
import { getToken, setToken, clearToken, isAuthenticated } from './authClient.js';

export { isAuthenticated };


const BASE = import.meta.env.VITE_API_URL || '/api';

async function handle(res) {
  if (res.status === 401) {
    // Token missing/expired/invalid — drop it so the app re-prompts for an
    // API key instead of silently retrying with the same bad credential.
    clearToken();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Exchanges an API key for a session token. Throws on an invalid key.
 * @param {string} apiKey
 */
export async function login(apiKey) {
  const res = await fetch(`${BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
  const body = await handle(res);
  setToken(body.token);
  return body;
}

export function logout() {
  clearToken();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

let socket = null;
function getSocket() {
  if (!socket) {
    socket = ioClient(import.meta.env.VITE_SOCKET_URL || undefined, {
      auth: { token: getToken() },
    });
  }
  return socket;
}

export function subscribeToValidationProgress(jobId, { onProgress, onComplete } = {}) {
  const sock = getSocket();
  sock.emit('validation:join', jobId);

  const handleProgress = (payload) => {
    if (payload.jobId === jobId) onProgress?.(payload);
  };
  const handleComplete = (payload) => {
    if (payload.jobId === jobId) onComplete?.(payload);
  };

  sock.on('validation:progress', handleProgress);
  sock.on('validation:complete', handleComplete);

  return function unsubscribe() {
    sock.off('validation:progress', handleProgress);
    sock.off('validation:complete', handleComplete);
  };
}

/**
 * @param {Array<Object>} records
 * @param {{ jobId?: string, onProgress?: Function, onComplete?: Function }} [options]
 */
export function validateFeed(records, options = {}) {
  const { jobId } = options;
  const body = jobId ? { records, jobId } : { records };
  return fetch(`${BASE}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  }).then(handle);
}

export function getRules() {
  return fetch(`${BASE}/rules`, { headers: authHeaders() }).then(handle);
}

export function askAgent(question) {
  return fetch(`${BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ question }),
  }).then(handle);
}
