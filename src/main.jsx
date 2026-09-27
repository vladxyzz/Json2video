import React, { useEffect, useMemo, useRef, useState } from "react";
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
  pending: "În așteptare",
  running: "Se randează",
  done: "Finalizat",
  error: "Eroare",
};
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
              : "variables din cererea JSON";
function App() {
  const [view, setView] = useState("editor"),
    [source, setSource] = useState(
      () => localStorage.getItem("j2v-draft") || pretty(examples[0].movie),
    );
  const [key, setKey] = useState(() => sessionStorage.getItem("j2v-key") || ""),
    [sessionReady, setSessionReady] = useState(false),
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
  const textRef = useRef(null),
    numbersRef = useRef(null),
    fileRef = useRef(null),
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
        data.message || data.errors?.[0]?.message || "Cererea nu a reușit.",
      );
    return data;
  }
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((s) => {
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
      if (document.hidden) {
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
      toast("Videoclipul a intrat în coada de randare.");
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
    toast("Exemplu încărcat în editor.");
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
      toast("Selectează și copiază textul manual.");
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
    ["editor", Braces, "Editor video"],
    ["renders", Film, "Videoclipuri"],
    ["templates", Layers, "Exemple"],
    ["api", Code2, "API & Make"],
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-main">
        Sari la editor
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
        <div className="workspace-label">Spațiu de lucru</div>
        <nav aria-label="Navigare principală">
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
              ? "Server indisponibil"
              : config?.engine === "ready"
                ? "Motor de randare activ"
                : config
                  ? "FFmpeg indisponibil"
                  : "Conectare la motor…"}
          </div>
          <span className="small-muted">FFmpeg · MP4 / H.264</span>
          <div className="profile">
            <HardDrive size={18} />
            <div>
              <strong>
                {config?.publicReady ? "Server public" : "Server local"}
              </strong>
              <span>
                {config?.publicReady ? "HTTPS activ" : "Pe acest calculator"}
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
          <a
            className="docs-link"
            href="https://json2video.com/docs/v2/"
            target="_blank"
            rel="noreferrer"
          >
            <BookOpen size={15} />
            Referință JSON2Video
            <ArrowUpRight size={14} />
          </a>
        </header>
        {!sessionReady ? (
          <div className="loading-state" role="status">
            <LoaderCircle size={18} className="spin" />
            Se conectează studioul…
          </div>
        ) : !key ? (
          <section className="connect-panel">
            <KeyRound size={32} />
            <h1>Conectează-te la studio</h1>
            <p>Introdu cheia API configurată pe server.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setKey(new FormData(e.currentTarget).get("key"));
              }}
            >
              <input
                aria-label="Cheie API"
                name="key"
                type="password"
                required
                minLength={24}
                placeholder="Cheia ta API"
              />
              <button className="primary">Conectează</button>
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
                  Schimbă cheia
                </button>
              </div>
            )}
            {error && (
              <div className="alert" role="alert">
                <AlertCircle size={18} />
                {error}
                <button
                  aria-label="Închide eroarea"
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
                    <h1>Editor video</h1>
                    <p>JSON, scene și randare</p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => fileRef.current.click()}
                  >
                    <Plus size={16} />
                    Importă JSON
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
                          toast("JSON importat.");
                        } catch {
                          setError("Fișierul nu conține JSON valid.");
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
                        aria-label="Numele videoclipului"
                        value={rawMovie?.name ?? ""}
                        placeholder={
                          rawMovie?.comment || "Numele videoclipului"
                        }
                        disabled={!rawMovie}
                        onChange={(e) => changeMovie("name", e.target.value)}
                      />
                      <span className="draft-tag">Ciornă</span>
                    </div>
                    <div className="project-actions">
                      <button
                        className="icon-button"
                        title="Descarcă JSON"
                        aria-label="Descarcă JSON"
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
                        Generează video
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
                              toast("JSON formatat.");
                            } catch {
                              setError(
                                "Corectează sintaxa înainte de formatare.",
                              );
                            }
                          }}
                        >
                          <Code2 size={14} />
                          Formatează
                        </button>
                      </div>
                      <div className="code-area">
                        <pre
                          ref={numbersRef}
                          aria-hidden="true"
                          className="line-numbers"
                        >
                          {source
                            .split("\n")
                            .map((_, i) => i + 1)
                            .join("\n")}
                        </pre>
                        <textarea
                          ref={textRef}
                          aria-label="Cod JSON pentru videoclip"
                          aria-invalid={!movie}
                          aria-describedby="json-validation"
                          spellCheck="false"
                          value={source}
                          onChange={(e) => updateSource(e.target.value)}
                          onScroll={(e) => {
                            if (numbersRef.current)
                              numbersRef.current.scrollTop = e.target.scrollTop;
                          }}
                        />
                      </div>
                      <div
                        id="json-validation"
                        className={`validation-bar ${movie ? "valid" : "invalid"}`}
                      >
                        {movie ? (
                          <>
                            <CheckCircle2 size={14} />
                            JSON valid
                            <span>
                              {movie.scenes.length} scene ·{" "}
                              {duration == null
                                ? "durată automată"
                                : `${duration}s`}
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={14} />
                            <span>
                              {syntaxError
                                ? `Sintaxă JSON: ${syntaxError}`
                                : `${issues[0]?.path.join(".") || "JSON"}: ${issues[0]?.message || "Completează JSON-ul."}`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="preview-pane">
                      <div className="pane-heading">
                        <div>
                          <span>Previzualizare</span>
                          <span className="preview-tag">
                            {activeJob?.status === "done" ? "MP4" : "Schiță"}
                          </span>
                        </div>
                        <label className="format-select">
                          <select
                            aria-label="Format video"
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
                            <option value="1:1">1:1 · Pătrat</option>
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
                                ? `${inspection.missing.length} variabile așteaptă date.`
                                : "Corectează JSON-ul pentru previzualizare."}
                            </p>
                            {!!inspection?.missing.length && (
                              <small>
                                Valorile se trimit în câmpul variables din Make.
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
                                aria-label="Progres randare"
                                value={activeJob.progress}
                                max="100"
                              />
                            )}
                            <p>{activeJob.message}</p>
                          </>
                        ) : (
                          <p>
                            <Film size={15} />
                            Generează videoclipul pentru redarea rezultatului
                            final.
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
                          ? "Durata se calculează din media"
                          : `${duration}s în total`}
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
                              {s.name || s.comment || `Scena ${i + 1}`}
                            </strong>
                            <span>
                              {s.duration > 0 ? `${s.duration}s` : "Auto"} ·{" "}
                              {s.elements.length} elemente
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
                            name: "Scenă nouă",
                            duration: 3,
                            "background-color": "#20282c",
                            elements: [
                              { type: "text", text: "Povestea continuă." },
                            ],
                          });
                          setSource(pretty(input));
                          setSceneIndex(input.scenes.length - 1);
                          setActive(null);
                        }}
                      >
                        <Plus size={20} />
                        <span>Adaugă scenă</span>
                      </button>
                    </div>
                  </div>
                </section>
                {!!inspection?.variables.length && (
                  <details className="template-inspector">
                    <summary>
                      Variabile șablon{" "}
                      <span>
                        {inspection.variables.length} în total ·{" "}
                        {inspection.missing.length} lipsă
                      </span>
                    </summary>
                    <p>
                      Valorile provin din cererea Make. Șablonul rămâne
                      neschimbat până când trimiți obiectul{" "}
                      <code>variables</code>.
                    </p>
                    <div className="variable-table-wrap">
                      <table className="variable-table">
                        <thead>
                          <tr>
                            <th>Variabilă</th>
                            <th>Sursa din scenariul tău</th>
                            <th>Valoare în JSON</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inspection.variables.map((v) => (
                            <tr key={v.name}>
                              <td>
                                <code>{v.name}</code>
                              </td>
                              <td>{variableSource(v.name)}</td>
                              <td>
                                {v.defined ? (
                                  <span
                                    className="variable-value"
                                    title={String(v.value)}
                                  >
                                    {String(v.value)}
                                  </span>
                                ) : (
                                  <span className="missing-value">
                                    Lipsește
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p>
                      {inspection.scenes} scene · {inspection.generatedImages}{" "}
                      imagini din prompt · {inspection.voices} voci ·{" "}
                      {inspection.subtitles} subtitrări
                    </p>
                  </details>
                )}
                <div className="editor-footnote">
                  <span>
                    <Check size={14} />
                    Ciorna se salvează automat în acest browser.
                  </span>
                  <button onClick={() => setView("api")}>
                    Automatizează cu Make <ArrowUpRight size={14} />
                  </button>
                </div>
              </>
            )}
            {view === "renders" && (
              <section className="content-page">
                <div className="page-heading">
                  <div>
                    <h1>Videoclipuri</h1>
                    <p>Randări reale, progres și fișiere gata de descărcat.</p>
                  </div>
                  <button className="primary" onClick={() => setView("editor")}>
                    <Plus size={16} />
                    Creează video
                  </button>
                </div>
                {jobsLoading ? (
                  <div className="loading-state" role="status">
                    <LoaderCircle size={18} className="spin" />
                    Se încarcă videoclipurile…
                  </div>
                ) : !jobs.length ? (
                  <div className="empty-state">
                    <Film size={38} />
                    <h2>Prima poveste te așteaptă.</h2>
                    <p>Generează un videoclip din editor. Îl vei găsi aici.</p>
                    <button
                      className="secondary"
                      onClick={() => setView("editor")}
                    >
                      Deschide editorul
                    </button>
                  </div>
                ) : (
                  <div className="jobs-list">
                    {jobs.map((job) => (
                      <article className="job-row" key={job.project}>
                        <button
                          className="job-thumbnail"
                          onClick={() => openJob(job)}
                          aria-label={`Deschide ${job.name}`}
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
                            {new Date(job.created_at).toLocaleString("ro-RO")} ·{" "}
                            {job.duration ? `${job.duration}s` : "Randare"}
                          </span>
                          <code>{job.project}</code>
                          {job.status === "error" && (
                            <p className="error-text">{job.message}</p>
                          )}
                          {job.webhook && (
                            <span>
                              Webhook: {job.webhook.state} ·{" "}
                              {job.webhook.attempts} încercări{" "}
                              {job.webhook.state === "failed" && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await api(
                                        `/api/movies/${job.project}/webhook/retry`,
                                        { method: "POST" },
                                      );
                                      toast("Webhook reprogramat.");
                                    } catch (e) {
                                      setError(e.message);
                                    }
                                  }}
                                >
                                  Reîncearcă
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
                    <h1>Șabloane și exemple</h1>
                    <p>
                      Șablonul din Make și exemple pentru testarea motorului.
                    </p>
                  </div>
                </div>
                <article className="make-template-row">
                  <div>
                    <h2>Scenariul tău Make</h2>
                    <p>
                      Intro + 10 scene, FLUX 1.1 Pro, GuyNeural și subtitrări.
                      Cele 25 de variabile se trimit separat.
                    </p>
                    <code>{makeTemplateId}</code>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => setSelectedTemplate(templates[0])}
                  >
                    Deschide șablonul <ArrowUpRight size={16} />
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
                              Ideile tale.
                              <br />
                              În mișcare.
                            </>
                          ) : example.id === "landscape" ? (
                            <>
                              Ce urmează
                              <br />
                              începe aici.
                            </>
                          ) : (
                            <>
                              Un pas mic.
                              <br />O idee mare.
                            </>
                          )}
                        </h2>
                        <span>{example.movie.scenes.length} scene</span>
                      </div>
                      <h2>{example.label}</h2>
                      <p>{example.description}</p>
                      <button
                        className="secondary"
                        onClick={() => setSelectedTemplate(example)}
                      >
                        Folosește exemplul
                        <ArrowUpRight size={16} />
                      </button>
                    </article>
                  ))}
                </div>
                {selectedTemplate && (
                  <div className="inline-confirm" role="alert">
                    <span>
                      Înlocuiești ciorna curentă cu „{selectedTemplate.label}”?
                    </span>
                    <button
                      className="secondary"
                      onClick={() => setSelectedTemplate(null)}
                    >
                      Păstrează ciorna
                    </button>
                    <button
                      className="primary"
                      onClick={() => loadTemplate(selectedTemplate)}
                    >
                      Încarcă exemplul
                    </button>
                  </div>
                )}
              </section>
            )}
            {view === "api" && (
              <section className="content-page api-page">
                <div className="page-heading">
                  <div>
                    <h1>API și Make</h1>
                    <p>
                      Leagă editorul de Make și generează videoclipuri din date.
                    </p>
                  </div>
                  <span className="status-tag done">REST API · v2</span>
                </div>
                <div className="api-settings">
                  <h2>Conexiunea ta</h2>
                  <label>
                    Adresa API
                    <input
                      readOnly
                      value={`${config?.publicUrl || location.origin}/v2/movies`}
                    />
                  </label>
                  {!config?.publicReady && (
                    <p className="connection-note">
                      <AlertCircle size={16} />
                      Rulezi local. Make necesită un server cu HTTPS public.
                      Setează PUBLIC_BASE_URL după publicarea serverului.
                    </p>
                  )}
                  <label>
                    Cheia API
                    <div className="key-field">
                      <input
                        aria-label="Cheia API curentă"
                        type="password"
                        readOnly
                        value={key}
                      />
                      <button className="secondary" onClick={() => copy(key)}>
                        {copied ? <Check size={15} /> : <Copy size={15} />}
                        Copiază
                      </button>
                    </div>
                  </label>
                  <p className="muted">
                    În Make HTTP v4: Authentication type → API key, plasare în
                    header, nume <code>x-api-key</code>.
                  </p>
                  <div className="provider-status">
                    <span>
                      FLUX 1.1 Pro{" "}
                      <strong>
                        {config?.fluxImages
                          ? "Configurat"
                          : "Lipsește BFL_API_KEY"}
                      </strong>
                    </span>
                    <span>
                      Azure · GuyNeural{" "}
                      <strong>
                        {config?.azureSpeech
                          ? "Configurat"
                          : "Lipsesc cheia și regiunea Azure"}
                      </strong>
                    </span>
                  </div>
                  <p className="muted">
                    Cheile se setează în fișierul .env de pe server. Aliasul{" "}
                    <code>flux-pro</code> folosește explicit FLUX 1.1 Pro.
                  </p>
                </div>
                <details className="make-contract" open>
                  <summary>Cererea din scenariul tău</summary>
                  <p>
                    Șablonul <code>{makeTemplateId}</code> este inclus pe acest
                    server. În HTTP 29, păstrezi ID-ul și mapările; schimbi
                    adresa API și cheia. HTTP 41 citește în continuare{" "}
                    <code>movie.url</code>, iar HTTP 44 descarcă MP4.
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
                    Mapările de mai sus arată sursele; selectează câmpurile în
                    Make. Folosește corp JSON structurat / Create JSON pentru a
                    păstra corect ghilimelele și liniile noi din Gemini.
                  </p>
                </details>
                <div className="make-flow">
                  <div>
                    <span className="flow-circle sheets">
                      <Layers size={22} />
                    </span>
                    <strong>Sheets / Gemini</strong>
                    <small>Pregătește conținutul</small>
                  </div>
                  <ChevronRight />
                  <div>
                    <span className="flow-circle json">
                      <Braces size={22} />
                    </span>
                    <strong>HTTP · POST</strong>
                    <small>Trimite JSON-ul</small>
                  </div>
                  <ChevronRight />
                  <div>
                    <span className="flow-circle render">
                      <Clapperboard size={22} />
                    </span>
                    <strong>Json2vid</strong>
                    <small>Generează MP4</small>
                  </div>
                  <ChevronRight />
                  <div>
                    <span className="flow-circle hook">
                      <Code2 size={22} />
                    </span>
                    <strong>Webhook Make</strong>
                    <small>Primește rezultatul</small>
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
                    <h2>1. Trimite videoclipul</h2>
                    <p>
                      Modul HTTP → Make a request. Metoda <code>POST</code>,
                      Body content type <code>application/JSON</code>. Trimite
                      JSON-ul din editor și salvează câmpul <code>project</code>{" "}
                      din răspuns.
                    </p>
                    <CodeBlock
                      text={
                        "POST /v2/movies\nx-api-key: CHEIA_TA\nContent-Type: application/json\nIdempotency-Key: rand-42-versiunea-1\n\n" +
                        pretty({
                          "...": "JSON-ul din editor",
                          "client-data": { row: 42 },
                          webhook_url:
                            "https://hook.eu1.make.com/WEBHOOKUL_TAU",
                        })
                      }
                    />
                    <p className="muted">
                      Exemplul de mai sus este orientativ: înlocuiește „...” cu
                      câmpurile filmului. Cheia de idempotență previne randările
                      duplicate pentru aceeași cerere.
                    </p>
                  </article>
                  <article>
                    <h2>2. Continuă când e gata</h2>
                    <p>
                      Într-un al doilea scenariu Make, adaugă{" "}
                      <strong>Webhooks → Custom webhook</strong>. Copiază URL-ul
                      în <code>webhook_url</code>. Filtrează după{" "}
                      <code>movie.status = done</code>, apoi descarcă{" "}
                      <code>movie.url</code>.
                    </p>
                    <CodeBlock
                      text={pretty({
                        event: "movie.done",
                        success: true,
                        project: "ID_VIDEO",
                        movie: {
                          status: "done",
                          url: "https://serverul-tau/files/…",
                          "client-data": { row: 42 },
                        },
                      })}
                    />
                    <p>
                      Conectează{" "}
                      <strong>HTTP → Download a file → Router</strong> la
                      modulele tale de publicare și actualizează rândul din
                      Sheets. Deduplifică notificările după <code>project</code>
                      .
                    </p>
                  </article>
                </div>
                <details>
                  <summary>
                    Preferi verificarea periodică din fluxul actual?
                  </summary>
                  <p>
                    Apelează <code>GET /v2/movies?project=ID_VIDEO</code> cu
                    aceeași cheie. Continuă doar pentru{" "}
                    <code>movie.status = done</code>. Pentru <code>error</code>,
                    salvează <code>movie.message</code>. Reîncearcă
                    pending/running cu o limită de timp; o pauză fixă nu
                    garantează finalizarea.
                  </p>
                </details>
                <details>
                  <summary>Ce acceptă formatul JSON?</summary>
                  <p>
                    Scene cu durată explicită sau calculată din media, text,
                    imagini și video prin HTTPS, imagini FLUX 1.1 Pro din
                    prompt, piste audio, voce locală în engleză sau Azure,
                    variabile <code>{"{{nume}}"}</code>, format
                    vertical/landscape/pătrat, SD/HD/Full HD. Sunetul clipurilor
                    video este ignorat: adaugă o pistă audio explicită. HTML,
                    componentele JSON2Video și tranzițiile între scene nu sunt
                    implementate. Fade-in/out, zoom și subtitrările sincronizate
                    cu vocea Azure sunt disponibile. Vocea locală folosește
                    Windows sau eSpeak NG; provider: azure necesită cheile Azure
                    pe server. Subtitrările locale necesită explicit timing:
                    estimated (aproximativ). Limita este de 900 secunde pe film
                    și 300 pe scenă.
                  </p>
                </details>
                <div className="source-links">
                  Documentație verificată:
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
                  alt="Imagine din scenă"
                  src={e.src}
                  referrerPolicy="no-referrer"
                  style={{ ...style, objectFit: e.fit }}
                />
              ) : (
                <div key={i} className="video-placeholder" style={style}>
                  <Film size={60} />
                  <span>
                    {e.type === "image"
                      ? "Imagine FLUX · generată la randare"
                      : "Clip video · vizibil după randare"}
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
