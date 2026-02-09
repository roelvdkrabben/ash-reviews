import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

// Load .env.local manually
const envContent = readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const sql = neon(process.env.DATABASE_URL);

async function check() {
  // Check recent reviews
  const recent = await sql`
    SELECT id, shop_id, status, posted_at, created_at 
    FROM reviews 
    ORDER BY created_at DESC 
    LIMIT 10
  `;
  console.log('Recent reviews:');
  console.table(recent);
  
  // Check posted reviews by date
  const byDate = await sql`
    SELECT 
      status, 
      DATE(COALESCE(posted_at, created_at)) as date,
      COUNT(*) as count
    FROM reviews 
    WHERE status IN ('posted', 'imported')
    GROUP BY status, DATE(COALESCE(posted_at, created_at))
    ORDER BY date DESC
    LIMIT 15
  `;
  console.log('\nPosted/Imported per date:');
  console.table(byDate);
  
  // Today's data specifically
  const today = new Date().toISOString().split('T')[0];
  const todayData = await sql`
    SELECT status, COUNT(*) as count
    FROM reviews 
    WHERE DATE(COALESCE(posted_at, created_at)) = ${today}
    GROUP BY status
  `;
  console.log(`\nToday (${today}):`);
  console.table(todayData);
}

check();
