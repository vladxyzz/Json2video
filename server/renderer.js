import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import ffmpegStatic from "ffmpeg-static";
import sharp from "sharp";
import { dimensions, pixelValue } from "../shared/schema.js";
import { download } from "./network.js";
import { outputDir, workDir } from "./config.js";
import { azureSpeech, generateImage } from "./providers.js";
import { subtitleCues } from "./subtitles.js";

export const ffmpeg = process.env.FFMPEG_PATH || ffmpegStatic;
export function probeDuration(file, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpeg,
      [
        "-hide_banner",
        "-nostdin",
        "-protocol_whitelist",
        "file,pipe",
        "-format_whitelist",
        "mov,matroska,webm,mp3,wav,ogg,flac,aac,avi",
        "-i",
        file,
      ],
      { cwd, windowsHide: true },
    );
    let output = "";
    child.stderr.on("data", (c) => {
      output = (output + c).slice(-12000);
    });
    const timer = setTimeout(() => child.kill(), 30000);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", () => {
      clearTimeout(timer);
      const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(output);
      const seconds = m
        ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
        : 0;
      if (seconds > 0 && Number.isFinite(seconds)) resolve(seconds);
      else reject(new Error("Nu se poate determina durata fișierului media."));
    });
  });
}
export function runFfmpeg(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpeg,
      ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", ...args],
      { cwd, windowsHide: true },
    );
    let error = "";
    child.stderr.on("data", (c) => {
      error = (error + c).slice(-6000);
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), 15 * 60 * 1000);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve()
        : reject(
            new Error(
              `FFmpeg (${code}): ${error || "Procesul a fost întrerupt."}`,
            ),
          );
    });
  });
}
const escapeXml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export function wrapText(text, width, fontSize) {
  const max = Math.max(4, Math.floor(width / (fontSize * 0.59)));
  return text.split("\n").flatMap((line) => {
    const words = line.split(/\s+/);
    const lines = [];
    let current = "";
    for (const word of words) {
      if (current && current.length + word.length + 1 > max) {
        lines.push(current);
        current = "";
      }
      current += (current ? " " : "") + word;
    }
    lines.push(current);
    return lines;
  });
}
async function textLayer(element, W, H, target) {
  const width = element.width || Math.round(W * 0.88),
    size = parseFloat(element["font-size"]);
  const lines = wrapText(element.text, width, size),
    lineHeight = size * 1.25,
    height =
      element.height || Math.ceil(lines.length * lineHeight + size * 0.25);
  const anchor = { left: "start", center: "middle", right: "end" }[
    element["text-align"]
  ];
  const x = { left: 4, center: width / 2, right: width - 4 }[
    element["text-align"]
  ];
  const shadow =
    element.style === "shadow"
      ? ` stroke="#111111" stroke-width="${Math.max(2, size / 14)}" stroke-linejoin="round" paint-order="stroke"`
      : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g fill="${element.color}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}" font-weight="${element["font-weight"]}" text-anchor="${anchor}"${shadow}>${lines.map((line, i) => `<text x="${x}" y="${size + i * lineHeight}">${escapeXml(line)}</text>`).join("")}</g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(target);
  return { width, height };
}
function coordinate(value, size, object, axis) {
  const pixels = pixelValue(value, size);
  return pixels !== undefined
    ? pixels
    : value === "center"
      ? (size - object) / 2
      : ["right", "bottom"].includes(value)
        ? size - object
        : 0;
}
async function speech(element, target) {
  if (element.provider === "local") {
    const textFile = target + ".txt";
    const windows = process.platform === "win32";
    await fs.writeFile(
      textFile,
      windows
        ? JSON.stringify({ text: element.text, language: element.language })
        : element.text,
      "utf8",
    );
    const command = windows
      ? path.join(
          process.env.SystemRoot || "C:/Windows",
          "System32/WindowsPowerShell/v1.0/powershell.exe",
        )
      : process.env.ESPEAK_PATH || "espeak-ng";
    const speechCommand = windows
      ? await fs.readFile(
          fileURLToPath(new URL("../scripts/speech.ps1", import.meta.url)),
          "utf8",
        )
      : "";
    const args = windows
      ? [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          Buffer.from(speechCommand, "utf16le").toString("base64"),
        ]
      : [
          "-b",
          "1",
          "-v",
          element.language.toLowerCase(),
          "-s",
          "155",
          "-f",
          textFile,
          "-w",
          target,
        ];
    await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        windowsHide: true,
        env: {
          ...process.env,
          J2V_SPEECH_INPUT: textFile,
          J2V_SPEECH_OUTPUT: target,
        },
      });
      let error = "";
      child.stderr.on("data", (c) => {
        error = (error + c).slice(-2000);
      });
      const timer = setTimeout(() => child.kill(), 60000);
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(new Error(`Vocea locală nu este disponibilă: ${e.message}`));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        code === 0
          ? resolve()
          : reject(new Error(`Vocea locală a eșuat: ${error}`));
      });
    });
    return { words: [] };
  }
  return azureSpeech(element, target);
}
function fadeFilters(el, length, audio = false) {
  const prefix = audio ? "afade" : "fade",
    alpha = audio ? "" : ":alpha=1",
    filters = [];
  if (el["fade-in"] > 0)
    filters.push(
      `${prefix}=t=in:st=0:d=${Math.min(length, el["fade-in"])}${alpha}`,
    );
  if (el["fade-out"] > 0) {
    const d = Math.min(length, el["fade-out"]);
    filters.push(
      `${prefix}=t=out:st=${Math.max(0, length - d)}:d=${d}${alpha}`,
    );
  }
  return filters.length ? filters.join(",") + "," : "";
}
export async function renderMovie(
  job,
  onProgress,
  {
    downloadAsset = download,
    synthesize = speech,
    imageGenerator = generateImage,
  } = {},
) {
  const movie = job.input,
    [W, H] = dimensions(movie),
    fps = movie.fps;
  const dir = path.join(workDir, job.id);
  await fs.mkdir(dir, { recursive: true });
  let assetIndex = 0;
  const prepared = new Map(),
    sceneDurations = [];
  async function asset(element) {
    if (prepared.has(element)) return prepared.get(element).file;
    const name = `asset-${assetIndex++}.${element.type === "voice" ? "wav" : "bin"}`;
    const target = path.join(dir, name);
    let metadata = {};
    if (element.type === "voice")
      metadata = (await synthesize(element, target)) || {};
    else if (element.type === "image" && element.prompt)
      await imageGenerator(
        element,
        target,
        element.width || W,
        element.height || H,
      );
    else await downloadAsset(element.src, target);
    if (element.type === "image") {
      await sharp(target, { limitInputPixels: 40000000 })
        .png()
        .toFile(target + ".png");
      prepared.set(element, { file: name + ".png" });
      return name + ".png";
    }
    prepared.set(element, {
      file: name,
      duration: await probeDuration(name, dir),
      ...metadata,
    });
    return name;
  }
  try {
    const parts = [];
    for (let s = 0; s < movie.scenes.length; s++) {
      const scene = movie.scenes[s];
      onProgress(
        Math.round(5 + (s / movie.scenes.length) * 80),
        `Pregătire media · scena ${s + 1}`,
      );
      for (const el of scene.elements.filter((e) =>
        ["voice", "audio", "video"].includes(e.type),
      ))
        await asset(el);
      const naturalEnd = (e) =>
        e.start +
        (e.duration > 0
          ? e.duration
          : e.duration === -2
            ? 0
            : Math.max(0, (prepared.get(e)?.duration || 0) - (e.seek || 0)));
      const duration =
        scene.duration > 0
          ? scene.duration
          : Math.ceil(Math.max(...scene.elements.map(naturalEnd)) * fps) / fps;
      if (!Number.isFinite(duration) || duration < 0.25 || duration > 300)
        throw new Error(
          `Scena ${s + 1}: durata trebuie să fie între 0.25 și 300 secunde.`,
        );
      sceneDurations.push(duration);
      if (sceneDurations.reduce((n, d) => n + d, 0) > 900)
        throw new Error("Durata totală maximă este 900 secunde.");
      const elements = scene.elements.flatMap((el) => {
        if (el.type !== "subtitles") return [el];
        const voice = scene.elements.find(
          (v) => v.type === "voice" && v.text === el.text,
        );
        const data = prepared.get(voice),
          start = el.start + (voice?.start || 0);
        const length = Math.min(
          el.duration > 0 ? el.duration : duration - start,
          data?.duration || duration - start,
        );
        return subtitleCues(el, data, length).map((cue) => ({
          ...el,
          type: "text",
          text: cue.text,
          start: start + cue.start,
          duration: cue.duration,
        }));
      });
      onProgress(
        Math.round(5 + (s / movie.scenes.length) * 80),
        `Randare scenă ${s + 1} din ${movie.scenes.length}`,
      );
      const args = [
        "-f",
        "lavfi",
        "-i",
        `color=c=${scene["background-color"]}:s=${W}x${H}:r=${fps}:d=${duration}`,
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=48000:cl=stereo",
      ];
      const filters = ["[0:v]format=rgba[v0]"];
      let v = "v0",
        input = 2;
      const audios = [];
      for (let e = 0; e < elements.length; e++) {
        const el = elements[e],
          start = el.start,
          length = el.duration > 0 ? el.duration : duration - start;
        if (
          start >= duration ||
          length <= 0 ||
          start + length > duration + 0.05
        )
          throw new Error(
            `Scena ${s + 1}: elementul depășește durata calculată.`,
          );
        if (el.type === "audio" || el.type === "voice") {
          const file = await asset(el);
          args.push(
            "-protocol_whitelist",
            "file,pipe",
            "-format_whitelist",
            "mov,matroska,webm,mp3,wav,ogg,flac,aac,avi",
            "-i",
            file,
          );
          const label = `a${e}`;
          filters.push(
            `[${input}:a]atrim=duration=${length},asetpts=PTS-STARTPTS,${fadeFilters(el, Math.min(length, prepared.get(el)?.duration || length), true)}volume=${el.volume},adelay=${Math.round(start * 1000)}:all=1[${label}]`,
          );
          audios.push(label);
          input++;
          continue;
        }
        let width = el.width || W,
          height = el.height || H,
          file;
        if (el.type === "text") {
          file = `text-${s}-${e}.png`;
          ({ width, height } = await textLayer(el, W, H, path.join(dir, file)));
        } else file = await asset(el);
        if (el.type === "video")
          args.push(
            "-protocol_whitelist",
            "file,pipe",
            "-format_whitelist",
            "mov,matroska,webm,avi",
            "-ss",
            String(el.seek),
            "-i",
            file,
          );
        else args.push("-loop", "1", "-framerate", String(fps), "-i", file);
        const scale =
          el.type === "text"
            ? ""
            : el.fit === "contain"
              ? `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black@0,`
              : `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},`;
        const label = `layer${e}`,
          next = `v${e + 1}`;
        const frames = Math.max(1, Math.round(length * fps) - 1),
          amount = Math.abs(el.zoom || 0) / 100;
        const zoom =
          el.type === "image" && amount
            ? `zoompan=z='${el.zoom > 0 ? `1+on*${amount}/${frames}` : `1+${amount}-on*${amount}/${frames}`}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${width}x${height}:fps=${fps},`
            : "";
        filters.push(
          `[${input}:v]format=rgba,${scale}${zoom}format=rgba,${fadeFilters(el, length)}setsar=1,setpts=PTS-STARTPTS+${start}/TB[${label}]`,
        );
        filters.push(
          `[${v}][${label}]overlay=x=${coordinate(el.x, W, width, "x")}:y=${coordinate(el.y, H, height, "y")}:enable='gte(t,${start})*lt(t,${start + length})':eof_action=pass[${next}]`,
        );
        v = next;
        input++;
      }
      filters.push(`[${v}]format=yuv420p[outv]`);
      filters.push(
        `[1:a]${audios.map((a) => `[${a}]`).join("")}amix=inputs=${audios.length + 1}:duration=first:normalize=0,alimiter=limit=0.95[outa]`,
      );
      const file = `scene-${s}.mp4`;
      parts.push(file);
      args.push(
        "-filter_complex_threads",
        "1",
        "-filter_complex",
        filters.join(";"),
        "-map",
        "[outv]",
        "-map",
        "[outa]",
        "-t",
        String(duration),
        "-r",
        String(fps),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        String({ low: 28, medium: 23, high: 20 }[movie.quality] || 21),
        "-maxrate",
        "5M",
        "-bufsize",
        "10M",
        "-g",
        String(fps * 2),
        "-threads",
        "2",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "48000",
        "-ac",
        "2",
        file,
      );
      await runFfmpeg(args, dir);
    }
    onProgress(88, "Asamblare MP4");
    await fs.writeFile(
      path.join(dir, "concat.txt"),
      parts.map((p) => `file '${p}'`).join("\n"),
    );
    await runFfmpeg(
      [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "concat.txt",
        "-c",
        "copy",
        "joined.mp4",
      ],
      dir,
    );
    const output = path.join(outputDir, `${job.id}.mp4`),
      total = sceneDurations.reduce((n, d) => n + d, 0);
    if (movie.elements.length) {
      const args = ["-i", "joined.mp4"],
        filters = [],
        labels = ["0:a"];
      for (let i = 0; i < movie.elements.length; i++) {
        const el = movie.elements[i],
          file = await asset(el);
        const length = el.duration > 0 ? el.duration : total - el.start;
        if (length <= 0 || el.start + length > total + 0.05)
          throw new Error("Pista audio depășește durata calculată a filmului.");
        args.push(
          "-protocol_whitelist",
          "file,pipe",
          "-format_whitelist",
          "mov,matroska,webm,mp3,wav,ogg,flac,aac,avi",
          "-i",
          file,
        );
        const label = `g${i}`;
        filters.push(
          `[${i + 1}:a]atrim=duration=${length},asetpts=PTS-STARTPTS,${fadeFilters(el, Math.min(length, prepared.get(el)?.duration || length), true)}volume=${el.volume},adelay=${Math.round(el.start * 1000)}:all=1[${label}]`,
        );
        labels.push(label);
      }
      filters.push(
        `${labels.map((l) => `[${l}]`).join("")}amix=inputs=${labels.length}:duration=first:normalize=0,alimiter=limit=0.95[outa]`,
      );
      await runFfmpeg(
        [
          ...args,
          "-filter_complex",
          filters.join(";"),
          "-map",
          "0:v",
          "-map",
          "[outa]",
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-t",
          String(total),
          "-movflags",
          "+faststart",
          output,
        ],
        dir,
      );
    } else
      await runFfmpeg(
        ["-i", "joined.mp4", "-c", "copy", "-movflags", "+faststart", output],
        dir,
      );
    await runFfmpeg(
      [
        "-i",
        output,
        "-frames:v",
        "1",
        "-update",
        "1",
        path.join(outputDir, `${job.id}.jpg`),
      ],
      dir,
    );
    const stat = await fs.stat(output);
    return { duration: total, width: W, height: H, size: stat.size };
  } finally {
    if (path.dirname(path.resolve(dir)) !== path.resolve(workDir))
      throw new Error("Invalid work directory.");
    await fs.rm(dir, { recursive: true, force: true });
  }
}
