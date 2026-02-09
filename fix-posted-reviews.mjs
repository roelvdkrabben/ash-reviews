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

// Fix reviews that have external_id but status is 'failed'
// These were successfully posted to Lightspeed but DB update failed
const result = await sql`
  UPDATE reviews 
  SET status = 'posted', rejection_reason = NULL, updated_at = NOW()
  WHERE external_id IS NOT NULL 
    AND status = 'failed'
  RETURNING id, external_id, status
`;

console.log(`Fixed ${result.length} reviews:`);
console.table(result);
