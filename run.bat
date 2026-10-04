@echo off
echo Starting ResearchSphere Project...

echo Checking for existing processes on ports 5000, 3000, and 8000...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr /R /C:":5000 .*LISTENING"') do (
    echo Terminating process on port 5000 [PID %%a]
    taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr /R /C:":3000 .*LISTENING"') do (
    echo Terminating process on port 3000 [PID %%a]
    taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr /R /C:":8000 .*LISTENING"') do (
    echo Terminating process on port 8000 [PID %%a]
    taskkill /F /PID %%a >nul 2>&1
)

echo Ports are clear. Starting services...

:: Start the API Server in a new command prompt window
start "ResearchSphere API Server" cmd /k "set "DATABASE_URL=postgresql://postgres:root@localhost:5433/researchsphere" && set "PORT=5000" && pnpm --filter @workspace/api-server run dev"

:: Start the Frontend React App in a new command prompt window
start "ResearchSphere Frontend" cmd /k "set "PORT=3000" && set "BASE_PATH=/" && pnpm --filter @workspace/research-sphere run dev"

:: Start the Python AI Service in a new command prompt window
start "ResearchSphere AI Service" cmd /k "cd artifacts\ai-service && .\venv\Scripts\python.exe main.py"

echo Successfully launched the servers! Check the new windows.
echo Frontend is available at http://localhost:3000
