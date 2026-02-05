/**
 * Sync products for all shops
 */

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
  const { syncAllShops } = await import('../src/lib/sync')

  console.log('🔄 Syncing products for all shops...\n')
  
  const results = await syncAllShops()
  
  for (const result of results) {
    if (result.success) {
      console.log(`✅ ${result.shopId}: ${result.productsCreated} created, ${result.productsUpdated} updated`)
    } else {
      console.log(`❌ ${result.shopId}: ${result.error}`)
    }
  }
  
  console.log('\n✨ Done!')
  process.exit(0)
}

main().catch(console.error)
