#!/usr/bin/env bash
# Broadcast a push-notification announcement to ALL We育 users.
#
# Usage:
#   ./scripts/send-announcement.sh "タイトル" "本文メッセージ"
#
# Example (new-feature announcement):
#   ./scripts/send-announcement.sh "新機能のお知らせ" "プレミアムプランと1ヶ月無料体験が追加されました！"
#
# Reads ADMIN_KEY from .env and posts to the live server. Returns a JSON
# summary: {"ok":true,"tokens":N,"batches":M,"failedBatches":0}.
set -euo pipefail
cd "$(dirname "$0")/.."

TITLE="${1:?usage: send-announcement.sh <title> <body>}"
BODY="${2:?usage: send-announcement.sh <title> <body>}"
URL="${ANNOUNCE_URL:-https://we-iku.app/api/admin/announce}"

AK=$(grep '^ADMIN_KEY=' .env | head -1 | sed -E 's/^ADMIN_KEY=//; s/^["'"'"']//; s/["'"'"']$//')
if [ -z "$AK" ]; then echo "ADMIN_KEY not found in .env" >&2; exit 1; fi

PAYLOAD=$(python3 -c 'import json,sys; print(json.dumps({"title":sys.argv[1],"body":sys.argv[2]}))' "$TITLE" "$BODY")

echo "Sending announcement:  $TITLE"
curl -s -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: $AK" \
  -d "$PAYLOAD"
echo
