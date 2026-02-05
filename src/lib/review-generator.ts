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
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
}

// Verschillende persona's voor variatie
const REVIEWER_PERSONAS = [
  {
    name: 'de_praktische',
    description: 'Een praktisch ingesteld persoon die focust op functionaliteit',
    style: 'Schrijf nuchter en to-the-point. Focus op of het product doet wat het moet doen.',
    example: 'Doet wat het moet doen. Past precies, goede kwaliteit.'
  },
  {
    name: 'de_techneut',
    description: 'Iemand die van specificaties en details houdt',
    style: 'Noem technische details of specificaties. Wees informatief voor andere kopers.',
    example: 'Capaciteit klopt met de specs. Laadt snel op, houdt goed z\'n spanning.'
  },
  {
    name: 'de_vergelijker',
    description: 'Iemand die dit product vergelijkt met vorige aankopen',
    style: 'Vergelijk kort met een vorig product of merk (zonder specifieke namen).',
    example: 'Beter dan m\'n vorige, gaat al 2 maanden mee zonder problemen.'
  },
  {
    name: 'de_scepticus',
    description: 'Iemand die eerst twijfelde maar overtuigd is',
    style: 'Begin met een kleine twijfel of zorg, eindig positief.',
    example: 'Was eerst niet zeker of dit zou passen, maar werkt perfect.'
  },
  {
    name: 'de_hobbyist',
    description: 'Iemand die het product voor een hobby/project gebruikt',
    style: 'Vertel kort waarvoor je het gebruikt. Wees specifiek over de toepassing.',
    example: 'Gebruik hem voor m\'n boot, prima accutje voor de buitenboordmotor.'
  },
  {
    name: 'de_herhaler',
    description: 'Iemand die vaker bij deze shop koopt',
    style: 'Hint dat je vaker hier koopt of dit merk vaker gebruikt.',
    example: 'Weer een goede aankoop hier. Derde keer dat ik dit merk neem.'
  },
  {
    name: 'de_minimalist',
    description: 'Iemand van weinig woorden',
    style: 'Extreem kort. Max 1-2 zinnen. Geen poespas.',
    example: 'Top. Precies wat ik zocht.'
  },
  {
    name: 'de_helper',
    description: 'Iemand die anderen wil helpen met de aankoop',
    style: 'Geef een tip of advies voor andere kopers.',
    example: 'Let op de maat, valt wat kleiner uit. Verder prima product.'
  }
]

// Build review generation prompt
function buildPrompt(input: ReviewInput, style: 'short' | 'medium' | 'long'): string {
  const { product, shop, existingReviews, targetRating } = input
  
  const rating = targetRating || (Math.random() > 0.3 ? 5 : 4)
  
  const lengthGuide = {
    short: '1-2 zinnen, bondig en to-the-point',
    medium: '2-3 zinnen, wat meer detail',
    long: '4-5 zinnen, uitgebreide ervaring'
  }

  // Kies random persona
  const persona = REVIEWER_PERSONAS[Math.floor(Math.random() * REVIEWER_PERSONAS.length)]

  let prompt = `Je schrijft een Nederlandse productreview vanuit het perspectief van: ${persona.description}

**Schrijfstijl:** ${persona.style}
**Voorbeeld van deze stijl:** "${persona.example}"

**Product:**
- ${product.name}
${product.description ? `- ${product.description}` : ''}
${product.category ? `- Categorie: ${product.category}` : ''}
${product.price ? `- Prijs: €${product.price}` : ''}

**Vereisten:**
- Rating: ${rating}/5 sterren
- Lengte: ${lengthGuide[style]}
- Taal: Natuurlijk Nederlands, zoals echte mensen schrijven
- GEEN uitroeptekens
- GEEN clichés als "zeer tevreden", "uitstekende kwaliteit", "aanrader"
- GEEN vermelding van bezorging/verpakking
- WEL: specifiek, geloofwaardig, menselijk`

  if (existingReviews && existingReviews.length > 0) {
    prompt += `

**Stijlreferentie (niet kopiëren):**
${existingReviews.slice(0, 2).map((r, i) => `- ${r.substring(0, 100)}...`).join('\n')}`
  }

  prompt += `

Antwoord ALLEEN in JSON:
{"title": "max 40 karakters", "content": "de review", "rating": ${rating}}`

  return prompt
}

/**
 * Genereer een enkele review
 */
export async function generateReview(input: ReviewInput): Promise<GeneratedReview> {
  const model = getModel()
  
  // Random style kiezen
  const styles: Array<'short' | 'medium' | 'long'> = ['short', 'medium', 'long']
  const weights = [0.45, 0.40, 0.15] // 45% kort, 40% medium, 15% lang
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
