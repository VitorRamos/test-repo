import { useEffect, useMemo, useState } from "react"
import { api } from "../services/api"
import type { Availability, Lesson, Review, User } from "../types"
import "./Dashboard.css"

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" }
]

const today = new Date()
const formatDateInput = (value: Date) => value.toISOString().split("T")[0]

const isValidTimeRange = (range: { start_time: string; end_time: string }) =>
  range.start_time !== "" && range.end_time !== "" && range.end_time > range.start_time

const hasSameTimeRange = (
  ranges: Array<{ start_time: string; end_time: string }>,
  candidate: { start_time: string; end_time: string }
) =>
  ranges.some(
    (range) =>
      range.start_time === candidate.start_time &&
      range.end_time === candidate.end_time
  )

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
    start_date: formatDateInput(today),
    end_date: formatDateInput(new Date(today.getTime() + 1000 * 60 * 60 * 24 * 30)),
    weekdays: [1, 2, 3, 4, 5]
  })
  const [timeRangeDraft, setTimeRangeDraft] = useState({
    start_time: "08:00",
    end_time: "12:00"
  })
  const [timeRangeDraftDirty, setTimeRangeDraftDirty] = useState(false)
  const [timeRanges, setTimeRanges] = useState<Array<{ start_time: string; end_time: string }>>([
    { start_time: "08:00", end_time: "12:00" }
  ])
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [confirmedError, setConfirmedError] = useState<string | null>(null)
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({})
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [historyFilter, setHistoryFilter] = useState<"all" | "completed" | "cancelled">("completed")

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
    const lesson = lessons.find((item) => item.id === lessonId)
    const confirmMessage =
      lesson?.status === "confirmed"
        ? "Cancelar esta aula confirmada?"
        : "Cancelar esta solicitacao de aula?"

    if (!window.confirm(confirmMessage)) {
      return
    }

    setCancelingId(lessonId)
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

    if (availabilityForm.end_date < availabilityForm.start_date) {
      setAvailabilityError("A data final deve ser maior ou igual à inicial")
      return
    }

    if (availabilityForm.weekdays.length === 0) {
      setAvailabilityError("Selecione pelo menos um dia da semana")
      return
    }

    const rangesToSave = [...timeRanges]
    if (
      timeRangeDraftDirty &&
      isValidTimeRange(timeRangeDraft) &&
      !hasSameTimeRange(rangesToSave, timeRangeDraft)
    ) {
      rangesToSave.push(timeRangeDraft)
    }

    if (!timeRangeDraftDirty && timeRanges.length === 0) {
      setAvailabilityError("Adicione pelo menos uma faixa de horário")
      return
    }

    if (timeRangeDraftDirty && !isValidTimeRange(timeRangeDraft) && timeRanges.length === 0) {
      setAvailabilityError("Preencha uma faixa válida ou adicione pelo menos uma faixa de horário")
      return
    }

    if (rangesToSave.length === 0) {
      setAvailabilityError("Adicione pelo menos uma faixa de horário")
      return
    }

    try {
      const created = await api.instructors.createAvailability({
        ...availabilityForm,
        time_ranges: rangesToSave
      })
      setAvailability((prev) => [...prev, ...created])
      setTimeRanges(rangesToSave)
      setTimeRangeDraft({ start_time: "08:00", end_time: "12:00" })
      setTimeRangeDraftDirty(false)
    } catch (err) {
      setAvailabilityError(err instanceof Error ? err.message : "Falha ao salvar disponibilidade")
    }
  }

  const handleAddTimeRange = () => {
    setAvailabilityError(null)
    if (!isValidTimeRange(timeRangeDraft)) {
      setAvailabilityError("Horário final deve ser maior que o horário inicial")
      return
    }

    const exists = hasSameTimeRange(timeRanges, timeRangeDraft)
    if (exists) {
      setAvailabilityError("Essa faixa de horário já foi adicionada")
      return
    }

    setTimeRanges((prev) => [...prev, timeRangeDraft])
    setTimeRangeDraft({ start_time: "08:00", end_time: "12:00" })
    setTimeRangeDraftDirty(false)
  }

  const handleRemoveTimeRange = (rangeToRemove: { start_time: string; end_time: string }) => {
    setTimeRanges((prev) =>
      prev.filter(
        (range) =>
          !(
            range.start_time === rangeToRemove.start_time &&
            range.end_time === rangeToRemove.end_time
          )
      )
    )
  }

  const toggleWeekday = (weekday: number) => {
    setAvailabilityForm((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(weekday)
        ? prev.weekdays.filter((day) => day !== weekday)
        : [...prev.weekdays, weekday].sort((a, b) => a - b)
    }))
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

  const historicalLessons = useMemo(() => {
    const items = lessons.filter((lesson) =>
      historyFilter === "all"
        ? lesson.status === "completed" || lesson.status === "cancelled"
        : lesson.status === historyFilter
    )

    return items.sort(
      (a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime()
    )
  }, [historyFilter, lessons])

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
                      <strong>Duração:</strong> {formatLessonDuration(lesson)}
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

        {/* Availability */}
        <div className="dashboard-card actions-card span-2" id="disponibilidade">
          <h3>🕒 Disponibilidade</h3>
          {availabilityError && <p className="confirm-error">{availabilityError}</p>}
          <form className="availability-form" onSubmit={handleAddAvailability}>
            <div className="availability-section">
              <h4>Publicação</h4>
              <div className="availability-row">
                <label>
                  Início do período
                  <input
                    type="date"
                    value={availabilityForm.start_date}
                    onChange={(e) =>
                      setAvailabilityForm((prev) => ({
                        ...prev,
                        start_date: e.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  Fim do período
                  <input
                    type="date"
                    value={availabilityForm.end_date}
                    onChange={(e) =>
                      setAvailabilityForm((prev) => ({
                        ...prev,
                        end_date: e.target.value
                      }))
                    }
                  />
                </label>
              </div>

              <div className="availability-hours">
                <span className="availability-label">Horarios</span>
                <div className="availability-row">
                  <label>
                    Início da faixa
                    <input
                      type="time"
                      value={timeRangeDraft.start_time}
                      onChange={(e) => {
                        setTimeRangeDraftDirty(true)
                        setTimeRangeDraft((prev) => ({
                          ...prev,
                          start_time: e.target.value
                        }))
                      }}
                    />
                  </label>
                  <label>
                    Fim da faixa
                    <input
                      type="time"
                      value={timeRangeDraft.end_time}
                      onChange={(e) => {
                        setTimeRangeDraftDirty(true)
                        setTimeRangeDraft((prev) => ({
                          ...prev,
                          end_time: e.target.value
                        }))
                      }}
                    />
                  </label>
                  <div className="availability-actions">
                    <button className="secondary-action-btn" type="button" onClick={handleAddTimeRange}>
                      Adicionar horario
                    </button>
                  </div>
                </div>

                <div className="time-range-list">
                  <p className="availability-helper-text">
                    Adicione varios horarios para publicar no mesmo período.
                  </p>
                  {timeRanges.map((range) => (
                    <div key={`${range.start_time}-${range.end_time}`} className="time-range-item">
                      <span>{range.start_time} - {range.end_time}</span>
                      <button type="button" className="cancel-btn" onClick={() => handleRemoveTimeRange(range)}>
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="availability-weekdays">
                <span className="availability-label">Dias da semana</span>
                <div className="availability-weekdays-row">
                  <div className="weekday-picker">
                    {WEEKDAY_OPTIONS.map((weekday) => (
                      <button
                        key={weekday.value}
                        type="button"
                        className={availabilityForm.weekdays.includes(weekday.value) ? "weekday-chip active" : "weekday-chip"}
                        onClick={() => toggleWeekday(weekday.value)}
                      >
                        {weekday.label}
                      </button>
                    ))}
                  </div>
                  <div className="availability-actions">
                    <button className="action-btn availability-submit" type="submit">Publicar disponibilidade</button>
                  </div>
                </div>
              </div>
            </div>
          </form>

          {availability.length === 0 ? (
            <p>Nenhuma disponibilidade cadastrada.</p>
          ) : (
            <div className="availability-list">
              {availability.map((slot) => (
                <div key={slot.id} className="availability-item">
                  <div className="availability-summary">
                    <strong>{slot.start_date} ate {slot.end_date}</strong>
                    <span>
                      {slot.weekdays
                        .map((day) => WEEKDAY_OPTIONS.find((option) => option.value === day)?.label || "")
                        .join(", ")} • {slot.start_time} - {slot.end_time}
                    </span>
                  </div>
                  <button className="cancel-btn" onClick={() => handleDeleteAvailability(slot.id)}>
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed Lessons */}
        <div className="dashboard-card actions-card" id="concluidas">
          <div className="section-header-with-filter">
            <h3>🏁 Aulas Concluídas</h3>
            <div className="section-filter">
              <label htmlFor="history-filter">Filtrar</label>
              <select
                id="history-filter"
                value={historyFilter}
                onChange={(e) =>
                  setHistoryFilter(e.target.value as "all" | "completed" | "cancelled")
                }
              >
                <option value="all">Todas</option>
                <option value="completed">Concluídas</option>
                <option value="cancelled">Canceladas</option>
              </select>
            </div>
          </div>
          {historicalLessons.length === 0 ? (
            <p>Nenhuma aula encontrada para este filtro.</p>
          ) : (
            <div className="booking-list">
              {historicalLessons.map((lesson) => (
                  <div key={lesson.id} className="booking-item">
                    <div>
                      <strong>Data:</strong>{" "}
                      {new Date(lesson.scheduled_start).toLocaleString("pt-BR")}
                    </div>
                    <div>
                      <strong>Status:</strong> {lesson.status === "completed" ? "Concluída" : "Cancelada"}
                    </div>
                    <div>
                      <strong>Aluno:</strong> {lesson.student_email || "Não informado"}
                    </div>
                    {lesson.status === "completed" && (
                      <div>
                        <strong>Confirmado em:</strong>{" "}
                        {lesson.code_confirmed_at
                          ? new Date(lesson.code_confirmed_at).toLocaleString("pt-BR")
                          : "Não informado"}
                      </div>
                    )}
                    {lesson.status === "completed" && (
                      <div>
                        <strong>Nota:</strong>{" "}
                        {lesson.review_rating ? lesson.review_rating : "Sem avaliação"}
                      </div>
                    )}
                    <div>
                      <strong>Total:</strong> R$ {lesson.total_price.toFixed(2)}
                    </div>
                  </div>
                ))}
            </div>
          )}
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
