import { useEffect, useMemo, useState } from "react"
import { api } from "../services/api"
import type { Lesson, User } from "../types"
import "./MyBookings.css"

interface MyBookingsProps {
  user: User | null
}

const statusLabels: Record<string, string> = {
  pending_instructor: "Aguardando confirmação do instrutor",
  confirmed: "Confirmada",
  pending_payment: "Aguardando pagamento",
  completed: "Concluída",
  cancelled: "Cancelada"
}

export function MyBookings({ user }: MyBookingsProps) {
  const [bookings, setBookings] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [instructorNames, setInstructorNames] = useState<Record<string, string>>({})
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [ratingInputs, setRatingInputs] = useState<Record<string, number>>({})
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [ratingSubmitting, setRatingSubmitting] = useState<string | null>(null)
  const [publicInputs, setPublicInputs] = useState<Record<string, boolean>>({})

  const sortedBookings = useMemo(() => {
    return [...bookings].sort(
      (a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime()
    )
  }, [bookings])

  useEffect(() => {
    loadBookings()
  }, [])

  const loadBookings = async () => {
    setLoading(true)
    setError(null)
    setActionMessage(null)
    try {
      const data = await api.lessons.myBookings()
      const lessons: Lesson[] = Array.isArray(data) ? (data as Lesson[]) : []
      setBookings(lessons)

      const fromPayload: Record<string, string> = {}
      lessons.forEach((lesson) => {
        if (lesson.instructor_name) {
          fromPayload[lesson.instructor_id] = lesson.instructor_name
        }
      })

      const missingIds = Array.from(
        new Set(
          lessons
            .filter((lesson) => !lesson.instructor_name)
            .map((lesson) => lesson.instructor_id)
        )
      )

      if (missingIds.length > 0) {
        const entries = await Promise.all(
          missingIds.map(async (id) => {
            const instructor = await api.instructors.getById(id)
            return [id, instructor.name] as const
          })
        )
        setInstructorNames({ ...fromPayload, ...Object.fromEntries(entries) })
      } else {
        setInstructorNames(fromPayload)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar agendamentos")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (lessonId: string) => {
    setCancellingId(lessonId)
    setError(null)
    setActionMessage(null)
    try {
      await api.lessons.cancelLesson(lessonId)
      setActionMessage("Agendamento cancelado com sucesso.")
      await loadBookings()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao cancelar agendamento")
    } finally {
      setCancellingId(null)
    }
  }

  const handleSubmitRating = async (lessonId: string) => {
    setRatingSubmitting(lessonId)
    setError(null)
    setActionMessage(null)
    try {
      const confirmSend = window.confirm("Enviar esta avaliação? Depois não será possível editar.")
      if (!confirmSend) {
        return
      }
      const rating = ratingInputs[lessonId] || 5
      const comment = commentInputs[lessonId]?.trim() || undefined
      const isPublic = publicInputs[lessonId] ?? true
      await api.reviews.create({ lesson_id: lessonId, rating, comment, is_public: isPublic })
      setActionMessage("Avaliação enviada com sucesso.")
      await loadBookings()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar avaliação")
    } finally {
      setRatingSubmitting(null)
    }
  }

  if (!user || user.role !== "student") {
    return <div className="bookings-container"><p>Acesso negado</p></div>
  }

  return (
    <div className="bookings-container">
      <h1>📅 Meus Agendamentos</h1>

      {loading ? (
        <p>Carregando agendamentos...</p>
      ) : (
        <>
          {error && <p className="booking-error">{error}</p>}
          {actionMessage && <p className="booking-success">{actionMessage}</p>}
          {sortedBookings.length === 0 ? (
            <p>Você ainda não possui agendamentos.</p>
          ) : (
            <div className="bookings-list">
              {sortedBookings.map((lesson) => {
                const start = new Date(lesson.scheduled_start)
                const end = new Date(lesson.scheduled_end)
                const durationHours =
                  Math.round((end.getTime() - start.getTime()) / 36e5 * 10) / 10

                return (
                  <div key={lesson.id} className="booking-card">
                    <div className="booking-header">
                      <div>
                        <strong>Instrutor:</strong>{" "}
                        {instructorNames[lesson.instructor_id] || "Carregando..."}
                      </div>
                      <span className="booking-status">
                        {statusLabels[lesson.status] || lesson.status}
                      </span>
                    </div>

                    <div className="booking-info">
                      <div>
                        <strong>Data:</strong> {start.toLocaleString("pt-BR")}
                      </div>
                      <div>
                        <strong>Duração:</strong> {durationHours}h
                      </div>
                      <div>
                        <strong>Total:</strong> R$ {lesson.total_price.toFixed(2)}
                      </div>
                      {lesson.confirmation_code && lesson.status === "confirmed" && (
                        <div>
                          <strong>Código da aula:</strong> {lesson.confirmation_code}
                        </div>
                      )}
                    </div>

                    {(lesson.status === "pending_instructor" ||
                      lesson.status === "confirmed" ||
                      lesson.status === "pending_payment") && (
                      <button
                        className="cancel-btn"
                        onClick={() => handleCancel(lesson.id)}
                        disabled={cancellingId === lesson.id}
                      >
                        {cancellingId === lesson.id ? "Cancelando..." : "Cancelar agendamento"}
                      </button>
                    )}

                    {lesson.status === "completed" && !lesson.has_review && (
                      <div className="rating-form">
                        <label>
                          Avaliação (1-5)
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={ratingInputs[lesson.id] || 5}
                            onChange={(e) =>
                              setRatingInputs((prev) => ({
                                ...prev,
                                [lesson.id]: Number(e.target.value)
                              }))
                            }
                          />
                        </label>
                        <label className="rating-checkbox">
                          <input
                            type="checkbox"
                            checked={publicInputs[lesson.id] ?? true}
                            onChange={(e) =>
                              setPublicInputs((prev) => ({
                                ...prev,
                                [lesson.id]: e.target.checked
                              }))
                            }
                          />
                          Tornar avaliação pública
                        </label>
                        <label>
                          Comentário (opcional)
                          <textarea
                            rows={2}
                            value={commentInputs[lesson.id] || ""}
                            onChange={(e) =>
                              setCommentInputs((prev) => ({
                                ...prev,
                                [lesson.id]: e.target.value
                              }))
                            }
                          />
                        </label>
                        <button
                          className="action-btn"
                          onClick={() => handleSubmitRating(lesson.id)}
                          disabled={ratingSubmitting === lesson.id}
                        >
                          {ratingSubmitting === lesson.id ? "Enviando..." : "Enviar avaliação"}
                        </button>
                      </div>
                    )}

                    {lesson.status === "completed" && lesson.has_review && (
                      <div className="rating-form">
                        <div className="rating-done">
                          Avaliação enviada ✅ (Nota: {lesson.review_rating ?? "-"})
                        </div>
                        {lesson.review_comment && (
                          <div className="rating-comment">
                            <strong>Seu comentário:</strong> {lesson.review_comment}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
