import https from "node:https";
import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";

export function isPublicAddress(address) {
  try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === "ipv6" && ip.isIPv4MappedAddress())
      ip = ip.toIPv4Address();
    return ip.range() === "unicast";
  } catch {
    return false;
  }
}
export async function safeRequest(raw, options = {}, redirects = 0) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw new Error(
      "Only public HTTPS URLs on port 443 without credentials are allowed.",
    );
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await dns.lookup(hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error("Local, private or reserved addresses are not allowed.");
  const pinned = addresses[0];
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: options.method || "GET",
        headers: options.headers || {},
        lookup: (_host, opts, cb) =>
          opts.all
            ? cb(null, [pinned])
            : cb(null, pinned.address, pinned.family),
      },
      (response) => {
        if (
          [301, 302, 303, 307, 308].includes(response.statusCode) &&
          response.headers.location
        ) {
          response.resume();
          if (options.method === "POST" || redirects >= 3)
            return reject(
              new Error("Redirect refused. Use the final HTTPS address."),
            );
          safeRequest(
            new URL(response.headers.location, url).href,
            options,
            redirects + 1,
          ).then(resolve, reject);
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          response.resume();
          return reject(
            new Error(
              `The external server replied with HTTP ${response.statusCode}.`,
            ),
          );
        }
        resolve(response);
      },
    );
    const timer = setTimeout(
      () =>
        request.destroy(
          new Error("The external service did not respond within 30 seconds."),
        ),
      30000,
    );
    request.on("close", () => clearTimeout(timer));
    request.on("error", reject);
    request.end(options.body);
  });
}
export async function download(raw, target) {
  const response = await safeRequest(raw);
  let size = 0;
  const limit = new Transform({
    transform(chunk, _enc, cb) {
      size += chunk.length;
      cb(
        size > 100 * 1024 * 1024
          ? new Error("The file is larger than 100 MB.")
          : null,
        chunk,
      );
    },
  });
  await pipeline(response, limit, createWriteStream(target));
  return target;
}
export async function postJson(url, payload, headers = {}) {
  const body = JSON.stringify(payload);
  const response = await safeRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      ...headers,
    },
    body,
  });
  response.resume();
  return response.statusCode;
}
