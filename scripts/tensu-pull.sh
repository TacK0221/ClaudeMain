#!/bin/sh
# 点数計算ドリルの最新版を GitHub から取ってきて、公開用の3ファイルを dist/tensu にそろえる
#   sh scripts/tensu-pull.sh            … ファイルをそろえるだけ
#   sh scripts/tensu-pull.sh --deploy   … そろえたあと Netlify に公開する（Node.js が必要）
# 取ってくるブランチを変えるときは TENSU_BRANCH=main sh scripts/tensu-pull.sh のように指定する
set -e
BRANCH="${TENSU_BRANCH:-claude/adoring-sagan-5gj26i}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 手元でファイルを書き換えていると取り込みで上書きできないので、先に止める
if [ -n "$(git status --porcelain)" ]; then
  echo "手元で変更されたファイルがあるため中止しました（git status で確認できます）"
  exit 1
fi

echo "最新版を取得しています（$BRANCH）"
git fetch origin "$BRANCH"
git checkout -q "$BRANCH" 2>/dev/null || git checkout -q -b "$BRANCH" "origin/$BRANCH"
git merge -q --ff-only "origin/$BRANCH"

OUT="$ROOT/dist/tensu"
rm -rf "$OUT"
mkdir -p "$OUT"
cp tensu/index.html tensu/mahjong.js tensu/tiles.js "$OUT/"
echo "用意できました: $OUT"
echo "（$(git log -1 --format='%h %s')）"

if [ "$1" = "--deploy" ]; then
  echo "Netlify に公開します"
  npx --yes netlify-cli deploy --prod --dir "$OUT"
fi
