import { useState } from "react";
import { transition } from "./transition.js";

const stored = () => {
  try {
    const saved = localStorage.getItem("j2v-theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
};
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem("j2v-theme");
    else localStorage.setItem("j2v-theme", theme);
  } catch {}
  const dark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document
    .querySelector("meta[name=theme-color]")
    ?.setAttribute("content", dark ? "#090d0c" : "#f2f4f0");
}
export function useTheme() {
  const [theme, setTheme] = useState(stored);
  const change = (next, from) =>
    transition(
      () => {
        applyTheme(next);
        setTheme(next);
      },
      { kind: "theme", from },
    );
  return [theme, change];
}
