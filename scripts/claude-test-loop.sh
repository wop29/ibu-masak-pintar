#!/bin/bash
# Lets Claude test imports on its own while this window stays open.
#  - Keeps a live log of the server in .claude-test/tail.log (Claude reads it).
#  - When Claude creates .claude-test/deploy-now, builds and deploys this folder
#    exactly as "npm run build && npx wrangler deploy" would, and writes the
#    result to .claude-test/deploy.log.
# Stop everything with Ctrl+C.
cd "$(dirname "$0")/.." || exit 1
mkdir -p .claude-test
( while true; do
    npx wrangler tail --format json >> .claude-test/tail.log 2>&1
    sleep 5
  done ) &
TAIL_LOOP=$!
trap 'kill $TAIL_LOOP 2>/dev/null; pkill -f "wrangler tail" 2>/dev/null; echo; echo "Stopped."; exit 0' INT TERM
echo "Claude test loop is running. Leave this window open. Ctrl+C stops it."
while true; do
  if [ -f .claude-test/deploy-now ]; then
    rm -f .claude-test/deploy-now
    echo "== $(date '+%H:%M:%S') deploy started" | tee -a .claude-test/deploy.log
    if npm run build >> .claude-test/deploy.log 2>&1 && npx wrangler deploy >> .claude-test/deploy.log 2>&1; then
      echo "== $(date '+%H:%M:%S') DEPLOY OK" | tee -a .claude-test/deploy.log
    else
      echo "== $(date '+%H:%M:%S') DEPLOY FAILED" | tee -a .claude-test/deploy.log
    fi
  fi
  sleep 3
done
