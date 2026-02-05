/**
 * Batch Generate Reviews
 * 
 * Run: cd ash-reviews && npx tsx scripts/batch-generate.ts [count]
 * Default: generates up to 10 reviews per shop
 */

import { db } from '../src/lib/db';
import { shops, products, reviews } from '../src/lib/schema';
import { eq, and } from 'drizzle-orm';
import { selectProductsAvoidingRecent } from '../src/lib/product-selector';
import { scheduleReviewsForShop, getGeneratedCountThisWeek } from '../src/lib/review-scheduler';
import { generateBatch, type GeneratedReview } from '../src/lib/review-generator';

async function batchGenerate(maxPerShop: number = 10) {
  console.log(`\n🚀 Starting batch review generation (max ${maxPerShop} per shop)...\n`);
  
  // Check API key
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not configured');
    process.exit(1);
  }

  // Get all shops with auto_generate enabled
  const autoShops = await db
    .select()
    .from(shops)
    .where(eq(shops.autoGenerate, 'true'));

  console.log(`Found ${autoShops.length} shops with auto-generate enabled\n`);

  let totalGenerated = 0;
  let totalScheduled = 0;

  for (const shop of autoShops) {
    console.log(`\n📦 Processing: ${shop.name}`);
    console.log('─'.repeat(40));

    // Calculate how many reviews needed this week
    const reviewsPerWeek = shop.reviewsPerWeek ?? 10;
    const generatedThisWeek = await getGeneratedCountThisWeek(shop.id);
    const needed = Math.min(maxPerShop, Math.max(0, reviewsPerWeek - generatedThisWeek));

    console.log(`  Week target: ${reviewsPerWeek}`);
    console.log(`  Already generated: ${generatedThisWeek}`);
    console.log(`  Will generate: ${needed}`);

    if (needed === 0) {
      console.log(`  ✅ Already at target for this week`);
      continue;
    }

    // Select products
    const selectedProducts = await selectProductsAvoidingRecent(shop.id, needed);
    
    if (selectedProducts.length === 0) {
      console.log(`  ⚠️  No suitable products found`);
      continue;
    }

    console.log(`  📋 Selected ${selectedProducts.length} products`);

    const generatedReviewIds: string[] = [];

    for (const selection of selectedProducts) {
      try {
        // Get product
        const [product] = await db
          .select()
          .from(products)
          .where(eq(products.id, selection.productId))
          .limit(1);

        if (!product) continue;

        // Get existing reviews for inspiration
        const existingReviews = await db
          .select({ content: reviews.content })
          .from(reviews)
          .where(
            and(
              eq(reviews.productId, product.id),
              eq(reviews.status, 'imported')
            )
          )
          .limit(5);

        // Generate
        const generated = await generateBatch(
          {
            product: {
              name: product.name,
              description: product.description || undefined,
              category: product.category || undefined,
              price: product.price ? parseFloat(product.price) : undefined,
            },
            shop: {
              name: shop.name,
              domain: shop.domain,
            },
            existingReviews: existingReviews.map(r => r.content),
          },
          1
        );

        if (generated.length === 0) {
          console.log(`    ❌ Failed: ${product.name}`);
          continue;
        }

        // Save
        const [savedReview] = await db
          .insert(reviews)
          .values({
            shopId: shop.id,
            productId: product.id,
            status: 'pending',
            reviewerName: generated[0].reviewerName,
            rating: generated[0].rating,
            title: generated[0].title,
            content: generated[0].content,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        generatedReviewIds.push(savedReview.id);
        console.log(`    ✅ ${product.name} → ${generated[0].reviewerName} (${generated[0].rating}⭐)`);
        totalGenerated++;

        // Rate limit
        await new Promise(r => setTimeout(r, 500));
      } catch (error) {
        console.error(`    ❌ Error for ${selection.productName}:`, error);
      }
    }

    // Schedule all generated reviews
    if (generatedReviewIds.length > 0) {
      await scheduleReviewsForShop(shop.id, generatedReviewIds);
      totalScheduled += generatedReviewIds.length;
      console.log(`  📅 Scheduled ${generatedReviewIds.length} reviews`);
    }
  }

  console.log(`\n${'═'.repeat(40)}`);
  console.log(`✅ Done! Generated: ${totalGenerated}, Scheduled: ${totalScheduled}`);
  console.log(`${'═'.repeat(40)}\n`);

  process.exit(0);
}

// Parse args
const count = parseInt(process.argv[2] || '10', 10);
batchGenerate(count).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
