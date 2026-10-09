import React from "react";

/** jsontovideo mark: curly braces (the JSON) around a play triangle (the video). */
export function LogoMark({ size = 36 }) {
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <rect className="logo-tile" width="40" height="40" rx="11" />
      <g className="logo-braces">
        <path
          className="brace-l"
          d="M14 11c-3 0-3.5 1.2-3.5 3.2v3.1c0 1.6-.8 2.7-2.5 2.7 1.7 0 2.5 1.1 2.5 2.7v3.1c0 2 .5 3.2 3.5 3.2"
        />
        <path
          className="brace-r"
          d="M26 11c3 0 3.5 1.2 3.5 3.2v3.1c0 1.6.8 2.7 2.5 2.7-1.7 0-2.5 1.1-2.5 2.7v3.1c0 2-.5 3.2-3.5 3.2"
        />
      </g>
      <path className="logo-play" d="M17.6 15.4 24.6 20l-7 4.6Z" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      json<span className="wordmark-to">to</span>video
    </span>
  );
}

export function Brand({ onClick, label = "jsontovideo, go to the editor" }) {
  return (
    <a
      href="#"
      className="brand"
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
    >
      <LogoMark />
      <Wordmark />
    </a>
  );
}
