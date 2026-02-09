#!/usr/bin/env node
/**
 * Fix bulk-posted reviews:
 * 1. Delete them from Lightspeed
 * 2. Reset status to 'approved'
 * 3. Re-schedule them spread out
 */

import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_jSOW8Aw4yxQq@ep-mute-violet-agjxj45y-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require');

// Shop credentials
const SHOPS = {
  'Accu Service Holland': { key: 'e6563f50275583106e31f147eef8ed93', secret: 'b7280e76e69eb2258b3a768f7afc360f' },
  'Hoorbatterij Online': { key: '24d482b13cff5a6592839fb7fb32c56f', secret: '2090785b6c9cfb46b2492c8f54c556ce' },
  'Rubberboot Expert': { key: '2fab9e55ef4705020ac9882b3869e4fb', secret: '63f54cefb33922bfb035f98b3d4c88f9' },
  'Motoraccu.nl': { key: '1a33cc296fa30d20b62cc40acfe485b4', secret: '0546a9a4ad6d63e76a1b20b124d73b15' },
};

async function deleteFromLightspeed(shopName, reviewId) {
  const creds = SHOPS[shopName];
  if (!creds) {
    console.log(`  ⚠️ No credentials for ${shopName}`);
    return false;
  }
  
  const auth = 'Basic ' + Buffer.from(`${creds.key}:${creds.secret}`).toString('base64');
  
  try {
    const res = await fetch(`https://api.webshopapp.com/nl/reviews/${reviewId}.json`, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });
    
    if (res.status === 204 || res.status === 200) {
      return true;
    } else if (res.status === 404) {
      console.log(`  ⚠️ Review ${reviewId} not found in Lightspeed (already deleted?)`);
      return true; // Consider it done
    } else {
      console.log(`  ❌ Failed to delete ${reviewId}: ${res.status}`);
      return false;
    }
  } catch (err) {
    console.log(`  ❌ Error deleting ${reviewId}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('=== Fixing bulk-posted reviews ===\n');
  
  // Find all reviews posted today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const postedToday = await sql`
    SELECT r.id, r.external_id, r.reviewer_name, s.name as shop_name
    FROM reviews r
    JOIN shops s ON r.shop_id = s.id
    WHERE r.status = 'posted'
    AND r.posted_at >= ${today.toISOString()}
    ORDER BY s.name, r.posted_at
  `;
  
  console.log(`Found ${postedToday.length} reviews posted today\n`);
  
  if (postedToday.length === 0) {
    console.log('Nothing to fix!');
    return;
  }
  
  // Group by shop
  const byShop = {};
  for (const r of postedToday) {
    if (!byShop[r.shop_name]) byShop[r.shop_name] = [];
    byShop[r.shop_name].push(r);
  }
  
  // Process each shop
  let deleted = 0;
  let failed = 0;
  
  for (const [shopName, reviews] of Object.entries(byShop)) {
    console.log(`\n${shopName}: ${reviews.length} reviews`);
    
    for (const r of reviews) {
      if (!r.external_id) {
        console.log(`  ⚠️ ${r.reviewer_name}: no external_id, skipping Lightspeed delete`);
        continue;
      }
      
      process.stdout.write(`  Deleting ${r.reviewer_name} (${r.external_id})... `);
      const success = await deleteFromLightspeed(shopName, r.external_id);
      
      if (success) {
        console.log('✓');
        deleted++;
      } else {
        failed++;
      }
      
      // Rate limit: wait 500ms between deletes
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`\n\nDeleted from Lightspeed: ${deleted}, Failed: ${failed}`);
  
  // Reset all posted-today reviews back to approved
  console.log('\nResetting reviews in database...');
  
  const resetResult = await sql`
    UPDATE reviews
    SET status = 'approved',
        external_id = NULL,
        posted_at = NULL,
        scheduled_at = NULL,
        updated_at = NOW()
    WHERE status = 'posted'
    AND posted_at >= ${today.toISOString()}
    RETURNING id
  `;
  
  console.log(`Reset ${resetResult.length} reviews to 'approved' status`);
  
  console.log('\n✅ Done! Reviews will be re-scheduled by the next generate-reviews cron run.');
  console.log('Or run: node scripts/reschedule-approved.mjs to schedule them now.');
}

main().catch(console.error);
