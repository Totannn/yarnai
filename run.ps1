# Yarn AI launcher (Windows PowerShell)
# Creates a venv on first run, installs deps, and starts the Flask server.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Cyan
    py -m venv .venv
}

& ".venv\Scripts\python.exe" -m pip install --quiet --upgrade pip
& ".venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt

if (-not (Test-Path ".env")) {
    Write-Host "No .env found - copying .env.example. Add your ANTHROPIC_API_KEY to it." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

Write-Host "`nYarn AI running at http://127.0.0.1:5055`n" -ForegroundColor Green
& ".venv\Scripts\python.exe" server.py
