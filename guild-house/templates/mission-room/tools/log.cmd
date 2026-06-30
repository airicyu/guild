@echo off
setlocal EnableExtensions

if "%~3"=="" (
  echo usage: tools\log.cmd ^<from^> ^<type^> ^<body^>
  echo PO types: milestone directive evaluator_done round_note
  echo Member types: status evidence qa_pass qa_fail
  exit /b 1
)

set "FROM=%~1"
set "EVENTTYPE=%~2"
set "BODY=%~3"

for %%I in ("%~dp0..") do set "MISSION_ID=%%~nxI"
if not defined GUILD_HOUSE_URL set "GUILD_HOUSE_URL=http://127.0.0.1:3847"
if not defined GUILD_API_KEY (
  echo Set GUILD_API_KEY 1>&2
  exit /b 1
)

call "%~dp0_escape.cmd" "%FROM%" FROM_ESC
call "%~dp0_escape.cmd" "%BODY%" BODY_ESC
call "%~dp0_escape.cmd" "%EVENTTYPE%" TYPE_ESC
set "PAYLOAD=%TEMP%\guild-log-%RANDOM%.json"
> "%PAYLOAD%" echo {^"from^":^"%FROM_ESC%^",^"body^":^"%BODY_ESC%^",^"type^":^"%TYPE_ESC%^"}

curl -sS -X POST "%GUILD_HOUSE_URL%/missions/%MISSION_ID%/events" ^
  -H "Authorization: Bearer %GUILD_API_KEY%" ^
  -H "Content-Type: application/json" ^
  --data-binary "@%PAYLOAD%"
del "%PAYLOAD%" 2>nul
echo.
