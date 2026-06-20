#!/usr/bin/env bash
# Serve the already-built dist, headless-drive the attack-pose repro, tear down.
set -u
cd "$(dirname "$0")/../.."
pkill -9 -f "vite preview" 2>/dev/null
pkill -9 -f "remote-debugging-port=9222" 2>/dev/null
sleep 1
nohup npx vite preview --port 4188 --strictPort > /tmp/wt_vite.log 2>&1 &
VITE=$!
nohup google-chrome --headless=new --disable-gpu --no-sandbox --remote-debugging-port=9222 --window-size=1280,720 about:blank > /tmp/wt_chrome.log 2>&1 &
CHROME=$!
sleep 8
node scripts/playtest/repro_attack_pose.mjs --port=4188 --shot=/tmp/attackpose.png
RC=$?
kill -9 $VITE $CHROME 2>/dev/null
pkill -9 -f "vite preview" 2>/dev/null
pkill -9 -f "remote-debugging-port=9222" 2>/dev/null
echo "REPRO_EXIT=$RC"
exit $RC
