import { flushSync } from "react-dom";

const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Runs a state update inside a View Transition when the browser supports it, so
 * page changes crossfade and theme changes ripple out from the clicked button.
 * Without support (or with reduced motion) the update just happens.
 */
export function transition(update, { kind = "view", from } = {}) {
  if (!document.startViewTransition || calm()) return update();
  const root = document.documentElement;
  if (from) {
    const box = from.getBoundingClientRect();
    root.style.setProperty("--vt-x", `${box.left + box.width / 2}px`);
    root.style.setProperty("--vt-y", `${box.top + box.height / 2}px`);
  }
  root.dataset.vt = kind;
  const run = document.startViewTransition(() => flushSync(update));
  run.finished.finally(() => delete root.dataset.vt);
}
