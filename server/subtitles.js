export function subtitleCues(element, voice, duration) {
  let words = voice?.words;
  if (element.timing === "estimated") {
    const matches = [...element.text.matchAll(/\S+/g)];
    const weight = matches.reduce((n, w) => n + w[0].length, 0);
    let t = 0;
    words = matches.map((w) => {
      const start = t;
      t += (duration * w[0].length) / weight;
      return { start, end: t, offset: w.index, length: w[0].length };
    });
  }
  if (!words?.length)
    throw new Error(
      "The voice did not return subtitle timings. You can set timing: estimated for an approximation.",
    );
  const cues = [];
  const per = element["max-words"] || 6;
  for (let i = 0; i < words.length; i += per) {
    const group = words.slice(i, i + per),
      first = group[0],
      last = group.at(-1),
      next = words[i + per];
    const text = element.text
      .slice(first.offset, next?.offset ?? element.text.length)
      .trim();
    const end = Math.min(duration, next?.start ?? Math.max(last.end, duration));
    if (first.start >= end) continue;
    if (!element["word-color"]) {
      cues.push({ text, start: first.start, duration: end - first.start });
      continue;
    }
    // Karaoke style: one cue per spoken word. The whole group stays on screen
    // and only the word being spoken is highlighted.
    group.forEach((word, k) => {
      const start = word.start,
        stop = Math.min(end, group[k + 1]?.start ?? end);
      if (start >= stop) return;
      // The highlight is an index into the whitespace-separated words of
      // `text`, which is how the renderer splits it. A voice may report one
      // token per piece of a hyphenated word, so count text tokens, not voice
      // words.
      const before = element.text.slice(first.offset, word.offset),
        tokens = (before.match(/\S+/g) || []).length;
      cues.push({
        text,
        start,
        duration: stop - start,
        highlight: tokens - (/\S$/.test(before) ? 1 : 0),
      });
    });
  }
  return cues;
}
