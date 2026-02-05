# ASH Reviews - Post Due Reviews
# Schedule this in Windows Task Scheduler to run every 10 minutes
#
# IMPORTANT: Ensure DATABASE_URL is set in .env.local

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
if (-not $env:DATABASE_URL) {
    Write-Error "DATABASE_URL not set! Add it to .env.local"
    exit 1
}

# Run the script
Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Running post-due-reviews..."
npx tsx scripts/post-due-reviews.ts

Write-Host "Done!"
