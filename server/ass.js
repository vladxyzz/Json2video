import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Subtitles as one ASS script per scene, burned in with FFmpeg's libass filter.
 * One filter replaces the hundreds of PNG overlays the per-word karaoke would
 * otherwise need. Fonts are bundled and passed through `fontsdir`, so the look
 * is the same on Windows, in Docker and on the VPS.
 */
export const fontDir = fileURLToPath(new URL("./fonts/", import.meta.url));
// `line` is libass' font height in em: ASS "Fontsize" is the whole line box
// (Windows ascent + descent), not the em, so it must be scaled to keep a
// `font-size: 72px` the same size as in the PNG renderer. `ascent` is the
// distance from the top of that box to the baseline, in em.
export const fonts = {
  "DejaVu Sans": {
    file: "DejaVuSans-Bold.ttf",
    name: "DejaVu Sans",
    bold: -1,
    line: 1.1640625,
    ascent: 1901 / 2048,
  },
  Poppins: {
    file: "Poppins-ExtraBold.ttf",
    name: "Poppins ExtraBold",
    bold: 0,
    line: 1.762,
    ascent: 1.135,
  },
};
export const fontFor = (element) =>
  fonts[element["font-family"]] || fonts["DejaVu Sans"];
export async function installFonts(dir) {
  const target = path.join(dir, "fonts");
  await fs.mkdir(target, { recursive: true });
  for (const font of Object.values(fonts))
    await fs.copyFile(path.join(fontDir, font.file), path.join(target, font.file));
  return "fonts";
}
const pad = (n) => String(n).padStart(2, "0");
const time = (t) => {
  const cs = Math.max(0, Math.round(t * 100));
  return `${Math.floor(cs / 360000)}:${pad(Math.floor(cs / 6000) % 60)}:${pad(Math.floor(cs / 100) % 60)}.${pad(cs % 100)}`;
};
// ASS colors are &HBBGGRR&.
const bgr = (hex) =>
  (hex.slice(5, 7) + hex.slice(3, 5) + hex.slice(1, 3)).toUpperCase();
// ASS has no escape for these; they never occur in real narration.
const clean = (s) => s.replace(/[{}\\]/g, "");

/**
 * @param items [{ element, cues }] with cue times already in scene time
 * @param helpers { wrapText, coordinate } shared with the PNG text renderer
 */
export function buildAss(items, W, H, { wrapText, coordinate }) {
  const styles = [],
    events = [];
  items.forEach(({ element, cues }, n) => {
    const font = fontFor(element),
      size = parseFloat(element["font-size"]),
      name = `S${n}`,
      primary = bgr(element.color),
      boxWidth = element.width || Math.round(W * 0.88),
      left = coordinate(element.x, W, boxWidth, "x"),
      align = element["text-align"],
      anchor = { left: 7, center: 8, right: 9 }[align],
      px = { left: left + 4, center: left + boxWidth / 2, right: left + boxWidth - 4 }[align],
      lineHeight = size * 1.25,
      wordColor = element["word-color"] && bgr(element["word-color"]),
      scale = Math.round((element["word-scale"] || 1) * 100),
      outline =
        element.style === "shadow" ? Math.max(2, Math.round(size * 0.11)) : 0,
      shadow = element.style === "shadow" ? Math.round(size * 0.06) : 0,
      fade = (e) =>
        e["fade-in"] > 0 || e["fade-out"] > 0
          ? `\\fad(${Math.round(e["fade-in"] * 1000)},${Math.round(e["fade-out"] * 1000)})`
          : "";
    styles.push(
      `Style: ${name},${font.name},${(size * font.line).toFixed(2)},&H00${primary},&H00${primary},&H00111111,&H78000000,${font.bold},0,0,0,100,100,0,0,1,${outline},${shadow},8,0,0,0,1`,
    );
    // Wide capitals need earlier line breaks than the shared width estimate.
    const charWidth = element["all-caps"] ? 0.68 : 0.59;
    const perLine = new Map();
    for (const cue of cues) {
      const shown = clean(
        element["all-caps"] ? cue.text.toUpperCase() : cue.text,
      );
      const lines = wrapText(shown, boxWidth, size, charWidth),
        block = Math.ceil(lines.length * lineHeight + size * 0.25),
        top = coordinate(element.y, H, block, "y");
      let counted = 0;
      lines.forEach((line, i) => {
        const y = top + size * (1 - font.ascent) + i * lineHeight;
        const body = line
          .split(" ")
          .map((word) => {
            if (cue.highlight === undefined || !wordColor) return word;
            if (counted++ !== cue.highlight) return word;
            const pop =
              scale > 100
                ? `\\t(0,90,\\fscx${scale}\\fscy${scale})\\t(90,200,\\fscx100\\fscy100)`
                : "";
            return `{\\c&H${wordColor}&${pop}}${word}{\\c&H${primary}&\\fscx100\\fscy100}`;
          })
          .join(" ");
        const text = `{\\an${anchor}\\pos(${px.toFixed(1)},${y.toFixed(1)})${fade(element)}}${body}`;
        const list = perLine.get(i) || [];
        const last = list.at(-1);
        // Lines that do not change between cues are one long event.
        if (last && last.text === text && Math.abs(last.end - cue.start) < 0.005)
          last.end = cue.start + cue.duration;
        else list.push({ text, start: cue.start, end: cue.start + cue.duration });
        perLine.set(i, list);
      });
    }
    for (const list of perLine.values())
      for (const e of list)
        events.push({ ...e, style: name });
  });
  events.sort((a, b) => a.start - b.start);
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    ...styles,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...events.map(
      (e) =>
        `Dialogue: 0,${time(e.start)},${time(e.end)},${e.style},,0,0,0,,${e.text}`,
    ),
    "",
  ].join("\n");
}
