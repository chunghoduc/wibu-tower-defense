/**
 * Dev/preview-only file logger sink. The browser can't write files, so the
 * client logger (src/debug/logger.ts) POSTs batches of log entries to `/__log`
 * and this middleware appends them to `logs/runtime.log` on disk — giving a real
 * file to inspect (or hand to a dev) after a bug. The file is truncated each time
 * the server starts, so one `npm run dev` / `npm run preview` session = one log.
 *
 * Does nothing in a static production build (no server); there the client falls
 * back to localStorage + `window.__saveLog()` download.
 */
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const LOG_DIR = resolve(process.cwd(), "logs");
const LOG_FILE = resolve(LOG_DIR, "runtime.log");

interface Entry {
  t?: number;
  level?: string;
  tag?: string;
  msg?: string;
  data?: unknown;
}

function initFile(mode: string): void {
  mkdirSync(LOG_DIR, { recursive: true });
  writeFileSync(LOG_FILE, `==== ${mode} session started ${new Date().toISOString()} ====\n`);

  console.log(`[file-log] writing runtime logs to ${LOG_FILE}`);
}

function fmt(e: Entry): string {
  const t = typeof e.t === "number" ? `+${String(Math.round(e.t)).padStart(6)}ms` : " ".repeat(9);
  const lvl = String(e.level ?? "info")
    .toUpperCase()
    .padEnd(5);
  const tag = e.tag ? `[${e.tag}] ` : "";
  let line = `${new Date().toISOString()} ${t} ${lvl} ${tag}${e.msg ?? ""}`;
  if (e.data !== undefined) {
    let d: string;
    try {
      d = typeof e.data === "string" ? e.data : JSON.stringify(e.data);
    } catch {
      d = String(e.data);
    }
    line += ` ${d}`;
  }
  return line.replace(/\s+$/, "") + "\n";
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((res) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 5_000_000) req.destroy();
    });
    req.on("end", () => res(body));
    req.on("error", () => res(""));
  });
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end();
    return;
  }
  const body = await readBody(req);
  try {
    const entries = JSON.parse(body) as Entry[];
    if (Array.isArray(entries) && entries.length)
      appendFileSync(LOG_FILE, entries.map(fmt).join(""));
  } catch {
    /* ignore malformed batches */
  }
  res.statusCode = 204;
  res.end();
}

export function fileLog(): Plugin {
  const mount = (middlewares: {
    use: (
      path: string,
      fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void,
    ) => void;
  }) => {
    middlewares.use("/__log", (req, res, next) => {
      if (req.method !== "POST") return next();
      void handle(req, res);
    });
  };
  return {
    name: "wtd-file-log",
    configureServer(server) {
      initFile("dev");
      mount(server.middlewares);
    },
    configurePreviewServer(server) {
      initFile("preview");
      mount(server.middlewares);
    },
  };
}
