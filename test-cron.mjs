// Test if cron endpoints work with the secret
const CRON_SECRET = 'ash-cron-c150b513455e8ea77f9862f16b228bea';

console.log('Testing post-reviews endpoint...\n');

const res = await fetch('https://ash-reviews.vercel.app/api/cron/post-reviews', {
  headers: { Authorization: `Bearer ${CRON_SECRET}` }
});

console.log(`Status: ${res.status} ${res.statusText}`);
const text = await res.text();
try {
  console.log('Response:', JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log('Response:', text.slice(0, 500));
}
