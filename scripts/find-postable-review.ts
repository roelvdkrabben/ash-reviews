import { db } from '../src/lib/db';
import { reviews, products, shops } from '../src/lib/schema';
import { eq, isNotNull, and, or } from 'drizzle-orm';

async function main() {
  // Find reviews with products that have WooCommerce IDs
  const results = await db
    .select({
      reviewId: reviews.id,
      status: reviews.status,
      reviewer: reviews.reviewerName,
      rating: reviews.rating,
      productName: products.name,
      productUrl: products.url,
      wooId: products.woocommerceId,
      shopName: shops.name,
      shopDomain: shops.domain
    })
    .from(reviews)
    .innerJoin(products, eq(reviews.productId, products.id))
    .innerJoin(shops, eq(reviews.shopId, shops.id))
    .where(
      and(
        or(
          eq(reviews.status, 'approved'),
          eq(reviews.status, 'pending')
        ),
        isNotNull(products.woocommerceId)
      )
    )
    .limit(10);

  console.log('Reviews with valid WooCommerce product data:\n');
  
  for (const r of results) {
    console.log('─'.repeat(60));
    console.log('Review ID:', r.reviewId);
    console.log('Status:', r.status);
    console.log('Reviewer:', r.reviewer, '(' + r.rating + '⭐)');
    console.log('Product:', r.productName);
    console.log('URL:', r.productUrl);
    console.log('WooCommerce ID:', r.wooId);
    console.log('Shop:', r.shopName, '(' + r.shopDomain + ')');
    console.log('');
  }
  
  if (results.length === 0) {
    console.log('❌ No reviews found with valid WooCommerce product data!');
    console.log('Products may need to be synced first.');
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
