#!/bin/sh

set -eu

PUID=${PUID:-0}
PGID=${PGID:-0}
NODE_PORT=3000
NODE_SOCKET=/run/daemun/daemun.sock
STATIC_HOME_DIR=/tmp/daemun/ssg
STATIC_INDEX="$STATIC_HOME_DIR/index.html"

export DAEMUN_STATIC_HOME_DIR="$STATIC_HOME_DIR"

mkdir -p /config "$STATIC_HOME_DIR" /run/daemun
[ ! -e "/app/config" ] && ln -s /config /app/config
CONFIG_DIR=$(readlink -f /app/config 2>/dev/null || echo /app/config)
rm -f "$NODE_SOCKET"

export HOMEPAGE_BUILDTIME=$(date +%s)

if [ "$PUID" = "0" ]; then
  echo "Skipping ownership changes for $CONFIG_DIR"
elif [ -d "$CONFIG_DIR" ]; then
  CURRENT_UID=$(stat -c %u "$CONFIG_DIR")
  CURRENT_GID=$(stat -c %g "$CONFIG_DIR")

  if [ "$CURRENT_UID" -ne "$PUID" ] || [ "$CURRENT_GID" -ne "$PGID" ]; then
    echo "Fixing ownership of $CONFIG_DIR"
    chown -R "$PUID:$PGID" "$CONFIG_DIR" 2>/dev/null || echo "Warning: Could not chown $CONFIG_DIR"
  else
    echo "$CONFIG_DIR already owned by correct UID/GID, skipping chown"
  fi
fi

if [ "$PUID" = "0" ]; then
  echo "Skipping ownership changes for $CONFIG_DIR/logs"
elif [ -n "$PUID" ] && [ -n "$PGID" ]; then
  mkdir -p "$CONFIG_DIR/logs" 2>/dev/null || true
  if [ -d "$CONFIG_DIR/logs" ]; then
    LOG_UID=$(stat -c %u "$CONFIG_DIR/logs")
    LOG_GID=$(stat -c %g "$CONFIG_DIR/logs")
    if [ "$LOG_UID" -ne "$PUID" ] || [ "$LOG_GID" -ne "$PGID" ]; then
      echo "Fixing ownership of $CONFIG_DIR/logs"
      chown -R "$PUID:$PGID" "$CONFIG_DIR/logs" 2>/dev/null || echo "Warning: Could not chown $CONFIG_DIR/logs"
    fi
  fi
fi

if [ -d /app/dist ]; then
  CURRENT_UID=$(stat -c %u /app/dist)
  CURRENT_GID=$(stat -c %g /app/dist)

  if [ "$PUID" -ne 0 ] && ([ "$CURRENT_UID" -ne "$PUID" ] || [ "$CURRENT_GID" -ne "$PGID" ]); then
    echo "Fixing ownership of /app/dist"
    chown -R "$PUID:$PGID" /app/dist 2>/dev/null || echo "Warning: Could not chown /app/dist"
  else
    echo "/app/dist already owned by correct UID/GID or running as root, skipping chown"
  fi
fi

if [ "$PUID" != "0" ]; then
  chown "$PUID:$PGID" "$STATIC_HOME_DIR" 2>/dev/null || echo "Warning: Could not chown $STATIC_HOME_DIR"
  chown "$PUID:$PGID" /run/daemun 2>/dev/null || echo "Warning: Could not chown /run/daemun"
fi

if [ "$(id -u)" = "0" ] && [ "$PUID" != "0" ]; then
  su-exec "$PUID:$PGID" node /app/dist/server/index.mjs --socket "$NODE_SOCKET" --port "$NODE_PORT" &
else
  node /app/dist/server/index.mjs --socket "$NODE_SOCKET" --port "$NODE_PORT" &
fi
NODE_PID=$!

deadline=$(( $(date +%s) + 30 ))
while [ ! -s "$STATIC_INDEX" ]; do
  if ! kill -0 "$NODE_PID" 2>/dev/null; then
    wait "$NODE_PID" || true
    echo "Daemun node backend exited before static index was generated"
    exit 1
  fi

  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "Timed out waiting for $STATIC_INDEX"
    kill -TERM "$NODE_PID" 2>/dev/null || true
    wait "$NODE_PID" 2>/dev/null || true
    exit 1
  fi

  sleep 1
done

deadline=$(( $(date +%s) + 30 ))
while ! node -e 'const http = require("node:http"); const req = http.request({ socketPath: process.argv[1], path: "/api/healthcheck", headers: { Host: "127.0.0.1:3000" }, timeout: 1000 }, (res) => process.exit(res.statusCode === 200 ? 0 : 1)); req.on("timeout", () => { req.destroy(); process.exit(1); }); req.on("error", () => process.exit(1)); req.end();' "$NODE_SOCKET"; do
  if ! kill -0 "$NODE_PID" 2>/dev/null; then
    wait "$NODE_PID" || true
    echo "Daemun node backend exited before the API socket became healthy"
    exit 1
  fi

  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "Timed out waiting for Daemun API socket at $NODE_SOCKET"
    kill -TERM "$NODE_PID" 2>/dev/null || true
    wait "$NODE_PID" 2>/dev/null || true
    exit 1
  fi

  sleep 1
done

nginx -g "daemon off;" &
NGINX_PID=$!

terminate() {
  kill -TERM "$NODE_PID" "$NGINX_PID" 2>/dev/null || true
  wait "$NODE_PID" 2>/dev/null || true
  wait "$NGINX_PID" 2>/dev/null || true
}

trap 'terminate; exit 143' INT TERM

while true; do
  if ! kill -0 "$NODE_PID" 2>/dev/null; then
    wait "$NODE_PID" || STATUS=$?
    terminate
    exit "${STATUS:-1}"
  fi

  if ! kill -0 "$NGINX_PID" 2>/dev/null; then
    wait "$NGINX_PID" || STATUS=$?
    terminate
    exit "${STATUS:-1}"
  fi

  sleep 1
done
