@echo off
rem 点数計算ドリルの最新版を GitHub から取ってきて、公開用の3ファイルを dist\tensu にそろえる
rem   scripts\tensu-pull.bat            … ファイルをそろえるだけ
rem   scripts\tensu-pull.bat --deploy   … そろえたあと Netlify に公開する（Node.js が必要）
rem 取ってくるブランチを変えるときは、先に set TENSU_BRANCH=main を実行しておく
chcp 65001 >nul
setlocal
if "%TENSU_BRANCH%"=="" set "TENSU_BRANCH=claude/adoring-sagan-5gj26i"
cd /d "%~dp0.."

rem 手元でファイルを書き換えていると取り込みで上書きできないので、先に止める
for /f %%i in ('git status --porcelain') do (
  echo 手元で変更されたファイルがあるため中止しました（git status で確認できます）
  exit /b 1
)

echo 最新版を取得しています（%TENSU_BRANCH%）
git fetch origin %TENSU_BRANCH% || goto :fail
git checkout -q %TENSU_BRANCH% 2>nul || git checkout -q -b %TENSU_BRANCH% origin/%TENSU_BRANCH% || goto :fail
git merge -q --ff-only origin/%TENSU_BRANCH% || goto :fail

if exist dist\tensu rmdir /s /q dist\tensu
mkdir dist\tensu
copy /y tensu\index.html dist\tensu\ >nul || goto :fail
copy /y tensu\mahjong.js dist\tensu\ >nul || goto :fail
copy /y tensu\tiles.js dist\tensu\ >nul || goto :fail
echo 用意できました: %CD%\dist\tensu

if /i "%~1"=="--deploy" (
  echo Netlify に公開します
  call npx --yes netlify-cli deploy --prod --dir dist\tensu || goto :fail
)
exit /b 0

:fail
echo 失敗しました。上に出ているメッセージを確認してください
exit /b 1
