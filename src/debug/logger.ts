/**
 * Runtime logger — the project's "black box recorder".
 *
 * Why: a browser game can't write files, and a bug is often only diagnosable
 * from the *trail of events leading up to it* (which scene was entered, what the
 * player did) plus the actual exception + stack. This logger keeps that trail and
 * ships it somewhere we can read after the fact:
 *   - streams batches to the dev/preview server (`POST /__log`) which writes
 *     `logs/runtime.log` on disk (see vite-plugin-filelog.ts) — the main path
 *     while developing;
 *   - keeps a backup of the last entries in localStorage (survives a crash+reload);
 *   - exposes `window.__log` (array), `window.__saveLog()` (download a .txt), and
 *     `window.__clearLog()` for any environment (incl. a static deploy with no server);
 *   - shows uncaught errors on-screen so a silent throw in the game loop (a common
 *     cause of "the UI suddenly stopped responding") is never invisible.
 *
 * Use it from gameplay code via the exported `log`:
 *   log.info("battle", "win", { stage: id });   log.error("save", "load failed", err);
 */
type Level = "debug" | "info" | "warn" | "error";
interface Entry {
  t: number;
  level: Level;
  tag: string;
  msg: string;
  data?: unknown;
}

const MAX_BUFFER = 600; // entries kept in memory / downloadable
const LS_KEY = "wtd_log";
const LS_MAX = 200; // entries mirrored to localStorage as a crash backup
const FLUSH_MS = 800;

const buffer: Entry[] = [];
let queue: Entry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let sinkAlive = true; // becomes false after the first failed POST (static deploy)
const t0 = typeof performance !== "undefined" ? performance.now() : 0;
const now = () => (typeof performance !== "undefined" ? performance.now() : 0) - t0;

// Keep references to the real console so capturing console.* can't recurse.
const realConsole =
  typeof console !== "undefined"
    ? { error: console.error.bind(console), warn: console.warn.bind(console) }
    : { error: () => {}, warn: () => {} };

function safe(data: unknown): unknown {
  if (data instanceof Error)
    return {
      name: data.name,
      message: data.message,
      stack: (data.stack ?? "").split("\n").slice(0, 6).join("\n"),
    };
  if (data === undefined) return undefined;
  try {
    JSON.stringify(data);
    return data;
  } catch {
    return String(data);
  }
}

function persist(): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(buffer.slice(-LS_MAX)));
  } catch {
    /* private mode / quota */
  }
}

function flush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!queue.length || !sinkAlive || typeof fetch === "undefined") return;
  const batch = queue;
  queue = [];
  fetch("/__log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
    keepalive: true,
  }).catch(() => {
    sinkAlive = false;
  }); // no server (static deploy) — stop trying, keep buffering
}

function scheduleFlush(): void {
  if (flushTimer || typeof setTimeout === "undefined") return;
  flushTimer = setTimeout(flush, FLUSH_MS);
}

function record(level: Level, tag: string, msg: string, data?: unknown): void {
  const e: Entry = { t: Math.round(now()), level, tag, msg: String(msg), data: safe(data) };
  buffer.push(e);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  queue.push(e);
  if (level === "error") {
    showOverlay(e);
    flush();
    persist();
  } else scheduleFlush();
}

export const log = {
  debug: (tag: string, msg: string, data?: unknown) => record("debug", tag, msg, data),
  info: (tag: string, msg: string, data?: unknown) => record("info", tag, msg, data),
  warn: (tag: string, msg: string, data?: unknown) => record("warn", tag, msg, data),
  error: (tag: string, msg: string, data?: unknown) => record("error", tag, msg, data),
};

// ---- on-screen overlay for errors --------------------------------------------

function fmtLine(e: Entry): string {
  const tag = e.tag ? `[${e.tag}] ` : "";
  const d =
    e.data !== undefined
      ? " " + (typeof e.data === "string" ? e.data : JSON.stringify(e.data))
      : "";
  return `+${e.t}ms ${e.level.toUpperCase()} ${tag}${e.msg}${d}`;
}

function showOverlay(e: Entry): void {
  if (typeof document === "undefined") return;
  let box = document.getElementById("__errlog") as HTMLDivElement | null;
  if (!box) {
    box = document.createElement("div");
    box.id = "__errlog";
    box.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:99999;max-height:42%;overflow:auto;background:rgba(40,8,8,.94);color:#ffd2d2;font:12px/1.4 monospace;padding:8px 12px;white-space:pre-wrap;border-top:2px solid #ff5a5a";
    const bar = document.createElement("div");
    bar.style.cssText = "position:sticky;top:0;text-align:right;margin-bottom:4px";
    const save = document.createElement("button");
    save.textContent = "⤓ save log";
    save.style.cssText =
      "background:#2a4a6a;color:#fff;border:1px solid #6a8aba;cursor:pointer;padding:2px 8px;margin-right:6px";
    save.onclick = () => saveLog();
    const close = document.createElement("button");
    close.textContent = "✕ dismiss";
    close.style.cssText =
      "background:#5a1a1a;color:#fff;border:1px solid #ff5a5a;cursor:pointer;padding:2px 8px";
    close.onclick = () => box?.remove();
    bar.append(save, close);
    box.appendChild(bar);
    document.body.appendChild(box);
  }
  const line = document.createElement("div");
  line.textContent = fmtLine(e);
  line.style.cssText = "border-top:1px solid #803030;padding-top:6px;margin-top:6px";
  box.appendChild(line);
}

// ---- download / globals ------------------------------------------------------

function saveLog(): void {
  if (typeof document === "undefined") return;
  const text = buffer.map(fmtLine).join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "wtd-log.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Install global capture (uncaught errors, rejections, console.error/warn) and
 *  expose the window helpers. Call once, as early as possible. */
export function installLogger(): void {
  const g = globalThis as unknown as {
    __log: Entry[];
    __saveLog: () => void;
    __clearLog: () => void;
  };
  g.__log = buffer;
  g.__saveLog = saveLog;
  g.__clearLog = () => {
    buffer.length = 0;
    queue = [];
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("error", (ev) =>
      record(
        "error",
        "window",
        ev.message || "error",
        ev.error ?? `${ev.filename}:${ev.lineno}:${ev.colno}`,
      ),
    );
    window.addEventListener("unhandledrejection", (ev) =>
      record("error", "promise", "unhandled rejection", ev.reason),
    );
    window.addEventListener("pagehide", () => {
      try {
        if (queue.length && navigator.sendBeacon)
          navigator.sendBeacon("/__log", JSON.stringify(queue));
      } catch {
        /* ignore */
      }
    });
  }

  if (typeof console !== "undefined") {
    console.error = (...a: unknown[]) => {
      record("error", "console", a.map(String).join(" "));
      realConsole.error(...a);
    };
    console.warn = (...a: unknown[]) => {
      record("warn", "console", a.map(String).join(" "));
      realConsole.warn(...a);
    };
  }

  log.info("app", "logger installed");
}
