import { useEffect, useState } from "react"
import { api } from "../services/api"
import type { Availability, Lesson, Review, User } from "../types"
import "./Dashboard.css"

interface InstructorStats {
  instructor_id: string
  total_lessons: number
  rating: number
  students_taught: number
  name: string
  city: string
  state: string
  price_per_hour: number
}

interface Earnings {
  total_earnings: number
  pending_earnings: number
  completed_lessons: number
  total_lessons: number
}

interface DashboardProps {
  user: User | null
}

export function InstructorPortal({ user }: DashboardProps) {
  const [stats, setStats] = useState<InstructorStats | null>(null)
  const [earnings, setEarnings] = useState<Earnings | null>(null)
  const [loading, setLoading] = useState(true)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [availability, setAvailability] = useState<Availability[]>([])
  const [availabilityForm, setAvailabilityForm] = useState({
    weekday: 1,
    start_time: "08:00",
    end_time: "12:00"
  })
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [confirmedError, setConfirmedError] = useState<string | null>(null)
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({})
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsData, earningsData, lessonsData, availabilityData] = await Promise.all([
        api.instructors.getStats(),
        api.instructors.getEarnings(),
        api.instructors.getLessons(),
        api.instructors.getAvailability()
      ])
      setStats(statsData)
      setEarnings(earningsData)
      setLessons(lessonsData || [])
      setAvailability(availabilityData || [])

      if (statsData?.instructor_id) {
        const reviewsData = await api.reviews.getByInstructor(statsData.instructor_id)
        setReviews(reviewsData || [])
      } else {
        setReviews([])
      }
    } catch (error) {
      console.error("Falha ao carregar dados do instrutor:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (lessonId: string) => {
    setConfirmingId(lessonId)
    setRequestError(null)
    try {
      await api.lessons.confirmBooking(lessonId)
      await fetchData()
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Falha ao confirmar agendamento")
    } finally {
      setConfirmingId(null)
    }
  }

  const handleValidateCode = async (lessonId: string) => {
    setValidatingId(lessonId)
    setConfirmedError(null)
    try {
      const code = codeInputs[lessonId] || ""
      await api.lessons.confirmCode(lessonId, code)
      setCodeInputs((prev) => ({ ...prev, [lessonId]: "" }))
      await fetchData()
    } catch (err) {
      setConfirmedError(err instanceof Error ? err.message : "Falha ao validar código")
    } finally {
      setValidatingId(null)
    }
  }

  const handleCancel = async (lessonId: string) => {
    setCancelingId(lessonId)
    const lesson = lessons.find((item) => item.id === lessonId)
    if (lesson?.status === "confirmed") {
      setConfirmedError(null)
    } else {
      setRequestError(null)
    }
    try {
      await api.lessons.cancelLesson(lessonId)
      await fetchData()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao cancelar aula"
      if (lesson?.status === "confirmed") {
        setConfirmedError(message)
      } else {
        setRequestError(message)
      }
    } finally {
      setCancelingId(null)
    }
  }

  const handleAddAvailability = async (event: React.FormEvent) => {
    event.preventDefault()
    setAvailabilityError(null)

    if (availabilityForm.end_time <= availabilityForm.start_time) {
      setAvailabilityError("Horário final deve ser maior que o horário inicial")
      return
    }

    try {
      const created = await api.instructors.createAvailability(availabilityForm)
      setAvailability((prev) => [...prev, created])
    } catch (err) {
      setAvailabilityError(err instanceof Error ? err.message : "Falha ao salvar disponibilidade")
    }
  }

  const handleDeleteAvailability = async (id: string) => {
    setAvailabilityError(null)
    try {
      await api.instructors.deleteAvailability(id)
      setAvailability((prev) => prev.filter((slot) => slot.id !== id))
    } catch (err) {
      setAvailabilityError(err instanceof Error ? err.message : "Falha ao remover disponibilidade")
    }
  }

  const formatLessonDuration = (lesson: Lesson) => {
    const hours =
      (new Date(lesson.scheduled_end).getTime() - new Date(lesson.scheduled_start).getTime()) /
      (1000 * 60 * 60)

    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`
  }

  if (!user || user.role !== "instructor") {
    return <div className="dashboard-container"><p>Acesso negado</p></div>
  }

  if (loading) {
    return <div className="dashboard-container"><p>Carregando...</p></div>
  }

  return (
    <div className="dashboard-container">
      <h1>📊 Central do Instrutor</h1>

      <div className="dashboard-grid">
        {/* Welcome Section */}
        <div className="dashboard-card welcome-card span-2">
          <h2>Bem-vindo, {stats?.name}!</h2>
          <p className="location">📍 {stats?.city}, {stats?.state}</p>
          <p className="price">R$ {stats?.price_per_hour.toFixed(2)}/hora</p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid span-2">
          <div className="stat-card">
            <div className="stat-number">{stats?.total_lessons}</div>
            <div className="stat-label">Aulas Totais</div>
          </div>

          <div className="stat-card">
            <div className="stat-number">{stats?.students_taught}</div>
            <div className="stat-label">Alunos Ensinados</div>
          </div>

          <div className="stat-card">
            <div className="stat-number">⭐ {stats?.rating.toFixed(1)}</div>
            <div className="stat-label">Avaliação</div>
          </div>

          <div className="stat-card">
            <div className="stat-number">R$ {earnings?.total_earnings.toFixed(2)}</div>
            <div className="stat-label">Ganhos Totais</div>
          </div>
        </div>

        {/* Earnings Section */}
        <div className="dashboard-card earnings-card" id="ganhos">
          <h3>💰 Ganhos</h3>
          <div className="earnings-item">
            <span>Ganhos Completos:</span>
            <strong>R$ {earnings?.total_earnings.toFixed(2)}</strong>
          </div>
          <div className="earnings-item">
            <span>Ganhos Pendentes:</span>
            <strong>R$ {earnings?.pending_earnings.toFixed(2)}</strong>
          </div>
          <div className="earnings-item">
            <span>Aulas Concluídas:</span>
            <strong>{earnings?.completed_lessons}</strong>
          </div>
        </div>

        {/* Booking Requests */}
        <div className="dashboard-card actions-card" id="solicitacoes">
          <h3>📅 Solicitações de Agendamento</h3>
          {requestError && <p className="confirm-error">{requestError}</p>}
          {lessons.filter((lesson) => lesson.status === "pending_instructor").length === 0 ? (
            <p>Nenhuma solicitação pendente.</p>
          ) : (
            <div className="booking-list">
              {lessons
                .filter((lesson) => lesson.status === "pending_instructor")
                .map((lesson) => (
                  <div key={lesson.id} className="booking-item">
                    <div>
                      <strong>Aula</strong> em {new Date(lesson.scheduled_start).toLocaleString("pt-BR")}
                    </div>
                    <div>
                      <strong>Aluno:</strong> {lesson.student_email || "Não informado"}
                    </div>
                    <div className="booking-actions">
                      <button
                        className="action-btn"
                        onClick={() => handleConfirm(lesson.id)}
                        disabled={confirmingId === lesson.id}
                      >
                        {confirmingId === lesson.id ? "Confirmando..." : "Confirmar"}
                      </button>
                      <button
                        className="cancel-btn"
                        onClick={() => handleCancel(lesson.id)}
                        disabled={cancelingId === lesson.id}
                      >
                        {cancelingId === lesson.id ? "Cancelando..." : "Cancelar"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Confirmed Lessons */}
        <div className="dashboard-card actions-card" id="confirmadas">
          <h3>✅ Aulas Confirmadas</h3>
          {confirmedError && <p className="confirm-error">{confirmedError}</p>}
          {lessons.filter((lesson) => lesson.status === "confirmed").length === 0 ? (
            <p>Nenhuma aula confirmada.</p>
          ) : (
            <div className="booking-list">
              {lessons
                .filter((lesson) => lesson.status === "confirmed")
                .map((lesson) => (
                  <div key={lesson.id} className="booking-item">
                    <div>
                      <strong>Data:</strong>{" "}
                      {new Date(lesson.scheduled_start).toLocaleString("pt-BR")}
                    </div>
                    <div>
                      <strong>Duração:</strong> {formatLessonDuration(lesson)}
                    </div>
                    <div>
                      <strong>Aluno:</strong> {lesson.student_email || "Não informado"}
                    </div>
                    <div className="code-row">
                      <input
                        type="text"
                        placeholder="Código do aluno"
                        value={codeInputs[lesson.id] || ""}
                        onChange={(e) =>
                          setCodeInputs((prev) => ({
                            ...prev,
                            [lesson.id]: e.target.value
                          }))
                        }
                      />
                      <button
                        className="action-btn"
                        onClick={() => handleValidateCode(lesson.id)}
                        disabled={validatingId === lesson.id}
                      >
                        {validatingId === lesson.id ? "Validando..." : "Validar Código"}
                      </button>
                      <button
                        className="cancel-btn"
                        onClick={() => handleCancel(lesson.id)}
                        disabled={cancelingId === lesson.id}
                      >
                        {cancelingId === lesson.id ? "Cancelando..." : "Cancelar"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Completed Lessons */}
        <div className="dashboard-card actions-card" id="concluidas">
          <h3>🏁 Aulas Concluídas</h3>
          {lessons.filter((lesson) => lesson.status === "completed").length === 0 ? (
            <p>Nenhuma aula concluída.</p>
          ) : (
            <div className="booking-list">
              {lessons
                .filter((lesson) => lesson.status === "completed")
                .map((lesson) => (
                  <div key={lesson.id} className="booking-item">
                    <div>
                      <strong>Data:</strong>{" "}
                      {new Date(lesson.scheduled_start).toLocaleString("pt-BR")}
                    </div>
                    <div>
                      <strong>Confirmado em:</strong>{" "}
                      {lesson.code_confirmed_at
                        ? new Date(lesson.code_confirmed_at).toLocaleString("pt-BR")
                        : "Não informado"}
                    </div>
                    <div>
                      <strong>Aluno:</strong> {lesson.student_email || "Não informado"}
                    </div>
                    <div>
                      <strong>Nota:</strong>{" "}
                      {lesson.review_rating ? lesson.review_rating : "Sem avaliação"}
                    </div>
                    <div>
                      <strong>Total:</strong> R$ {lesson.total_price.toFixed(2)}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Availability */}
        <div className="dashboard-card actions-card span-2" id="disponibilidade">
          <h3>🕒 Disponibilidade</h3>
          {availabilityError && <p className="confirm-error">{availabilityError}</p>}
          <form className="availability-form" onSubmit={handleAddAvailability}>
            <label>
              Dia da semana
              <select
                value={availabilityForm.weekday}
                onChange={(e) =>
                  setAvailabilityForm((prev) => ({
                    ...prev,
                    weekday: Number(e.target.value)
                  }))
                }
              >
                <option value={0}>Domingo</option>
                <option value={1}>Segunda</option>
                <option value={2}>Terça</option>
                <option value={3}>Quarta</option>
                <option value={4}>Quinta</option>
                <option value={5}>Sexta</option>
                <option value={6}>Sábado</option>
              </select>
            </label>
            <label>
              Início
              <input
                type="time"
                value={availabilityForm.start_time}
                onChange={(e) =>
                  setAvailabilityForm((prev) => ({
                    ...prev,
                    start_time: e.target.value
                  }))
                }
              />
            </label>
            <label>
              Fim
              <input
                type="time"
                value={availabilityForm.end_time}
                onChange={(e) =>
                  setAvailabilityForm((prev) => ({
                    ...prev,
                    end_time: e.target.value
                  }))
                }
              />
            </label>
            <button className="action-btn" type="submit">Adicionar</button>
          </form>

          {availability.length === 0 ? (
            <p>Nenhuma disponibilidade cadastrada.</p>
          ) : (
            <div className="availability-list">
              {availability.map((slot) => (
                <div key={slot.id} className="availability-item">
                  <span>
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][slot.weekday]} • {slot.start_time} - {slot.end_time}
                  </span>
                  <button className="cancel-btn" onClick={() => handleDeleteAvailability(slot.id)}>
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reviews */}
        <div className="dashboard-card actions-card span-2" id="avaliacoes">
          <h3>⭐ Avaliações Recentes</h3>
          {reviews.length === 0 ? (
            <p>Nenhuma avaliação ainda.</p>
          ) : (
            <div className="reviews-list">
              {reviews.slice(0, 6).map((review) => (
                <div key={review.id} className="review-item">
                  <div className="review-header">
                    <strong>{review.student_email || "Aluno"}</strong>
                    <span>⭐ {review.rating.toFixed(1)}</span>
                  </div>
                  {review.comment && <p>{review.comment}</p>}
                  {review.is_public === false && (
                    <span className="review-private">Avaliação privada</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
