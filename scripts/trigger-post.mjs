#!/usr/bin/env node
// Trigger ASH Reviews post-reviews endpoint (multiple batches with rate limit handling)
const CRON_SECRET = process.env.CRON_SECRET || 'ash-cron-c150b513455e8ea77f9862f16b228bea';

// Random delay 0-12 minutes for natural timestamps
const delayMinutes = Math.floor(Math.random() * 12);
const delayMs = delayMinutes * 60 * 1000;
console.log(`[ASH Cron] Waiting ${delayMinutes} minutes before posting...`);
await new Promise(r => setTimeout(r, delayMs));

console.log('[ASH Cron] Triggering post-reviews...');

let totalPosted = 0;
let totalFailed = 0;
let batchCount = 0;
const maxBatches = 10; // Safety limit

while (batchCount < maxBatches) {
  batchCount++;
  console.log(`[ASH Cron] Batch ${batchCount}...`);
  
  const res = await fetch('https://ash-reviews.vercel.app/api/cron/post-reviews', {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
    signal: AbortSignal.timeout(120000)
  });

  const data = await res.json();
  
  if (!data.success) {
    console.log(`[ASH Cron] Error: ${data.error}`);
    break;
  }
  
  totalPosted += data.posted || 0;
  totalFailed += data.failed || 0;
  
  console.log(`[ASH Cron] Batch ${batchCount}: ${data.posted} posted, ${data.failed} failed`);
  
  // Check if we hit rate limit
  const rateLimited = data.results?.some(r => r.error?.includes('429'));
  if (rateLimited) {
    console.log('[ASH Cron] Rate limited, waiting 60s...');
    await new Promise(r => setTimeout(r, 60000));
    continue;
  }
  
  // If no reviews left or very few posted, we're done
  if (data.posted === 0 || data.message === 'No reviews to post') {
    break;
  }
  
  // Small delay between batches
  await new Promise(r => setTimeout(r, 5000));
}

console.log(`[ASH Cron] Done! Total: ${totalPosted} posted, ${totalFailed} failed`);
