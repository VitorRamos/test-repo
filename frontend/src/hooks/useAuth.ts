import { useState, useCallback } from "react"
import { storage } from "../utils/storage"
import { api } from "../services/api"
import type { User } from "../types"

export function useAuth() {
  const [user, setUser] = useState<User | null>(storage.getUser())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const register = useCallback(async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.auth.register(email, password)
      return response
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.auth.login(email, password)
      storage.setToken(response.access_token)

      // Fetch user data (you'd add this endpoint to the backend)
      const userData = { email, role: "student" }
      setUser(userData as User)
      storage.setUser(userData)

      return response
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    storage.clear()
    setUser(null)
  }, [])

  return {
    user,
    loading,
    error,
    register,
    login,
    logout,
    isAuthenticated: !!user
  }
}
