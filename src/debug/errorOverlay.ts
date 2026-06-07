/**
 * Global error surface. Any uncaught exception or unhandled rejection during
 * play (including inside Phaser's update/render/input loop) is shown on-screen
 * instead of failing silently — a silently-thrown error in the game loop is a
 * classic cause of "the UI suddenly stops responding to clicks". The last few
 * errors are also stashed on `window.__errors` so the headless playtest harness
 * can read them.
 *
 * Purely additive: if nothing throws, nothing renders.
 */
const recent: string[] = [];

function describe(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}\n${(e.stack ?? "").split("\n").slice(1, 5).join("\n")}`;
  return String(e);
}

function ensureBox(): HTMLDivElement {
  let box = document.getElementById("__err") as HTMLDivElement | null;
  if (!box) {
    box = document.createElement("div");
    box.id = "__err";
    box.style.cssText = [
      "position:fixed", "left:0", "right:0", "bottom:0", "z-index:99999",
      "max-height:42%", "overflow:auto", "background:rgba(40,8,8,.94)",
      "color:#ffd2d2", "font:12px/1.4 monospace", "padding:8px 12px",
      "white-space:pre-wrap", "border-top:2px solid #ff5a5a",
    ].join(";");
    const close = document.createElement("button");
    close.textContent = "✕ dismiss";
    close.style.cssText = "float:right;background:#5a1a1a;color:#fff;border:1px solid #ff5a5a;cursor:pointer;padding:2px 8px";
    close.onclick = () => box?.remove();
    box.appendChild(close);
    document.body.appendChild(box);
  }
  return box;
}

function report(label: string, e: unknown): void {
  const msg = `[${label}] ${describe(e)}`;
  recent.push(msg);
  if (recent.length > 10) recent.shift();
  (globalThis as unknown as { __errors: string[] }).__errors = recent;
  const line = document.createElement("div");
  line.textContent = msg;
  line.style.cssText = "margin-top:6px;border-top:1px solid #803030;padding-top:6px";
  ensureBox().appendChild(line);
};

/** Install global handlers. Call once, as early as possible. */
export function installErrorOverlay(): void {
  (globalThis as unknown as { __errors: string[] }).__errors = recent;
  window.addEventListener("error", (ev) => report("error", ev.error ?? ev.message));
  window.addEventListener("unhandledrejection", (ev) => report("promise", ev.reason));
}
