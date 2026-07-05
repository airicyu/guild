@echo off
setlocal EnableExtensions

if "%~1"=="" (
  echo usage: tools\escalate.cmd ^<question^> [urgency] [context]
  exit /b 1
)

set "QUESTION=%~1"
if "%~2"=="" (set "URGENCY=normal") else (set "URGENCY=%~2")
set "CONTEXT=%~3"

if /I not "%URGENCY%"=="low" if /I not "%URGENCY%"=="normal" if /I not "%URGENCY%"=="high" (
  echo Invalid urgency: %URGENCY% ^(use low, normal, or high^) 1>&2
  exit /b 1
)

for %%I in ("%~dp0..") do set "IDEA_ID=%%~nxI"
if not defined GUILD_HOUSE_URL set "GUILD_HOUSE_URL=http://127.0.0.1:3847"
if not defined GUILD_API_KEY (
  echo Set GUILD_API_KEY 1>&2
  exit /b 1
)

call "%~dp0_escape.cmd" "%QUESTION%" QUESTION_ESC
set "PAYLOAD=%TEMP%\guild-discovery-escalate-%RANDOM%.json"
if "%CONTEXT%"=="" (
  > "%PAYLOAD%" echo {^"question^":^"%QUESTION_ESC%^",^"urgency^":^"%URGENCY%^"}
) else (
  call "%~dp0_escape.cmd" "%CONTEXT%" CONTEXT_ESC
  > "%PAYLOAD%" echo {^"question^":^"%QUESTION_ESC%^",^"urgency^":^"%URGENCY%^",^"context^":^"%CONTEXT_ESC%^"}
)

curl -sS -X POST "%GUILD_HOUSE_URL%/missions/%IDEA_ID%/escalate" ^
  -H "Authorization: Bearer %GUILD_API_KEY%" ^
  -H "Content-Type: application/json" ^
  --data-binary "@%PAYLOAD%"
del "%PAYLOAD%" 2>nul
echo.
