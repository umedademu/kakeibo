export type ThemePreference = "system" | "light" | "dark";

export const themeStorageKey = "kakeibo-theme";

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

// 本文を表示する前に保存済みの配色を適用し、明るい画面のちらつきを防ぎます。
export const themeInitializationScript = `
  try {
    const saved = localStorage.getItem("${themeStorageKey}");
    document.documentElement.dataset.theme =
      saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    document.documentElement.dataset.theme = "system";
  }
`;
