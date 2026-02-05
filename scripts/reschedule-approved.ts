import { db } from '../src/lib/db';
import { reviews } from '../src/lib/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { scheduleReviewsForShop } from '../src/lib/review-scheduler';

async function reschedule() {
  console.log('Finding unscheduled approved reviews...');
  
  // Find approved reviews without scheduledAt
  const unscheduled = await db
    .select()
    .from(reviews)
    .where(
      and(
        eq(reviews.status, 'approved'),
        isNull(reviews.scheduledAt)
      )
    );
  
  console.log(`Found ${unscheduled.length} unscheduled approved reviews`);
  
  if (unscheduled.length === 0) {
    console.log('Nothing to schedule');
    process.exit(0);
  }
  
  // Group by shop
  const byShop = new Map<string, string[]>();
  for (const r of unscheduled) {
    if (r.shopId) {
      const list = byShop.get(r.shopId) || [];
      list.push(r.id);
      byShop.set(r.shopId, list);
    }
  }
  
  // Schedule each shop's reviews
  for (const [shopId, ids] of byShop.entries()) {
    console.log(`Scheduling ${ids.length} reviews for shop ${shopId}...`);
    await scheduleReviewsForShop(shopId, ids);
  }
  
  // Show results
  const updated = await db
    .select({ id: reviews.id, scheduledAt: reviews.scheduledAt, reviewerName: reviews.reviewerName })
    .from(reviews)
    .where(eq(reviews.status, 'approved'));
  
  console.log('\nScheduled reviews:');
  for (const r of updated.filter(x => x.scheduledAt)) {
    console.log(`  ${r.reviewerName} → ${r.scheduledAt?.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}`);
  }
  
  console.log('\nDone!');
  process.exit(0);
}

reschedule().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
