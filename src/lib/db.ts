import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// Throw clear error if DATABASE_URL is missing at runtime
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL environment variable is required. ' +
    'Please set it in your .env.local file or deployment environment.'
  )
}

const sql = neon(process.env.DATABASE_URL)
export const db = drizzle(sql, { schema })
