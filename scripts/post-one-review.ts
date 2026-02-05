/**
 * Post a single approved review to WooCommerce
 * 
 * Run: npx tsx scripts/post-one-review.ts [reviewId]
 * If no reviewId, posts the first approved review found
 */

import { db } from '../src/lib/db';
import { reviews, products, shops } from '../src/lib/schema';
import { eq, and } from 'drizzle-orm';

async function postOneReview(reviewId?: string) {
  console.log('\n🔍 Finding approved review...\n');

  // Find an approved review
  let reviewQuery = db
    .select()
    .from(reviews)
    .where(eq(reviews.status, 'approved'))
    .limit(1);

  if (reviewId) {
    reviewQuery = db
      .select()
      .from(reviews)
      .where(and(eq(reviews.id, reviewId), eq(reviews.status, 'approved')))
      .limit(1);
  }

  const [review] = await reviewQuery;

  if (!review) {
    console.log('❌ No approved review found');
    process.exit(1);
  }

  console.log('Found review:');
  console.log(`  ID: ${review.id}`);
  console.log(`  Reviewer: ${review.reviewerName}`);
  console.log(`  Rating: ${review.rating}⭐`);
  console.log(`  Title: ${review.title}`);
  console.log(`  Content: ${review.content?.substring(0, 100)}...`);

  // Get product
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, review.productId!))
    .limit(1);

  if (!product) {
    console.log('❌ Product not found');
    process.exit(1);
  }

  console.log(`\n📦 Product: ${product.name}`);
  console.log(`  URL: ${product.url}`);
  console.log(`  WooCommerce ID: ${product.woocommerceId}`);

  // Get shop
  const [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, review.shopId!))
    .limit(1);

  if (!shop) {
    console.log('❌ Shop not found');
    process.exit(1);
  }

  console.log(`\n🏪 Shop: ${shop.name}`);
  console.log(`  Domain: ${shop.domain}`);

  // Post to WooCommerce
  console.log('\n📤 Posting to WooCommerce...');

  const credentials = Buffer.from(
    `${shop.woocommerceKey}:${shop.woocommerceSecret}`
  ).toString('base64');

  const apiUrl = `https://${shop.domain}/wp-json/wc/v3/products/reviews`;

  const reviewData = {
    product_id: parseInt(product.woocommerceId!),
    review: review.content,
    reviewer: review.reviewerName,
    reviewer_email: `${review.reviewerName?.toLowerCase().replace(/[^a-z]/g, '')}@reviews.local`,
    rating: review.rating,
    verified: true,
    status: 'approved'
  };

  console.log('  API URL:', apiUrl);
  console.log('  Product ID:', reviewData.product_id);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reviewData)
    });

    const result = await response.json();

    if (!response.ok) {
      console.log('❌ WooCommerce error:', result);
      process.exit(1);
    }

    console.log('\n✅ Review posted successfully!');
    console.log('  WooCommerce Review ID:', result.id);

    // Update review status
    await db
      .update(reviews)
      .set({
        status: 'posted',
        postedAt: new Date(),
        woocommerceReviewId: result.id.toString(),
        updatedAt: new Date()
      })
      .where(eq(reviews.id, review.id));

    console.log('  Database updated to "posted"');

    console.log('\n🔗 Check it here:');
    console.log(`  ${product.url}`);
    console.log(`  ${product.url}#reviews`);

  } catch (error) {
    console.error('❌ Error posting review:', error);
    process.exit(1);
  }

  process.exit(0);
}

const reviewId = process.argv[2];
postOneReview(reviewId).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
