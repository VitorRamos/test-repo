import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ScheduleCalendar } from "./ScheduleCalendar"
import type { AvailableDay, Instructor, Lesson, Review } from "../types"
import { api } from "../services/api"
import { useAuth } from "../context/AuthContext"
import {
  endOfMonth,
  endOfWeek,
  formatDateKey,
  formatLongDate,
  parseDateKey,
  startOfMonth,
  startOfWeek,
  type CalendarMarker
} from "../utils/calendar"
import "./InstructorCard.css"

const today = new Date()
const todayKey = formatDateKey(today)
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
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [activeDate, setActiveDate] = useState(todayKey)
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [displayMonth, setDisplayMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const sortDateKeys = (values: string[]) =>
    [...values].sort((left, right) => parseDateKey(left).getTime() - parseDateKey(right).getTime())

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
      const monthStart = startOfWeek(startOfMonth(displayMonth))
      const monthEnd = endOfWeek(endOfMonth(displayMonth))
      const days = await api.instructors.getAvailableSlots(instructor.id, {
        duration_hours: durationHours,
        date_from: formatDateInput(monthStart),
        date_to: formatDateInput(monthEnd)
      })
      setAvailableDays(days)
      const validSlots = new Set(days.flatMap((day: AvailableDay) => day.slots))
      setSelectedSlots((prev) => prev.filter((slot) => validSlots.has(slot)))
      const availableDateKeys = new Set(days.map((day: AvailableDay) => day.date))
      setSelectedDates((prev) => sortDateKeys(prev.filter((dateKey) => availableDateKeys.has(dateKey))))
      setActiveDate((prev) => prev || formatDateKey(monthStart))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar horários.")
    } finally {
      setLoadingSlots(false)
    }
  }

  useEffect(() => {
    if (!showForm) return
    void loadSlots()
  }, [displayMonth, durationHours, showForm])

  const availableDates = useMemo(() => new Set(availableDays.map((day) => day.date)), [availableDays])
  const selectedAvailableDays = useMemo(
    () => sortDateKeys(selectedDates).map((dateKey) => availableDays.find((day) => day.date === dateKey)).filter(Boolean) as AvailableDay[],
    [availableDays, selectedDates]
  )
  const groupedDays = useMemo(() => {
    const groups: { timeKey: string; days: AvailableDay[]; timeStrs: string[] }[] = []
    for (const day of selectedAvailableDays) {
      const timeStrs = day.slots
        .map((s) => new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))
        .sort()
      const timeKey = timeStrs.join(",")
      const existing = groups.find((g) => g.timeKey === timeKey)
      if (existing) {
        existing.days.push(day)
      } else {
        groups.push({ timeKey, days: [day], timeStrs })
      }
    }
    return groups
  }, [selectedAvailableDays])
  const activeDaySlots = availableDays.find((day) => day.date === activeDate)?.slots ?? []

  const markersByDate = useMemo<Record<string, CalendarMarker[]>>(
    () =>
      Object.fromEntries(
        availableDays.map((day: AvailableDay) => [
          day.date,
          [{ tone: "availability", label: "Horários", count: day.slots.length }]
        ])
      ),
    [availableDays]
  )

  const toggleSlotSelection = (slot: string) => {
    setSelectedSlots((prev) =>
      prev.includes(slot)
        ? prev.filter((item) => item !== slot)
        : [...prev, slot].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    )
  }

  const toggleSlotsSelection = (slotsToToggle: string[]) => {
    if (slotsToToggle.length === 0) return
    setSelectedSlots((prev) => {
      const allSelected = slotsToToggle.every((s) => prev.includes(s))
      if (allSelected) {
        return prev.filter((s) => !slotsToToggle.includes(s))
      } else {
        const next = new Set(prev)
        slotsToToggle.forEach((s) => next.add(s))
        return Array.from(next).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      }
    })
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

  const handleSelectDate = (dateKey: string) => {
    const date = parseDateKey(dateKey)
    setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setActiveDate(dateKey)

    if (!availableDates.has(dateKey)) {
      return
    }

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

    const rangeDates: string[] = []
    for (let cursor = new Date(rangeStart); cursor <= rangeEnd; cursor.setDate(cursor.getDate() + 1)) {
      const dateKey = formatDateKey(cursor)
      if (availableDates.has(dateKey)) {
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
      return prev.filter((dateKey) => !rangeDates.includes(dateKey))
    })
    setActiveDate(rangeDates[rangeDates.length - 1])
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

      {showForm && (
        <form className="booking-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <ScheduleCalendar
              month={displayMonth}
              selectedDates={selectedDates}
              activeDate={activeDate}
              markersByDate={markersByDate}
              onMonthChange={setDisplayMonth}
              onSelectDate={handleSelectDate}
              onRangeSelect={handleRangeSelect}
              title="1. Selecione um ou mais dias"
              subtitle="Clique para adicionar ou remover dias com horários livres. Você pode arrastar para selecionar vários."
              toolbar={
                <label className="booking-duration-toolbar" htmlFor={`duration-${instructor.id}`}>
                  <span>Duração</span>
                  <select
                    id={`duration-${instructor.id}`}
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4].map((value) => (
                      <option key={value} value={value}>
                        {value} hora{value > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              }
              contextualPanel={
                <div className="booking-calendar-summary">
                  <strong>
                    {selectedDates.length > 0
                      ? `${selectedDates.length} dia(s) selecionado(s)`
                      : `Dia em foco: ${formatLongDate(activeDate)}`}
                  </strong>
                  <span>
                    {selectedDates.length > 0
                      ? "Agora escolha os horários desejados em cada dia abaixo."
                      : availableDates.has(activeDate)
                        ? `${activeDaySlots.length} horário(s) disponível(is) neste dia. Clique para selecionar.`
                        : "Este dia não possui horários disponíveis para a duração escolhida."}
                  </span>
                </div>
              }
            />
          </div>
          <div className="form-group">
            <label>2. Escolha os horários dentro dos dias selecionados</label>
            {loadingSlots ? (
              <p className="booking-helper-text">Carregando calendário...</p>
            ) : availableDays.length === 0 ? (
              <p className="booking-helper-text">Nenhuma disponibilidade encontrada neste mês.</p>
            ) : selectedAvailableDays.length === 0 ? (
              <p className="booking-helper-text">
                {availableDates.has(activeDate)
                  ? "Clique novamente no dia em foco para selecioná-lo, ou escolha vários dias com horários livres."
                  : "Este dia não possui horários disponíveis. Escolha um dia marcado no calendário para ver os horários."}
              </p>
            ) : (
              <div className="booking-slot-sections">
                {groupedDays.map((group, index) => (
                  <section
                    key={`${index}-${group.timeKey}`}
                    className={`booking-slot-section${group.days.some((d) => d.date === activeDate) ? " active" : ""}`}
                  >
                    <div className="booking-slot-section-header" style={{ alignItems: "flex-start" }}>
                      <div className="selected-slot-list" style={{ flex: 1 }}>
                        {group.days.map((d) => {
                          const [, month, day] = d.date.split("-")
                          return (
                            <span key={d.date} className="selected-slot-chip" style={{ cursor: "default" }}>
                              {day}/{month}
                            </span>
                          )
                        })}
                      </div>
                      <span style={{ whiteSpace: "nowrap", paddingTop: "0.45rem" }}>
                        {group.timeStrs.length} horário(s)
                      </span>
                    </div>
                    <div className="booking-slot-grid">
                      {group.timeStrs.map((timeStr) => {
                        const slotsForThisTime = group.days
                          .map((d) =>
                            d.slots.find(
                              (s) =>
                                new Date(s).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit"
                                }) === timeStr
                            )
                          )
                          .filter(Boolean) as string[]

                        const allSelected = slotsForThisTime.length > 0 && slotsForThisTime.every((s) => selectedSlots.includes(s))
                        const someSelected = slotsForThisTime.some((s) => selectedSlots.includes(s))

                        return (
                          <button
                            key={timeStr}
                            type="button"
                            className={`booking-slot ${allSelected ? "active" : someSelected ? "partial" : ""}`}
                            onClick={() => toggleSlotsSelection(slotsForThisTime)}
                            title={someSelected && !allSelected ? "Alguns dias estão selecionados. Clique para selecionar todos." : undefined}
                          >
                            {timeStr}
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
          <div className="form-group">
            <label>3. Revise os horários selecionados</label>
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

      {message && <div className="booking-success">{message}</div>}
      {error && <div className="booking-error">{error}</div>}

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
