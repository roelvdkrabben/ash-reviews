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

async function debug() {
  console.log('=== POST FLOW DEBUG ===\n');
  
  // 1. Check reviews by status
  const byStatus = await sql`
    SELECT status, COUNT(*) as count
    FROM reviews
    GROUP BY status
    ORDER BY count DESC
  `;
  console.log('Reviews by status:');
  console.table(byStatus);
  
  // 2. Check approved reviews ready to post
  const now = new Date().toISOString();
  const readyToPost = await sql`
    SELECT r.id, r.status, r.scheduled_at, p.name as product, s.name as shop
    FROM reviews r
    LEFT JOIN products p ON r.product_id = p.id
    LEFT JOIN shops s ON r.shop_id = s.id
    WHERE r.status = 'approved'
      AND r.scheduled_at IS NOT NULL
      AND r.scheduled_at <= ${now}
    LIMIT 10
  `;
  console.log('\nApproved & ready to post (scheduled_at <= now):');
  console.table(readyToPost);
  
  // 3. Check approved but not scheduled
  const approvedNotScheduled = await sql`
    SELECT r.id, r.status, r.scheduled_at, p.name as product
    FROM reviews r
    LEFT JOIN products p ON r.product_id = p.id
    WHERE r.status = 'approved'
      AND (r.scheduled_at IS NULL OR r.scheduled_at > ${now})
    LIMIT 10
  `;
  console.log('\nApproved but NOT ready (no scheduled_at or future):');
  console.table(approvedNotScheduled);
  
  // 4. Check failed reviews with reasons
  const failed = await sql`
    SELECT r.id, r.rejection_reason, r.updated_at, p.name as product
    FROM reviews r
    LEFT JOIN products p ON r.product_id = p.id
    WHERE r.status = 'failed'
    ORDER BY r.updated_at DESC
    LIMIT 10
  `;
  console.log('\nRecent failed reviews:');
  console.table(failed);
  
  // 5. Check if shops have credentials
  const shops = await sql`
    SELECT id, name, 
           CASE WHEN lightspeed_api_key IS NOT NULL THEN 'Yes' ELSE 'No' END as has_key,
           CASE WHEN lightspeed_api_secret IS NOT NULL THEN 'Yes' ELSE 'No' END as has_secret,
           settings->>'reviewCustomerId' as customer_id
    FROM shops
  `;
  console.log('\nShops credentials:');
  console.table(shops);
  
  // 6. Check most recent posted review
  const lastPosted = await sql`
    SELECT r.id, r.posted_at, r.external_id, p.name as product, s.name as shop
    FROM reviews r
    LEFT JOIN products p ON r.product_id = p.id
    LEFT JOIN shops s ON r.shop_id = s.id
    WHERE r.status = 'posted'
    ORDER BY r.posted_at DESC
    LIMIT 5
  `;
  console.log('\nLast posted reviews:');
  console.table(lastPosted);
}

debug();
