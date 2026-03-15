import { storage } from "../utils/storage"

const API_BASE = "/api"

export const api = {
  async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>)
    }

    const token = storage.getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Request failed")
    }

    return response.json()
  },

  auth: {
    register: (email: string, password: string) =>
      api.request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password })
      }),

    login: (email: string, password: string) => {
      const formData = new URLSearchParams()
      formData.append("username", email)
      formData.append("password", password)

      return api.request("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formData.toString()
      })
    }
  },

  instructors: {
    create: (data: any) =>
      api.request("/instructors/", {
        method: "POST",
        body: JSON.stringify(data)
      }),

    search: (filters?: any) => {
      const query = new URLSearchParams()
      if (filters?.city) query.append("city", filters.city)
      if (filters?.price_max) query.append("price_max", filters.price_max)
      if (filters?.rating_min) query.append("rating_min", filters.rating_min)

      const queryString = query.toString()
      return api.request(`/instructors/${queryString ? "?" + queryString : ""}`, {
        method: "GET"
      }).catch(() => [])
    },

    getById: (id: string) =>
      api.request(`/instructors/${id}`, { method: "GET" })
  }
}
