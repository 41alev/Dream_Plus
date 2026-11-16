@echo off
rem Dream Plus sunucu dongusu. Windows gorevi (kurulum.ps1) bunu calistirir.
rem Sunucu kapanirsa 5 saniye sonra yeniden baslatir; ciktiyi data\logs'a yazar.
rem Kullanim: run-server.cmd "C:\Program Files\nodejs\node.exe"
setlocal
cd /d "%~dp0.."
set "NODE_EXE=%~1"
if "%NODE_EXE%"=="" set "NODE_EXE=node"
if not exist "data\logs" mkdir "data\logs"
:loop
rem Basit dondurme: 20 MB'i gecen gunluk, yeniden baslatmada server.old.log olur.
for %%F in ("data\logs\server.log") do if exist "%%~F" if %%~zF GTR 20000000 move /y "%%~F" "data\logs\server.old.log" >nul
echo [%date% %time%] Dream Plus baslatiliyor >> "data\logs\server.log"
"%NODE_EXE%" server\index.js >> "data\logs\server.log" 2>&1
echo [%date% %time%] Sunucu kapandi (cikis kodu %errorlevel%), 5 sn sonra yeniden baslatiliyor >> "data\logs\server.log"
rem timeout.exe needs a console; a scheduled task has none, so use ping as the delay.
ping -n 6 127.0.0.1 >nul
goto loop
