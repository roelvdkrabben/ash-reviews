import { readFileSync } from 'fs'
import { join } from 'path'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Load .env.local
const envPath = join(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    process.env[match[1].trim()] = match[2].trim()
  }
}

async function testGemini() {
  console.log('=== Gemini API Test ===\n')
  
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in .env.local')
    process.exit(1)
  }
  
  console.log(`✅ Found GEMINI_API_KEY: ${apiKey.substring(0, 10)}...`)
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    
    // Test different models
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro']
    
    for (const modelName of models) {
      console.log(`\n--- Testing model: ${modelName} ---`)
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent('Zeg alleen "hallo" in het Nederlands')
        const text = result.response.text()
        console.log(`✅ ${modelName} works! Response: "${text.trim()}"`)
        break // Found working model
      } catch (e: any) {
        console.log(`❌ ${modelName} failed: ${e.message}`)
      }
    }
  } catch (e: any) {
    console.error(`\n❌ General error: ${e.message}`)
    if (e.message.includes('API_KEY')) {
      console.log('\n💡 The API key might be invalid or expired')
    }
  }
}

testGemini()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1) })
