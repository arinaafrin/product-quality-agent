const STORAGE_KEY = 'pqa.authToken';

/** @returns {string | null} */
export function getToken() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** @param {string} token */
export function setToken(token) {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Storage can be unavailable (private browsing, quota). The app still
    // works for the current in-memory session; the user just re-enters
    // their API key next reload.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}

export function isAuthenticated() {
  return Boolean(getToken());
}
