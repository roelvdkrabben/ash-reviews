import { auth } from '@/lib/auth'
import { DashboardContent } from './DashboardContent'

export default async function DashboardPage() {
  const session = await auth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welkom, {session?.user?.email}</p>
      </div>

      <DashboardContent />
    </div>
  )
}
