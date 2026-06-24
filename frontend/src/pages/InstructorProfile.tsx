import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { api } from "../services/api"
import { useAuth } from "../context/AuthContext"
import type { AvailableDay, Instructor, Review } /* + availability summary from API */ from "../types"
import "./InstructorProfile.css"

const today = new Date()
const formatDateInput = (value: Date) => value.toISOString().split("T")[0]

export function InstructorProfilePage() {
  const { instructorId = "" } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [instructor, setInstructor] = useState<Instructor | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [availableDays, setAvailableDays] = useState<AvailableDay[]>([])
  const [availabilityMeta, setAvailabilityMeta] = useState<{
    weekdays: number[]
    time_windows: { start_time: string; end_time: string }[]
    has_upcoming_slots: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadProfile = async () => {
      setLoading(true)
      setError(null)

      try {
        const [instructorData, reviewData, availabilityData, summaryData] = await Promise.all([
          api.instructors.getById(instructorId) as Promise<Instructor>,
          api.reviews.getPublicByInstructor(instructorId) as Promise<Review[]>,
          api.instructors.getAvailableSlots(instructorId, {
            duration_hours: 1,
            date_from: formatDateInput(today),
            date_to: formatDateInput(new Date(today.getTime() + 1000 * 60 * 60 * 24 * 13))
          }),
          api.instructors.getAvailabilitySummary(instructorId).catch(() => null) as Promise<any>
        ])

        if (cancelled) {
          return
        }

        setInstructor(instructorData)
        setReviews(reviewData || [])
        setAvailableDays(availabilityData || [])
        setAvailabilityMeta(summaryData || null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Falha ao carregar perfil do instrutor.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    if (!instructorId) {
      setError("Instrutor não encontrado.")
      setLoading(false)
      return
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [instructorId])

  const availabilitySummary = useMemo(
    () =>
      availableDays.slice(0, 6).map((day) => ({
        date: new Date(`${day.date}T12:00:00`),
        slots: day.slots
          .map((slot) =>
            new Date(slot).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit"
            })
          )
          .slice(0, 3),
        total: day.slots.length
      })),
    [availableDays]
  )

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate("/")
  }

  const handleStartBooking = () => {
    if (!user) {
      navigate("/login")
      return
    }

    if (user.role !== "student") {
      return
    }

    navigate(`/instructors/${instructorId}/book`)
  }

  if (loading) {
    return <div className="instructor-profile-page"><p>Carregando perfil do instrutor...</p></div>
  }

  if (!instructor) {
    return (
      <div className="instructor-profile-page">
        <div className="instructor-profile-card">
          <p>{error || "Instrutor não encontrado."}</p>
          <button type="button" className="instructor-profile-backlink" onClick={handleGoBack}>
            Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="instructor-profile-page">
      <div className="instructor-profile-card">
        <div className="instructor-profile-topbar">
          <button type="button" className="instructor-profile-backlink" onClick={handleGoBack}>
            Voltar
          </button>
          <div className="instructor-profile-actions">
            <button className="book-btn" onClick={handleStartBooking}>
              {user?.role === "student" ? "Agendar Aula" : "Entrar para agendar"}
            </button>
          </div>
        </div>

        <header className="instructor-profile-hero">
          <div className="instructor-profile-main">
            <p className="instructor-profile-kicker">Instrutor verificado</p>
            <h1>{instructor.name}</h1>
            <p className="instructor-profile-location">
              {instructor.city}, {instructor.state}
            </p>
            <p className="instructor-profile-bio">{instructor.bio || "Sem bio disponível."}</p>
          </div>

          <aside className="instructor-profile-summary">
            <div className="instructor-profile-stat">
              <span>Preço</span>
              <strong>R$ {instructor.price_per_hour.toFixed(2)}/h</strong>
            </div>
            <div className="instructor-profile-stat">
              <span>Avaliação</span>
              <strong>{instructor.rating.toFixed(1)} / 5</strong>
            </div>
            <div className="instructor-profile-stat">
              <span>Aulas registradas</span>
              <strong>{instructor.total_lessons}</strong>
            </div>
            <div className="instructor-profile-stat">
              <span>Licença DETRAN</span>
              <strong>{instructor.detran_license}</strong>
            </div>
          </aside>
        </header>

        {error && <p className="booking-error">{error}</p>}

        <section className="instructor-profile-section">
          <div className="instructor-profile-section-header">
            <h2>Próximos horários públicos</h2>
            <span>Resumo dos próximos 14 dias</span>
          </div>
          {availabilitySummary.length === 0 ? (
            <p className="instructor-profile-muted">Nenhum horário público encontrado no período.</p>
          ) : (
            <div className="instructor-availability-grid">
              {availabilitySummary.map((day) => (
                <div key={day.date.toISOString()} className="instructor-availability-card">
                  <strong>
                    {day.date.toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit"
                    })}
                  </strong>
                  <div className="instructor-availability-slots">
                    {day.slots.map((slot) => (
                      <span key={slot} className="instructor-availability-chip">{slot}</span>
                    ))}
                    {day.total > day.slots.length && (
                      <span className="instructor-availability-more">+{day.total - day.slots.length} horário(s)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="instructor-profile-section">
          <div className="instructor-profile-section-header">
            <h2>Avaliações públicas</h2>
            <span>
      {availabilityMeta && (
        <section className="instructor-profile-availability-summary" style={{ margin: "1rem 0" }}>
          <h3>Disponibilidade (resumo)</h3>
          <p style={{ fontSize: "0.9rem", color: "#475569" }}>
            Dias da semana:{" "}
            {availabilityMeta.weekdays.length
              ? availabilityMeta.weekdays
                  .map((d) => ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d] ?? d)
                  .join(", ")
              : "não informado"}
          </p>
          <p style={{ fontSize: "0.9rem", color: "#475569" }}>
            Janelas:{" "}
            {availabilityMeta.time_windows.length
              ? availabilityMeta.time_windows.map((w) => `${w.start_time}–${w.end_time}`).join(", ")
              : "não informado"}
          </p>
          <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
            {availabilityMeta.has_upcoming_slots
              ? "Há horários futuros disponíveis para agendamento."
              : "Sem horários futuros abertos no momento."}
          </p>
        </section>
      )}

      {reviews.length} avaliação(ões)</span>
          </div>
          {reviews.length === 0 ? (
            <p className="instructor-profile-muted">Ainda não há avaliações públicas para este instrutor.</p>
          ) : (
            <div className="instructor-review-list">
              {reviews.map((review) => (
                <article key={review.id} className="instructor-review-card">
                  <div className="instructor-review-header">
                    <strong>⭐ {review.rating.toFixed(1)}</strong>
                    <span>{new Date(review.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <p>{review.comment || "Aluno não deixou comentário."}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
