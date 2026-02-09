import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_jSOW8Aw4yxQq@ep-mute-violet-agjxj45y-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require');

console.log('=== Setting reviews ready for immediate posting ===\n');

// Set scheduled_at to NOW so they're ready to post
const result = await sql`
  UPDATE reviews 
  SET scheduled_at = NOW() - INTERVAL '1 minute'
  WHERE status = 'approved' AND scheduled_at > NOW()
  RETURNING id, reviewer_name
`;

console.log(`Updated ${result.length} reviews to post immediately`);

// Now trigger the post endpoint
console.log('\nTriggering post-reviews...');
const CRON_SECRET = 'ash-cron-c150b513455e8ea77f9862f16b228bea';
const res = await fetch('https://ash-reviews.vercel.app/api/cron/post-reviews', {
  headers: { Authorization: `Bearer ${CRON_SECRET}` }
});

const data = await res.json();
console.log(`\nResult: ${data.message}`);
console.log(`Posted: ${data.posted}, Failed: ${data.failed}`);
if (data.results?.length > 0) {
  data.results.forEach(r => {
    console.log(`  - ${r.productName}: ${r.success ? '✓' : '✗ ' + r.error}`);
  });
}
