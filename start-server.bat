@echo off
REM Start webpack devServer for development
cd /d F:\Interavtive_Resume
npx webpack serve --config webpack.config.js --mode development --open
echo Press any key to exit...
cmd /k
