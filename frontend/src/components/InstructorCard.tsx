import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import type { AvailableDay, Instructor, Lesson, Review } from "../types"
import { api } from "../services/api"
import { useAuth } from "../context/AuthContext"
import "./InstructorCard.css"

const today = new Date()
const formatDateInput = (value: Date) => value.toISOString().split("T")[0]

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
  const [availableDays, setAvailableDays] = useState<AvailableDay[]>([])
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [dateRange, setDateRange] = useState({
    date_from: formatDateInput(today),
    date_to: formatDateInput(new Date(today.getTime() + 1000 * 60 * 60 * 24 * 21))
  })

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
    if (selectedSlots.length === 0) {
      setError("Selecione pelo menos uma data e horário.")
      return
    }

    setSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      const lessons = await api.lessons.bookBatch({
        instructor_id: instructor.id,
        scheduled_starts: selectedSlots,
        duration_hours: durationHours
      }) as Lesson[]

      setMessage(
        `Agendamentos enviados! ${lessons.length} aula(s) solicitada(s). Total: R$ ${lessons.reduce((sum, lesson) => sum + lesson.total_price, 0).toFixed(2)}`
      )
      setShowForm(false)
      setSelectedSlots([])
      setDurationHours(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao agendar a aula.")
    } finally {
      setSubmitting(false)
    }
  }

  const loadSlots = async () => {
    setLoadingSlots(true)
    try {
      const days = await api.instructors.getAvailableSlots(instructor.id, {
        duration_hours: durationHours,
        date_from: dateRange.date_from,
        date_to: dateRange.date_to
      })
      setAvailableDays(days)
      const validSlots = new Set(days.flatMap((day: AvailableDay) => day.slots))
      setSelectedSlots((prev) => prev.filter((slot) => validSlots.has(slot)))
      if (days.length > 0) {
        setSelectedDate(days[0].date)
      } else {
        setSelectedDate("")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar horários.")
    } finally {
      setLoadingSlots(false)
    }
  }

  useEffect(() => {
    if (!showForm) return
    void loadSlots()
  }, [durationHours, showForm, dateRange.date_from, dateRange.date_to])

  const slotsForSelectedDate =
    availableDays.find((day) => day.date === selectedDate)?.slots ?? []

  const toggleSlotSelection = (slot: string) => {
    setSelectedSlots((prev) =>
      prev.includes(slot)
        ? prev.filter((item) => item !== slot)
        : [...prev, slot].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    )
  }

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

      {message && <div className="booking-success">{message}</div>}

      {error && <div className="booking-error">{error}</div>}
      {showForm && (
        <form className="booking-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor={`date-from-${instructor.id}`}>Buscar entre datas</label>
            <div className="booking-range-inputs">
              <input
                id={`date-from-${instructor.id}`}
                type="date"
                value={dateRange.date_from}
                onChange={(e) => setDateRange((prev) => ({ ...prev, date_from: e.target.value }))}
              />
              <input
                type="date"
                value={dateRange.date_to}
                onChange={(e) => setDateRange((prev) => ({ ...prev, date_to: e.target.value }))}
              />
            </div>
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
          <div className="form-group">
            <label>Escolha um dia</label>
            {loadingSlots ? (
              <p className="booking-helper-text">Carregando calendário...</p>
            ) : availableDays.length === 0 ? (
              <p className="booking-helper-text">Nenhuma disponibilidade encontrada nesse período.</p>
            ) : (
              <div className="booking-day-grid">
                {availableDays.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    className={selectedDate === day.date ? "booking-day active" : "booking-day"}
                    onClick={() => {
                      setSelectedDate(day.date)
                    }}
                  >
                    <strong>{new Date(`${day.date}T00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</strong>
                    <span>{day.slots.length} horarios</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Escolha um horário</label>
            {slotsForSelectedDate.length === 0 ? (
              <p className="booking-helper-text">Selecione um dia para ver os horários.</p>
            ) : (
              <div className="booking-slot-grid">
                {slotsForSelectedDate.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className={selectedSlots.includes(slot) ? "booking-slot active" : "booking-slot"}
                    onClick={() => toggleSlotSelection(slot)}
                  >
                    {new Date(slot).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Horários selecionados</label>
            {selectedSlots.length === 0 ? (
              <p className="booking-helper-text">Nenhum horário selecionado.</p>
            ) : (
              <div className="selected-slot-list">
                {selectedSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className="selected-slot-chip"
                    onClick={() => toggleSlotSelection(slot)}
                  >
                    {new Date(slot).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="book-btn" type="submit" disabled={submitting}>
            {submitting
              ? "Agendando..."
              : selectedSlots.length > 0
                ? `Confirmar ${selectedSlots.length} agendamento${selectedSlots.length > 1 ? "s" : ""}`
                : "Confirmar agendamentos"}
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
