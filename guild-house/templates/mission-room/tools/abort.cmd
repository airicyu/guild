@echo off
setlocal EnableExtensions

for %%I in ("%~dp0..") do set "MISSION_ID=%%~nxI"
if not defined GUILD_HOUSE_URL set "GUILD_HOUSE_URL=http://127.0.0.1:3847"
if not defined GUILD_API_KEY (
  echo Set GUILD_API_KEY 1>&2
  exit /b 1
)

set "PAYLOAD=%TEMP%\guild-abort-%RANDOM%.json"
if "%~1"=="" (
  > "%PAYLOAD%" echo {}
) else (
  call "%~dp0_escape.cmd" "%~1" REASON_ESC
  > "%PAYLOAD%" echo {^"reason^":^"%REASON_ESC%^"}
)

curl -sS -X POST "%GUILD_HOUSE_URL%/missions/%MISSION_ID%/abort" ^
  -H "Authorization: Bearer %GUILD_API_KEY%" ^
  -H "Content-Type: application/json" ^
  --data-binary "@%PAYLOAD%"
del "%PAYLOAD%" 2>nul
echo.
