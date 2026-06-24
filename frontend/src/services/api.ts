import { storage } from "../utils/storage"
import type { AvailableDay, Availability } from "../types"

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

    const text = await response.text()
    const parseJson = (value: string) => {
      try {
        return value ? JSON.parse(value) : null
      } catch {
        return null
      }
    }

    if (!response.ok) {
      const error = parseJson(text)
      let message = "Falha na requisição"

      if (error?.detail) {
        if (Array.isArray(error.detail)) {
          message = error.detail.map((e: any) => e.msg).join(", ")
        } else {
          message = error.detail
        }
      } else if (text) {
        message = text
      }

      throw new Error(message)
    }

    return parseJson(text)
  },

  auth: {
    me: async () => api.request("/auth/me", {
        method: "GET"
      }),

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

  lessons: {
    book: (data: { instructor_id: string; scheduled_start: string; duration_hours: number }) =>
      api.request("/lessons/book", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    bookBatch: (data: { instructor_id: string; scheduled_starts: string[]; duration_hours: number }) =>
      api.request("/lessons/book-batch", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    myBookings: () =>
      api.request("/lessons/my-bookings", { method: "GET" }).catch(() => []),
    confirmBooking: (lessonId: string) =>
      api.request(`/lessons/${lessonId}/confirm`, {
        method: "POST"
      }),
    confirmCode: (lessonId: string, code: string) =>
      api.request(`/lessons/${lessonId}/confirm-code`, {
        method: "POST",
        body: JSON.stringify({ code })
      }),
    cancelLesson: (lessonId: string) =>
      api.request(`/lessons/${lessonId}/cancel`, {
        method: "POST"
      }),
    clearCancelled: () =>
      api.request("/lessons/cancelled", {
        method: "DELETE"
      }) as Promise<{ deleted: number }>
  },
  reviews: {
    create: (data: { lesson_id: string; rating: number; comment?: string; is_public?: boolean }) =>
      api.request("/reviews/", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    getByInstructor: (instructorId: string) =>
      api.request(`/reviews/instructor/${instructorId}`, { method: "GET" }).catch(() => []),
    getByLesson: (lessonId: string) =>
      api.request(`/reviews/lesson/${lessonId}`, { method: "GET" }),
    getPublicByInstructor: (instructorId: string) =>
      api.request(`/reviews/public/${instructorId}`, { method: "GET" }).catch(() => [])
  },

  instructors: {
    become: (data: any) =>
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
      api.request(`/instructors/${id}`, { method: "GET" }),
    getAvailabilitySummary: (id: string) =>
      api.request(`/instructors/${id}/availability-summary`, { method: "GET" }),
    getAvailableSlots: (id: string, params: { duration_hours: number; date_from?: string; date_to?: string }) => {
      const query = new URLSearchParams({
        duration_hours: String(params.duration_hours)
      })
      if (params.date_from) query.append("date_from", params.date_from)
      if (params.date_to) query.append("date_to", params.date_to)
      return api.request(`/instructors/${id}/available-slots?${query.toString()}`, { method: "GET" }).catch(() => [] as AvailableDay[])
    },

    getStats: () =>
      api.request("/instructors/stats", { method: "GET" }).catch(() => ({
        instructor_id: "",
        total_lessons: 0,
        rating: 0,
        students_taught: 0,
        name: "Instrutor",
        city: "",
        state: "",
        price_per_hour: 0
      })),

    getEarnings: () =>
      api.request("/instructors/earnings", { method: "GET" }).catch(() => ({
        total_earnings: 0,
        pending_earnings: 0,
        completed_lessons: 0,
        total_lessons: 0
      })),

    getLessons: () =>
      api.request("/instructors/my-lessons", { method: "GET" }).catch(() => []),
    getAvailability: () =>
      api.request("/instructors/availability", { method: "GET" }).catch(() => [] as Availability[]),
    createAvailability: (data: {
      start_date: string
      end_date: string
      weekdays: number[]
      time_ranges: Array<{ start_time: string; end_time: string }>
    }) =>
      api.request("/instructors/availability", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    deleteAvailability: (id: string) =>
      api.request(`/instructors/availability/${id}`, { method: "DELETE" })
  }
}
