import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { shops } from '@/lib/schema'
import { eq } from 'drizzle-orm'

// Test Lightspeed API connection
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    
    // Get shop with credentials
    const [shop] = await db.select().from(shops).where(eq(shops.id, id))
    
    if (!shop) {
      return NextResponse.json({ 
        success: false, 
        message: 'Shop niet gevonden' 
      }, { status: 404 })
    }

    if (!shop.lightspeedApiKey || !shop.lightspeedApiSecret) {
      return NextResponse.json({ 
        success: false, 
        message: 'API credentials niet geconfigureerd' 
      })
    }

    // Lightspeed eCom API uses Basic Auth with key:secret
    // API endpoint format: https://api.webshopapp.com/{language}/
    // The shop slug is needed as cluster in the URL
    
    // Try to get shop info as a simple test
    const apiUrl = `https://api.webshopapp.com/nl/shop.json`
    
    const credentials = Buffer.from(
      `${shop.lightspeedApiKey}:${shop.lightspeedApiSecret}`
    ).toString('base64')

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Lightspeed API error:', response.status, errorText)
      
      if (response.status === 401) {
        return NextResponse.json({
          success: false,
          message: 'Ongeldige API credentials - controleer je API key en secret',
        })
      }
      
      if (response.status === 403) {
        return NextResponse.json({
          success: false,
          message: 'Geen toegang - controleer API permissies in Lightspeed',
        })
      }
      
      if (response.status === 429) {
        return NextResponse.json({
          success: false,
          message: 'Rate limit bereikt - probeer later opnieuw',
        })
      }

      return NextResponse.json({
        success: false,
        message: `API error: ${response.status} ${response.statusText}`,
      })
    }

    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      message: `Verbonden met: ${data.shop?.name || shop.name}`,
      data: {
        shopName: data.shop?.name,
        shopId: data.shop?.id,
        country: data.shop?.country?.code,
      },
    })
  } catch (error) {
    console.error('Error testing Lightspeed API:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        return NextResponse.json({
          success: false,
          message: 'Kan geen verbinding maken met Lightspeed API',
        })
      }
    }
    
    return NextResponse.json({
      success: false,
      message: 'Onbekende fout bij API test',
    })
  }
}
