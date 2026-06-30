@echo off
setlocal EnableExtensions

if "%~1"=="" (
  echo usage: tools\signal.cmd ^<type^> [summary]
  exit /b 1
)

set "TYPE=%~1"
set "SUMMARY=%~2"
for %%I in ("%~dp0..") do set "MISSION_ID=%%~nxI"
if not defined GUILD_HOUSE_URL set "GUILD_HOUSE_URL=http://127.0.0.1:3847"
if not defined GUILD_API_KEY (
  echo Set GUILD_API_KEY 1>&2
  exit /b 1
)

set "PAYLOAD=%TEMP%\guild-signal-%RANDOM%.json"
if "%SUMMARY%"=="" (
  > "%PAYLOAD%" echo {^"type^":^"%TYPE%^",^"by^":^"project-owner^"}
) else (
  call "%~dp0_escape.cmd" "%SUMMARY%" SUMMARY_ESC
  > "%PAYLOAD%" echo {^"type^":^"%TYPE%^",^"by^":^"project-owner^",^"summary^":^"%SUMMARY_ESC%^"}
)

curl -sS -X POST "%GUILD_HOUSE_URL%/missions/%MISSION_ID%/signals" ^
  -H "Authorization: Bearer %GUILD_API_KEY%" ^
  -H "Content-Type: application/json" ^
  --data-binary "@%PAYLOAD%"
del "%PAYLOAD%" 2>nul
echo.
