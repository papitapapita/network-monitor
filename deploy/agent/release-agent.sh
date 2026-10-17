#!/usr/bin/env bash
# Packages the agent at the checked-out commit, checks the signed release and
# publishes it into the installers folder every install on a host shares
# (INS-042). Connected agents are offered it within a minute and update
# themselves (AGT-080 … AGT-085); new sites download the new installer.
#
#   deploy/agent/release-agent.sh                           publish on this machine
#   deploy/agent/release-agent.sh --remote user@host        publish on another
#                                                           machine over SSH
#   deploy/agent/release-agent.sh --remote user@host:/dir   ... into that folder
#   deploy/agent/release-agent.sh --no-package ...          publish what
#                                                           dist/agent already holds
#
# The folder is INSTALLERS_DIR from vendor.env ($NMS_CUSTOMERS_DIR, default
# ~/nms-customers) on the machine that receives the release, or the one given.
# Signing needs the release key (npm run agent:release-key), at
# $NMS_AGENT_RELEASE_KEY or ~/.config/nms-agent/release-key.pem.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
OUT="$REPO/dist/agent"
KEY="${NMS_AGENT_RELEASE_KEY:-$HOME/.config/nms-agent/release-key.pem}"

fail() { echo "error: $*" >&2; exit 1; }

REMOTE=""
PACKAGE=true
while [ $# -gt 0 ]; do
  case "$1" in
    --remote) [ $# -ge 2 ] || fail "--remote needs user@host[:/dir]"; REMOTE="$2"; shift 2 ;;
    --no-package) PACKAGE=false; shift ;;
    -h|--help) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) fail "unknown option $1 (see --help)" ;;
  esac
done

# A release must be reproducible from a commit: the version agents report has
# to point at code that exists.
[ -z "$(git -C "$REPO" status --porcelain)" ] ||
  fail "uncommitted changes in $REPO; commit them first"
VERSION="$(sed -n "s/.*AGENT_VERSION = '\([^']*\)'.*/\1/p" "$REPO/src/agent/version.ts")"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
  fail "AGENT_VERSION in src/agent/version.ts is not major.minor.patch: '$VERSION'"
# Without the key, package:agent builds installers but no update, and agents
# in the field would never hear of this version.
[ -f "$KEY" ] || fail "no release key at $KEY (npm run agent:release-key)"

vendor_env='${NMS_CUSTOMERS_DIR:-$HOME/nms-customers}/vendor.env'

if [ -n "$REMOTE" ]; then
  HOST="${REMOTE%%:*}"
  DIR=""
  [[ "$REMOTE" == *:* ]] && DIR="${REMOTE#*:}"
  if [ -z "$DIR" ]; then
    DIR="$(ssh "$HOST" "sed -n 's/^INSTALLERS_DIR=//p' \"$vendor_env\"" | tr -d "\"'\r")" ||
      fail "could not read INSTALLERS_DIR from vendor.env on $HOST"
  fi
  [ -n "$DIR" ] || fail "INSTALLERS_DIR is empty in vendor.env on $HOST; pass --remote $HOST:/dir"
  run() { ssh "$HOST" "$(printf '%q ' "$@")"; }
  WHERE="$HOST:$DIR"
else
  DIR="${INSTALLERS_DIR:-}"
  if [ -z "$DIR" ]; then
    env_file="$(eval echo "$vendor_env")"
    [ -f "$env_file" ] && DIR="$(sed -n 's/^INSTALLERS_DIR=//p' "$env_file" | tr -d "\"'\r")"
  fi
  [ -n "$DIR" ] || fail "no INSTALLERS_DIR in the environment or vendor.env; use --remote for another machine"
  run() { "$@"; }
  WHERE="$DIR"
fi
[[ "$DIR" == /* ]] || fail "INSTALLERS_DIR must be an absolute path, got '$DIR'"
run test -d "$DIR" || fail "$WHERE is not a folder"

# AGT-082 offers only the newest release, so publishing an older or equal
# version would do nothing, or replace files agents may be downloading.
NEWEST="$(run ls "$DIR" | sed -n 's/^nms-agent-\([0-9]*\.[0-9]*\.[0-9]*\)\.manifest\.json$/\1/p' | sort -V | tail -1)"
if [ -n "$NEWEST" ]; then
  [ "$NEWEST" != "$VERSION" ] || fail "$VERSION is already published in $WHERE; bump AGENT_VERSION"
  [ "$(printf '%s\n%s\n' "$NEWEST" "$VERSION" | sort -V | tail -1)" = "$VERSION" ] ||
    fail "$WHERE already has $NEWEST, newer than $VERSION"
fi

echo "Agent $VERSION from $(git -C "$REPO" rev-parse --short HEAD) → $WHERE (now ${NEWEST:-none})"

if $PACKAGE; then
  (cd "$REPO" && npm run --silent package:agent)
fi
(cd "$REPO" && npx tsx scripts/agent/verify-release.ts "$OUT" "$VERSION")

FILES=()
for f in "nms-agent-setup-$VERSION.exe" "nms-agent-$VERSION-linux-x64.tar.gz"; do
  if [ -f "$OUT/$f" ]; then
    FILES+=("$f")
  else
    echo "warning: no $f; new sites will still download the previous installer" >&2
  fi
done
FILES+=("nms-agent-$VERSION-win-x64.gz" "nms-agent-$VERSION-linux-x64.gz")
# Last, so no install sees the release before its binaries are in place.
MANIFEST="nms-agent-$VERSION.manifest.json"
FILES+=("$MANIFEST")

# Each file lands under a hidden name, which neither the installer list nor
# the release catalog reads, and is renamed into place once complete.
for f in "${FILES[@]}"; do
  echo "  $f"
  if [ -n "$REMOTE" ]; then
    scp -q "$OUT/$f" "$HOST:$DIR/.$f.part"
  else
    cp "$OUT/$f" "$DIR/.$f.part"
  fi
done
for f in "${FILES[@]}"; do
  run mv -f "$DIR/.$f.part" "$DIR/$f"
done

echo "Published agent $VERSION to $WHERE."
echo "Connected agents are offered it within a minute; check the version in Agentes."
