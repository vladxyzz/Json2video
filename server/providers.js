import fs from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { download } from "./network.js";

export const imageModels = {
  "flux-pro": "flux-pro-1.1",
  "flux-pro-1.1": "flux-pro-1.1",
};
export function providerIssues(movie) {
  const elements = [
    ...movie.elements,
    ...movie.scenes.flatMap((s) => s.elements),
  ];
  const issues = [];
  if (
    elements.some((e) => e.type === "voice" && e.provider === "azure") &&
    (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION)
  )
    issues.push(
      "Configurează AZURE_SPEECH_KEY și AZURE_SPEECH_REGION în .env pentru vocea Azure.",
    );
  if (
    elements.some((e) => e.type === "image" && e.prompt) &&
    !process.env.BFL_API_KEY
  )
    issues.push("Configurează BFL_API_KEY în .env pentru FLUX 1.1 Pro.");
  return issues;
}

export async function generateImage(
  element,
  target,
  W,
  H,
  { fetchImpl = fetch, downloadAsset = download, sleep = delay } = {},
) {
  if (!process.env.BFL_API_KEY)
    throw new Error("Lipsește BFL_API_KEY pentru FLUX 1.1 Pro.");
  const model = imageModels[element.model];
  if (!model) throw new Error("Modelul de imagini nu este implementat.");
  const scale = Math.min(1, 1440 / W, 1440 / H);
  const size = (n) =>
    Math.max(256, Math.min(1440, Math.round((n * scale) / 32) * 32));
  const headers = {
    "Content-Type": "application/json",
    "x-key": process.env.BFL_API_KEY,
  };
  const read = async (url, options) => {
    const r = await fetchImpl(url, {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok)
      throw new Error(
        `FLUX a răspuns cu HTTP ${r.status}. Verifică cheia, creditele și disponibilitatea serviciului.`,
      );
    return r.json();
  };
  const task = await read(`https://api.bfl.ai/v1/${model}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: element.prompt,
      width: size(W),
      height: size(H),
      output_format: "png",
    }),
  });
  const poll = new URL(task.polling_url);
  if (
    poll.protocol !== "https:" ||
    !/^(?:api\.)?(?:[a-z0-9-]+\.)*bfl\.ai$/.test(poll.hostname) ||
    poll.port ||
    poll.username ||
    poll.password
  )
    throw new Error("Adresa de status FLUX nu este validă.");
  const deadline = Date.now() + 300000;
  for (let i = 0; i < 150 && Date.now() < deadline; i++) {
    await sleep(2000);
    const result = await read(poll.href, { headers });
    if (result.status === "Ready") {
      if (!result.result?.sample)
        throw new Error("FLUX nu a returnat o imagine.");
      await downloadAsset(result.result.sample, target);
      return;
    }
    if (
      ["Error", "Failed", "Request Moderated", "Content Moderated"].includes(
        result.status,
      )
    )
      throw new Error(`Generarea FLUX s-a oprit: ${result.status}.`);
  }
  throw new Error("Generarea FLUX a depășit timpul de așteptare.");
}

export async function azureSpeech(element, target) {
  const key = process.env.AZURE_SPEECH_KEY,
    region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region || !/^[a-z0-9]+$/.test(region))
    throw new Error("Configurează cheia și regiunea Azure Speech în .env.");
  const sdk = await import("microsoft-cognitiveservices-speech-sdk");
  const config = sdk.SpeechConfig.fromSubscription(key, region);
  config.speechSynthesisVoiceName = element.voice;
  config.speechSynthesisLanguage = element.language;
  config.speechSynthesisOutputFormat =
    sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;
  const synthesizer = new sdk.SpeechSynthesizer(config, null),
    words = [];
  synthesizer.wordBoundary = (_, e) => {
    if (e.boundaryType === sdk.SpeechSynthesisBoundaryType.Word)
      words.push({
        start: e.audioOffset / 1e7,
        end: (e.audioOffset + e.duration) / 1e7,
        offset: e.textOffset,
        length: e.wordLength,
      });
  };
  try {
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Azure Speech nu a răspuns în 90 secunde.")),
        90000,
      );
      synthesizer.speakTextAsync(
        element.text,
        (r) => {
          clearTimeout(timer);
          resolve(r);
        },
        () => {
          clearTimeout(timer);
          reject(
            new Error(
              "Azure Speech a eșuat. Verifică cheia, regiunea și vocea.",
            ),
          );
        },
      );
    });
    if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted)
      throw new Error(
        "Azure Speech nu a generat vocea. Verifică cheia, regiunea și vocea selectată.",
      );
    await fs.writeFile(target, Buffer.from(result.audioData));
    return { words };
  } finally {
    synthesizer.close();
  }
}
