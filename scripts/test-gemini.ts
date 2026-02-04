import { readFileSync } from 'fs'
import { join } from 'path'

// Load .env.local
const envPath = join(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    process.env[match[1].trim()] = match[2].trim()
  }
}

import { GoogleGenerativeAI } from '@google/generative-ai'

async function main() {
  const apiKey = process.env.GEMINI_API_KEY
  console.log('API Key:', apiKey ? apiKey.substring(0, 15) + '...' : 'NOT SET')
  
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found')
    process.exit(1)
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    
    console.log('Testing Gemini API...')
    const result = await model.generateContent('Zeg "Hallo!" in het Nederlands')
    const text = result.response.text()
    
    console.log('✅ Gemini response:', text)
  } catch (error) {
    console.error('❌ Gemini error:', error)
  }
}

main()
