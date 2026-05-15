#!/bin/sh

set -e

# Default to root, so old installations won't break
export PUID=${PUID:-0}
export PGID=${PGID:-0}
STATIC_HOME_DIR=${DAEMUN_STATIC_HOME_DIR:-/tmp/daemun/ssg}
export DAEMUN_STATIC_HOME_DIR="$STATIC_HOME_DIR"

# This is in attempt to preserve the original behavior of the Dockerfile,
# while also supporting the lscr.io /config directory
mkdir -p /config
mkdir -p "$STATIC_HOME_DIR"
[ ! -e "/app/config" ] && ln -s /config /app/config
CONFIG_DIR=$(readlink -f /app/config 2>/dev/null || echo /app/config)

export HOMEPAGE_BUILDTIME=$(date +%s)

# Check ownership before chown
if [ "$PUID" = "0" ]; then
  echo "Skipping ownership changes for $CONFIG_DIR"
elif [ -d "$CONFIG_DIR" ]; then
  CURRENT_UID=$(stat -c %u "$CONFIG_DIR")
  CURRENT_GID=$(stat -c %g "$CONFIG_DIR")

  if [ "$CURRENT_UID" -ne "$PUID" ] || [ "$CURRENT_GID" -ne "$PGID" ]; then
    echo "Fixing ownership of $CONFIG_DIR"
    if ! chown -R "$PUID:$PGID" "$CONFIG_DIR" 2>/dev/null; then
      echo "Warning: Could not chown $CONFIG_DIR; continuing anyway"
    fi
  else
    echo "$CONFIG_DIR already owned by correct UID/GID, skipping chown"
  fi
else
  echo "$CONFIG_DIR does not exist; skipping ownership check"
fi

# Ensure config logs exists and is owned
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
    if ! chown -R "$PUID:$PGID" /app/dist 2>/dev/null; then
      echo "Warning: Could not chown /app/dist; continuing anyway"
    fi
  else
    echo "/app/dist already owned by correct UID/GID or running as root, skipping chown"
  fi
fi

if [ "$PUID" != "0" ]; then
  chown "$PUID:$PGID" "$STATIC_HOME_DIR" 2>/dev/null || echo "Warning: Could not chown $STATIC_HOME_DIR"
fi

# Drop privileges (when asked to) if root, otherwise run as current user
if [ "$(id -u)" = "0" ] && [ "${PUID}" != "0" ]; then
  exec su-exec ${PUID}:${PGID} "$@"
else
  exec "$@"
fi
