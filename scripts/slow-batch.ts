/**
 * Slow Batch Generator
 * 
 * Generates reviews with long pauses between each to avoid rate limits.
 * Runs until target is reached or manually stopped.
 * 
 * Usage: npx tsx scripts/slow-batch.ts [pauseMinutes] [totalReviews]
 * Default: 5 minute pause, 50 reviews total
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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

async function slowBatch(pauseMinutes: number = 5, totalTarget: number = 50) {
  // Dynamic imports after env is loaded
  const { db } = await import('../src/lib/db');
  const { shops, products, reviews } = await import('../src/lib/schema');
  const { eq, and, sql } = await import('drizzle-orm');
  const { selectProductsAvoidingRecent } = await import('../src/lib/product-selector');
  const { scheduleReviewsForShop } = await import('../src/lib/review-scheduler');
  const { generateBatch } = await import('../src/lib/review-generator');

  const pauseMs = pauseMinutes * 60 * 1000;

  console.log(`\n🐢 Slow Batch Generator`);
  console.log(`   Pause between reviews: ${pauseMinutes} minutes`);
  console.log(`   Target: ${totalTarget} reviews`);
  console.log(`   Estimated time: ${formatTime(pauseMs * totalTarget)}`);
  console.log(`   Press Ctrl+C to stop\n`);

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not configured');
    process.exit(1);
  }

  // Get all shops with auto_generate enabled
  const autoShops = await db
    .select()
    .from(shops)
    .where(eq(shops.autoGenerate, 'true'));

  if (autoShops.length === 0) {
    console.log('⚠️  No shops with auto-generate enabled');
    process.exit(0);
  }

  console.log(`📦 Found ${autoShops.length} shops: ${autoShops.map(s => s.name).join(', ')}\n`);

  let totalGenerated = 0;
  let totalErrors = 0;
  let shopIndex = 0;

  while (totalGenerated < totalTarget) {
    const shop = autoShops[shopIndex];
    
    // Check if shop needs reviews
    const reviewsPerWeek = shop.reviewsPerWeek ?? 10;
    const targetWeeks = 3;
    const shopTarget = reviewsPerWeek * targetWeeks;

    const [pendingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(
        and(
          eq(reviews.shopId, shop.id),
          eq(reviews.status, 'pending')
        )
      );

    const pending = Number(pendingCount?.count || 0);
    const needed = Math.max(0, shopTarget - pending);

    if (needed === 0) {
      console.log(`✅ ${shop.name}: heeft genoeg (${pending}/${shopTarget})`);
      shopIndex = (shopIndex + 1) % autoShops.length;
      
      // Check if all shops are done
      let allDone = true;
      for (const s of autoShops) {
        const [c] = await db
          .select({ count: sql<number>`count(*)` })
          .from(reviews)
          .where(and(eq(reviews.shopId, s.id), eq(reviews.status, 'pending')));
        const t = (s.reviewsPerWeek ?? 10) * 3;
        if (Number(c?.count || 0) < t) {
          allDone = false;
          break;
        }
      }
      if (allDone) {
        console.log(`\n🎉 Alle shops hebben genoeg reviews gepland!`);
        break;
      }
      continue;
    }

    // Select a product
    const selectedProducts = await selectProductsAvoidingRecent(shop.id, 3);
    
    if (selectedProducts.length === 0) {
      console.log(`⚠️  ${shop.name}: geen producten beschikbaar`);
      shopIndex = (shopIndex + 1) % autoShops.length;
      continue;
    }

    const selection = selectedProducts[0];

    try {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, selection.productId))
        .limit(1);

      if (!product) {
        shopIndex = (shopIndex + 1) % autoShops.length;
        continue;
      }

      const timestamp = new Date().toLocaleTimeString('nl-NL');
      console.log(`\n[${timestamp}] 🔄 ${shop.name}`);
      console.log(`   Product: ${product.name.substring(0, 60)}...`);

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

      const result = await generateBatch(
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

      if (result.length === 0) {
        console.log(`   ❌ Generatie mislukt`);
        totalErrors++;
      } else {
        const [savedReview] = await db
          .insert(reviews)
          .values({
            shopId: shop.id,
            productId: product.id,
            status: 'pending',
            reviewerName: result[0].reviewerName,
            rating: result[0].rating,
            title: result[0].title,
            content: result[0].content,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        await scheduleReviewsForShop(shop.id, [savedReview.id]);

        totalGenerated++;
        console.log(`   ✅ ${result[0].reviewerName} (${result[0].rating}⭐)`);
        console.log(`   📊 Progress: ${totalGenerated}/${totalTarget}`);
      }

    } catch (error: any) {
      totalErrors++;
      if (error.status === 429) {
        console.log(`   ⚠️ Rate limit! Extra pauze van 2 minuten...`);
        await sleep(120000); // Extra 2 minute wait on rate limit
      } else {
        console.error(`   ❌ Error: ${error.message?.substring(0, 60) || 'Unknown'}`);
      }
    }

    // Move to next shop (round-robin)
    shopIndex = (shopIndex + 1) % autoShops.length;

    // Pause before next review
    if (totalGenerated < totalTarget) {
      console.log(`   ⏳ Pauze ${pauseMinutes} minuten...`);
      await sleep(pauseMs);
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🎉 KLAAR!`);
  console.log(`   Gegenereerd: ${totalGenerated}`);
  console.log(`   Errors: ${totalErrors}`);
  console.log(`${'═'.repeat(50)}\n`);

  process.exit(0);
}

// Parse args
const pauseMinutes = parseInt(process.argv[2] || '5', 10);
const totalTarget = parseInt(process.argv[3] || '50', 10);
slowBatch(pauseMinutes, totalTarget).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
