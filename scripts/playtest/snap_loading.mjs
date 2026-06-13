// Capture the loading screen (PreloadScene). Throttles the network so the
// canvas loader + procedural backdrop stay on screen long enough to screenshot.
//   node scripts/playtest/snap_loading.mjs --out=/tmp/loading.png [--at=1800] [--port=4188]
import { writeFileSync } from "node:fs";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const OUT = arg("out", "/tmp/loading.png");
const AT = Number(arg("at", "1800"));
const PORT = arg("port", "4188");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const t = await (
    await fetch(`http://localhost:9222/json/new?about:blank`, { method: "PUT" })
  ).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0;
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  const rpc = (method, params = {}) =>
    new Promise((res) => {
      const myId = ++id;
      const onMsg = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id === myId) {
          ws.removeEventListener("message", onMsg);
          res(m.result);
        }
      };
      ws.addEventListener("message", onMsg);
      ws.send(JSON.stringify({ id: myId, method, params }));
    });

  await rpc("Page.enable");
  await rpc("Network.enable");
  // Throttle hard so the loader is visible for a while (bytes/sec).
  await rpc("Network.emulateNetworkConditions", {
    offline: false,
    latency: 40,
    downloadThroughput: (900 * 1024) / 8,
    uploadThroughput: (900 * 1024) / 8,
  });
  await rpc("Page.navigate", { url: `http://localhost:${PORT}/?debug` });
  await wait(AT);
  const shot = await rpc("Page.captureScreenshot", { format: "png" });
  writeFileSync(OUT, Buffer.from(shot.data, "base64"));
  console.log("wrote", OUT);
  ws.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
