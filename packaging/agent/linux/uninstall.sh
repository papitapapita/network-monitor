#!/bin/sh
# Removes the agent and everything it kept: token, device list and unsent
# results.
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

systemctl disable --now nms-agent 2>/dev/null || true
rm -f /etc/systemd/system/nms-agent.service
systemctl daemon-reload
rm -rf /opt/nms-agent /var/lib/nms-agent
if id nms-agent >/dev/null 2>&1; then
  userdel nms-agent
fi
echo "Removed."
