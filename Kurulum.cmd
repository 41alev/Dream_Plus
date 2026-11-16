@echo off
rem Dream Plus - cift tiklayin. Yonetici izni ister, sonra windows\kurulum.ps1 calisir.
rem Ek parametreler aynen gecer, ornek:  Kurulum.cmd -OpenFirewall -Port 8080
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%*' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\kurulum.ps1" %*
echo.
pause
