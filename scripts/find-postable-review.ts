import { db } from '../src/lib/db';
import { reviews, products, shops } from '../src/lib/schema';
import { eq, and, or } from 'drizzle-orm';

async function main() {
  // Find reviews with products that are ready for posting
  const results = await db
    .select({
      reviewId: reviews.id,
      status: reviews.status,
      reviewer: reviews.reviewerName,
      rating: reviews.rating,
      productName: products.name,
      productExternalId: products.externalId,
      shopName: shops.name,
      shopDomain: shops.domain
    })
    .from(reviews)
    .innerJoin(products, eq(reviews.productId, products.id))
    .innerJoin(shops, eq(reviews.shopId, shops.id))
    .where(
      or(
        eq(reviews.status, 'approved'),
        eq(reviews.status, 'pending')
      )
    )
    .limit(10);

  console.log('Reviews ready for posting:\n');
  
  for (const r of results) {
    console.log('─'.repeat(60));
    console.log('Review ID:', r.reviewId);
    console.log('Status:', r.status);
    console.log('Reviewer:', r.reviewer, '(' + r.rating + '⭐)');
    console.log('Product:', r.productName);
    console.log('External ID:', r.productExternalId);
    console.log('Shop:', r.shopName, '(' + r.shopDomain + ')');
    console.log('');
  }
  
  if (results.length === 0) {
    console.log('❌ No reviews found ready for posting!');
    console.log('Generate some reviews first.');
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
