# Script to launch both Next.js Frontend and FastAPI Python Backend
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Starting KPM Full-Stack Application       " -ForegroundColor Green
Write-Host "  - Frontend: http://localhost:3000          " -ForegroundColor Yellow
Write-Host "  - Backend:  http://127.0.0.1:8000/docs     " -ForegroundColor Yellow
Write-Host "  - Database: PostgreSQL on port 5432        " -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Cyan

# Check if PostgreSQL service or port is accessible
$postgresReady = Test-NetConnection -ComputerName "localhost" -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue

if (-not $postgresReady) {
    Write-Host "[!] Warning: PostgreSQL is not detected on localhost:5432." -ForegroundColor Red
    Write-Host "    If using Docker, run: docker compose up -d" -ForegroundColor Magenta
    Write-Host "    If using Windows service, start PostgreSQL service." -ForegroundColor Magenta
} else {
    Write-Host "[✓] PostgreSQL is listening on localhost:5432" -ForegroundColor Green
}

# Start Backend in background or separate window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot/backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000 --host 127.0.0.1"

# Start Frontend in current window or separate window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot/frontend'; npm run dev"

Write-Host "Both servers launched in independent terminal windows!" -ForegroundColor Green
