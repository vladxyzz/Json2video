import React, {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const LINE_HEIGHT = 22;
const token =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:]/g;
const variable = /(\{\{[^}]*\}\})/g;

function stringParts(text) {
  return text.split(variable).map((part, i) =>
    i % 2 ? (
      <span key={i} className="tk-var">
        {part}
      </span>
    ) : (
      part
    ),
  );
}
function highlight(line) {
  const out = [];
  let last = 0,
    m;
  token.lastIndex = 0;
  while ((m = token.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const [all, str, colon, literal] = m;
    if (str)
      out.push(
        <span key={m.index} className={colon ? "tk-key" : "tk-str"}>
          {stringParts(str)}
        </span>,
        colon && (
          <span key={`${m.index}c`} className="tk-punct">
            {colon}
          </span>
        ),
      );
    else if (literal)
      out.push(
        <span key={m.index} className="tk-lit">
          {all}
        </span>,
      );
    else if (/^[{}[\],:]$/.test(all))
      out.push(
        <span key={m.index} className="tk-punct">
          {all}
        </span>,
      );
    else
      out.push(
        <span key={m.index} className="tk-num">
          {all}
        </span>,
      );
    last = m.index + all.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}
const Line = memo(function Line({ text }) {
  return <div className="cl">{text ? highlight(text) : "​"}</div>;
});

/**
 * A JSON editor on a plain textarea. The text is painted by a highlight layer
 * underneath it, which wraps exactly like the textarea, so the same layer
 * tells the gutter how tall every wrapped line is.
 */
export function CodeEditor({ value, onChange, invalid }) {
  const textRef = useRef(null),
    layerRef = useRef(null),
    gutterRef = useRef(null),
    [width, setWidth] = useState(0),
    [rows, setRows] = useState([]);
  const lines = useMemo(() => value.split("\n"), [value]);
  useEffect(() => {
    const el = textRef.current;
    const read = () => {
      const css = getComputedStyle(el);
      setWidth(
        Math.max(
          0,
          el.clientWidth -
            parseFloat(css.paddingLeft) -
            parseFloat(css.paddingRight),
        ),
      );
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const kids = layerRef.current?.children;
    if (!kids) return;
    const next = Array.from(kids, (k) =>
      Math.max(1, Math.round(k.offsetHeight / LINE_HEIGHT)),
    );
    setRows((prev) =>
      prev.length === next.length && prev.every((n, i) => n === next[i])
        ? prev
        : next,
    );
  }, [lines, width]);
  const follow = (top) => {
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-top}px)`;
    if (layerRef.current) layerRef.current.style.transform = `translateY(${-top}px)`;
  };
  return (
    <div className="code-area">
      <div className="line-numbers" aria-hidden="true">
        <div ref={gutterRef} className="line-numbers-track">
          {lines.map((_, i) => (
            <div key={i} style={{ height: (rows[i] ?? 1) * LINE_HEIGHT }}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>
      <div className="code-stack">
        <div className="code-clip" aria-hidden="true">
          <div ref={layerRef} className="code-layer" style={{ width }}>
            {lines.map((line, i) => (
              <Line key={i} text={line} />
            ))}
          </div>
        </div>
        <textarea
          ref={textRef}
          aria-label="Video JSON code"
          aria-invalid={invalid}
          aria-describedby="json-validation"
          spellCheck="false"
          wrap="soft"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => follow(e.target.scrollTop)}
        />
      </div>
    </div>
  );
}
