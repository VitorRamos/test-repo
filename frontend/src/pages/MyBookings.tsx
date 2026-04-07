import { useEffect, useMemo, useState } from "react"
import { ScheduleCalendar } from "../components/ScheduleCalendar"
import { api } from "../services/api"
import type { Lesson, User } from "../types"
import { formatDateKey, parseDateKey, type CalendarMarker } from "../utils/calendar"
import "./MyBookings.css"

interface MyBookingsProps {
  user: User | null
}

const statusLabels: Record<string, string> = {
  pending_instructor: "Pendente",
  confirmed: "Confirmada",
  pending_payment: "Pendente pagamento",
  completed: "Concluída",
  cancelled: "Cancelada"
}

const statusPriority: Record<string, number> = {
  pending_instructor: 0,
  confirmed: 1,
  pending_payment: 2,
  completed: 3,
  cancelled: 4
}

const markerToneByStatus: Record<string, CalendarMarker["tone"]> = {
  pending_instructor: "pending",
  confirmed: "confirmed",
  pending_payment: "pending",
  completed: "completed",
  cancelled: "cancelled"
}

const today = new Date()
const todayKey = formatDateKey(today)

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
  const [filter, setFilter] = useState<"all" | "confirmed" | "completed" | "cancelled" | "pending_instructor">("all")
  const [displayMonth, setDisplayMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDates, setSelectedDates] = useState<string[]>([todayKey])
  const [activeDate, setActiveDate] = useState(todayKey)
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false)

  const sortDateKeys = (values: string[]) =>
    [...values].sort((left, right) => parseDateKey(left).getTime() - parseDateKey(right).getTime())

  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const statusDiff = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99)
      if (statusDiff !== 0) {
        return statusDiff
      }
      return new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
    })
  }, [bookings])

  const filteredBookings = useMemo(() => {
    if (filter === "all") {
      return sortedBookings
    }
    if (filter === "completed") {
      return sortedBookings.filter((lesson) => lesson.status === "completed")
    }
    if (filter === "confirmed") {
      return sortedBookings.filter((lesson) => lesson.status === "confirmed")
    }
    if (filter === "cancelled") {
      return sortedBookings.filter((lesson) => lesson.status === "cancelled")
    }
    if (filter === "pending_instructor") {
      return sortedBookings.filter((lesson) => lesson.status === "pending_instructor")
    }
    return sortedBookings
  }, [filter, sortedBookings])

  const selectableDaysByFilter = useMemo(() => {
    const dateKeysByFilter = {
      all: new Set<string>(),
      confirmed: new Set<string>(),
      completed: new Set<string>(),
      cancelled: new Set<string>(),
      pending_instructor: new Set<string>()
    }

    sortedBookings.forEach((lesson) => {
      const dateKey = formatDateKey(new Date(lesson.scheduled_start))
      dateKeysByFilter.all.add(dateKey)

      if (lesson.status === "confirmed") {
        dateKeysByFilter.confirmed.add(dateKey)
      }
      if (lesson.status === "completed") {
        dateKeysByFilter.completed.add(dateKey)
      }
      if (lesson.status === "cancelled") {
        dateKeysByFilter.cancelled.add(dateKey)
      }
      if (lesson.status === "pending_instructor") {
        dateKeysByFilter.pending_instructor.add(dateKey)
      }
    })

    return {
      all: sortDateKeys(Array.from(dateKeysByFilter.all)),
      confirmed: sortDateKeys(Array.from(dateKeysByFilter.confirmed)),
      completed: sortDateKeys(Array.from(dateKeysByFilter.completed)),
      cancelled: sortDateKeys(Array.from(dateKeysByFilter.cancelled)),
      pending_instructor: sortDateKeys(Array.from(dateKeysByFilter.pending_instructor))
    }
  }, [sortedBookings])

  useEffect(() => {
    void loadBookings()
  }, [])

  useEffect(() => {
    if (hasInitializedSelection) {
      return
    }

    const nextSelection = selectableDaysByFilter[filter]
    if (nextSelection.length === 0) {
      return
    }

    const nextActiveDate = nextSelection[0]
    setSelectedDates(nextSelection)
    setActiveDate(nextActiveDate)
    setHasInitializedSelection(true)

    const nextMonth = parseDateKey(nextActiveDate)
    setDisplayMonth(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1))
  }, [filter, hasInitializedSelection, selectableDaysByFilter])

  useEffect(() => {
    const validDates = new Set(selectableDaysByFilter[filter])
    const nextSelectedDates = sortDateKeys(selectedDates.filter((dateKey) => validDates.has(dateKey)))

    if (nextSelectedDates.length === 0) {
      return
    }

    if (nextSelectedDates.length !== selectedDates.length) {
      setSelectedDates(nextSelectedDates)
    }

    if (!nextSelectedDates.includes(activeDate)) {
      setActiveDate(nextSelectedDates[0])
    }
  }, [activeDate, filter, selectableDaysByFilter, selectedDates])

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

  const markersByDate = useMemo<Record<string, CalendarMarker[]>>(() => {
    const markerMap: Record<string, CalendarMarker[]> = {}

    filteredBookings.forEach((lesson) => {
      const dateKey = formatDateKey(new Date(lesson.scheduled_start))
      const existing = markerMap[dateKey] || []
      const label = statusLabels[lesson.status] || lesson.status
      const tone = markerToneByStatus[lesson.status] || "completed"
      const marker = existing.find((item) => item.label === label && item.tone === tone)

      if (marker) {
        marker.count = (marker.count || 0) + 1
      } else {
        existing.push({ tone, label, count: 1 })
      }

      markerMap[dateKey] = existing
    })

    return markerMap
  }, [filteredBookings])

  const bookingsForSelectedDates = useMemo(
    () =>
      filteredBookings.filter((lesson) =>
        selectedDates.includes(formatDateKey(new Date(lesson.scheduled_start)))
      ),
    [filteredBookings, selectedDates]
  )

  const groupedBookings = useMemo(() => {
    const groups = new Map<string, Lesson[]>()

    bookingsForSelectedDates.forEach((lesson) => {
      const dateKey = formatDateKey(new Date(lesson.scheduled_start))
      const current = groups.get(dateKey) || []
      current.push(lesson)
      groups.set(dateKey, current)
    })

    return sortDateKeys(Array.from(groups.keys())).map((dateKey) => ({
      dateKey,
      lessons: groups.get(dateKey) || []
    }))
  }, [bookingsForSelectedDates])

  const handleSelectDate = (dateKey: string) => {
    setActiveDate(dateKey)
    const date = parseDateKey(dateKey)
    setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1))

    setSelectedDates((prev) =>
      prev.includes(dateKey)
        ? prev.filter((item) => item !== dateKey)
        : sortDateKeys([...prev, dateKey])
    )
  }

  const handleRangeSelect = (startDate: string, endDate: string, mode: "add" | "remove") => {
    const start = parseDateKey(startDate)
    const end = parseDateKey(endDate)
    const [rangeStart, rangeEnd] =
      start.getTime() <= end.getTime() ? [start, end] : [end, start]

    const selectableDates = new Set(
      filteredBookings.map((lesson) => formatDateKey(new Date(lesson.scheduled_start)))
    )
    const rangeDates: string[] = []

    for (let cursor = new Date(rangeStart); cursor <= rangeEnd; cursor.setDate(cursor.getDate() + 1)) {
      const dateKey = formatDateKey(cursor)
      if (selectableDates.has(dateKey)) {
        rangeDates.push(dateKey)
      }
    }

    if (rangeDates.length === 0) {
      return
    }

    setSelectedDates((prev) => {
      if (mode === "add") {
        return sortDateKeys(Array.from(new Set([...prev, ...rangeDates])))
      }
      const next = prev.filter((dateKey) => !rangeDates.includes(dateKey))
      return next.length > 0 ? next : [rangeDates[rangeDates.length - 1]]
    })

    setActiveDate(rangeDates[rangeDates.length - 1])
  }

  const handleGoToday = () => {
    setSelectedDates([todayKey])
    setActiveDate(todayKey)
    setDisplayMonth(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  const handleFilterChange = (
    value: "all" | "confirmed" | "completed" | "cancelled" | "pending_instructor"
  ) => {
    setFilter(value)
    setHasInitializedSelection(true)

    const nextSelection = selectableDaysByFilter[value]
    if (nextSelection.length === 0) {
      setSelectedDates([todayKey])
      setActiveDate(todayKey)
      setDisplayMonth(new Date(today.getFullYear(), today.getMonth(), 1))
      return
    }

    const nextActiveDate = nextSelection[0]
    setSelectedDates(nextSelection)
    setActiveDate(nextActiveDate)
    const nextMonth = parseDateKey(nextActiveDate)
    setDisplayMonth(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1))
  }

  if (!user || user.role !== "student") {
    return <div className="bookings-container"><p>Acesso negado</p></div>
  }

  return (
    <div className="bookings-container">
      {loading ? (
        <p>Carregando agendamentos...</p>
      ) : (
        <>
          {error && <p className="booking-error">{error}</p>}
          {actionMessage && <p className="booking-success">{actionMessage}</p>}
          {sortedBookings.length === 0 ? (
            <p>Você ainda não possui agendamentos.</p>
          ) : (
            <>
              <div className="bookings-toolbar">
                <label htmlFor="booking-filter">Filtrar</label>
                <select
                  id="booking-filter"
                  value={filter}
                  onChange={(e) =>
                    handleFilterChange(
                      e.target.value as "all" | "confirmed" | "completed" | "cancelled" | "pending_instructor"
                    )
                  }
                >
                  <option value="all">Todos</option>
                  <option value="pending_instructor">Pendente</option>
                  <option value="confirmed">Confirmados</option>
                  <option value="completed">Concluídos</option>
                  <option value="cancelled">Cancelados</option>
                </select>
                <button className="calendar-ghost-btn" onClick={handleGoToday}>
                  Hoje
                </button>
              </div>

              <div className="bookings-calendar-card">
                <ScheduleCalendar
                  month={displayMonth}
                  selectedDates={selectedDates}
                  activeDate={activeDate}
                  markersByDate={markersByDate}
                  onMonthChange={setDisplayMonth}
                  onSelectDate={handleSelectDate}
                  onRangeSelect={handleRangeSelect}
                  title="📅 Meus Agendamentos"
                  subtitle="Navegue pelos agendamentos e selecione um ou mais dias."
                />
              </div>

              <div className="bookings-day-header">
                <h2>
                  {selectedDates.length === 1
                    ? parseDateKey(selectedDates[0]).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
                    : `${selectedDates.length} dias selecionados`}
                </h2>
                <span>{bookingsForSelectedDates.length} agendamento(s)</span>
              </div>

              {bookingsForSelectedDates.length === 0 ? (
                <p>Nenhum agendamento encontrado para a seleção atual.</p>
              ) : (
                <div className="bookings-list">
                  {groupedBookings.map(({ dateKey, lessons }) => (
                    <section key={dateKey} className="booking-day-group">
                      <div className="booking-day-group-header">
                        <h3>
                          {parseDateKey(dateKey).toLocaleDateString("pt-BR", {
                            weekday: "long",
                            day: "2-digit",
                            month: "long"
                          })}
                          {dateKey === activeDate ? " · Dia ativo" : ""}
                        </h3>
                        <span>{lessons.length} agendamento(s)</span>
                      </div>

                      {lessons.map((lesson) => {
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
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
