import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function check() {
  const result = await sql`
    SELECT id, status, scheduled_at, reviewer_name, created_at 
    FROM reviews 
    ORDER BY created_at DESC 
    LIMIT 20
  `;
  
  console.log('Reviews in database:');
  for (const row of result) {
    console.log(`  ${row.reviewer_name || 'Unknown'} - status: ${row.status}, scheduled: ${row.scheduled_at || 'null'}`);
  }
  
  const counts = await sql`
    SELECT status, COUNT(*) as count 
    FROM reviews 
    GROUP BY status
  `;
  
  console.log('\nCounts by status:');
  for (const row of counts) {
    console.log(`  ${row.status}: ${row.count}`);
  }
}

check().catch(console.error);
