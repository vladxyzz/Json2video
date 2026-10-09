// Real video length is only known once the voices have been synthesized, so for
// template based videos (scene durations left automatic) this estimates it from
// the narration text. Explicit durations are always taken as they are.
const WORDS_PER_SECOND = 2.55;

export function speechSeconds(text = "") {
  const words = (text.match(/\S+/g) || []).length;
  const stops = (text.match(/[.!?]+(?=\s|$)/g) || []).length * 0.35;
  const commas = (text.match(/[,;:](?=\s|$)/g) || []).length * 0.15;
  return Math.max(0.6, words / WORDS_PER_SECOND + stops + commas);
}

function sceneSeconds(scene) {
  if (scene.duration > 0) return { seconds: scene.duration, exact: true };
  let end = 0,
    known = false;
  for (const el of scene.elements) {
    const start = el.start || 0;
    if (el.duration > 0) {
      end = Math.max(end, start + el.duration);
      known = true;
    } else if (el.type === "voice") {
      end = Math.max(end, start + speechSeconds(el.text));
      known = true;
    }
  }
  return known ? { seconds: end, exact: false } : null;
}

/** @returns {{ total: number|null, exact: boolean, scenes: Array<{seconds:number|null, exact:boolean}> }} */
export function estimateMovie(movie) {
  if (!movie) return { total: null, exact: false, scenes: [] };
  const scenes = movie.scenes.map(
    (s) => sceneSeconds(s) || { seconds: null, exact: false },
  );
  const total = scenes.every((s) => s.seconds != null)
    ? scenes.reduce((sum, s) => sum + s.seconds, 0)
    : null;
  return { total, exact: scenes.every((s) => s.exact), scenes };
}

export function clock(n) {
  if (n == null || !Number.isFinite(n)) return "0:00";
  const whole = Math.max(0, Math.round(n));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
export function approx(n, exact) {
  return n == null ? "" : `${exact ? "" : "~"}${clock(n)}`;
}
