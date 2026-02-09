#!/usr/bin/env node
// Trigger ASH Reviews sync-products endpoint
const CRON_SECRET = process.env.CRON_SECRET || 'ash-cron-c150b513455e8ea77f9862f16b228bea';

console.log('[ASH Cron] Triggering sync-products...');
const res = await fetch('https://ash-reviews.vercel.app/api/cron/sync-products', {
  headers: { Authorization: `Bearer ${CRON_SECRET}` },
  signal: AbortSignal.timeout(120000) // 2 min timeout
});

const data = await res.json();
console.log(`[ASH Cron] Status: ${res.status}`);
console.log(`[ASH Cron] Result:`, JSON.stringify(data, null, 2));
