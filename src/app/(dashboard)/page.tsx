import { auth } from '@/lib/auth'

export default async function DashboardPage() {
  const session = await auth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welkom, {session?.user?.email}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Shops</div>
          <div className="mt-1 text-3xl font-semibold text-gray-900">0</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Producten</div>
          <div className="mt-1 text-3xl font-semibold text-gray-900">0</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Reviews (pending)</div>
          <div className="mt-1 text-3xl font-semibold text-yellow-600">0</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Reviews (gepost)</div>
          <div className="mt-1 text-3xl font-semibold text-green-600">0</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Snelle acties</h2>
        <div className="flex flex-wrap gap-4">
          <a
            href="/shops"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Shop toevoegen
          </a>
          <a
            href="/reviews"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Reviews bekijken
          </a>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recente activiteit</h2>
        <p className="text-gray-500 text-sm">Geen recente activiteit</p>
      </div>
    </div>
  )
}
