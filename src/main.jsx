import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  BookOpen,
  Braces,
  Check,
  CheckCircle2,
  AlertCircle,
  Clapperboard,
  Code2,
  Copy,
  Download,
  Film,
  Globe,
  Laptop,
  Layers,
  LoaderCircle,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { examples } from "../shared/examples.js";
import { validateMovie, dimensions } from "../shared/schema.js";
import { inspectTemplate } from "../shared/template.js";
import {
  templates,
  resolveTemplate,
  makeTemplateId,
} from "../shared/templates.js";
import { approx, clock, estimateMovie } from "./lib/duration.js";
import { transition } from "./lib/transition.js";
import { useTheme } from "./lib/theme.js";
import { Brand, LogoMark } from "./components/Logo.jsx";
import { ThemeSwitch } from "./components/ThemeSwitch.jsx";
import { CodeEditor } from "./components/CodeEditor.jsx";
import { ScenePreview } from "./components/ScenePreview.jsx";
import { ConnectScreen } from "./components/ConnectScreen.jsx";
import { MakeFlow } from "./components/MakeFlow.jsx";
import "./style.css";

const pretty = (value) => JSON.stringify(value, null, 2);
const statusLabels = {
  pending: "Waiting",
  running: "Rendering",
  done: "Done",
  error: "Error",
};
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
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
const localHostname = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/;
const nav = [
  ["editor", Braces, "Video editor"],
  ["renders", Film, "Videos"],
  ["templates", Layers, "Examples"],
  ["api", Code2, "API & Make"],
];

// A thumbnail that falls back to a film icon if the image can't be loaded.
function Thumb({ src }) {
  const [broken, setBroken] = useState(false);
  return src && !broken ? (
    <img src={src} alt="" onError={() => setBroken(true)} />
  ) : (
    <Film size={22} strokeWidth={1.4} />
  );
}

function CodeBlock({ text, onCopied }) {
  const [done, setDone] = useState(false);
  return (
    <div className="api-code-wrap">
      <button
        type="button"
        className="code-copy"
        aria-label="Copy this code"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setDone(true);
            setTimeout(() => setDone(false), 1600);
          } catch {
            onCopied?.();
          }
        }}
      >
        {done ? <Check size={14} /> : <Copy size={14} />}
        {done ? "Copied" : "Copy"}
      </button>
      <pre className="api-code">
        <code>{text}</code>
      </pre>
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
    [entering, setEntering] = useState(false),
    [confirming, setConfirming] = useState(null),
    [leaving, setLeaving] = useState([]),
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
  const estimate = useMemo(() => estimateMovie(movie), [movie]);
  const total = estimate.total;
  const scene =
    movie?.scenes[Math.min(sceneIndex, (movie?.scenes.length || 1) - 1)];
  const activeJob = jobs.find((j) => j.project === active);
  const sceneStart = estimate.scenes
    .slice(0, sceneIndex)
    .reduce((n, s) => n + (s.seconds || 0), 0);
  const lengthLabel =
    activeJob?.status === "done" && activeJob.duration
      ? clock(activeJob.duration)
      : total == null
        ? "-"
        : approx(total, estimate.exact);
  // Hosted vs local is judged from what is observable without a key: the
  // address in the browser and the key-free /api/session. /api/config only
  // refines it once authenticated, so the connect screen never calls a hosted
  // server "local".
  const serverHttps =
    config?.publicReady ??
    session?.publicReady ??
    location.protocol === "https:";
  const publicHost =
    !localHostname.test(location.hostname) ||
    !!(config?.publicReady ?? session?.publicReady);
  const hostKnown = publicHost || !!config || !!session;
  const serverAddress = (() => {
    try {
      return publicHost && config?.publicUrl
        ? new URL(config.publicUrl).host
        : location.host;
    } catch {
      return location.host;
    }
  })();
  const engineProblem = !!config && config.engine !== "ready";

  function toast(message) {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 4000);
  }
  async function api(url, options = {}, apiKey = key) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
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
  async function verifyKey(candidate) {
    let response;
    try {
      response = await fetch("/api/config", {
        headers: { "x-api-key": candidate },
      });
    } catch {
      throw new Error(
        "Can't reach the server. Check your connection and try again.",
      );
    }
    if (response.status === 401)
      throw new Error("That key doesn't match this server. Check it and try again.");
    if (!response.ok)
      throw new Error("The server returned an error. Try again in a moment.");
  }
  function go(next) {
    if (next === view) return;
    transition(() => setView(next), { kind: "view" });
    window.scrollTo({ top: 0 });
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
  useEffect(() => {
    if (!confirming) return;
    const cancel = (e) => e.key === "Escape" && setConfirming(null);
    const timer = setTimeout(() => setConfirming(null), 7000);
    window.addEventListener("keydown", cancel);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", cancel);
    };
  }, [confirming]);
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
  async function removeJob(job) {
    setConfirming(null);
    try {
      await api(`/api/movies/${job.project}`, { method: "DELETE" });
    } catch (e) {
      setError(e.message);
      return;
    }
    setLeaving((l) => [...l, job.project]);
    toast("Video deleted.");
    setTimeout(() => {
      setJobs((list) => list.filter((j) => j.project !== job.project));
      setLeaving((l) => l.filter((id) => id !== job.project));
      setActive((id) => (id === job.project ? null : id));
    }, 340);
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
    go("editor");
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
      go("editor");
    } catch (e) {
      setError(e.message);
    }
  }

  if (!sessionReady)
    return (
      <div className="splash" role="status" aria-label="Loading">
        <LogoMark size={56} />
      </div>
    );
  if (!key)
    return (
      <ConnectScreen
        verify={verifyKey}
        onConnect={(next) => {
          setEntering(true);
          setKey(next);
          setTimeout(() => setEntering(false), 1000);
        }}
        theme={theme}
        onTheme={setTheme}
      />
    );
  const navIndex = nav.findIndex((n) => n[0] === view);
  return (
    <div className="app-shell">
      {entering && <div className="enter-wash" aria-hidden="true" />}
      <a className="skip-link" href="#workspace-main">
        Skip to the editor
      </a>
      <aside className="sidebar">
        <Brand onClick={() => go("editor")} />
        <nav aria-label="Main navigation" style={{ "--i": navIndex }}>
          <span className="nav-pill" aria-hidden="true" />
          {nav.map(([id, Icon, label]) => (
            <button
              key={id}
              aria-label={label}
              aria-current={view === id ? "page" : undefined}
              title={label}
              className={`nav-item ${view === id ? "active" : ""}`}
              onClick={() => go(id)}
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>{label}</span>
              {id === "renders" && jobs.length > 0 && (
                <span className="count">{jobs.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="server" title={serverAddress}>
            <span className="server-icon">
              {publicHost ? (
                <Globe size={17} strokeWidth={1.6} />
              ) : (
                <Laptop size={17} strokeWidth={1.6} />
              )}
            </span>
            <div>
              <strong>
                {networkError
                  ? "Server unreachable"
                  : !hostKnown
                    ? "Checking server"
                    : publicHost
                      ? "Public server"
                      : "Local server"}
              </strong>
              <span>{serverAddress}</span>
            </div>
          </div>
        </div>
      </aside>
      <main id="workspace-main" tabIndex={-1}>
        <header className="topbar">
          <div className="breadcrumb">
            jsontovideo
            <span className="crumb-sep" aria-hidden="true">
              /
            </span>
            <span>{nav[navIndex]?.[2]}</span>
          </div>
          <div className="topbar-tools">
            <ThemeSwitch theme={theme} onChange={setTheme} />
            <a
              className="docs-link"
              href="https://json2video.com/docs/v2/"
              target="_blank"
              rel="noreferrer"
            >
              <BookOpen size={15} strokeWidth={1.7} />
              <span>JSON2Video reference</span>
              <ArrowUpRight size={13} />
            </a>
          </div>
        </header>
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
        {engineProblem && (
          <div className="alert" role="alert">
            <AlertCircle size={18} />
            <span>
              FFmpeg isn't available on this server, so videos can't be
              generated yet.
            </span>
          </div>
        )}
        {error && (
          <div className="alert" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError("")}>
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
            <section className="studio">
              <div className="project-bar">
                <div className="project-title">
                  <Clapperboard size={18} strokeWidth={1.6} />
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
                    <Download size={17} strokeWidth={1.7} />
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
                  <div className="pane-heading">
                    <div>
                      <Braces size={15} strokeWidth={1.7} />
                      <span className="mono">movie.json</span>
                    </div>
                    <button
                      className="ghost"
                      onClick={() => {
                        try {
                          setSource(pretty(JSON.parse(source)));
                          toast("JSON formatted.");
                        } catch {
                          setError("Fix the syntax before formatting.");
                        }
                      }}
                    >
                      <Code2 size={14} strokeWidth={1.7} />
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
                        <CheckCircle2 size={15} />
                        <span>Valid JSON</span>
                        <span className="validation-meta">
                          {plural(movie.scenes.length, "scene")}
                          {total != null && ` · ${lengthLabel}`}
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={15} />
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
                  <div className="stage">
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
                        <Braces size={34} strokeWidth={1.3} />
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
                  <div className="transport">
                    <span className="timecode" title="Start of this scene, then the length of the whole video">
                      {clock(sceneStart)}
                      <span> / {lengthLabel}</span>
                    </span>
                    <span className="dims">
                      {movie ? dimensions(movie).join(" × ") : "-"}
                      {" · "}
                      {movie?.fps || 30} fps
                    </span>
                  </div>
                  <div className="render-result" aria-live="polite">
                    {activeJob ? (
                      <>
                        <div className={`job-status ${activeJob.status}`}>
                          {["running", "pending"].includes(activeJob.status) ? (
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
                    <Layers size={16} strokeWidth={1.7} />
                    Scenes
                  </span>
                  <span
                    className="timeline-total"
                    title={
                      estimate.exact
                        ? "Total length of your scenes"
                        : "Estimated from the narration text. The exact length is known once the video is rendered."
                    }
                  >
                    {total == null
                      ? "Length set by the media"
                      : `${lengthLabel} in total`}
                  </span>
                </div>
                {movie && (
                  <div className="tl-bar" role="presentation">
                    {movie.scenes.map((s, i) => (
                      <button
                        key={i}
                        tabIndex={-1}
                        aria-hidden="true"
                        className={`tl-seg ${sceneIndex === i ? "on" : ""}`}
                        style={{
                          flexGrow: Math.max(1, estimate.scenes[i]?.seconds ?? 3),
                          background: s["background-color"],
                        }}
                        onClick={() => {
                          setSceneIndex(i);
                          setActive(null);
                        }}
                      />
                    ))}
                  </div>
                )}
                <div className="scene-strip">
                  {movie?.scenes.map((s, i) => {
                    const length = estimate.scenes[i];
                    return (
                      <button
                        key={i}
                        aria-pressed={sceneIndex === i}
                        className={`scene-card ${sceneIndex === i ? "selected" : ""}`}
                        style={{ "--i": Math.min(i, 12) }}
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
                              s.elements.find((e) => e.type === "text")?.color ||
                              "#fff",
                          }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="scene-info">
                          <strong>{s.name || s.comment || `Scene ${i + 1}`}</strong>
                          <span>
                            {length?.seconds != null
                              ? `${length.exact ? "" : "~"}${Math.round(length.seconds)}s`
                              : "-"}
                            {" · "}
                            {plural(s.elements.length, "element")}
                          </span>
                        </span>
                      </button>
                    );
                  })}
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
                    <Plus size={18} strokeWidth={1.7} />
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
                  unchanged until you send the <code>variables</code> object.
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
                              <span className="missing-value">Missing</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  {plural(inspection.scenes, "scene")} ·{" "}
                  {plural(inspection.generatedImages, "image")} from a prompt ·{" "}
                  {plural(inspection.voices, "voice")} ·{" "}
                  {plural(inspection.subtitles, "subtitle track")}
                </p>
              </details>
            )}
            <div className="editor-footnote">
              <span>
                <Check size={14} />
                Your draft is saved automatically in this browser.
              </span>
              <button onClick={() => go("api")}>
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
              <button className="primary" onClick={() => go("editor")}>
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
                <svg className="leader" viewBox="0 0 160 160" aria-hidden="true">
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
                <button className="secondary" onClick={() => go("editor")}>
                  Open the editor
                </button>
              </div>
            ) : (
              <div className="jobs-list">
                {jobs.map((job, i) => {
                  const finished = ["done", "error"].includes(job.status);
                  return (
                    <div
                      key={job.project}
                      className={`job-wrap ${leaving.includes(job.project) ? "leaving" : ""}`}
                      style={{ "--i": Math.min(i, 8) }}
                    >
                      <article className="job-row">
                        <button
                          className="job-thumbnail"
                          onClick={() => openJob(job)}
                          aria-label={`Open ${job.name}`}
                        >
                          <Thumb src={job.thumbnail} />
                        </button>
                        <div className="job-detail">
                          <button
                            className="text-button"
                            onClick={() => openJob(job)}
                          >
                            {job.name}
                          </button>
                          <span>
                            {new Date(job.created_at).toLocaleString("en-US")}
                            {job.duration ? ` · ${clock(job.duration)}` : ""}
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
                        <div className="job-actions">
                          {confirming === job.project ? (
                            <div className="confirm" role="alertdialog" aria-label={`Delete ${job.name}?`}>
                              <span>Delete this video?</span>
                              <button
                                className="secondary"
                                onClick={() => setConfirming(null)}
                                autoFocus
                              >
                                Keep
                              </button>
                              <button
                                className="danger"
                                onClick={() => removeJob(job)}
                              >
                                <Trash2 size={15} />
                                Delete
                              </button>
                            </div>
                          ) : (
                            <>
                              {job.url && (
                                <a
                                  className="secondary"
                                  href={`${job.url}&download=1`}
                                >
                                  <Download size={16} />
                                  <span>MP4</span>
                                </a>
                              )}
                              <button
                                className="icon-button delete"
                                aria-label={`Delete ${job.name}`}
                                title={
                                  finished
                                    ? "Delete this video"
                                    : "You can delete it once it has finished"
                                }
                                disabled={!finished}
                                onClick={() => setConfirming(job.project)}
                              >
                                <Trash2 size={17} strokeWidth={1.6} />
                              </button>
                            </>
                          )}
                        </div>
                      </article>
                    </div>
                  );
                })}
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
                  Intro + 10 scenes, FLUX 1.1 Pro, GuyNeural and subtitles. The
                  25 variables are sent separately.
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
              {examples.map((example, i) => (
                <article
                  className="template"
                  key={example.id}
                  style={{ "--i": i }}
                >
                  <div
                    className="template-art"
                    style={{
                      background: example.movie.scenes[0]["background-color"],
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
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </label>
              <p className="muted">
                In Make HTTP v4: Authentication type → API key, placed in the
                header, named <code>x-api-key</code>.
              </p>
              <div className="provider-status">
                <span>
                  FLUX 1.1 Pro{" "}
                  <strong className={config?.fluxImages ? "ok" : "missing"}>
                    {config?.fluxImages ? "Configured" : "BFL_API_KEY is missing"}
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
                The template <code>{makeTemplateId}</code> is included on this
                server. In HTTP 29, keep the ID and the mappings, and just
                change the API address and key. HTTP 41 still reads{" "}
                <code>movie.url</code>, and HTTP 44 downloads the MP4.
              </p>
              <CodeBlock
                onCopied={() => toast("Select the text and copy it by hand.")}
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
                The mappings above show where each value comes from; pick the
                fields in Make. Use a structured JSON body / Create JSON so the
                quotes and line breaks from Gemini stay intact.
              </p>
            </details>
            <MakeFlow />
            <div className="api-guide">
              <article>
                <h2>1. Send the video</h2>
                <p>
                  Use the HTTP → Make a request module. Set the method to{" "}
                  <code>POST</code> and Body content type to{" "}
                  <code>application/JSON</code>. Send the JSON from the editor
                  and save the <code>project</code> field from the response.
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
                  video's fields. The idempotency key stops duplicate renders
                  when the same request is sent twice.
                </p>
              </article>
              <article>
                <h2>2. Continue when it's ready</h2>
                <p>
                  In a second Make scenario, add{" "}
                  <strong>Webhooks → Custom webhook</strong>. Copy its URL into{" "}
                  <code>webhook_url</code>. Filter on{" "}
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
                  Connect <strong>HTTP → Download a file → Router</strong> to
                  your publishing modules and update the row in Sheets.
                  Deduplicate notifications by <code>project</code>.
                </p>
              </article>
            </div>
            <details>
              <summary>Prefer to poll from your current flow?</summary>
              <p>
                Call <code>GET /v2/movies?project=VIDEO_ID</code> with the same
                key. Only continue when <code>movie.status = done</code>. On{" "}
                <code>error</code>, save <code>movie.message</code>. Retry
                pending and running jobs with a time limit, because a fixed
                wait doesn't guarantee the render has finished.
              </p>
            </details>
            <details>
              <summary>What does the JSON format support?</summary>
              <p>
                Scenes with an explicit duration or one calculated from the
                media; text; images and video over HTTPS; FLUX 1.1 Pro images
                from a prompt; audio tracks; a local English voice or Azure;{" "}
                <code>{"{{name}}"}</code> variables; vertical, landscape or
                square formats; and SD/HD/Full HD. Audio from video clips is
                ignored, so add an explicit audio track. HTML, JSON2Video
                components and transitions between scenes aren't implemented.
                Fade-in/out, zoom and subtitles synced to the Azure voice are
                available. Subtitles can highlight the word being spoken
                (word-color), show a set number of words at a time (max-words),
                pop the active word (word-scale) and switch to capitals
                (all-caps). Text and subtitles can use the DejaVu Sans or
                Poppins font (font-family). The local voice uses Windows or
                eSpeak NG, while provider: azure needs your Azure keys on the
                server. Local subtitles need an explicit timing: estimated
                (approximate). The limit is 900 seconds per video and 300 per
                scene.
              </p>
            </details>
            <div className="source-links">
              Checked documentation:
              <a href="https://apps.make.com/http" target="_blank" rel="noreferrer">
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
createRoot(document.getElementById("root")).render(<App />);
