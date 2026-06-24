export interface User {
  id: string
  email: string
  role: "student" | "instructor" | "admin"
}

export interface Instructor {
  id: string
  user_id: string
  name: string
  cpf: string
  detran_license: string
  price_per_hour: number
  bio?: string
  rating: number
  total_lessons: number
  city: string
  state: string
  created_at: string
  active: boolean
  photo_url?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface AuthResponse {
  access_token: string
  token_type: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface Lesson {
  id: string
  student_id: string
  instructor_id: string
  scheduled_start: string
  scheduled_end: string
  hour_price: number
  total_price: number
  status: string
  confirmation_code: string | null
  code_confirmed_at: string | null
  code_confirmed_by_instructor: boolean
  student_name?: string | null
  student_email?: string | null
  instructor_name?: string | null
  has_review?: boolean
  review_rating?: number | null
  review_comment?: string | null
  review_is_public?: boolean | null
  created_at: string
}

export interface Review {
  id: string
  lesson_id: string
  student_id: string
  instructor_id: string
  rating: number
  comment?: string | null
  student_email?: string | null
  is_public?: boolean
  created_at: string
}

export interface Availability {
  id: string
  instructor_id: string
  weekday: number
  start_date: string | null
  end_date: string | null
  weekdays: number[]
  start_time: string
  end_time: string
  created_at: string
}

export interface AvailableDay {
  date: string
  slots: string[]
}
