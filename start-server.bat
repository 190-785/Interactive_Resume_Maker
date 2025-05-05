@echo off
REM Simple local server using Python 3 serving from src directory
cd /d F:\Interavtive_Resume\src
python -m http.server 8080
