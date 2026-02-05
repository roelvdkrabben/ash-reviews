/**
 * Reset failed reviews back to approved for retry
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
  const { db } = await import('../src/lib/db')
  const { reviews } = await import('../src/lib/schema')
  const { eq } = await import('drizzle-orm')

  const result = await db
    .update(reviews)
    .set({ status: 'approved', error: null })
    .where(eq(reviews.status, 'failed'))

  console.log('Reset failed reviews to approved status')
  process.exit(0)
}

main().catch(console.error)
