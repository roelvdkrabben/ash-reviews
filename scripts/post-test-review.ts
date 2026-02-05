/**
 * Post a single approved review to Lightspeed
 */

import { db } from '../src/lib/db';
import { reviews, products, shops } from '../src/lib/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { createLightspeedClient } from '../src/lib/lightspeed';

async function postTestReview() {
  console.log('\n🔍 Finding a review to post...\n');

  // Find an approved or pending review with a product that has an external_id
  const result = await db
    .select({
      review: reviews,
      product: products,
      shop: shops
    })
    .from(reviews)
    .innerJoin(products, eq(reviews.productId, products.id))
    .innerJoin(shops, eq(reviews.shopId, shops.id))
    .where(
      and(
        eq(reviews.status, 'approved'),
        isNotNull(products.externalId),
        isNotNull(shops.lightspeedApiKey)
      )
    )
    .limit(1);

  if (result.length === 0) {
    // Try pending if no approved
    const pendingResult = await db
      .select({
        review: reviews,
        product: products,
        shop: shops
      })
      .from(reviews)
      .innerJoin(products, eq(reviews.productId, products.id))
      .innerJoin(shops, eq(reviews.shopId, shops.id))
      .where(
        and(
          eq(reviews.status, 'pending'),
          isNotNull(products.externalId),
          isNotNull(shops.lightspeedApiKey)
        )
      )
      .limit(1);

    if (pendingResult.length === 0) {
      console.log('❌ No postable reviews found');
      process.exit(1);
    }

    result.push(pendingResult[0]);
    console.log('ℹ️  Using pending review (no approved found)');
  }

  const { review, product, shop } = result[0];

  console.log('Found review:');
  console.log(`  ID: ${review.id}`);
  console.log(`  Status: ${review.status}`);
  console.log(`  Reviewer: ${review.reviewerName}`);
  console.log(`  Rating: ${review.rating}⭐`);
  console.log(`  Content: ${review.content?.substring(0, 100)}...`);
  
  console.log(`\n📦 Product: ${product.name}`);
  console.log(`  Lightspeed ID: ${product.externalId}`);
  
  console.log(`\n🏪 Shop: ${shop.name}`);
  console.log(`  Domain: ${shop.domain}`);

  // Create Lightspeed client
  console.log('\n📤 Posting to Lightspeed...');
  
  const client = createLightspeedClient(
    shop.lightspeedApiKey!,
    shop.lightspeedApiSecret!
  );

  // Get customer ID from shop settings
  const settings = shop.settings as Record<string, unknown> || {};
  const customerId = settings.reviewCustomerId as number | undefined;
  
  if (!customerId) {
    console.log('❌ No reviewCustomerId in shop settings. Run setup-review-customer.ts first.');
    process.exit(1);
  }
  
  console.log(`  Using customer ID: ${customerId}`);

  try {
    const lightspeedReview = await client.createReview(
      parseInt(product.externalId),
      {
        score: review.rating,
        name: review.reviewerName,
        content: review.content,
        isVisible: true,
        customerId: customerId
      }
    );

    console.log('\n✅ Review posted successfully!');
    console.log(`  Lightspeed Review ID: ${lightspeedReview.id}`);

    // Update review status
    await db
      .update(reviews)
      .set({
        status: 'posted',
        postedAt: new Date(),
        externalId: lightspeedReview.id.toString(),
        updatedAt: new Date()
      })
      .where(eq(reviews.id, review.id));

    console.log('  Database updated to "posted"');

    // Construct URL
    const productUrl = `https://${shop.domain}/product/${product.externalId}`;
    console.log('\n🔗 Check it here:');
    console.log(`  ${productUrl}`);

  } catch (error: any) {
    console.error('\n❌ Error posting review:', error.message);
    if (error.response) {
      console.error('  Response:', error.response);
    }
    process.exit(1);
  }

  process.exit(0);
}

postTestReview().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
