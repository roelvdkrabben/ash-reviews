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
  console.log('=== VANDAAG (9 feb 2026) ===\n');
  
  // All reviews updated today
  const updatedToday = await sql`
    SELECT r.id, r.status, r.posted_at, r.updated_at, r.external_id, p.name as product
    FROM reviews r
    LEFT JOIN products p ON r.product_id = p.id
    WHERE DATE(r.updated_at) = '2026-02-09'
    ORDER BY r.updated_at DESC
    LIMIT 20
  `;
  console.log('Reviews updated vandaag:');
  console.table(updatedToday);
  
  // Any reviews posted today (by posted_at)
  const postedToday = await sql`
    SELECT r.id, r.status, r.posted_at, r.external_id, p.name as product
    FROM reviews r
    LEFT JOIN products p ON r.product_id = p.id
    WHERE DATE(r.posted_at) = '2026-02-09'
  `;
  console.log('\nReviews met posted_at vandaag:');
  console.table(postedToday);
  
  // Check all statuses with timestamps
  const allStatuses = await sql`
    SELECT status, 
           COUNT(*) as count,
           MAX(updated_at) as last_updated
    FROM reviews
    GROUP BY status
  `;
  console.log('\nAlle statussen met laatste update:');
  console.table(allStatuses);
  
  // Reviews with external_id (successfully posted to Lightspeed)
  const withExternalId = await sql`
    SELECT r.id, r.status, r.posted_at, r.external_id, p.name as product
    FROM reviews r
    LEFT JOIN products p ON r.product_id = p.id
    WHERE r.external_id IS NOT NULL
    ORDER BY r.posted_at DESC
    LIMIT 10
  `;
  console.log('\nReviews met Lightspeed external_id:');
  console.table(withExternalId);
}

check();
