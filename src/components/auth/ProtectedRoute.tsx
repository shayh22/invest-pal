import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { SetupNotice } from '@/components/SetupNotice'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute() {
  const { configured, loading, user } = useAuth()
  const location = useLocation()

  if (!configured) {
    return <SetupNotice />
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
