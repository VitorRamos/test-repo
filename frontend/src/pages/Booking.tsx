import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ScheduleCalendar } from "../components/ScheduleCalendar"
import { api } from "../services/api"
import type { AvailableDay, Instructor, Lesson, User } from "../types"
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
import "../components/InstructorCard.css"
import "./Booking.css"

const today = new Date()
const todayKey = formatDateKey(today)
const formatDateInput = (value: Date) => value.toISOString().split("T")[0]

interface BookingPageProps {
  user: User | null
}

export function BookingPage({ user: _user }: BookingPageProps) {
  const { instructorId = "" } = useParams()
  const navigate = useNavigate()
  const [instructor, setInstructor] = useState<Instructor | null>(null)
  const [loading, setLoading] = useState(true)
  const [durationHours, setDurationHours] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [availableDays, setAvailableDays] = useState<AvailableDay[]>([])
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [activeDate, setActiveDate] = useState(todayKey)
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [displayMonth, setDisplayMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const sortDateKeys = (values: string[]) =>
    [...values].sort((left, right) => parseDateKey(left).getTime() - parseDateKey(right).getTime())

  useEffect(() => {
    let cancelled = false

    const loadInstructor = async () => {
      setLoading(true)
      try {
        const data = await api.instructors.getById(instructorId) as Instructor
        if (!cancelled) {
          setInstructor(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Falha ao carregar instrutor.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    if (instructorId) {
      void loadInstructor()
    } else {
      setLoading(false)
      setError("Instrutor não encontrado.")
    }

    return () => {
      cancelled = true
    }
  }, [instructorId])

  const loadSlots = async () => {
    if (!instructor) {
      return
    }

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
    if (!instructor) {
      return
    }
    void loadSlots()
  }, [displayMonth, durationHours, instructor])

  const availableDates = useMemo(() => new Set(availableDays.map((day) => day.date)), [availableDays])
  const selectedAvailableDays = useMemo(
    () =>
      sortDateKeys(selectedDates)
        .map((dateKey) => availableDays.find((day) => day.date === dateKey))
        .filter(Boolean) as AvailableDay[],
    [availableDays, selectedDates]
  )

  const groupedDays = useMemo(() => {
    const groups: { timeKey: string; days: AvailableDay[]; timeStrs: string[] }[] = []
    for (const day of selectedAvailableDays) {
      const timeStrs = day.slots
        .map((slot) => new Date(slot).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))
        .sort()
      const timeKey = timeStrs.join(",")
      const existing = groups.find((group) => group.timeKey === timeKey)
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
    if (slotsToToggle.length === 0) {
      return
    }

    setSelectedSlots((prev) => {
      const allSelected = slotsToToggle.every((slot) => prev.includes(slot))
      if (allSelected) {
        return prev.filter((slot) => !slotsToToggle.includes(slot))
      }

      const next = new Set(prev)
      slotsToToggle.forEach((slot) => next.add(slot))
      return Array.from(next).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    })
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
    const [rangeStart, rangeEnd] = start.getTime() <= end.getTime() ? [start, end] : [end, start]

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!instructor) {
      return
    }

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
      setSelectedSlots([])
      setSelectedDates([])
      setDurationHours(1)
      if (selectedDates.length > 0) {
        setActiveDate(selectedDates[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao agendar a aula.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="booking-page"><p>Carregando instrutor...</p></div>
  }

  if (!instructor) {
    return (
      <div className="booking-page">
        <div className="booking-page-card">
          <p>{error || "Instrutor não encontrado."}</p>
          <Link className="booking-page-link" to="/">Voltar para a busca</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="booking-page">
      <div className="booking-page-card">
        <div className="booking-page-header">
          <div>
            <Link className="booking-page-link" to="/">Voltar para a busca</Link>
            <h1>Agendar Aula</h1>
            <p>
              {instructor.name} • {instructor.city}, {instructor.state}
            </p>
          </div>
          <div className="booking-page-summary">
            <strong>R$ {instructor.price_per_hour.toFixed(2)}/hora</strong>
            <span>{instructor.detran_license}</span>
          </div>
        </div>

        <form className="booking-page-form" onSubmit={handleSubmit}>
          <div className="booking-page-section">
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
                    onChange={(event) => setDurationHours(Number(event.target.value))}
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

          <div className="booking-page-section">
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
                    className={`booking-slot-section${group.days.some((day) => day.date === activeDate) ? " active" : ""}`}
                  >
                    <div className="booking-slot-section-header booking-page-slot-header">
                      <div className="selected-slot-list booking-page-chip-list">
                        {group.days.map((day) => {
                          const [, month, dayNumber] = day.date.split("-")
                          return (
                            <span key={day.date} className="selected-slot-chip booking-page-static-chip">
                              {dayNumber}/{month}
                            </span>
                          )
                        })}
                      </div>
                      <span className="booking-page-slot-count">{group.timeStrs.length} horário(s)</span>
                    </div>
                    <div className="booking-slot-grid">
                      {group.timeStrs.map((timeStr) => {
                        const slotsForThisTime = group.days
                          .map((day) =>
                            day.slots.find(
                              (slot) =>
                                new Date(slot).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit"
                                }) === timeStr
                            )
                          )
                          .filter(Boolean) as string[]

                        const allSelected =
                          slotsForThisTime.length > 0 &&
                          slotsForThisTime.every((slot) => selectedSlots.includes(slot))
                        const someSelected = slotsForThisTime.some((slot) => selectedSlots.includes(slot))

                        return (
                          <button
                            key={timeStr}
                            type="button"
                            className={`booking-slot ${allSelected ? "active" : someSelected ? "partial" : ""}`}
                            onClick={() => toggleSlotsSelection(slotsForThisTime)}
                            title={
                              someSelected && !allSelected
                                ? "Alguns dias estão selecionados. Clique para selecionar todos."
                                : undefined
                            }
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

          <div className="booking-page-section">
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

          <div className="booking-page-actions">
            <button className="book-btn" type="submit" disabled={submitting}>
              {submitting
                ? "Agendando..."
                : selectedSlots.length > 0
                  ? `Confirmar ${selectedSlots.length} agendamento${selectedSlots.length > 1 ? "s" : ""}`
                  : "Confirmar agendamentos"}
            </button>
            <button className="secondary-btn" type="button" onClick={() => navigate("/my-bookings")}>
              Ver meus agendamentos
            </button>
          </div>
        </form>

        {message && <div className="booking-success">{message}</div>}
        {error && <div className="booking-error">{error}</div>}
      </div>
    </div>
  )
}
