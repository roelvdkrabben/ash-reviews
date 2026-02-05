/**
 * Queue-based Review Generator
 * 
 * Generates 1-2 reviews per run to avoid rate limits.
 * Run via cron every 5-10 minutes for gradual generation.
 * 
 * Usage: npx tsx scripts/generate-queue.ts [count]
 * Default: 1 review per run
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

// State file to track progress across runs
const STATE_FILE = path.join(process.cwd(), '.generation-queue-state.json');

interface QueueState {
  currentShopIndex: number;
  totalGenerated: number;
  lastRun: string;
  errors: number;
}

function loadState(): QueueState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {}
  return { currentShopIndex: 0, totalGenerated: 0, lastRun: '', errors: 0 };
}

function saveState(state: QueueState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function generateFromQueue(count: number = 1) {
  // Dynamic imports after env is loaded
  const { db } = await import('../src/lib/db');
  const { shops, products, reviews } = await import('../src/lib/schema');
  const { eq, and, sql } = await import('drizzle-orm');
  const { selectProductsAvoidingRecent } = await import('../src/lib/product-selector');
  const { scheduleReviewsForShop } = await import('../src/lib/review-scheduler');
  const { generateBatch } = await import('../src/lib/review-generator');

  const state = loadState();
  console.log(`\n🔄 Queue Generator - Run at ${new Date().toISOString()}`);
  console.log(`   State: shop ${state.currentShopIndex}, total generated: ${state.totalGenerated}\n`);

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

  // Round-robin through shops
  const shopIndex = state.currentShopIndex % autoShops.length;
  const shop = autoShops[shopIndex];

  console.log(`📦 Shop: ${shop.name} (${shopIndex + 1}/${autoShops.length})`);

  // Check how many reviews are needed
  const reviewsPerWeek = shop.reviewsPerWeek ?? 10;
  const targetWeeks = 3; // Always aim for 3 weeks ahead
  const targetTotal = reviewsPerWeek * targetWeeks;

  // Count pending reviews
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
  const needed = Math.max(0, targetTotal - pending);

  console.log(`   Target: ${targetTotal} (${targetWeeks} weeks × ${reviewsPerWeek}/week)`);
  console.log(`   Pending: ${pending}`);
  console.log(`   Needed: ${needed}`);

  if (needed === 0) {
    console.log(`   ✅ Shop has enough reviews scheduled!`);
    // Move to next shop
    state.currentShopIndex = (shopIndex + 1) % autoShops.length;
    state.lastRun = new Date().toISOString();
    saveState(state);
    console.log(`\n➡️  Next run will process: ${autoShops[state.currentShopIndex].name}`);
    process.exit(0);
  }

  // Select products
  const selectedProducts = await selectProductsAvoidingRecent(shop.id, count + 2);
  
  if (selectedProducts.length === 0) {
    console.log(`   ⚠️ No suitable products found`);
    state.currentShopIndex = (shopIndex + 1) % autoShops.length;
    saveState(state);
    process.exit(0);
  }

  let generated = 0;
  let errors = 0;

  for (let i = 0; i < Math.min(count, selectedProducts.length, needed); i++) {
    const selection = selectedProducts[i];
    
    try {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, selection.productId))
        .limit(1);

      if (!product) continue;

      console.log(`\n   🔄 Generating for: ${product.name.substring(0, 50)}...`);

      // Get existing reviews for context
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
        console.log(`   ❌ Generation failed`);
        errors++;
        continue;
      }

      // Save review
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

      // Schedule it
      await scheduleReviewsForShop(shop.id, [savedReview.id]);

      generated++;
      console.log(`   ✅ ${result[0].reviewerName} (${result[0].rating}⭐)`);

    } catch (error: any) {
      errors++;
      if (error.status === 429) {
        console.log(`   ⚠️ Rate limited - will retry next run`);
        break; // Stop this run, try again next time
      } else {
        console.error(`   ❌ Error: ${error.message?.substring(0, 80) || 'Unknown'}`);
      }
    }
  }

  // Update state
  state.totalGenerated += generated;
  state.errors += errors;
  state.lastRun = new Date().toISOString();
  
  // Move to next shop if we generated something, or on error
  if (generated > 0 || errors > 0) {
    state.currentShopIndex = (shopIndex + 1) % autoShops.length;
  }
  
  saveState(state);

  console.log(`\n📊 This run: ${generated} generated, ${errors} errors`);
  console.log(`📈 Total: ${state.totalGenerated} generated across all runs`);
  console.log(`➡️  Next shop: ${autoShops[state.currentShopIndex].name}`);
  
  process.exit(0);
}

// Parse args
const count = parseInt(process.argv[2] || '1', 10);
generateFromQueue(count).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
