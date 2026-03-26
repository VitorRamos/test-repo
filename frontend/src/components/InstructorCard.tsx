import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import type { Availability, BookedSlot, Instructor, Review } from "../types"
import { api } from "../services/api"
import { useAuth } from "../context/AuthContext"
import "./InstructorCard.css"

interface InstructorCardProps {
  instructor: Instructor
}

export function InstructorCard({ instructor }: InstructorCardProps) {
  const rating = instructor.rating.toFixed(1)
  const { user } = useAuth()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [durationHours, setDurationHours] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [showReviews, setShowReviews] = useState(false)
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState("")
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [availabilityData, setAvailabilityData] = useState<Availability[]>([])
  const [bookedData, setBookedData] = useState<BookedSlot[]>([])

  const handleOpenForm = () => {
    setMessage(null)
    setError(null)

    if (!user) {
      navigate("/login")
      return
    }

    if (user.role !== "student") {
      setError("Apenas alunos podem agendar aulas.")
      return
    }

    setShowForm((prev) => !prev)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedSlot) {
      setError("Selecione uma data e horário.")
      return
    }

    setSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      const lesson = await api.lessons.book({
        instructor_id: instructor.id,
        scheduled_start: selectedSlot,
        duration_hours: durationHours
      })

      setMessage(
        `Agendamento enviado! Aguarde a confirmação do instrutor. Total: R$ ${lesson.total_price.toFixed(2)}`
      )
      setShowForm(false)
      setSelectedSlot("")
      setDurationHours(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao agendar a aula.")
    } finally {
      setSubmitting(false)
    }
  }

  const formatLocalDateTime = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, "0")
    const yyyy = date.getFullYear()
    const mm = pad(date.getMonth() + 1)
    const dd = pad(date.getDate())
    const hh = pad(date.getHours())
    const min = pad(date.getMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`
  }

  const parseTime = (value: string) => {
    const match = value.match(/^(\d{2}):(\d{2})/)
    if (!match) return null
    return [Number(match[1]), Number(match[2])]
  }

  const generateSlots = (
    availability: Availability[],
    booked: BookedSlot[],
    duration: number
  ) => {
    const slots: string[] = []
    const now = new Date()
    const daysToShow = 14

    for (let i = 0; i < daysToShow; i += 1) {
      const date = new Date(now)
      date.setDate(now.getDate() + i)
      const weekday = date.getDay()
      const daySlots = availability.filter((slot) => Number(slot.weekday) === weekday)

      daySlots.forEach((slot) => {
        const startParts = parseTime(slot.start_time)
        const endParts = parseTime(slot.end_time)
        if (!startParts || !endParts) {
          return
        }
        const [startHour, startMinute] = startParts
        const [endHour, endMinute] = endParts
        const start = new Date(date)
        start.setHours(startHour, startMinute, 0, 0)
        const end = new Date(date)
        end.setHours(endHour, endMinute, 0, 0)

        let cursor = new Date(start)
        while (cursor.getTime() + duration * 60 * 60 * 1000 <= end.getTime()) {
          const candidateStart = new Date(cursor)
          const candidateEnd = new Date(cursor.getTime() + duration * 60 * 60 * 1000)

          const overlaps = booked.some((b) => {
            const bStart = new Date(b.scheduled_start)
            const bEnd = new Date(b.scheduled_end)
            return candidateStart < bEnd && candidateEnd > bStart
          })

          if (!overlaps && candidateStart > now) {
            slots.push(formatLocalDateTime(candidateStart))
          }
          cursor = new Date(cursor.getTime() + 60 * 60 * 1000)
        }
      })
    }

    return slots
  }

  const loadSlots = async () => {
    setLoadingSlots(true)
    try {
      const [availability, booked] = await Promise.all([
        api.instructors.getPublicAvailability(instructor.id),
        api.lessons.getBookedForInstructor(instructor.id)
      ])
      const availabilityList = availability || []
      const bookedList = booked || []
      setAvailabilityData(availabilityList)
      setBookedData(bookedList)
      const slots = generateSlots(availabilityList, bookedList, durationHours)
      setAvailableSlots(slots)
      if (slots.length > 0) {
        setSelectedSlot(slots[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar horários.")
    } finally {
      setLoadingSlots(false)
    }
  }

  useEffect(() => {
    if (!showForm) return
    const slots = generateSlots(availabilityData, bookedData, durationHours)
    setAvailableSlots(slots)
    if (slots.length > 0) {
      setSelectedSlot(slots[0])
    } else {
      setSelectedSlot("")
    }
  }, [durationHours, showForm, availabilityData, bookedData])

  const toggleReviews = async () => {
    if (showReviews) {
      setShowReviews(false)
      return
    }
    setLoadingReviews(true)
    try {
      const data = await api.reviews.getPublicByInstructor(instructor.id)
      setReviews(data || [])
      setShowReviews(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar avaliações.")
    } finally {
      setLoadingReviews(false)
    }
  }

  const toggleForm = async () => {
    if (!user) {
      handleOpenForm()
      return
    }
    if (user.role !== "student") {
      handleOpenForm()
      return
    }
    const nextShow = !showForm
    setShowForm(nextShow)
    if (nextShow) {
      await loadSlots()
    }
  }

  return (
    <div className="instructor-card">
      <div className="instructor-header">
        <h3>{instructor.name}</h3>
        <div className="instructor-rating">
          <span className="stars">⭐</span>
          <span className="rating-value">{rating}</span>
          <span className="lesson-count">({instructor.total_lessons} aulas)</span>
        </div>
      </div>

      <div className="instructor-location">
        📍 {instructor.city}, {instructor.state}
      </div>

      <div className="instructor-license">
        <span className="license-label">Licença:</span>
        <span className="license-value">{instructor.detran_license}</span>
      </div>

      <div className="instructor-bio">
        {instructor.bio || "Sem bio disponível"}
      </div>

      <div className="instructor-footer">
        <div className="price">
          <span className="price-label">Preço por hora:</span>
          <span className="price-value">R$ {instructor.price_per_hour.toFixed(2)}</span>
        </div>
        <div className="card-actions">
          <button className="book-btn" onClick={toggleForm}>
            Agendar Aula
          </button>
          <button className="secondary-btn" onClick={toggleReviews} disabled={loadingReviews}>
            {loadingReviews ? "Carregando..." : showReviews ? "Ocultar Avaliações" : "Ver Avaliações"}
          </button>
        </div>
      </div>

      {error && <div className="booking-error">{error}</div>}
      {message && <div className="booking-success">{message}</div>}

      {showForm && (
        <form className="booking-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor={`start-${instructor.id}`}>Data e horário</label>
            <select
              id={`start-${instructor.id}`}
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              required
              disabled={loadingSlots}
            >
              {availableSlots.length === 0 ? (
                <option value="">Nenhum horário disponível</option>
              ) : (
                availableSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {new Date(slot).toLocaleString("pt-BR")}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor={`duration-${instructor.id}`}>Duração (horas)</label>
            <input
              id={`duration-${instructor.id}`}
              type="number"
              min={1}
              max={8}
              step={1}
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              required
            />
          </div>
          <button className="book-btn" type="submit" disabled={submitting}>
            {submitting ? "Agendando..." : "Confirmar Agendamento"}
          </button>
        </form>
      )}

      {showReviews && (
        <div className="reviews-panel">
          <h4>Avaliações Públicas</h4>
          {reviews.length === 0 ? (
            <p>Nenhuma avaliação pública ainda.</p>
          ) : (
            <div className="reviews-list">
              {reviews.slice(0, 3).map((review) => (
                <div key={review.id} className="review-item">
                  <div className="review-header">
                    <span>⭐ {review.rating.toFixed(1)}</span>
                    <span>{new Date(review.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  {review.comment && <p>{review.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
