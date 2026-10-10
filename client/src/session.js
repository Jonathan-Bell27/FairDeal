// Keeps the current deal in sessionStorage so a reload (or the phone
// dropping the tab) doesn't lose it. sessionStorage clears when the tab
// closes, so contract details don't linger on the device.

const KEY = "fairdeal:session";

export function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

export function saveSession(state) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage blocked or full: the app still works, just without restore
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
