# ASH Reviews - Post Due Reviews
# Schedule this in Windows Task Scheduler to run every 30 minutes

$ErrorActionPreference = "Stop"

# Change to project directory
Set-Location "C:\Users\Roel\clawd\ash-reviews"

# Load environment
$env:DATABASE_URL = "postgresql://neondb_owner:npg_jSOW8Aw4yxQq@ep-mute-violet-agjxj45y-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require"

# Run the script
Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Running post-due-reviews..."
npx tsx scripts/post-due-reviews.ts

Write-Host "Done!"
