/**
 * Review Scheduler Service
 * 
 * Determines when to schedule reviews based on shop settings:
 * - Active days (which days of the week)
 * - Time slots (start/end hours)
 * - Minimum hours between reviews
 */

import { db } from './db'
import { shops, reviews } from './schema'
import { eq, sql, and, gte, lte, isNotNull, asc } from 'drizzle-orm'

// Day name to number mapping (0 = Sunday, 1 = Monday, etc.)
const DAY_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

// Reverse mapping
const NUMBER_TO_DAY: Record<number, string> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
}

interface ShopScheduleSettings {
  activeDays: string[]
  timeSlotStart: string // "HH:MM"
  timeSlotEnd: string   // "HH:MM"
  minHoursBetween: number
}

/**
 * Get shop schedule settings
 */
async function getShopScheduleSettings(shopId: string): Promise<ShopScheduleSettings> {
  const [shop] = await db
    .select({
      activeDays: shops.activeDays,
      timeSlotStart: shops.timeSlotStart,
      timeSlotEnd: shops.timeSlotEnd,
      minHoursBetween: shops.minHoursBetween,
    })
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1)

  if (!shop) {
    throw new Error(`Shop not found: ${shopId}`)
  }

  return {
    activeDays: shop.activeDays ?? ['tue', 'wed', 'thu', 'sat'],
    timeSlotStart: shop.timeSlotStart ?? '09:00',
    timeSlotEnd: shop.timeSlotEnd ?? '21:00',
    minHoursBetween: shop.minHoursBetween ?? 4,
  }
}

/**
 * Parse time string "HH:MM" to hours and minutes
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return { hours: hours || 0, minutes: minutes || 0 }
}

/**
 * Get already scheduled reviews for a date range
 */
async function getScheduledReviewsInRange(
  shopId: string,
  startDate: Date,
  endDate: Date
): Promise<Date[]> {
  const scheduled = await db
    .select({ scheduledAt: reviews.scheduledAt })
    .from(reviews)
    .where(
      and(
        eq(reviews.shopId, shopId),
        isNotNull(reviews.scheduledAt),
        gte(reviews.scheduledAt, startDate),
        lte(reviews.scheduledAt, endDate)
      )
    )
    .orderBy(asc(reviews.scheduledAt))

  return scheduled
    .filter(r => r.scheduledAt !== null)
    .map(r => r.scheduledAt as Date)
}

/**
 * Check if a date/time is valid for scheduling
 */
function isValidSlot(
  dateTime: Date,
  settings: ShopScheduleSettings,
  scheduledTimes: Date[]
): boolean {
  // Check if day is active
  const dayName = NUMBER_TO_DAY[dateTime.getDay()]
  if (!settings.activeDays.includes(dayName)) {
    return false
  }

  // Check if time is within slot
  const { hours: startHour, minutes: startMin } = parseTime(settings.timeSlotStart)
  const { hours: endHour, minutes: endMin } = parseTime(settings.timeSlotEnd)
  
  const currentHour = dateTime.getHours()
  const currentMin = dateTime.getMinutes()
  
  const currentMinutes = currentHour * 60 + currentMin
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
    return false
  }

  // Check minimum hours between reviews
  const minMs = settings.minHoursBetween * 60 * 60 * 1000
  
  for (const scheduled of scheduledTimes) {
    const diff = Math.abs(dateTime.getTime() - scheduled.getTime())
    if (diff < minMs) {
      return false
    }
  }

  return true
}

/**
 * Find the next available time slot
 */
function findNextAvailableSlot(
  startFrom: Date,
  settings: ShopScheduleSettings,
  scheduledTimes: Date[],
  maxDaysAhead: number = 42 // 6 weeks ahead
): Date | null {
  const current = new Date(startFrom)
  const maxDate = new Date(startFrom)
  maxDate.setDate(maxDate.getDate() + maxDaysAhead)

  // Start from the beginning of the time slot
  const { hours: startHour, minutes: startMin } = parseTime(settings.timeSlotStart)
  
  while (current < maxDate) {
    // Check if this day is active
    const dayName = NUMBER_TO_DAY[current.getDay()]
    
    if (settings.activeDays.includes(dayName)) {
      // Try slots every 30 minutes within the time window
      const { hours: endHour, minutes: endMin } = parseTime(settings.timeSlotEnd)
      
      // If we're already past the start time, use current time + some buffer
      let startMinutes: number
      if (
        current.getHours() > startHour ||
        (current.getHours() === startHour && current.getMinutes() >= startMin)
      ) {
        // Start from current time, rounded to next 30min
        startMinutes = Math.ceil((current.getHours() * 60 + current.getMinutes()) / 30) * 30
      } else {
        // Start from time slot start
        startMinutes = startHour * 60 + startMin
      }
      
      const endMinutes = endHour * 60 + endMin

      for (let mins = startMinutes; mins < endMinutes; mins += 30) {
        const candidate = new Date(current)
        candidate.setHours(Math.floor(mins / 60), mins % 60, 0, 0)

        // Add some randomness (±15 minutes) to make times look natural
        const jitter = Math.floor(Math.random() * 30) - 15
        candidate.setMinutes(candidate.getMinutes() + jitter)

        // Check if this slot is valid
        if (isValidSlot(candidate, settings, scheduledTimes)) {
          return candidate
        }
      }
    }

    // Move to next day at start of time slot
    current.setDate(current.getDate() + 1)
    current.setHours(startHour, startMin, 0, 0)
  }

  return null
}

/**
 * Schedule reviews for a shop
 * 
 * @param shopId - The shop ID
 * @param reviewIds - Array of review IDs to schedule
 */
export async function scheduleReviewsForShop(
  shopId: string,
  reviewIds: string[]
): Promise<void> {
  if (reviewIds.length === 0) {
    console.log('[ReviewScheduler] No reviews to schedule')
    return
  }

  console.log(`[ReviewScheduler] Scheduling ${reviewIds.length} reviews for shop ${shopId}`)

  // Get shop settings
  const settings = await getShopScheduleSettings(shopId)
  console.log('[ReviewScheduler] Settings:', settings)

  // Get current week's scheduled reviews
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Start of week (Sunday)
  weekStart.setHours(0, 0, 0, 0)
  
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 49) // Look 7 weeks ahead
  weekEnd.setHours(23, 59, 59, 999)

  const existingScheduled = await getScheduledReviewsInRange(shopId, weekStart, weekEnd)
  console.log(`[ReviewScheduler] Found ${existingScheduled.length} already scheduled reviews`)

  // Track newly scheduled times
  const allScheduled = [...existingScheduled]

  // Find slots for each review
  for (const reviewId of reviewIds) {
    // Start looking from now (or next valid time)
    const searchStart = new Date()
    searchStart.setMinutes(searchStart.getMinutes() + 30) // At least 30 min from now

    const slot = findNextAvailableSlot(searchStart, settings, allScheduled)

    if (slot) {
      // Update review with scheduled time
      await db
        .update(reviews)
        .set({
          scheduledAt: slot,
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, reviewId))

      console.log(`[ReviewScheduler] Review ${reviewId} scheduled for ${slot.toISOString()}`)
      
      // Add to tracked times
      allScheduled.push(slot)
      allScheduled.sort((a, b) => a.getTime() - b.getTime())
    } else {
      console.log(`[ReviewScheduler] Could not find slot for review ${reviewId}`)
    }
  }
}

/**
 * Get count of reviews already scheduled for this week
 */
export async function getScheduledCountThisWeek(shopId: string): Promise<number> {
  const now = new Date()
  
  // Start of current week (Monday)
  const weekStart = new Date(now)
  const day = weekStart.getDay()
  const diff = day === 0 ? -6 : 1 - day // Adjust to Monday
  weekStart.setDate(weekStart.getDate() + diff)
  weekStart.setHours(0, 0, 0, 0)
  
  // End of current week (Sunday)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(reviews)
    .where(
      and(
        eq(reviews.shopId, shopId),
        isNotNull(reviews.scheduledAt),
        gte(reviews.scheduledAt, weekStart),
        lte(reviews.scheduledAt, weekEnd)
      )
    )

  return result[0]?.count ?? 0
}

/**
 * Get count of reviews already generated this week
 */
export async function getGeneratedCountThisWeek(shopId: string): Promise<number> {
  const now = new Date()
  
  // Start of current week (Monday)
  const weekStart = new Date(now)
  const day = weekStart.getDay()
  const diff = day === 0 ? -6 : 1 - day
  weekStart.setDate(weekStart.getDate() + diff)
  weekStart.setHours(0, 0, 0, 0)
  
  // End of current week (Sunday)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(reviews)
    .where(
      and(
        eq(reviews.shopId, shopId),
        sql`${reviews.status} != 'imported'`, // Don't count imported reviews
        gte(reviews.createdAt, weekStart),
        lte(reviews.createdAt, weekEnd)
      )
    )

  return result[0]?.count ?? 0
}
