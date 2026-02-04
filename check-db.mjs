import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const shops = await sql`SELECT id, name, slug, domain FROM shops`;
console.log('Shops in database:', JSON.stringify(shops, null, 2));
