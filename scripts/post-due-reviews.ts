import { db } from '../src/lib/db';
import { shops, products, reviews } from '../src/lib/schema';
import { eq, and, lte, isNotNull } from 'drizzle-orm';
import { createLightspeedClient } from '../src/lib/lightspeed';

async function postDueReviews() {
  const now = new Date();
  console.log('Checking for reviews due before:', now.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' }));

  // Find reviews ready to post
  const reviewsToPost = await db
    .select({
      review: reviews,
      product: products,
      shop: shops,
    })
    .from(reviews)
    .leftJoin(products, eq(reviews.productId, products.id))
    .leftJoin(shops, eq(reviews.shopId, shops.id))
    .where(
      and(
        eq(reviews.status, 'approved'),
        isNotNull(reviews.scheduledAt),
        lte(reviews.scheduledAt, now)
      )
    );

  console.log(`Found ${reviewsToPost.length} reviews ready to post`);

  if (reviewsToPost.length === 0) {
    console.log('Nothing to post');
    process.exit(0);
  }

  for (const { review, product, shop } of reviewsToPost) {
    if (!product || !shop) {
      console.log(`Skipping review ${review.id} - missing product or shop`);
      continue;
    }

    if (!shop.lightspeedApiKey || !shop.lightspeedApiSecret) {
      console.log(`Skipping review ${review.id} - shop missing Lightspeed credentials`);
      continue;
    }

    if (!product.externalId) {
      console.log(`Skipping review ${review.id} - product missing external ID`);
      continue;
    }

    console.log(`Posting review by ${review.reviewerName} for ${product.name}...`);

    try {
      const client = createLightspeedClient(
        shop.lightspeedApiKey,
        shop.lightspeedApiSecret,
        'nl'
      );

      const lightspeedReview = await client.createReview(
        parseInt(product.externalId, 10),
        {
          score: review.rating,
          name: review.reviewerName,
          content: review.content,
          isVisible: true,
        }
      );

      console.log(`✅ Posted! Lightspeed ID: ${lightspeedReview.id}`);

      // Update review status
      await db
        .update(reviews)
        .set({
          status: 'posted',
          postedAt: new Date(),
          externalId: String(lightspeedReview.id),
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, review.id));

    } catch (error) {
      console.error(`❌ Failed to post review ${review.id}:`, error);
      
      // Mark as failed
      await db
        .update(reviews)
        .set({
          status: 'failed',
          rejectionReason: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, review.id));
    }

    // Delay between posts
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('Done!');
  process.exit(0);
}

postDueReviews().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
