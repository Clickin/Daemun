#!/bin/sh

set -eu

PUID=${PUID:-0}
PGID=${PGID:-0}
NODE_PORT=3000
NODE_SOCKET=/run/daemun/daemun.sock
STATIC_INDEX=/app/dist/server/ssg/index.html

mkdir -p /config /app/dist/server/ssg /run/daemun
[ ! -e "/app/config" ] && ln -s /config /app/config
rm -f "$NODE_SOCKET"

export HOMEPAGE_BUILDTIME=$(date +%s)

if [ "$PUID" = "0" ]; then
  echo "Skipping ownership changes for /app/config"
elif [ -e /app/config ]; then
  CURRENT_UID=$(stat -c %u /app/config)
  CURRENT_GID=$(stat -c %g /app/config)

  if [ "$CURRENT_UID" -ne "$PUID" ] || [ "$CURRENT_GID" -ne "$PGID" ]; then
    echo "Fixing ownership of /app/config"
    chown -R "$PUID:$PGID" /app/config 2>/dev/null || echo "Warning: Could not chown /app/config"
  else
    echo "/app/config already owned by correct UID/GID, skipping chown"
  fi
fi

if [ "$PUID" = "0" ]; then
  echo "Skipping ownership changes for /app/config/logs"
elif [ -n "$PUID" ] && [ -n "$PGID" ]; then
  mkdir -p /app/config/logs 2>/dev/null || true
  if [ -d /app/config/logs ]; then
    LOG_UID=$(stat -c %u /app/config/logs)
    LOG_GID=$(stat -c %g /app/config/logs)
    if [ "$LOG_UID" -ne "$PUID" ] || [ "$LOG_GID" -ne "$PGID" ]; then
      echo "Fixing ownership of /app/config/logs"
      chown -R "$PUID:$PGID" /app/config/logs 2>/dev/null || echo "Warning: Could not chown /app/config/logs"
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
