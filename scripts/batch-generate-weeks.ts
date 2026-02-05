/**
 * Batch Generate Reviews for Multiple Weeks
 * 
 * Run: cd ash-reviews && npx tsx scripts/batch-generate-weeks.ts [weeks]
 * Default: 2 weeks
 * 
 * Includes rate limiting to avoid Gemini 429 errors
 */

import fs from 'fs';
import path from 'path';

// Load .env.local manually BEFORE any other imports
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value.replace(/^["']|["']$/g, '');
      }
    }
  }
}

const DELAY_BETWEEN_REVIEWS = 2000; // 2 seconds between API calls
const DELAY_BETWEEN_SHOPS = 5000;   // 5 seconds between shops

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function batchGenerateWeeks(weeks: number = 2) {
  // Dynamic imports after env is loaded
  const { db } = await import('../src/lib/db');
  const { shops, products, reviews } = await import('../src/lib/schema');
  const { eq, and } = await import('drizzle-orm');
  const { selectProductsAvoidingRecent } = await import('../src/lib/product-selector');
  const { scheduleReviewsForShop } = await import('../src/lib/review-scheduler');
  const { generateBatch } = await import('../src/lib/review-generator');

  console.log(`\n🚀 Generating reviews for ${weeks} weeks...\n`);
  
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
  let totalErrors = 0;

  for (const shop of autoShops) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`📦 ${shop.name}`);
    console.log(`${'═'.repeat(50)}`);

    const reviewsPerWeek = shop.reviewsPerWeek ?? 10;
    const targetTotal = reviewsPerWeek * weeks;

    // Count already scheduled reviews for the future
    const scheduledReviews = await db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.shopId, shop.id),
          eq(reviews.status, 'pending')
        )
      );

    const alreadyScheduled = scheduledReviews.length;
    const needed = Math.max(0, targetTotal - alreadyScheduled);

    console.log(`  Target for ${weeks} weeks: ${targetTotal}`);
    console.log(`  Already scheduled: ${alreadyScheduled}`);
    console.log(`  Need to generate: ${needed}`);

    if (needed === 0) {
      console.log(`  ✅ Already have enough scheduled!`);
      continue;
    }

    // Select products (get more than needed for variety)
    const selectedProducts = await selectProductsAvoidingRecent(shop.id, needed + 5);
    
    if (selectedProducts.length === 0) {
      console.log(`  ⚠️  No suitable products found`);
      continue;
    }

    console.log(`  📋 Selected ${selectedProducts.length} products`);
    console.log(`  ⏳ Generating with ${DELAY_BETWEEN_REVIEWS}ms delay between calls...\n`);

    const generatedReviewIds: string[] = [];
    let shopGenerated = 0;
    let shopErrors = 0;

    for (let i = 0; i < Math.min(needed, selectedProducts.length); i++) {
      const selection = selectedProducts[i];
      
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
          console.log(`    ❌ [${i + 1}/${needed}] Failed: ${product.name.substring(0, 40)}...`);
          shopErrors++;
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
        shopGenerated++;
        console.log(`    ✅ [${i + 1}/${needed}] ${generated[0].reviewerName} (${generated[0].rating}⭐) → ${product.name.substring(0, 30)}...`);

        // Rate limit delay
        await sleep(DELAY_BETWEEN_REVIEWS);

      } catch (error: any) {
        shopErrors++;
        if (error.status === 429) {
          console.log(`    ⚠️  Rate limited! Waiting 30 seconds...`);
          await sleep(30000);
          i--; // Retry this product
        } else {
          console.error(`    ❌ Error: ${error.message?.substring(0, 50) || 'Unknown'}`);
        }
      }
    }

    // Schedule all generated reviews
    if (generatedReviewIds.length > 0) {
      await scheduleReviewsForShop(shop.id, generatedReviewIds);
      console.log(`\n  📅 Scheduled ${generatedReviewIds.length} reviews`);
    }

    totalGenerated += shopGenerated;
    totalScheduled += generatedReviewIds.length;
    totalErrors += shopErrors;

    console.log(`  📊 Shop total: ${shopGenerated} generated, ${shopErrors} errors`);

    // Delay between shops
    if (autoShops.indexOf(shop) < autoShops.length - 1) {
      console.log(`\n  ⏳ Waiting ${DELAY_BETWEEN_SHOPS / 1000}s before next shop...`);
      await sleep(DELAY_BETWEEN_SHOPS);
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🎉 COMPLETE!`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`  Generated: ${totalGenerated}`);
  console.log(`  Scheduled: ${totalScheduled}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log(`${'═'.repeat(50)}\n`);

  process.exit(0);
}

// Parse args
const weeks = parseInt(process.argv[2] || '2', 10);
batchGenerateWeeks(weeks).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
