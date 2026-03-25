import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { storage } from "../utils/storage"
import { api } from "../services/api"
import type { User } from "../types"

interface AuthContextType {
  user: User | null
  loading: boolean
  error: string | null
  updateUser: () => Promise<void>
  register: (email: string, password: string) => Promise<any>
  login: (email: string, password: string) => Promise<any>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
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

      const userData = {
        email: response.email,
        role: response.role
      }
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

  const updateUser = useCallback(async () => {
  try {
    const data = await api.auth.me()
    const userData = {
      email: data.email,
      role: data.role
    }
    setUser(userData as User)
    storage.setUser(userData)
  } catch (err) {
    console.error("Failed to update user", err)
    logout() // optional: force logout if token invalid
  }
}, [logout])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        updateUser,
        register,
        login,
        logout,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
