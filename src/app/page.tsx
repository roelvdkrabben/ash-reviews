import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardContent } from './(dashboard)/DashboardContent'
import Navbar from '@/components/Navbar'

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welkom, {session?.user?.email}</p>
          </div>
          <DashboardContent />
        </div>
      </main>
    </div>
  )
}
