import { db } from '@/lib/db'
import { shops } from '@/lib/schema'
import { desc } from 'drizzle-orm'
import Link from 'next/link'

// Disable caching for this page
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ShopsPage() {
  let shopList: typeof shops.$inferSelect[] = []
  let error: string | null = null

  try {
    shopList = await db.select().from(shops).orderBy(desc(shops.createdAt))
  } catch (e) {
    error = e instanceof Error ? e.message : 'Onbekende fout'
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shops</h1>
          <p className="text-gray-600 mt-1">Beheer je aangesloten webshops</p>
        </div>
        <Link
          href="/shops/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          + Nieuwe shop
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Fout bij laden: {error}
        </div>
      )}

      {!error && shopList.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Geen shops</h3>
          <p className="text-gray-500 mb-4">Begin met het toevoegen van je eerste webshop.</p>
          <Link
            href="/shops/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Eerste shop toevoegen
          </Link>
        </div>
      )}

      {shopList.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shop
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domein
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  API Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shopList.map((shop) => (
                <tr key={shop.id} className="hover:bg-gray-50 group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/shops/${shop.id}`} className="block">
                      <div className="font-medium text-gray-900 group-hover:text-blue-600">{shop.name}</div>
                      <div className="text-sm text-gray-500">{shop.slug}</div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <Link href={`/shops/${shop.id}`} className="block">
                      {shop.domain}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/shops/${shop.id}`} className="block">
                      {shop.lightspeedApiKey ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Geconfigureerd
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Niet geconfigureerd
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      href={`/shops/${shop.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Beheren →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
