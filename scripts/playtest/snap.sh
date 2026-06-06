#!/usr/bin/env bash
# Build, serve, drive the game headlessly, screenshot. Args forwarded to playtest.mjs.
#   scripts/playtest/snap.sh --out=/tmp/shot.png --place=4 --wait=5000 [--scene=GachaScene] [--eval='...']
set -u
cd "$(dirname "$0")/../.."
pkill -9 -f "vite preview" 2>/dev/null
pkill -9 -f "remote-debugging-port=9222" 2>/dev/null
sleep 1
npm run build > /tmp/wt_build.log 2>&1 || { echo "BUILD FAILED"; tail -5 /tmp/wt_build.log; exit 1; }
nohup npx vite preview --port 4188 --strictPort > /tmp/wt_vite.log 2>&1 &
VITE=$!
nohup google-chrome --headless --disable-gpu --no-sandbox --remote-debugging-port=9222 --window-size=1280,720 about:blank > /tmp/wt_chrome.log 2>&1 &
CHROME=$!
sleep 6
node scripts/playtest/playtest.mjs "$@"
RC=$?
kill -9 $VITE $CHROME 2>/dev/null
pkill -9 -f "vite preview" 2>/dev/null
pkill -9 -f "remote-debugging-port=9222" 2>/dev/null
exit $RC
