import React from "react";
import { ArrowUpRight, Braces, Clapperboard, Code2, Layers } from "lucide-react";

const nodes = [
  { id: "sheets", Icon: Layers, title: "Sheets / Gemini", note: "Prepares the content" },
  { id: "post", Icon: Braces, title: "HTTP · POST", note: "Sends the JSON" },
  { id: "app", Icon: Clapperboard, title: "jsontovideo", note: "Renders the MP4" },
  { id: "hook", Icon: Code2, title: "Webhook Make", note: "Receives the result" },
  { id: "router", Icon: ArrowUpRight, title: "Router", note: "Posts to your channels" },
];
// What travels along each connector.
const packets = ["{ }", "202", "MP4", "done"];
const channels = ["YouTube", "Instagram", "TikTok"];

/**
 * The automation loop, told as one repeating story. Every part lights up in the
 * order it really happens: Make prepares the JSON, posts it, jsontovideo renders,
 * the webhook calls back and the router publishes. All timing lives in CSS
 * (one shared cycle plus a per-element delay), so it costs no JavaScript.
 */
export function MakeFlow() {
  return (
    <figure className="make-flow" aria-label="How Make and jsontovideo work together">
      <ol className="flow-track">
        {nodes.map(({ id, Icon, title, note }, i) => (
          <React.Fragment key={id}>
            <li className={`flow-node ${id}`} style={{ "--n": i }}>
              <span className="flow-icon">
                <Icon size={22} strokeWidth={1.6} />
              </span>
              <strong>{title}</strong>
              <small>{note}</small>
              {id === "app" && (
                <span className="flow-render" aria-hidden="true">
                  <i />
                </span>
              )}
              {id === "router" && (
                <span className="flow-channels">
                  {channels.map((c, k) => (
                    <em key={c} style={{ "--k": k }}>
                      {c}
                    </em>
                  ))}
                </span>
              )}
            </li>
            {i < packets.length && (
              <li className="flow-link" style={{ "--n": i }} aria-hidden="true">
                <span className="flow-packet">{packets[i]}</span>
              </li>
            )}
          </React.Fragment>
        ))}
      </ol>
    </figure>
  );
}
