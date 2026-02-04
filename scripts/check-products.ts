import { readFileSync } from 'fs'
import { join } from 'path'
import { neon } from '@neondatabase/serverless'

// Load .env.local
const envPath = join(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const value = match[2].trim()
    process.env[key] = value
  }
}

const sql = neon(process.env.DATABASE_URL!)

async function check() {
  console.log('=== Database Check ===\n')
  
  const allShops = await sql`SELECT id, name FROM shops`
  console.log(`Found ${allShops.length} shops:\n`)
  
  for (const shop of allShops) {
    const [productCount] = await sql`SELECT COUNT(*) as count FROM products WHERE shop_id = ${shop.id}`
    const [reviewCount] = await sql`SELECT COUNT(*) as count FROM reviews WHERE shop_id = ${shop.id}`
    const [pendingCount] = await sql`SELECT COUNT(*) as count FROM reviews WHERE shop_id = ${shop.id} AND status = 'pending'`
    
    console.log(`📦 ${shop.name}`)
    console.log(`   ID: ${shop.id}`)
    console.log(`   Products: ${productCount.count}`)
    console.log(`   Reviews: ${reviewCount.count} (${pendingCount.count} pending)`)
    console.log('')
  }
}

check()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1) })
