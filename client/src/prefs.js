// Per-device preferences (language, theme). localStorage can be blocked in
// private windows, so every access is guarded and the app works without it.

export function getPref(key, fallback) {
  try {
    return localStorage.getItem(`fairdeal:${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}

export function setPref(key, value) {
  try {
    if (value == null) localStorage.removeItem(`fairdeal:${key}`);
    else localStorage.setItem(`fairdeal:${key}`, value);
  } catch {
    // ignore
  }
}

// Default language: saved choice, else the browser's language.
export function initialLang() {
  const saved = getPref("lang", null);
  if (saved === "en" || saved === "es") return saved;
  return navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";
}

// Default theme: saved choice, else the system setting.
export function initialTheme() {
  const saved = getPref("theme", null);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
