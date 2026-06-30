@echo off
setlocal EnableExtensions

if "%~1"=="" (
  echo usage: scripts\guild-api.cmd ^<path^> [curl-args...]
  echo example: scripts\guild-api.cmd /board
  echo example: scripts\guild-api.cmd /bell -X POST
  exit /b 1
)

if not defined GUILD_HOUSE_URL set "GUILD_HOUSE_URL=http://127.0.0.1:3847"
if not defined GUILD_API_KEY (
  echo Set GUILD_API_KEY 1>&2
  exit /b 1
)

set "PATH_PART=%~1"
shift
set "AUTH=Authorization: Bearer %GUILD_API_KEY%"

curl -sS -H "%AUTH%" "%GUILD_HOUSE_URL%%PATH_PART%" %*
