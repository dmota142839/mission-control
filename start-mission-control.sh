#!/usr/bin/env bash
set -euo pipefail
cd /home/moltbot/mission-control
# pnpm start uses shell ${PORT:-3000}; .env is not exported automatically
export PORT="${PORT:-$(grep -E '^PORT=' .env | head -1 | cut -d= -f2-)}"
export PORT="${PORT:-7004}"
exec pnpm start
