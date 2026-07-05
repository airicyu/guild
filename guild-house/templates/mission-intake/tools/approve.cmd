@echo off
setlocal EnableExtensions

for %%I in ("%~dp0..") do set "IDEA_ID=%%~nxI"
if not defined GUILD_HOUSE_URL set "GUILD_HOUSE_URL=http://127.0.0.1:3847"
if not defined GUILD_API_KEY (
  echo Set GUILD_API_KEY 1>&2
  exit /b 1
)

curl -fsS -X POST "%GUILD_HOUSE_URL%/missions/%IDEA_ID%/approve-discovery" ^
  -H "Authorization: Bearer %GUILD_API_KEY%" ^
  -H "Content-Type: application/json"
echo.
