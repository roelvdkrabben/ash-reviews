# ASH Reviews - Daily Review Generation
# Schedule this in Windows Task Scheduler to run once daily (e.g., 5:00 AM)

$ErrorActionPreference = "Stop"

# Change to project directory  
Set-Location "C:\Users\Roel\clawd\ash-reviews"

# Load environment
$env:DATABASE_URL = "postgresql://neondb_owner:npg_jSOW8Aw4yxQq@ep-mute-violet-agjxj45y-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require"
$env:GEMINI_API_KEY = "AIzaSyCPk0uDX3VozxLVohiE8LplXd_mOxBp1c8"

# Run the batch generation (max 10 per shop)
Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Running batch review generation..."
npx tsx scripts/batch-generate.ts 10

Write-Host "Done!"
