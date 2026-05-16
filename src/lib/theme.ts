// Theme manager with localStorage persistence and system detection
export type Theme = "light" | "dark" | "system";

const KEY = "vuma-theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem(KEY) as Theme) || "system";
}

export function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  root.classList.toggle("dark", resolved === "dark");
  localStorage.setItem(KEY, theme);
}

export function initTheme() {
  applyTheme(getStoredTheme());
  if (typeof window !== "undefined") {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (getStoredTheme() === "system") applyTheme("system");
      });
  }
}
