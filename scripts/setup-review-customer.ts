/**
 * Setup a generic "reviews" customer for each shop
 * This customer ID is used to post reviews via the Lightspeed API
 */

import { db } from '../src/lib/db';
import { shops } from '../src/lib/schema';
import { eq, isNotNull } from 'drizzle-orm';
import { createLightspeedClient } from '../src/lib/lightspeed';

async function setupReviewCustomers() {
  console.log('\n🔧 Setting up review customers for all shops...\n');

  const allShops = await db
    .select()
    .from(shops)
    .where(isNotNull(shops.lightspeedApiKey));

  for (const shop of allShops) {
    console.log(`\n📦 ${shop.name} (${shop.domain})`);
    console.log('─'.repeat(50));

    const client = createLightspeedClient(
      shop.lightspeedApiKey!,
      shop.lightspeedApiSecret!
    );

    try {
      // Check existing customers
      const customers = await client.getCustomers(250);
      console.log(`  Found ${customers.length} existing customers`);

      // Look for a "reviews" customer
      const reviewEmail = `reviews@${shop.domain}`;
      const existingReviewCustomer = customers.find(
        c => c.email.toLowerCase() === reviewEmail.toLowerCase() ||
             c.email.toLowerCase().includes('reviews@') ||
             c.firstname.toLowerCase().includes('review')
      );

      if (existingReviewCustomer) {
        console.log(`  ✅ Found existing review customer:`);
        console.log(`     ID: ${existingReviewCustomer.id}`);
        console.log(`     Email: ${existingReviewCustomer.email}`);
        console.log(`     Name: ${existingReviewCustomer.firstname} ${existingReviewCustomer.lastname}`);
        
        // Store in settings
        const currentSettings = (shop.settings as Record<string, unknown>) || {};
        await db.update(shops).set({
          settings: {
            ...currentSettings,
            reviewCustomerId: existingReviewCustomer.id
          }
        }).where(eq(shops.id, shop.id));
        console.log(`     Saved to shop settings`);
        
      } else {
        console.log(`  ℹ️  No review customer found, creating one...`);
        
        try {
          const newCustomer = await client.createCustomer(
            reviewEmail,
            'Klantreviews',
            shop.name
          );
          
          console.log(`  ✅ Created new customer:`);
          console.log(`     ID: ${newCustomer.id}`);
          console.log(`     Email: ${reviewEmail}`);
          
          // Store in settings
          const currentSettings = (shop.settings as Record<string, unknown>) || {};
          await db.update(shops).set({
            settings: {
              ...currentSettings,
              reviewCustomerId: newCustomer.id
            }
          }).where(eq(shops.id, shop.id));
          console.log(`     Saved to shop settings`);
          
        } catch (createError: any) {
          console.log(`  ⚠️  Could not create customer: ${createError.message}`);
          
          // Use first customer as fallback
          if (customers.length > 0) {
            console.log(`  Using first customer as fallback:`);
            console.log(`     ID: ${customers[0].id}`);
            console.log(`     Email: ${customers[0].email}`);
            
            const currentSettings = (shop.settings as Record<string, unknown>) || {};
            await db.update(shops).set({
              settings: {
                ...currentSettings,
                reviewCustomerId: customers[0].id
              }
            }).where(eq(shops.id, shop.id));
            console.log(`     Saved to shop settings`);
          }
        }
      }

    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }

  console.log('\n✅ Done!\n');
  process.exit(0);
}

setupReviewCustomers().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
