import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateDutchName } from './names'

// Types
export interface ReviewInput {
  product: {
    name: string
    description?: string
    category?: string
    price?: number
  }
  shop: {
    name: string
    domain: string
  }
  existingReviews?: string[]
  targetRating?: number // 4 of 5
}

export interface GeneratedReview {
  reviewerName: string
  rating: number
  title: string
  content: string
}

// Initialize Gemini client
function getModel() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[ReviewGenerator] GEMINI_API_KEY is not set!')
    throw new Error('GEMINI_API_KEY environment variable is required')
  }
  console.log('[ReviewGenerator] Initializing Gemini with key:', apiKey.substring(0, 10) + '...')
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
}

// Build review generation prompt
function buildPrompt(input: ReviewInput, style: 'short' | 'medium' | 'long'): string {
  const { product, shop, existingReviews, targetRating } = input
  
  const rating = targetRating || (Math.random() > 0.3 ? 5 : 4)
  
  const lengthGuide = {
    short: '1-2 zinnen, bondig en to-the-point',
    medium: '3-4 zinnen, wat meer detail',
    long: '5-7 zinnen, uitgebreide ervaring'
  }

  const styleGuide = [
    'casual en vriendelijk, alsof je tegen een vriend praat',
    'wat formeler, zakelijk maar positief',
    'enthousiast, met uitroeptekens',
    'nuchter Nederlands, geen overdreven lovend',
    'praktisch, focus op gebruiksgemak'
  ]
  
  const randomStyle = styleGuide[Math.floor(Math.random() * styleGuide.length)]

  let prompt = `Je bent een Nederlandse consument die een product review schrijft. Schrijf een authentieke, geloofwaardige review.

**Product informatie:**
- Naam: ${product.name}
${product.description ? `- Beschrijving: ${product.description}` : ''}
${product.category ? `- Categorie: ${product.category}` : ''}
${product.price ? `- Prijs: €${product.price}` : ''}

**Shop context:**
- Webshop: ${shop.name} (${shop.domain})

**Review specificaties:**
- Rating: ${rating} van de 5 sterren
- Lengte: ${lengthGuide[style]}
- Schrijfstijl: ${randomStyle}

**Belangrijke regels:**
1. Schrijf in natuurlijk Nederlands, zoals echte klanten schrijven
2. Vermijd AI-achtige zinnen zoals "Ik ben zeer tevreden" of "Uitstekende kwaliteit"
3. Noem specifieke eigenschappen of ervaringen met het product
4. Kleine imperfecties in spelling/grammatica zijn OK (maar overdrijf niet)
5. Geen onnodige superlatieven
6. Geen vermelding van levertijd of verpakking tenzij relevant voor het product
7. Focus op het product zelf, niet op de webshop`

  if (existingReviews && existingReviews.length > 0) {
    prompt += `

**Inspiratie van bestaande reviews (gebruik als stijlreferentie, niet kopiëren):**
${existingReviews.slice(0, 3).map((r, i) => `${i + 1}. ${r}`).join('\n')}`
  }

  prompt += `

Geef je antwoord in exact dit JSON format (alleen JSON, geen andere tekst):
{
  "title": "Korte pakkende titel (max 50 karakters)",
  "content": "De review tekst",
  "rating": ${rating}
}`

  return prompt
}

/**
 * Genereer een enkele review
 */
export async function generateReview(input: ReviewInput): Promise<GeneratedReview> {
  const model = getModel()
  
  // Random style kiezen
  const styles: Array<'short' | 'medium' | 'long'> = ['short', 'medium', 'long']
  const weights = [0.3, 0.5, 0.2] // 30% kort, 50% medium, 20% lang
  const random = Math.random()
  let style: 'short' | 'medium' | 'long' = 'medium'
  
  if (random < weights[0]) {
    style = 'short'
  } else if (random < weights[0] + weights[1]) {
    style = 'medium'
  } else {
    style = 'long'
  }

  const prompt = buildPrompt(input, style)

  const result = await model.generateContent(prompt)
  const responseText = result.response.text()
  
  // Extract JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Could not parse review response as JSON')
  }

  const parsed = JSON.parse(jsonMatch[0])

  return {
    reviewerName: generateDutchName(),
    rating: parsed.rating || input.targetRating || 5,
    title: parsed.title || '',
    content: parsed.content || ''
  }
}

/**
 * Genereer meerdere reviews in batch
 */
export async function generateBatch(
  input: ReviewInput, 
  count: number
): Promise<GeneratedReview[]> {
  const reviews: GeneratedReview[] = []
  
  // Generate reviews sequentially to avoid rate limits
  // and ensure unique names
  const usedNames = new Set<string>()
  
  for (let i = 0; i < count; i++) {
    try {
      // Varieer de target rating wat
      const adjustedInput = {
        ...input,
        targetRating: input.targetRating || (Math.random() > 0.25 ? 5 : 4)
      }
      
      const review = await generateReview(adjustedInput)
      
      // Ensure unique name
      while (usedNames.has(review.reviewerName)) {
        review.reviewerName = generateDutchName()
      }
      usedNames.add(review.reviewerName)
      
      reviews.push(review)
      
      // Small delay between requests
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    } catch (error) {
      console.error(`Failed to generate review ${i + 1}:`, error)
      // Continue with remaining reviews
    }
  }
  
  return reviews
}

/**
 * Genereer reviews parallel (sneller maar kan rate limits raken)
 */
export async function generateBatchParallel(
  input: ReviewInput,
  count: number,
  concurrency: number = 3
): Promise<GeneratedReview[]> {
  const reviews: GeneratedReview[] = []
  const usedNames = new Set<string>()
  
  // Process in batches of concurrency
  for (let i = 0; i < count; i += concurrency) {
    const batchSize = Math.min(concurrency, count - i)
    const promises = Array.from({ length: batchSize }, () => {
      const adjustedInput = {
        ...input,
        targetRating: input.targetRating || (Math.random() > 0.25 ? 5 : 4)
      }
      return generateReview(adjustedInput)
    })
    
    const batchResults = await Promise.allSettled(promises)
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const review = result.value
        while (usedNames.has(review.reviewerName)) {
          review.reviewerName = generateDutchName()
        }
        usedNames.add(review.reviewerName)
        reviews.push(review)
      }
    }
    
    // Small delay between batches
    if (i + concurrency < count) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  return reviews
}
