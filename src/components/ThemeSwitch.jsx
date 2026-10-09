import React from "react";
import { Monitor, Sun, Moon } from "lucide-react";

const choices = [
  ["system", Monitor, "System"],
  ["light", Sun, "Light"],
  ["dark", Moon, "Dark"],
];
export function ThemeSwitch({ theme, onChange }) {
  const index = choices.findIndex(([id]) => id === theme);
  return (
    <div
      className="theme-switch"
      role="group"
      aria-label="Theme"
      style={{ "--i": index }}
    >
      <span className="theme-thumb" aria-hidden="true" />
      {choices.map(([id, Icon, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={theme === id}
          aria-label={label}
          title={label}
          onClick={(e) => onChange(id, e.currentTarget)}
        >
          <Icon size={15} aria-hidden="true" strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}
