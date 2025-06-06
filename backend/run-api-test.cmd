@echo off
cd %~dp0
echo Compiling TypeScript...
call npx tsc src/scripts/getSportEvents.ts --esModuleInterop --resolveJsonModule
echo Running script...
node src/scripts/getSportEvents.js
echo Done!
pause 