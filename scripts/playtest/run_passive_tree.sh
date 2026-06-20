#!/usr/bin/env bash
# Serve the built dist, headless-drive the passive-tree expansion repro, tear down.
set -u
cd "$(dirname "$0")/../.."
pkill -9 -f "vite preview" 2>/dev/null
pkill -9 -f "remote-debugging-port=9222" 2>/dev/null
sleep 1
nohup npx vite --port 4188 --strictPort > /tmp/wt_vite.log 2>&1 &
VITE=$!
nohup google-chrome --headless=new --disable-gpu --no-sandbox --remote-debugging-port=9222 --window-size=1280,720 about:blank > /tmp/wt_chrome.log 2>&1 &
CHROME=$!
sleep 8
node scripts/playtest/repro_passive_tree.mjs --port=4188
RC=$?
kill -9 $VITE $CHROME 2>/dev/null
pkill -9 -f "vite preview" 2>/dev/null
pkill -9 -f "remote-debugging-port=9222" 2>/dev/null
echo "REPRO_EXIT=$RC"
exit $RC
