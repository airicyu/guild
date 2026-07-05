@echo off
rem Usage: call _escape.cmd "raw text" OUTVAR
setlocal EnableDelayedExpansion
set "str=%~1"
if not defined str (
  endlocal & set "%~2="
  exit /b 0
)
set "str=!str:\=\\!"
set "str=!str:"=\"!"
for /f "delims=" %%A in ("!str!") do endlocal & set "%~2=%%A"
exit /b 0
