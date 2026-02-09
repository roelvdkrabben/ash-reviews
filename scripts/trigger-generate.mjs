#!/usr/bin/env node
// Trigger ASH Reviews generate-reviews endpoint
const CRON_SECRET = process.env.CRON_SECRET || 'ash-cron-c150b513455e8ea77f9862f16b228bea';

console.log('[ASH Cron] Triggering generate-reviews...');
const res = await fetch('https://ash-reviews.vercel.app/api/cron/generate-reviews', {
  headers: { Authorization: `Bearer ${CRON_SECRET}` },
  signal: AbortSignal.timeout(300000) // 5 min timeout
});

const data = await res.json();
console.log(`[ASH Cron] Status: ${res.status}`);
console.log(`[ASH Cron] Result:`, JSON.stringify(data, null, 2));
