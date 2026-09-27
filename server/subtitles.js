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
      "Vocea nu a returnat timpi pentru subtitrări. Poți alege explicit timing: estimated pentru o aproximare.",
    );
  const cues = [];
  for (let i = 0; i < words.length; i += 6) {
    const group = words.slice(i, i + 6),
      first = group[0],
      last = group.at(-1),
      next = words[i + 6];
    const text = element.text
      .slice(first.offset, next?.offset ?? element.text.length)
      .trim();
    const end = Math.min(duration, next?.start ?? Math.max(last.end, duration));
    if (first.start < end)
      cues.push({ text, start: first.start, duration: end - first.start });
  }
  return cues;
}
