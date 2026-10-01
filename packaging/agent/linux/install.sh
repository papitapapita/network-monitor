#!/bin/sh
# Installs the on-site agent as a systemd service (ADR 0002, 1.8).
#   sudo ./install.sh <pairing-key>     first install
#   sudo ./install.sh                   upgrade; keeps the pairing
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
DATA_DIR=/var/lib/nms-agent
KEY=${1:-}

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo $0 [pairing-key]" >&2
  exit 1
fi
if ! command -v systemctl >/dev/null 2>&1; then
  echo "This installer needs systemd." >&2
  exit 1
fi
if ! command -v ping >/dev/null 2>&1; then
  echo "The agent needs the system ping command (package iputils-ping)." >&2
  exit 1
fi
if [ ! -f "$DATA_DIR/agent.json" ] && [ -z "$KEY" ]; then
  echo "Not paired yet: sudo $0 <pairing-key>" >&2
  exit 1
fi
case "$KEY" in
  ''|pk1.*.*) ;;
  *) echo "That is not a pairing key; it starts with pk1." >&2; exit 1 ;;
esac

if ! id nms-agent >/dev/null 2>&1; then
  useradd --system --no-create-home --home-dir "$DATA_DIR" \
    --shell /usr/sbin/nologin nms-agent
fi

systemctl stop nms-agent 2>/dev/null || true
# The agent replaces its own binary when it updates itself, so the
# program's directory belongs to its user.
install -d -m 0755 -o nms-agent -g nms-agent /opt/nms-agent
install -m 0755 -o nms-agent -g nms-agent "$HERE/nms-agent" /opt/nms-agent/nms-agent
rm -f /opt/nms-agent/nms-agent.old /opt/nms-agent/nms-agent.new
install -m 0644 "$HERE/nms-agent.service" /etc/systemd/system/nms-agent.service
install -d -m 0700 -o nms-agent -g nms-agent "$DATA_DIR"

if [ -n "$KEY" ] && [ ! -f "$DATA_DIR/agent.json" ]; then
  umask 077
  printf '%s\n' "$KEY" > "$DATA_DIR/pairing.key"
  chown nms-agent:nms-agent "$DATA_DIR/pairing.key"
fi

systemctl daemon-reload
systemctl enable --now nms-agent
echo "Installed. Follow it with: journalctl -u nms-agent -f"
