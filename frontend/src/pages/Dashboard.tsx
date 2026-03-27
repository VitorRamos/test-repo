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

function StepBadge({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return <span className={`availability-step-badge${active ? " active" : ""}${done ? " done" : ""}`}>{done ? "✓" : n}</span>
}

function AvailabilitySection() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [period, setPeriod] = useState({
    start_date: formatDateInput(today),
    end_date: formatDateInput(new Date(today.getTime() + 1000 * 60 * 60 * 24 * 30))
  })
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [timeRanges, setTimeRanges] = useState<Array<{ start_time: string; end_time: string }>>([])
  const [draft, setDraft] = useState({ start_time: "08:00", end_time: "12:00" })
  const [availability, setAvailability] = useState<Availability[]>([])
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [blockPeriod, setBlockPeriod] = useState({
    start_date: formatDateInput(today),
    end_date: formatDateInput(new Date(today.getTime() + 1000 * 60 * 60 * 24 * 7))
  })
  const [blockError, setBlockError] = useState<string | null>(null)
  const [blocking, setBlocking] = useState(false)
  const [blockedCount, setBlockedCount] = useState<number | null>(null)

  useEffect(() => {
    void fetchAvailability()
  }, [])

  useEffect(() => {
    if (blockedCount === null) {
      return
    }

    const timeoutId = window.setTimeout(() => setBlockedCount(null), 2500)
    return () => window.clearTimeout(timeoutId)
  }, [blockedCount])

  const fetchAvailability = async () => {
    try {
      const data = await api.instructors.getAvailability()
      setAvailability(data || [])
    } catch (error) {
      console.error("Erro ao carregar disponibilidades", error)
    }
  }

  const canGoStep2 = period.end_date >= period.start_date && weekdays.length > 0
  const canGoStep3 = timeRanges.length > 0

  const goToStep = (target: 1 | 2 | 3) => {
    setPublishError(null)

    if (target === 2 && !canGoStep2) {
      setPublishError("Selecione datas validas e pelo menos um dia da semana.")
      return
    }

    if (target === 3 && (!canGoStep2 || !canGoStep3)) {
      setPublishError("Adicione pelo menos uma faixa de horario.")
      return
    }

    setStep(target)
  }

  const handleAddTimeRange = () => {
    setPublishError(null)

    if (!isValidTimeRange(draft)) {
      setPublishError("O horario final deve ser maior que o inicial.")
      return
    }

    if (hasSameTimeRange(timeRanges, draft)) {
      setPublishError("Essa faixa ja foi adicionada.")
      return
    }

    setTimeRanges((prev) => [...prev, draft])
    setDraft({ start_time: "08:00", end_time: "12:00" })
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
    setWeekdays((prev) =>
      prev.includes(weekday)
        ? prev.filter((day) => day !== weekday)
        : [...prev, weekday].sort((a, b) => a - b)
    )
  }

  const handlePublish = async () => {
    setPublishError(null)
    if (!canGoStep2 || !canGoStep3) {
      return
    }

    setPublishing(true)
    try {
      const created = await api.instructors.createAvailability({
        ...period,
        weekdays,
        time_ranges: timeRanges
      })
      setAvailability((prev) => [...prev, ...created])
      setStep(1)
      setTimeRanges([])
      setDraft({ start_time: "08:00", end_time: "12:00" })
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Falha ao publicar disponibilidade.")
    } finally {
      setPublishing(false)
    }
  }

  const handleDeleteAvailability = async (id: string) => {
    setPublishError(null)
    try {
      await api.instructors.deleteAvailability(id)
      setAvailability((prev) => prev.filter((slot) => slot.id !== id))
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Falha ao remover disponibilidade.")
    }
  }

  const handleBlockPeriod = async () => {
    setBlockError(null)

    if (blockPeriod.end_date < blockPeriod.start_date) {
      setBlockError("A data final deve ser maior ou igual a inicial.")
      return
    }

    setBlocking(true)
    try {
      const overlapping = availability.filter(
        (slot) => {
          if (!slot.start_date || !slot.end_date) {
            return false
          }

          return !(slot.end_date < blockPeriod.start_date || slot.start_date > blockPeriod.end_date)
        }
      )

      await Promise.all(overlapping.map((slot) => api.instructors.deleteAvailability(slot.id)))

      setAvailability((prev) =>
        prev.filter(
          (slot) => {
            if (!slot.start_date || !slot.end_date) {
              return true
            }

            return slot.end_date < blockPeriod.start_date || slot.start_date > blockPeriod.end_date
          }
        )
      )
      setBlockedCount(overlapping.length)
      setShowBlockModal(false)
      setBlockPeriod({
        start_date: formatDateInput(today),
        end_date: formatDateInput(new Date(today.getTime() + 1000 * 60 * 60 * 24 * 7))
      })
    } catch (error) {
      setBlockError(error instanceof Error ? error.message : "Falha ao bloquear periodo.")
    } finally {
      setBlocking(false)
    }
  }

  return (
    <div className="availability-wizard">
      <div className="availability-card">
        <div className="availability-card-header">
          <div>
            <h3>🕒 Disponibilidade</h3>
            <p>Publique horarios recorrentes e controle exatamente o que fica visivel para os alunos na busca e na reserva.</p>
          </div>
          <button
            className="availability-block-trigger"
            type="button"
            onClick={() => {
              setShowBlockModal(true)
              setBlockError(null)
              setBlockedCount(null)
            }}
          >
            🚫 Bloquear periodo
          </button>
        </div>

        <div className="availability-steps">
          {[
            { n: 1, label: "Periodo e dias" },
            { n: 2, label: "Horarios" },
            { n: 3, label: "Confirmacao" }
          ].map(({ n, label }) => {
            const isDone = step > n
            const isActive = step === n

            return (
              <button
                key={n}
                type="button"
                className={`availability-step${isDone ? " done" : ""}${isActive ? " active" : ""}`}
                onClick={() => goToStep(n as 1 | 2 | 3)}
              >
                <StepBadge n={n} active={isActive} done={isDone} />
                <span>{label}</span>
              </button>
            )
          })}
        </div>

        {publishError && <p className="confirm-error">{publishError}</p>}

        {step === 1 && (
          <div className="availability-panel">
            <div className="availability-field-grid">
              <label className="availability-field">
                <span>Inicio do periodo</span>
                <input
                  type="date"
                  value={period.start_date}
                  onChange={(event) =>
                    setPeriod((prev) => ({ ...prev, start_date: event.target.value }))
                  }
                />
              </label>
              <label className="availability-field">
                <span>Fim do periodo</span>
                <input
                  type="date"
                  value={period.end_date}
                  onChange={(event) =>
                    setPeriod((prev) => ({ ...prev, end_date: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="availability-weekday-section">
              <span className="availability-label">Dias da semana</span>
              <div className="weekday-picker">
                {WEEKDAY_OPTIONS.map((weekday) => (
                  <button
                    key={weekday.value}
                    type="button"
                    className={weekdays.includes(weekday.value) ? "weekday-chip active" : "weekday-chip"}
                    onClick={() => toggleWeekday(weekday.value)}
                  >
                    {weekday.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="availability-step-nav">
              <span />
              <button className="action-btn" type="button" onClick={() => goToStep(2)} disabled={!canGoStep2}>
                Proximo
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="availability-panel">
            <div className="availability-inline-header">
              <span className="availability-label">Adicione as faixas de horario disponiveis</span>
            </div>

            <div className="availability-time-row">
              <label className="availability-field">
                <span>Inicio</span>
                <input
                  type="time"
                  value={draft.start_time}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, start_time: event.target.value }))
                  }
                />
              </label>
              <label className="availability-field">
                <span>Fim</span>
                <input
                  type="time"
                  value={draft.end_time}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, end_time: event.target.value }))
                  }
                />
              </label>
              <button className="secondary-action-btn availability-add-btn" type="button" onClick={handleAddTimeRange}>
                + Adicionar
              </button>
            </div>

            <div className="availability-pill-list">
              {timeRanges.length === 0 ? (
                <span className="availability-helper-text">Nenhuma faixa adicionada ainda.</span>
              ) : (
                timeRanges.map((range) => (
                  <span key={`${range.start_time}-${range.end_time}`} className="availability-pill">
                    {range.start_time} - {range.end_time}
                    <button type="button" onClick={() => handleRemoveTimeRange(range)} aria-label="Remover horario">
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>

            <div className="availability-step-nav">
              <button className="cancel-btn availability-nav-btn" type="button" onClick={() => goToStep(1)}>
                Voltar
              </button>
              <button className="action-btn availability-nav-btn" type="button" onClick={() => goToStep(3)} disabled={!canGoStep3}>
                Revisar
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="availability-panel">
            <span className="availability-label">Revise antes de publicar</span>
            <div className="availability-summary-box">
              <div>
                <strong>Periodo:</strong> {period.start_date} ate {period.end_date}
              </div>
              <div>
                <strong>Dias:</strong>{" "}
                {weekdays
                  .map((value) => WEEKDAY_OPTIONS.find((option) => option.value === value)?.label || "")
                  .join(", ")}
              </div>
              <div>
                <strong>Horarios:</strong> {timeRanges.map((range) => `${range.start_time}-${range.end_time}`).join(" • ")}
              </div>
            </div>

            <div className="availability-step-nav">
              <button className="cancel-btn availability-nav-btn" type="button" onClick={() => goToStep(2)}>
                Voltar
              </button>
              <button className="action-btn availability-nav-btn" type="button" onClick={handlePublish} disabled={publishing}>
                {publishing ? "Publicando..." : "Publicar disponibilidade"}
              </button>
            </div>
          </div>
        )}

        <div className="availability-published-list">
          <div className="availability-published-header">
            <div>
              <span>Disponibilidades publicadas</span>
              <p>Esses periodos aparecem como base para os horarios publicos exibidos aos alunos.</p>
            </div>
            <strong>{availability.length}</strong>
          </div>

          {availability.length === 0 ? (
            <p className="availability-empty">Nenhuma disponibilidade cadastrada.</p>
          ) : (
            <div className="availability-list">
              {availability.map((slot) => (
                <div key={slot.id} className="availability-item">
                  <div className="availability-summary-main">
                    <div className="availability-summary">
                      <strong>{slot.start_date} ate {slot.end_date}</strong>
                      <span>Janela publica para reservas</span>
                    </div>
                    <div className="availability-detail-chips">
                      <span className="availability-detail-chip">
                        📅 {slot.weekdays
                          .map((day) => WEEKDAY_OPTIONS.find((option) => option.value === day)?.label || "")
                          .join(", ")}
                      </span>
                      <span className="availability-detail-chip">
                        🕒 {slot.start_time} - {slot.end_time}
                      </span>
                    </div>
                  </div>
                  <button className="cancel-btn availability-remove-btn" type="button" onClick={() => handleDeleteAvailability(slot.id)}>
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showBlockModal && (
        <div
          className="availability-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowBlockModal(false)
            }
          }}
        >
          <div className="availability-modal">
            <h4>🚫 Bloquear periodo</h4>
            <p>
              Todas as disponibilidades que se sobrepoem ao intervalo selecionado serao removidas. Nesse intervalo, os alunos deixam de ver esses horarios publicos e nao conseguem reservar novas aulas.
            </p>

            {blockError && <p className="confirm-error">{blockError}</p>}

            <div className="availability-field-grid">
              <label className="availability-field">
                <span>Data inicial</span>
                <input
                  type="date"
                  value={blockPeriod.start_date}
                  onChange={(event) =>
                    setBlockPeriod((prev) => ({ ...prev, start_date: event.target.value }))
                  }
                />
              </label>
              <label className="availability-field">
                <span>Data final</span>
                <input
                  type="date"
                  value={blockPeriod.end_date}
                  onChange={(event) =>
                    setBlockPeriod((prev) => ({ ...prev, end_date: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="availability-modal-actions">
              <button className="cancel-btn availability-nav-btn" type="button" onClick={() => setShowBlockModal(false)}>
                Cancelar
              </button>
              <button className="action-btn availability-nav-btn danger" type="button" onClick={handleBlockPeriod} disabled={blocking}>
                {blocking ? "Bloqueando..." : "Bloquear periodo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {blockedCount !== null && (
        <div className="availability-toast">
          {blockedCount} disponibilidade(s) removida(s) para o periodo.
        </div>
      )}
    </div>
  )
}

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
      const [statsData, earningsData, lessonsData] = await Promise.all([
        api.instructors.getStats(),
        api.instructors.getEarnings(),
        api.instructors.getLessons()
      ])
      setStats(statsData)
      setEarnings(earningsData)
      setLessons(lessonsData || [])

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
          <AvailabilitySection />
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
