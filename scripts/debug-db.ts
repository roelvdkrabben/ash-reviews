import fs from 'fs'
import path from 'path'

const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim()
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value.replace(/^["']|["']$/g, '')
      }
    }
  }
}

async function main() {
  const { neon } = await import('@neondatabase/serverless')
  const sql = neon(process.env.DATABASE_URL!)
  
  // Check reviews data
  console.log('\n📊 Reviews by date (last 90 days):')
  const reviewsByDate = await sql`
    SELECT 
      DATE(COALESCE(r.posted_at, r.created_at)) as date,
      COUNT(*) as count,
      r.shop_id,
      s.name as shop_name
    FROM reviews r
    JOIN shops s ON r.shop_id = s.id
    WHERE r.status IN ('posted', 'imported')
      AND COALESCE(r.posted_at, r.created_at) >= NOW() - INTERVAL '90 days'
    GROUP BY DATE(COALESCE(r.posted_at, r.created_at)), r.shop_id, s.name
    ORDER BY date DESC
    LIMIT 30
  `
  console.log(reviewsByDate)
  
  // Check total counts
  console.log('\n📈 Total reviews by status:')
  const counts = await sql`
    SELECT status, COUNT(*) as count
    FROM reviews
    GROUP BY status
  `
  console.log(counts)
  
  process.exit(0)
}

main().catch(console.error)
