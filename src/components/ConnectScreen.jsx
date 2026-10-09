import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import { Brand } from "./Logo.jsx";
import { ThemeSwitch } from "./ThemeSwitch.jsx";

const words = ["Every", "great", "idea", "starts", "small."];
const codeLines = [
  ['"name"', '"Small steps."'],
  ['"aspect-ratio"', '"9:16"'],
  ['"scenes"', "["],
  ['"type"', '"voice"'],
  ['"word-color"', '"#FFD400"'],
  ['"font-family"', '"Poppins"'],
];

/** The motion piece: JSON on the left is read line by line, a vertical video grows on the right. */
function Showpiece() {
  return (
    <div className="showpiece" aria-hidden="true">
      <div className="sp-code">
        <div className="sp-scan" />
        {codeLines.map(([k, v], i) => (
          <div className="sp-line" key={k} style={{ "--l": i }}>
            <span className="tk-punct">{i === 0 ? "{ " : "  "}</span>
            <span className="tk-key">{k}</span>
            <span className="tk-punct">: </span>
            <span className={v.startsWith('"') ? "tk-str" : "tk-punct"}>{v}</span>
          </div>
        ))}
      </div>
      <div className="sp-frame">
        <div className="sp-scene s1">
          <b>Small steps.</b>
          <b>Big ideas.</b>
        </div>
        <div className="sp-scene s2">
          <b>Create.</b>
          <b>Share.</b>
          <b>Repeat.</b>
        </div>
        <div className="sp-scene s3">
          <b>One small</b>
          <b>step.</b>
        </div>
        <p className="sp-subs">
          {words.map((w, i) => (
            <span key={w} style={{ "--w": i }}>
              {w}{" "}
            </span>
          ))}
        </p>
        <div className="sp-timeline">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}

export function ConnectScreen({ verify, onConnect, theme, onTheme }) {
  const [value, setValue] = useState("");
  const [shown, setShown] = useState(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const input = useRef(null);
  useEffect(() => input.current?.focus(), []);
  async function submit(e) {
    e.preventDefault();
    const key = value.trim();
    if (status === "checking" || status === "unlocking") return;
    setStatus("checking");
    setMessage("");
    try {
      await verify(key);
    } catch (error) {
      setStatus("error");
      setMessage(error.message);
      input.current?.focus();
      return;
    }
    setStatus("unlocking");
    setTimeout(() => onConnect(key), 900);
  }
  const busy = status === "checking" || status === "unlocking";
  return (
    <div className={`connect is-${status}`}>
      <header className="connect-top">
        <Brand />
        <ThemeSwitch theme={theme} onChange={onTheme} />
      </header>
      <section className="connect-main">
        <div className="connect-copy">
          <h1>Turn JSON into video.</h1>
          <p className="connect-lede">
            Enter the API key from your server to open your studio.
          </p>
          <form onSubmit={submit} noValidate>
            <label htmlFor="api-key">API key</label>
            <div className="key-input" data-error={status === "error"}>
              <KeyRound size={18} strokeWidth={1.6} aria-hidden="true" />
              <input
                id="api-key"
                ref={input}
                name="key"
                type={shown ? "text" : "password"}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                autoComplete="off"
                spellCheck="false"
                aria-invalid={status === "error"}
                aria-describedby="key-help"
                disabled={status === "unlocking"}
              />
              <button
                type="button"
                className="reveal"
                onClick={() => setShown((s) => !s)}
                aria-label={shown ? "Hide the key" : "Show the key"}
              >
                {shown ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
              <button
                className="primary go"
                disabled={value.trim().length < 24 || busy}
              >
                {busy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <>
                    Connect <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
            <p
              id="key-help"
              className={status === "error" ? "key-help bad" : "key-help"}
              role={status === "error" ? "alert" : undefined}
            >
              {status === "error"
                ? message
                : "It's the API_KEY value in your server's .env file."}
            </p>
          </form>
        </div>
        <Showpiece />
      </section>
      <div className="connect-wash" aria-hidden="true" />
    </div>
  );
}
