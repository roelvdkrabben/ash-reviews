# ASH Reviews - Daily Review Generation
# Schedule this in Windows Task Scheduler to run once daily (e.g., 5:00 AM)
#
# IMPORTANT: Set these environment variables BEFORE running:
#   - DATABASE_URL (or set below)
#   - GEMINI_API_KEY (required - get from Google AI Studio)

$ErrorActionPreference = "Stop"

# Change to project directory  
Set-Location "C:\Users\Roel\clawd\ash-reviews"

# Load environment from .env.local if it exists
if (Test-Path ".env.local") {
    Get-Content ".env.local" | ForEach-Object {
        if ($_ -match "^([^#=]+)=(.*)$") {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

# Verify required env vars
if (-not $env:GEMINI_API_KEY) {
    Write-Error "GEMINI_API_KEY not set! Add it to .env.local or set as environment variable."
    exit 1
}

# Run the batch generation (max 10 per shop)
Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Running batch review generation..."
npx tsx scripts/batch-generate.ts 10

Write-Host "Done!"
