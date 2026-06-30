@echo off
setlocal EnableExtensions

if not defined GUILD_API_KEY set "GUILD_API_KEY=change-me-in-production"
set "BASE=http://127.0.0.1:3847"
set "AUTH=Authorization: Bearer %GUILD_API_KEY%"

echo === GET /health ===
curl -sS "%BASE%/health"
echo.

echo === GET /board ===
curl -sS -H "%AUTH%" "%BASE%/board"
echo.

echo === GET /queue ===
curl -sS -H "%AUTH%" "%BASE%/queue"
echo.

echo === POST /bell ===
curl -sS -X POST -H "%AUTH%" "%BASE%/bell"
echo.

echo === GET /missions ===
curl -sS -H "%AUTH%" "%BASE%/missions"
echo.

echo === GET /outbox ===
curl -sS -H "%AUTH%" "%BASE%/outbox"
echo.

echo Done. For manual tests see docs\tests\README.md
