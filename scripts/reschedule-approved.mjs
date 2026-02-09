#!/usr/bin/env node
/**
 * Reschedule all approved reviews with spread-out times
 */

import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_jSOW8Aw4yxQq@ep-mute-violet-agjxj45y-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require');

// Default schedule settings
const ACTIVE_DAYS = ['tue', 'wed', 'thu', 'sat']; // 2, 3, 4, 6
const TIME_START = 9; // 09:00
const TIME_END = 21;  // 21:00
const MIN_HOURS_BETWEEN = 4;

const DAY_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const ACTIVE_DAY_NUMS = ACTIVE_DAYS.map(d => DAY_MAP[d]);

function getRandomTime(date, startHour, endHour) {
  const hour = startHour + Math.floor(Math.random() * (endHour - startHour));
  const minute = Math.floor(Math.random() * 60);
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isActiveDay(date) {
  return ACTIVE_DAY_NUMS.includes(date.getDay());
}

function getNextActiveDay(from) {
  let date = new Date(from);
  date.setDate(date.getDate() + 1);
  while (!isActiveDay(date)) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

async function main() {
  console.log('=== Rescheduling approved reviews ===\n');
  
  // Get all approved reviews without scheduled_at, grouped by shop
  const reviews = await sql`
    SELECT r.id, r.shop_id, s.name as shop_name, s.reviews_per_week
    FROM reviews r
    JOIN shops s ON r.shop_id = s.id
    WHERE r.status = 'approved'
    AND r.scheduled_at IS NULL
    ORDER BY s.name, r.created_at
  `;
  
  console.log(`Found ${reviews.length} reviews to schedule\n`);
  
  if (reviews.length === 0) {
    console.log('Nothing to schedule!');
    return;
  }
  
  // Group by shop
  const byShop = {};
  for (const r of reviews) {
    if (!byShop[r.shop_id]) {
      byShop[r.shop_id] = { name: r.shop_name, reviewsPerWeek: r.reviews_per_week || 10, reviews: [] };
    }
    byShop[r.shop_id].reviews.push(r);
  }
  
  // Schedule each shop's reviews
  let totalScheduled = 0;
  
  for (const [shopId, shop] of Object.entries(byShop)) {
    console.log(`\n${shop.name}: ${shop.reviews.length} reviews`);
    console.log(`  Target: ${shop.reviewsPerWeek} reviews/week`);
    
    // Calculate reviews per active day
    const reviewsPerDay = Math.ceil(shop.reviewsPerWeek / ACTIVE_DAYS.length);
    console.log(`  Reviews per active day: ~${reviewsPerDay}`);
    
    // Start scheduling from tomorrow
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    // Find first active day
    if (!isActiveDay(currentDate)) {
      currentDate = getNextActiveDay(currentDate);
    } else {
      // If today is active but past posting time, start tomorrow
      const now = new Date();
      if (now.getHours() >= TIME_END - 2) {
        currentDate = getNextActiveDay(currentDate);
      }
    }
    
    let reviewsOnCurrentDay = 0;
    let lastScheduledTime = null;
    
    for (const review of shop.reviews) {
      // Move to next day if we've scheduled enough for this day
      if (reviewsOnCurrentDay >= reviewsPerDay) {
        currentDate = getNextActiveDay(currentDate);
        reviewsOnCurrentDay = 0;
        lastScheduledTime = null;
      }
      
      // Get a random time on this day
      let scheduledAt = getRandomTime(currentDate, TIME_START, TIME_END);
      
      // Ensure minimum hours between reviews
      if (lastScheduledTime) {
        const minTime = new Date(lastScheduledTime.getTime() + MIN_HOURS_BETWEEN * 60 * 60 * 1000);
        if (scheduledAt < minTime) {
          scheduledAt = new Date(minTime.getTime() + Math.floor(Math.random() * 30) * 60 * 1000);
        }
        
        // If this pushes us past end time, move to next day
        if (scheduledAt.getHours() >= TIME_END) {
          currentDate = getNextActiveDay(currentDate);
          reviewsOnCurrentDay = 0;
          lastScheduledTime = null;
          scheduledAt = getRandomTime(currentDate, TIME_START, TIME_END);
        }
      }
      
      // Update review
      await sql`
        UPDATE reviews
        SET scheduled_at = ${scheduledAt.toISOString()},
            updated_at = NOW()
        WHERE id = ${review.id}
      `;
      
      lastScheduledTime = scheduledAt;
      reviewsOnCurrentDay++;
      totalScheduled++;
    }
    
    // Show schedule preview
    const scheduled = await sql`
      SELECT DATE(scheduled_at) as date, COUNT(*) as count
      FROM reviews
      WHERE shop_id = ${shopId}
      AND status = 'approved'
      AND scheduled_at IS NOT NULL
      GROUP BY DATE(scheduled_at)
      ORDER BY date
      LIMIT 14
    `;
    
    console.log('  Schedule preview:');
    for (const s of scheduled) {
      const date = new Date(s.date);
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
      console.log(`    ${dayName} ${date.toISOString().split('T')[0]}: ${s.count} reviews`);
    }
  }
  
  console.log(`\n\n✅ Scheduled ${totalScheduled} reviews!`);
  console.log('Reviews will be posted automatically by the cron jobs.');
}

main().catch(console.error);
