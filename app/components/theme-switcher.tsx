"use client";

import { useSyncExternalStore } from "react";
import { parseThemePreference, themeStorageKey, type ThemePreference } from "../lib/theme";

const themeChangeEvent = "kakeibo-theme-change";

function getTheme() {
  return parseThemePreference(document.documentElement.dataset.theme);
}

function getServerTheme(): ThemePreference {
  return "system";
}

function applyTheme(preference: ThemePreference) {
  document.documentElement.dataset.theme = preference;
  window.dispatchEvent(new Event(themeChangeEvent));
}

function subscribe(onChange: () => void) {
  function syncStoredTheme(event: StorageEvent) {
    if (event.key !== themeStorageKey && event.key !== null) return;

    try {
      if (event.storageArea !== window.localStorage) return;
      applyTheme(parseThemePreference(window.localStorage.getItem(themeStorageKey)));
    } catch {
      // 保存領域が使えない場合も、現在の画面の選択は維持します。
    }
  }

  window.addEventListener(themeChangeEvent, onChange);
  window.addEventListener("storage", syncStoredTheme);
  return () => {
    window.removeEventListener(themeChangeEvent, onChange);
    window.removeEventListener("storage", syncStoredTheme);
  };
}

function changeTheme(preference: ThemePreference) {
  applyTheme(preference);
  try {
    window.localStorage.setItem(themeStorageKey, preference);
  } catch {
    // 保存できない環境でも、この画面では配色を切り替えられます。
  }
}

export default function ThemeSwitcher() {
  const preference = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  return (
    <label className="theme-switcher">
      <span>表示</span>
      <select
        aria-label="画面の配色"
        value={preference}
        onChange={(event) => changeTheme(parseThemePreference(event.target.value))}
      >
        <option value="system">端末に合わせる</option>
        <option value="light">ライト</option>
        <option value="dark">ダーク</option>
      </select>
    </label>
  );
}
