@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js bulunamadi.
  echo     https://nodejs.org adresinden LTS surumu kurun, sonra bu dosyayi tekrar calistirin.
  pause
  exit /b 1
)
node "%~dp0src\cli.js" %*
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" pause
exit /b %EXITCODE%