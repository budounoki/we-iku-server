#!/usr/bin/env bash
# iOS（kumar8080 アカウント）向け OTA / ビルド用のフォルダを、現在の mobile/ から作り直す。
#
# 以前は /tmp の git worktree を使っていたが、/tmp の定期削除で丸ごと消えた
# （2026-10-25）。毎回このスクリプトで作り直せば、ソースの同期漏れも起きない。
#   - mobile/ の中身をコピー（node_modules と Android 用 app.json/eas.json は除く）
#   - mobile/ios-kumar/ の kumar 用 app.json / eas.json / metro.config.js を上書き
#   - node_modules はメインのものへのシンボリックリンク（依存は同一）
# 実行後に表示されるコマンドで eas update / eas build を行う。
# このフォルダは git リポジトリではないため、EAS には EAS_NO_VCS=1 を付けて実行する
# （付けないと「git init しますか？」で止まり、--non-interactive では失敗する）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${IOS_BUILD_DIR:-$HOME/Downloads/WeApp-ios/mobile}"

mkdir -p "$OUT"
rsync -a --delete \
  --exclude node_modules --exclude .expo --exclude ios-kumar \
  --exclude app.json --exclude eas.json --exclude metro.config.js \
  "$ROOT/mobile/" "$OUT/"
cp "$ROOT/mobile/ios-kumar/app.json" "$ROOT/mobile/ios-kumar/eas.json" "$ROOT/mobile/ios-kumar/metro.config.js" "$OUT/"
ln -sfn "$ROOT/mobile/node_modules" "$OUT/node_modules"

echo "iOS folder ready: $OUT"
echo
echo "OTA:"
echo "  cd $OUT && EAS_NO_VCS=1 EXPO_PUBLIC_ADMOB_BANNER_IOS=ca-app-pub-4413290155368727/3978804222 EXPO_PUBLIC_ADMOB_BANNER_ANDROID=ca-app-pub-4413290155368727/5100314208 EXPO_TOKEN=<kumar token> npx eas-cli@latest update --branch production --message \"...\" --environment production --platform ios --non-interactive"
echo "Build:"
echo "  cd $OUT && EAS_NO_VCS=1 EXPO_TOKEN=<kumar token> npx eas-cli@latest build --platform ios --profile production --non-interactive"
