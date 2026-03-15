import { Navigate } from "react-router-dom"
import type { User } from "../types"

interface ProtectedRouteProps {
  children: React.ReactNode
  user: User | null
  requiredRole?: string
}

export function ProtectedRoute({
  children,
  user,
  requiredRole
}: ProtectedRouteProps) {
  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
