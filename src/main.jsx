import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Braces,
  Clapperboard,
  Play,
  Check,
  Copy,
  Download,
  Code2,
  BookOpen,
  ArrowUpRight,
  Film,
  Layers,
  LoaderCircle,
  ChevronRight,
  Plus,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  X,
  HardDrive,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { examples } from "../shared/examples.js";
import { validateMovie, dimensions, pixelValue } from "../shared/schema.js";
import { inspectTemplate } from "../shared/template.js";
import {
  templates,
  resolveTemplate,
  makeTemplateId,
} from "../shared/templates.js";
import "./style.css";

const pretty = (value) => JSON.stringify(value, null, 2);
const statusLabels = {
  pending: "Waiting",
  running: "Rendering",
  done: "Done",
  error: "Error",
};
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const seconds = (n) =>
  n == null || !Number.isFinite(n)
    ? "Auto"
    : `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
const variableSource = (name) =>
  name === "intro_video"
    ? "Sheets 37 · Foaie2 / intro_video (D)"
    : name === "bg_music"
      ? "Sheets 37 · Foaie2 / randomized_audio (C)"
      : name === "title"
        ? "Sheets 6 · Foaie1 / idea (B)"
        : name === "voice"
          ? "HTTP 29 · en-US-GuyNeural"
          : name === "image_model"
            ? "HTTP 29 · flux-pro → FLUX 1.1 Pro"
            : /^scene_\d+_(voice|prompt)$/.test(name)
              ? `JSON 8 · ${name}`
              : "variables from the JSON request";
const themeChoices = [
  ["system", Monitor, "System"],
  ["light", Sun, "Light"],
  ["dark", Moon, "Dark"],
];
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("j2v-theme");
      return saved === "light" || saved === "dark" ? saved : "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      if (theme === "system") localStorage.removeItem("j2v-theme");
      else localStorage.setItem("j2v-theme", theme);
    } catch {}
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const paint = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document
        .querySelector("meta[name=theme-color]")
        ?.setAttribute("content", dark ? "#0b0f0f" : "#e9ebe1");
    };
    paint();
    media.addEventListener("change", paint);
    return () => media.removeEventListener("change", paint);
  }, [theme]);
  return [theme, setTheme];
}
const localHostname = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/;
const LINE_HEIGHT = 22;
function CodeEditor({ value, onChange, invalid }) {
  const textRef = useRef(null),
    mirrorRef = useRef(null),
    gutterRef = useRef(null),
    [width, setWidth] = useState(0),
    [rows, setRows] = useState([]);
  const lines = useMemo(() => value.split("\n"), [value]);
  // The textarea wraps long lines, so each logical line can span several
  // visual rows. A hidden mirror with identical metrics measures them, and the
  // gutter gives every line number the height of its wrapped text.
  useEffect(() => {
    const el = textRef.current;
    const read = () => {
      const css = getComputedStyle(el);
      setWidth(
        Math.max(
          0,
          el.clientWidth -
            parseFloat(css.paddingLeft) -
            parseFloat(css.paddingRight),
        ),
      );
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const kids = mirrorRef.current?.children;
    if (!kids) return;
    const next = Array.from(kids, (k) =>
      Math.max(1, Math.round(k.offsetHeight / LINE_HEIGHT)),
    );
    setRows((prev) =>
      prev.length === next.length && prev.every((n, i) => n === next[i])
        ? prev
        : next,
    );
  }, [lines, width]);
  return (
    <div className="code-area">
      <div ref={gutterRef} aria-hidden="true" className="line-numbers">
        {lines.map((_, i) => (
          <div key={i} style={{ height: (rows[i] ?? 1) * LINE_HEIGHT }}>
            {i + 1}
          </div>
        ))}
      </div>
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className="code-mirror"
        style={{ width }}
      >
        {lines.map((line, i) => (
          <div key={i}>{line || "​"}</div>
        ))}
      </div>
      <textarea
        ref={textRef}
        aria-label="Cod JSON pentru videoclip"
        aria-invalid={invalid}
        aria-describedby="json-validation"
        spellCheck="false"
        wrap="soft"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (gutterRef.current)
            gutterRef.current.scrollTop = e.target.scrollTop;
        }}
      />
    </div>
  );
}
function App() {
  const [theme, setTheme] = useTheme();
  const [view, setView] = useState("editor"),
    [source, setSource] = useState(
      () => localStorage.getItem("j2v-draft") || pretty(examples[0].movie),
    );
  const [key, setKey] = useState(() => sessionStorage.getItem("j2v-key") || ""),
    [sessionReady, setSessionReady] = useState(false),
    [session, setSession] = useState(null),
    [config, setConfig] = useState(null),
    [jobs, setJobs] = useState([]),
    [active, setActive] = useState(null),
    [sceneIndex, setSceneIndex] = useState(0),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [networkError, setNetworkError] = useState(""),
    [jobsLoading, setJobsLoading] = useState(true),
    [selectedTemplate, setSelectedTemplate] = useState(null),
    [copied, setCopied] = useState(false);
  const fileRef = useRef(null),
    noticeTimer = useRef(null);
  const { parsed, rawMovie, syntaxError } = useMemo(() => {
    try {
      const rawMovie = JSON.parse(source);
      return { rawMovie, parsed: validateMovie(rawMovie), syntaxError: "" };
    } catch (e) {
      return { parsed: null, rawMovie: null, syntaxError: e.message };
    }
  }, [source]);
  const movie = parsed?.success ? parsed.data : null,
    issues = parsed?.success ? [] : parsed?.error?.issues || [];
  const inspection = useMemo(() => {
    try {
      return inspectTemplate(resolveTemplate(rawMovie));
    } catch {
      return null;
    }
  }, [rawMovie]);
  const duration = movie?.scenes.every((s) => s.duration > 0)
    ? movie.scenes.reduce((sum, s) => sum + s.duration, 0)
    : null;
  const scene =
    movie?.scenes[Math.min(sceneIndex, (movie?.scenes.length || 1) - 1)];
  const activeJob = jobs.find((j) => j.project === active);
  // Hosted vs local is judged from what is observable without a key: the
  // address in the browser and the key-free /api/session. /api/config only
  // refines it once authenticated, so the connect screen no longer claims
  // "local" for a hosted server.
  const serverHttps =
    config?.publicReady ??
    session?.publicReady ??
    location.protocol === "https:";
  const publicHost =
    !localHostname.test(location.hostname) ||
    !!(config?.publicReady ?? session?.publicReady);
  const hostKnown = publicHost || !!config || !!session;
  function toast(message) {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 4000);
  }
  async function api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        ...options.headers,
      },
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.message || data.errors?.[0]?.message || "The request failed.",
      );
    return data;
  }
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((s) => {
        setSession(s);
        if (s.key) setKey(s.key);
      })
      .catch(() => {})
      .finally(() => setSessionReady(true));
  }, []);
  useEffect(() => {
    if (!key) return;
    try {
      sessionStorage.setItem("j2v-key", key);
    } catch {}
    let mounted = true;
    let timer;
    let needsConfig = true;
    const refresh = async () => {
      let interval = 15000;
      if (document.hidden && !needsConfig) {
        timer = setTimeout(refresh, interval);
        return;
      }
      try {
        const [c, j] = await Promise.all([
          needsConfig ? api("/api/config") : Promise.resolve(null),
          api("/v2/movies"),
        ]);
        if (mounted) {
          if (c) {
            setConfig(c);
            needsConfig = false;
          }
          setJobs(j.movies);
          setNetworkError("");
          interval = j.movies.some((job) =>
            ["pending", "running"].includes(job.status),
          )
            ? 2500
            : 15000;
        }
      } catch (e) {
        if (mounted) setNetworkError(e.message);
      } finally {
        if (mounted) {
          setJobsLoading(false);
          timer = setTimeout(refresh, interval);
        }
      }
    };
    void refresh();
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [key, active]);
  useEffect(() => {
    try {
      localStorage.setItem("j2v-draft", source);
    } catch {}
  }, [source]);
  async function render() {
    if (!movie) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/v2/movies", { method: "POST", body: source });
      setActive(result.project);
      const data = await api("/v2/movies");
      setJobs(data.movies);
      toast("Your video is in the render queue.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function updateSource(value) {
    setSource(value);
    setActive(null);
    setSceneIndex(0);
  }
  function changeMovie(field, value) {
    if (!rawMovie) return;
    const raw = JSON.parse(source);
    raw[field] = value;
    updateSource(pretty(raw));
  }
  function loadTemplate(example) {
    updateSource(pretty(example.movie));
    setSelectedTemplate(null);
    setView("editor");
    toast("Example loaded into the editor.");
  }
  function downloadJson() {
    const url = URL.createObjectURL(
      new Blob([source], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "movie.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn't copy automatically. Select the text and copy it by hand.");
    }
  }
  async function openJob(job) {
    try {
      const input = await api(`/api/movies/${job.project}/source`);
      setSource(pretty(input));
      setActive(job.project);
      setSceneIndex(0);
      setView("editor");
    } catch (e) {
      setError(e.message);
    }
  }
  const nav = [
    ["editor", Braces, "Video editor"],
    ["renders", Film, "Videos"],
    ["templates", Layers, "Examples"],
    ["api", Code2, "API & Make"],
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to the editor
      </a>
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setView("editor");
          }}
        >
          <span className="brand-symbol">
            <Play size={18} fill="currentColor" />
          </span>
          json<span className="brand-two">2</span>vid
          <span className="studio-word">STUDIO</span>
        </a>
        <div className="workspace-label">Workspace</div>
        <nav aria-label="Main navigation">
          {nav.map(([id, Icon, label]) => (
            <button
              key={id}
              aria-label={label}
              aria-current={view === id ? "page" : undefined}
              title={label}
              className={`nav-item ${view === id ? "active" : ""}`}
              onClick={() => setView(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "renders" && jobs.length > 0 && (
                <span className="count">{jobs.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="engine-label">
            <span
              className={
                config?.engine === "ready" ? "online-dot" : "offline-dot"
              }
            />
            {networkError
              ? "Server unavailable"
              : config?.engine === "ready"
                ? "Render engine ready"
                : config
                  ? "FFmpeg unavailable"
                  : sessionReady && !key
                    ? "Sign-in required"
                    : "Connecting to the engine…"}
          </div>
          <span className="small-muted">FFmpeg · MP4 / H.264</span>
          <div className="profile">
            <HardDrive size={18} />
            <div>
              <strong>
                {!hostKnown
                  ? "Checking the server…"
                  : publicHost
                    ? "Public server"
                    : "Local server"}
              </strong>
              <span>
                {!hostKnown
                  ? "Just a moment"
                  : publicHost
                    ? serverHttps
                      ? "HTTPS enabled"
                      : "No HTTPS"
                    : "On this computer"}
              </span>
            </div>
          </div>
        </div>
      </aside>
      <main id="workspace-main" tabIndex={-1}>
        <header className="topbar">
          <div className="breadcrumb">
            Studio <ChevronRight size={14} />
            <span>{nav.find((n) => n[0] === view)?.[2]}</span>
          </div>
          <div className="topbar-tools">
            <div className="theme-switch" role="group" aria-label="Theme">
              {themeChoices.map(([id, Icon, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={theme === id}
                  title={label}
                  className={theme === id ? "on" : ""}
                  onClick={() => setTheme(id)}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <a
              className="docs-link"
              href="https://json2video.com/docs/v2/"
              target="_blank"
              rel="noreferrer"
            >
              <BookOpen size={15} />
              JSON2Video reference
              <ArrowUpRight size={14} />
            </a>
          </div>
        </header>
        {!sessionReady ? (
          <div className="loading-state" role="status">
            <LoaderCircle size={18} className="spin" />
            Connecting to the studio…
          </div>
        ) : !key ? (
          <section className="connect-panel">
            <KeyRound size={32} />
            <h1>Connect to the studio</h1>
            <p>Enter the API key set on your server.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setKey(new FormData(e.currentTarget).get("key"));
              }}
            >
              <input
                aria-label="API key"
                name="key"
                type="password"
                required
                minLength={24}
                placeholder="Your API key"
              />
              <button className="primary">Connect</button>
            </form>
          </section>
        ) : (
          <>
            {networkError && (
              <div className="alert" role="alert">
                <AlertCircle size={18} />
                <span>{networkError}</span>
                <button
                  className="secondary"
                  onClick={() => {
                    setKey("");
                    try {
                      sessionStorage.removeItem("j2v-key");
                    } catch {}
                  }}
                >
                  Change key
                </button>
              </div>
            )}
            {error && (
              <div className="alert" role="alert">
                <AlertCircle size={18} />
                {error}
                <button
                  aria-label="Dismiss error"
                  onClick={() => setError("")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {view === "editor" && (
              <>
                <section className="page-heading editor-heading">
                  <div>
                    <h1>Video editor</h1>
                    <p>JSON, scenes and rendering</p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => fileRef.current.click()}
                  >
                    <Plus size={16} />
                    Import JSON
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".json,.txt,application/json,text/plain"
                    hidden
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        try {
                          const text = await f.text();
                          JSON.parse(text);
                          updateSource(text);
                          toast("JSON imported.");
                        } catch {
                          setError("That file doesn't contain valid JSON.");
                        }
                      }
                      e.target.value = "";
                    }}
                  />
                </section>
                <section className="editor-workspace">
                  <div className="project-bar">
                    <div className="project-title">
                      <Clapperboard size={18} />
                      <input
                        aria-label="Video name"
                        value={rawMovie?.name ?? ""}
                        placeholder={rawMovie?.comment || "Video name"}
                        disabled={!rawMovie}
                        onChange={(e) => changeMovie("name", e.target.value)}
                      />
                      <span className="draft-tag">Draft</span>
                    </div>
                    <div className="project-actions">
                      <button
                        className="icon-button"
                        title="Download JSON"
                        aria-label="Download JSON"
                        onClick={downloadJson}
                      >
                        <Download size={17} />
                      </button>
                      <button
                        className="primary"
                        onClick={render}
                        disabled={
                          !movie || busy || !config || config.engine !== "ready"
                        }
                      >
                        {busy ? (
                          <LoaderCircle size={16} className="spin" />
                        ) : (
                          <Play size={15} fill="currentColor" />
                        )}
                        Generate video
                      </button>
                    </div>
                  </div>
                  <div className="editor-columns">
                    <div className="code-pane">
                      <div className="pane-heading dark">
                        <div>
                          <Braces size={16} />
                          <span>movie.json</span>
                        </div>
                        <button
                          onClick={() => {
                            try {
                              setSource(pretty(JSON.parse(source)));
                              toast("JSON formatted.");
                            } catch {
                              setError("Fix the syntax before formatting.");
                            }
                          }}
                        >
                          <Code2 size={14} />
                          Format
                        </button>
                      </div>
                      <CodeEditor
                        value={source}
                        invalid={!movie}
                        onChange={updateSource}
                      />
                      <div
                        id="json-validation"
                        className={`validation-bar ${movie ? "valid" : "invalid"}`}
                      >
                        {movie ? (
                          <>
                            <CheckCircle2 size={14} />
                            Valid JSON
                            <span>
                              {plural(movie.scenes.length, "scene")} ·{" "}
                              {duration == null
                                ? "automatic duration"
                                : `${duration}s`}
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={14} />
                            <span>
                              {syntaxError
                                ? `JSON syntax: ${syntaxError}`
                                : `${issues[0]?.path.join(".") || "JSON"}: ${issues[0]?.message || "Fill in the JSON."}`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="preview-pane">
                      <div className="pane-heading">
                        <div>
                          <span>Preview</span>
                          <span className="preview-tag">
                            {activeJob?.status === "done" ? "MP4" : "Sketch"}
                          </span>
                        </div>
                        <label className="format-select">
                          <select
                            aria-label="Video format"
                            value={
                              movie?.["aspect-ratio"] ||
                              rawMovie?.["aspect-ratio"] ||
                              "16:9"
                            }
                            disabled={!movie}
                            onChange={(e) =>
                              changeMovie("aspect-ratio", e.target.value)
                            }
                          >
                            <option value="9:16">9:16 · Vertical</option>
                            <option value="16:9">16:9 · Landscape</option>
                            <option value="1:1">1:1 · Square</option>
                          </select>
                        </label>
                      </div>
                      <div className="monitor">
                        {activeJob?.status === "done" ? (
                          <video
                            key={activeJob.project}
                            controls
                            playsInline
                            src={activeJob.url}
                            poster={activeJob.thumbnail}
                          />
                        ) : scene ? (
                          <ScenePreview movie={movie} scene={scene} />
                        ) : (
                          <div className="empty-preview">
                            <Braces size={36} />
                            <p>
                              {inspection?.missing.length
                                ? `${plural(inspection.missing.length, "variable is", "variables are")} waiting for values.`
                                : "Fix the JSON to see a preview."}
                            </p>
                            {!!inspection?.missing.length && (
                              <small>
                                Make sends the values in the variables field.
                              </small>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="preview-footer">
                        <span className="timecode">
                          {seconds(
                            duration == null
                              ? null
                              : movie?.scenes
                                  .slice(0, sceneIndex)
                                  .reduce((n, s) => n + s.duration, 0) || 0,
                          )}{" "}
                          <span>/ {seconds(duration)}</span>
                        </span>
                        <span>
                          {movie ? dimensions(movie).join(" × ") : "—"}{" "}
                          <span className="separator">·</span>{" "}
                          {movie?.fps || 30} fps
                        </span>
                      </div>
                      <div className="render-result" aria-live="polite">
                        {activeJob ? (
                          <>
                            <div className={`job-status ${activeJob.status}`}>
                              {["running", "pending"].includes(
                                activeJob.status,
                              ) ? (
                                <LoaderCircle size={16} className="spin" />
                              ) : activeJob.status === "done" ? (
                                <CheckCircle2 size={16} />
                              ) : (
                                <AlertCircle size={16} />
                              )}
                              <strong>{statusLabels[activeJob.status]}</strong>
                              <span>
                                {activeJob.status === "running"
                                  ? `${activeJob.progress}%`
                                  : ""}
                              </span>
                              {activeJob.status === "done" && (
                                <a
                                  className="download-result"
                                  href={`${activeJob.url}&download=1`}
                                >
                                  <Download size={15} />
                                  MP4
                                </a>
                              )}
                            </div>
                            {activeJob.status === "running" && (
                              <progress
                                aria-label="Render progress"
                                value={activeJob.progress}
                                max="100"
                              />
                            )}
                            <p>{activeJob.message}</p>
                          </>
                        ) : (
                          <p>
                            <Film size={15} />
                            Generate the video to play the final result.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="timeline">
                    <div className="timeline-top">
                      <span>
                        <Layers size={16} />
                        Scene
                      </span>
                      <span>
                        {duration == null
                          ? "Duration is calculated from the media"
                          : `${duration}s in total`}
                      </span>
                    </div>
                    <div className="scene-strip">
                      {movie?.scenes.map((s, i) => (
                        <button
                          key={i}
                          aria-pressed={sceneIndex === i}
                          className={`scene-card ${sceneIndex === i ? "selected" : ""}`}
                          onClick={() => {
                            setSceneIndex(i);
                            setActive(null);
                          }}
                        >
                          <span
                            className="scene-swatch"
                            style={{
                              background: s["background-color"],
                              color:
                                s.elements.find((e) => e.type === "text")
                                  ?.color || "#fff",
                            }}
                          >
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="scene-info">
                            <strong>
                              {s.name || s.comment || `Scene ${i + 1}`}
                            </strong>
                            <span>
                              {s.duration > 0 ? `${s.duration}s` : "Auto"} ·{" "}
                              {plural(s.elements.length, "element")}
                            </span>
                          </span>
                        </button>
                      ))}
                      <button
                        className="add-scene"
                        disabled={!movie}
                        onClick={() => {
                          const input = resolveTemplate(JSON.parse(source));
                          input.scenes.push({
                            name: "New scene",
                            duration: 3,
                            "background-color": "#20282c",
                            elements: [
                              { type: "text", text: "The story goes on." },
                            ],
                          });
                          setSource(pretty(input));
                          setSceneIndex(input.scenes.length - 1);
                          setActive(null);
                        }}
                      >
                        <Plus size={20} />
                        <span>Add scene</span>
                      </button>
                    </div>
                  </div>
                </section>
                {!!inspection?.variables.length && (
                  <details className="template-inspector">
                    <summary>
                      Template variables{" "}
                      <span>
                        {inspection.variables.length} in total ·{" "}
                        {inspection.missing.length} missing
                      </span>
                    </summary>
                    <p>
                      The values come from the Make request. The template stays
                      unchanged until you send the <code>variables</code>{" "}
                      object.
                    </p>
                    <div className="variable-table-wrap">
                      <table className="variable-table">
                        <thead>
                          <tr>
                            <th>Variable</th>
                            <th>Source in your scenario</th>
                            <th>Value in the JSON</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inspection.variables.map((v) => (
                            <tr key={v.name}>
                              <td data-label="Variable">
                                <code>{v.name}</code>
                              </td>
                              <td data-label="Source in your scenario">
                                {variableSource(v.name)}
                              </td>
                              <td data-label="Value in the JSON">
                                {v.defined ? (
                                  <span
                                    className="variable-value"
                                    title={String(v.value)}
                                  >
                                    {String(v.value)}
                                  </span>
                                ) : (
                                  <span className="missing-value">
                                    Missing
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p>
                      {plural(inspection.scenes, "scene")} ·{" "}
                      {plural(inspection.generatedImages, "image")} from a
                      prompt · {plural(inspection.voices, "voice")} ·{" "}
                      {plural(inspection.subtitles, "subtitle track")}
                    </p>
                  </details>
                )}
                <div className="editor-footnote">
                  <span>
                    <Check size={14} />
                    Your draft is saved automatically in this browser.
                  </span>
                  <button onClick={() => setView("api")}>
                    Automate with Make <ArrowUpRight size={14} />
                  </button>
                </div>
              </>
            )}
            {view === "renders" && (
              <section className="content-page">
                <div className="page-heading">
                  <div>
                    <h1>Videos</h1>
                    <p>Real renders, live progress and files ready to download.</p>
                  </div>
                  <button className="primary" onClick={() => setView("editor")}>
                    <Plus size={16} />
                    Create video
                  </button>
                </div>
                {jobsLoading ? (
                  <div className="loading-state" role="status">
                    <LoaderCircle size={18} className="spin" />
                    Loading your videos…
                  </div>
                ) : !jobs.length ? (
                  <div className="empty-state">
                    <svg
                      className="leader"
                      viewBox="0 0 160 160"
                      aria-hidden="true"
                    >
                      <circle cx="80" cy="80" r="74" />
                      <circle cx="80" cy="80" r="52" />
                      <path d="M80 4v152M4 80h152" />
                      <path className="sweep" d="M80 80V6a74 74 0 0 1 52 21Z" />
                      <text x="80" y="104" textAnchor="middle">
                        1
                      </text>
                    </svg>
                    <h2>Your first story is waiting.</h2>
                    <p>Generate a video in the editor and it will show up here.</p>
                    <button
                      className="secondary"
                      onClick={() => setView("editor")}
                    >
                      Open the editor
                    </button>
                  </div>
                ) : (
                  <div className="jobs-list">
                    {jobs.map((job) => (
                      <article className="job-row" key={job.project}>
                        <button
                          className="job-thumbnail"
                          onClick={() => openJob(job)}
                          aria-label={`Open ${job.name}`}
                        >
                          {job.thumbnail ? (
                            <img src={job.thumbnail} alt="" />
                          ) : (
                            <Film size={23} />
                          )}
                        </button>
                        <div className="job-detail">
                          <button
                            className="text-button"
                            onClick={() => openJob(job)}
                          >
                            {job.name}
                          </button>
                          <span>
                            {new Date(job.created_at).toLocaleString("en-US")} ·{" "}
                            {job.duration ? `${job.duration}s` : "Render"}
                          </span>
                          <code>{job.project}</code>
                          {job.status === "error" && (
                            <p className="error-text">{job.message}</p>
                          )}
                          {job.status === "running" && (
                            <progress
                              aria-label={`Render progress for ${job.name}`}
                              value={job.progress}
                              max="100"
                            />
                          )}
                          {job.webhook && (
                            <span>
                              Webhook: {job.webhook.state} ·{" "}
                              {plural(job.webhook.attempts, "attempt")}{" "}
                              {job.webhook.state === "failed" && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await api(
                                        `/api/movies/${job.project}/webhook/retry`,
                                        { method: "POST" },
                                      );
                                      toast("Webhook rescheduled.");
                                    } catch (e) {
                                      setError(e.message);
                                    }
                                  }}
                                >
                                  Retry
                                </button>
                              )}
                            </span>
                          )}
                        </div>
                        <span className={`status-tag ${job.status}`}>
                          {statusLabels[job.status]}
                          {job.status === "running" && ` ${job.progress}%`}
                        </span>
                        {job.url && (
                          <a
                            className="secondary"
                            href={`${job.url}&download=1`}
                          >
                            <Download size={16} />
                            <span>MP4</span>
                          </a>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
            {view === "templates" && (
              <section className="content-page">
                <div className="page-heading">
                  <div>
                    <h1>Templates and examples</h1>
                    <p>Your Make template, plus examples for testing the engine.</p>
                  </div>
                </div>
                <article className="make-template-row">
                  <div>
                    <h2>Your Make scenario</h2>
                    <p>
                      Intro + 10 scenes, FLUX 1.1 Pro, GuyNeural and subtitles.
                      The 25 variables are sent separately.
                    </p>
                    <code>{makeTemplateId}</code>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => setSelectedTemplate(templates[0])}
                  >
                    Open the template <ArrowUpRight size={16} />
                  </button>
                </article>
                <div className="template-grid">
                  {examples.map((example) => (
                    <article className="template" key={example.id}>
                      <div
                        className="template-art"
                        style={{
                          background:
                            example.movie.scenes[0]["background-color"],
                          color: example.movie.scenes[0].elements[0].color,
                        }}
                      >
                        <span>{example.movie["aspect-ratio"]}</span>
                        <h2>
                          {example.id === "english" ? (
                            <>
                              Small steps.
                              <br />
                              Big ideas.
                            </>
                          ) : example.id === "manifest" ? (
                            <>
                              Your ideas.
                              <br />
                              In motion.
                            </>
                          ) : example.id === "landscape" ? (
                            <>
                              What comes
                              <br />
                              next starts here.
                            </>
                          ) : (
                            <>
                              One small step.
                              <br />
                              One big idea.
                            </>
                          )}
                        </h2>
                        <span>{plural(example.movie.scenes.length, "scene")}</span>
                      </div>
                      <h2>{example.label}</h2>
                      <p>{example.description}</p>
                      <button
                        className="secondary"
                        onClick={() => setSelectedTemplate(example)}
                      >
                        Use this example
                        <ArrowUpRight size={16} />
                      </button>
                    </article>
                  ))}
                </div>
                {selectedTemplate && (
                  <div className="inline-confirm" role="alert">
                    <span>
                      Replace your current draft with “{selectedTemplate.label}”?
                    </span>
                    <button
                      className="secondary"
                      onClick={() => setSelectedTemplate(null)}
                    >
                      Keep my draft
                    </button>
                    <button
                      className="primary"
                      onClick={() => loadTemplate(selectedTemplate)}
                    >
                      Load the example
                    </button>
                  </div>
                )}
              </section>
            )}
            {view === "api" && (
              <section className="content-page api-page">
                <div className="page-heading">
                  <div>
                    <h1>API and Make</h1>
                    <p>Connect the editor to Make and generate videos from data.</p>
                  </div>
                  <span className="status-tag done">REST API · v2</span>
                </div>
                <div className="api-settings">
                  <h2>Your connection</h2>
                  <label>
                    API address
                    <input
                      readOnly
                      value={`${config?.publicUrl || location.origin}/v2/movies`}
                    />
                  </label>
                  {hostKnown && !(publicHost && serverHttps) && (
                    <p className="connection-note">
                      <AlertCircle size={16} />
                      {publicHost
                        ? "This server isn't using HTTPS. Make needs a public HTTPS address, so set PUBLIC_BASE_URL to your https URL."
                        : "You're running locally. Make needs a server with public HTTPS, so set PUBLIC_BASE_URL once you've published the server."}
                    </p>
                  )}
                  <label>
                    API key
                    <div className="key-field">
                      <input
                        aria-label="Current API key"
                        type="password"
                        readOnly
                        value={key}
                      />
                      <button className="secondary" onClick={() => copy(key)}>
                        {copied ? <Check size={15} /> : <Copy size={15} />}
                        Copy
                      </button>
                    </div>
                  </label>
                  <p className="muted">
                    In Make HTTP v4: Authentication type → API key, placed in
                    the header, named <code>x-api-key</code>.
                  </p>
                  <div className="provider-status">
                    <span>
                      FLUX 1.1 Pro{" "}
                      <strong className={config?.fluxImages ? "ok" : "missing"}>
                        {config?.fluxImages
                          ? "Configured"
                          : "BFL_API_KEY is missing"}
                      </strong>
                    </span>
                    <span>
                      Azure · GuyNeural{" "}
                      <strong className={config?.azureSpeech ? "ok" : "missing"}>
                        {config?.azureSpeech
                          ? "Configured"
                          : "Azure key and region are missing"}
                      </strong>
                    </span>
                  </div>
                  <p className="muted">
                    Set the keys in the .env file on your server. The{" "}
                    <code>flux-pro</code> alias explicitly uses FLUX 1.1 Pro.
                  </p>
                </div>
                <details className="make-contract" open>
                  <summary>The request in your scenario</summary>
                  <p>
                    The template <code>{makeTemplateId}</code> is included on
                    this server. In HTTP 29, keep the ID and the mappings, and
                    just change the API address and key. HTTP 41 still reads{" "}
                    <code>movie.url</code>, and HTTP 44 downloads the MP4.
                  </p>
                  <CodeBlock
                    text={pretty({
                      template: makeTemplateId,
                      variables: {
                        title: "{{6.idea}}",
                        intro_video: "{{37.intro_video}}",
                        bg_music: "{{37.randomized_audio}}",
                        voice: "en-US-GuyNeural",
                        image_model: "flux-pro",
                        ...Object.fromEntries(
                          Array.from({ length: 10 }, (_, i) => [
                            [
                              `scene_${i + 1}_voice`,
                              `{{8.scene_${i + 1}_voice}}`,
                            ],
                            [
                              `scene_${i + 1}_prompt`,
                              `{{8.scene_${i + 1}_prompt}}`,
                            ],
                          ]).flat(),
                        ),
                      },
                    })}
                  />
                  <p>
                    The mappings above show where each value comes from; pick
                    the fields in Make. Use a structured JSON body / Create JSON
                    so the quotes and line breaks from Gemini stay intact.
                  </p>
                </details>
                <div className="make-flow">
                  <div>
                    <span className="flow-circle sheets">
                      <Layers size={22} />
                    </span>
                    <strong>Sheets / Gemini</strong>
                    <small>Prepares the content</small>
                  </div>
                  <ChevronRight />
                  <div>
                    <span className="flow-circle json">
                      <Braces size={22} />
                    </span>
                    <strong>HTTP · POST</strong>
                    <small>Sends the JSON</small>
                  </div>
                  <ChevronRight />
                  <div>
                    <span className="flow-circle render">
                      <Clapperboard size={22} />
                    </span>
                    <strong>Json2vid</strong>
                    <small>Renders the MP4</small>
                  </div>
                  <ChevronRight />
                  <div>
                    <span className="flow-circle hook">
                      <Code2 size={22} />
                    </span>
                    <strong>Webhook Make</strong>
                    <small>Receives the result</small>
                  </div>
                  <ChevronRight />
                  <div>
                    <span className="flow-circle publish">
                      <ArrowUpRight size={22} />
                    </span>
                    <strong>Router</strong>
                    <small>YouTube · Instagram · TikTok</small>
                  </div>
                </div>
                <div className="api-guide">
                  <article>
                    <h2>1. Send the video</h2>
                    <p>
                      Use the HTTP → Make a request module. Set the method to{" "}
                      <code>POST</code> and Body content type to{" "}
                      <code>application/JSON</code>. Send the JSON from the
                      editor and save the <code>project</code> field from the
                      response.
                    </p>
                    <CodeBlock
                      text={
                        "POST /v2/movies\nx-api-key: YOUR_KEY\nContent-Type: application/json\nIdempotency-Key: row-42-version-1\n\n" +
                        pretty({
                          "...": "the JSON from the editor",
                          "client-data": { row: 42 },
                          webhook_url: "https://hook.eu1.make.com/YOUR_WEBHOOK",
                        })
                      }
                    />
                    <p className="muted">
                      The example above is only a guide: replace “...” with your
                      video's fields. The idempotency key stops duplicate
                      renders when the same request is sent twice.
                    </p>
                  </article>
                  <article>
                    <h2>2. Continue when it's ready</h2>
                    <p>
                      In a second Make scenario, add{" "}
                      <strong>Webhooks → Custom webhook</strong>. Copy its URL
                      into <code>webhook_url</code>. Filter on{" "}
                      <code>movie.status = done</code>, then download{" "}
                      <code>movie.url</code>.
                    </p>
                    <CodeBlock
                      text={pretty({
                        event: "movie.done",
                        success: true,
                        project: "VIDEO_ID",
                        movie: {
                          status: "done",
                          url: "https://your-server/files/…",
                          "client-data": { row: 42 },
                        },
                      })}
                    />
                    <p>
                      Connect{" "}
                      <strong>HTTP → Download a file → Router</strong> to your
                      publishing modules and update the row in Sheets.
                      Deduplicate notifications by <code>project</code>.
                    </p>
                  </article>
                </div>
                <details>
                  <summary>Prefer to poll from your current flow?</summary>
                  <p>
                    Call <code>GET /v2/movies?project=VIDEO_ID</code> with the
                    same key. Only continue when{" "}
                    <code>movie.status = done</code>. On <code>error</code>,
                    save <code>movie.message</code>. Retry pending and running
                    jobs with a time limit, because a fixed wait doesn't
                    guarantee the render has finished.
                  </p>
                </details>
                <details>
                  <summary>What does the JSON format support?</summary>
                  <p>
                    Scenes with an explicit duration or one calculated from the
                    media; text; images and video over HTTPS; FLUX 1.1 Pro
                    images from a prompt; audio tracks; a local English voice or
                    Azure; <code>{"{{name}}"}</code> variables; vertical,
                    landscape or square formats; and SD/HD/Full HD. Audio from
                    video clips is ignored, so add an explicit audio track.
                    HTML, JSON2Video components and transitions between scenes
                    aren't implemented. Fade-in/out, zoom and subtitles synced
                    to the Azure voice are available. Subtitles can highlight
                    the word being spoken (word-color), show a set number of
                    words at a time (max-words), pop the active word
                    (word-scale) and switch to capitals (all-caps). Text and
                    subtitles can use the DejaVu Sans or Poppins font
                    (font-family). The local voice uses
                    Windows or eSpeak NG, while provider: azure needs your Azure
                    keys on the server. Local subtitles need an explicit
                    timing: estimated (approximate). The limit is 900 seconds
                    per video and 300 per scene.
                  </p>
                </details>
                <div className="source-links">
                  Checked documentation:
                  <a
                    href="https://apps.make.com/http"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Make HTTP
                    <ArrowUpRight size={13} />
                  </a>
                  <a
                    href="https://help.make.com/webhooks"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Make Webhooks
                    <ArrowUpRight size={13} />
                  </a>
                  <a
                    href="https://json2video.com/docs/v2/reference/api-endpoints"
                    target="_blank"
                    rel="noreferrer"
                  >
                    JSON2Video API
                    <ArrowUpRight size={13} />
                  </a>
                </div>
              </section>
            )}
          </>
        )}
      </main>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
    </div>
  );
}
function CodeBlock({ text }) {
  return (
    <pre className="api-code">
      <code>{text}</code>
    </pre>
  );
}
function ScenePreview({ movie, scene }) {
  const [W, H] = dimensions(movie),
    ref = useRef(null),
    [scale, setScale] = useState(0.28);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setScale(
        Math.min(entry.contentRect.width / W, entry.contentRect.height / H),
      ),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [W, H]);
  return (
    <div ref={ref} className="scene-preview-frame">
      <div
        className="scene-preview"
        style={{
          width: W * scale,
          height: H * scale,
          background: scene["background-color"],
        }}
      >
        <div
          className="scene-canvas"
          style={{ width: W, height: H, transform: `scale(${scale})` }}
        >
          {scene.elements
            .filter(
              (e) =>
                ["text", "subtitles", "image", "video"].includes(e.type) &&
                e.start === 0,
            )
            .map((e, i) => {
              const textElement = ["text", "subtitles"].includes(e.type);
              const width = e.width || (textElement ? W * 0.88 : W),
                height = e.height || (textElement ? undefined : H);
              const left =
                pixelValue(e.x, W) !== undefined
                  ? pixelValue(e.x, W)
                  : e.x === "right"
                    ? W - width
                    : e.x === "left"
                      ? 0
                      : W / 2;
              const top =
                pixelValue(e.y, H) !== undefined
                  ? pixelValue(e.y, H)
                  : e.y === "bottom"
                    ? H
                    : e.y === "top"
                      ? 0
                      : H / 2;
              const transform = `translate(${e.x === "center" ? "-50%" : "0"},${e.y === "center" ? "-50%" : e.y === "bottom" ? "-100%" : "0"})`;
              const style = {
                position: "absolute",
                left,
                top,
                width,
                height,
                transform,
                color: e.color,
                fontSize: e["font-size"],
                fontWeight: e["font-weight"],
                textAlign: e["text-align"],
                lineHeight: 1.25,
                whiteSpace: "pre-wrap",
                overflowWrap: "break-word",
                textShadow: e.style === "shadow" ? "0 2px 5px #111" : undefined,
              };
              return textElement ? (
                <div key={i} style={style}>
                  {e.type === "subtitles"
                    ? e.text.split(/\s+/).slice(0, 6).join(" ")
                    : e.text}
                </div>
              ) : e.type === "image" && e.src ? (
                <img
                  key={i}
                  alt="Image from the scene"
                  src={e.src}
                  referrerPolicy="no-referrer"
                  style={{ ...style, objectFit: e.fit }}
                />
              ) : (
                <div key={i} className="video-placeholder" style={style}>
                  <Film size={60} />
                  <span>
                    {e.type === "image"
                      ? "FLUX image · generated at render time"
                      : "Video clip · visible after rendering"}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
