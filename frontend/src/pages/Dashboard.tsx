import { useEffect, useMemo, useState } from "react"
import { ScheduleCalendar } from "../components/ScheduleCalendar"
import { api } from "../services/api"
import type { Availability, Lesson, Review, User } from "../types"
import {
  addDays,
  endOfMonth,
  endOfWeek,
  formatDateKey,
  formatLongDate,
  parseDateKey,
  startOfMonth,
  startOfWeek,
  type CalendarMarker
} from "../utils/calendar"
import "./Dashboard.css"

const today = new Date()
const todayKey = formatDateKey(today)
const defaultMonth = new Date(today.getFullYear(), today.getMonth(), 1)

const isValidTimeRange = (range: { start_time: string; end_time: string }) =>
  range.start_time !== "" && range.end_time !== "" && range.end_time > range.start_time

const lessonStatusLabel: Record<string, string> = {
  pending_instructor: "Solicitação pendente",
  confirmed: "Aula confirmada",
  completed: "Concluída",
  cancelled: "Cancelada",
  pending_payment: "Pagamento pendente"
}

const activeLessonStatuses = ["pending_instructor", "confirmed", "pending_payment"] as const

const getLessonDateKey = (lesson: Lesson) => formatDateKey(new Date(lesson.scheduled_start))

const isActiveLesson = (lesson: Lesson) => activeLessonStatuses.includes(lesson.status as (typeof activeLessonStatuses)[number])

const getPreferredActiveDate = (dateKeys: string[]) => {
  if (dateKeys.length === 0) {
    return null
  }

  if (dateKeys.includes(todayKey)) {
    return todayKey
  }

  const nextUpcoming = dateKeys.find((dateKey) => dateKey >= todayKey)
  if (nextUpcoming) {
    return nextUpcoming
  }

  return dateKeys[dateKeys.length - 1]
}

const TIME_RANGE_PRESETS = [
  { value: "08:00-12:00", label: "Manhã · 08:00-12:00" },
  { value: "13:00-18:00", label: "Tarde · 13:00-18:00" },
  { value: "18:00-21:00", label: "Noite · 18:00-21:00" },
  { value: "08:00-18:00", label: "Dia inteiro · 08:00-18:00" },
  { value: "custom", label: "Personalizado" }
] as const

const formatDateRanges = (dateKeys: string[]) => {
  if (dateKeys.length === 0) {
    return ""
  }

  const sorted = [...dateKeys].sort()
  const ranges: Array<{ start: string; end: string }> = []
  let start = sorted[0]
  let end = sorted[0]

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index]
    const expectedNext = formatDateKey(addDays(parseDateKey(end), 1))

    if (current === expectedNext) {
      end = current
      continue
    }

    ranges.push({ start, end })
    start = current
    end = current
  }

  ranges.push({ start, end })

  return ranges
    .map((range) => {
      const startLabel = parseDateKey(range.start).toLocaleDateString("pt-BR")
      const endLabel = parseDateKey(range.end).toLocaleDateString("pt-BR")
      return range.start === range.end ? startLabel : `${startLabel} até ${endLabel}`
    })
    .join(" • ")
}

const formatLessonDuration = (lesson: Lesson) => {
  const hours =
    (new Date(lesson.scheduled_end).getTime() - new Date(lesson.scheduled_start).getTime()) /
    (1000 * 60 * 60)

  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`
}

const availabilityMatchesDate = (slot: Availability, dateKey: string) => {
  if (!slot.start_date || !slot.end_date) {
    return false
  }

  if (dateKey < slot.start_date || dateKey > slot.end_date) {
    return false
  }

  return slot.weekdays.includes(parseDateKey(dateKey).getDay())
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

interface InstructorScheduleBoardProps {
  lessons: Lesson[]
  onConfirm: (lessonId: string) => Promise<void>
  onConfirmAll: (lessonIds: string[]) => Promise<void>
  onValidateCode: (lessonId: string, code: string) => Promise<void>
  onCancel: (lessonId: string) => Promise<void>
  onCancelAll: (lessonIds: string[]) => Promise<void>
  confirmingId: string | null
  confirmingAll: boolean
  validatingId: string | null
  cancelingId: string | null
  cancelingAll: boolean
  requestError: string | null
  validationErrors: Record<string, string | null>
}

function InstructorScheduleBoard({
  lessons,
  onConfirm,
  onConfirmAll,
  onValidateCode,
  onCancel,
  onCancelAll,
  confirmingId,
  confirmingAll,
  validatingId,
  cancelingId,
  cancelingAll,
  requestError,
  validationErrors
}: InstructorScheduleBoardProps) {
  const [selectionFilter, setSelectionFilter] = useState<"all" | "availability" | "lessons">("lessons")
  const [availability, setAvailability] = useState<Availability[]>([])
  const [displayMonth, setDisplayMonth] = useState(defaultMonth)
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<(typeof TIME_RANGE_PRESETS)[number]["value"]>("08:00-12:00")
  const [draft, setDraft] = useState({ start_time: "08:00", end_time: "12:00" })
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    void fetchAvailability()
  }, [])

  const fetchAvailability = async () => {
    try {
      const data = await api.instructors.getAvailability()
      setAvailability(data || [])
    } catch (error) {
      console.error("Erro ao carregar disponibilidades", error)
    }
  }

  const selectDate = (dateKey: string) => {
    const nextSelection = selectedDates.includes(dateKey)
      ? selectedDates.filter((item) => item !== dateKey)
      : [...selectedDates, dateKey].sort()

    setSelectedDates(nextSelection)
    setActiveDate(nextSelection.length === 0 ? null : nextSelection.includes(dateKey) ? dateKey : nextSelection[nextSelection.length - 1])
    const date = parseDateKey(dateKey)
    setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setPublishError(null)
  }

  const handleRangeSelect = (startDate: string, endDate: string, mode: "add" | "remove") => {
    const start = parseDateKey(startDate)
    const end = parseDateKey(endDate)
    const ordered = start.getTime() <= end.getTime() ? [startDate, endDate] : [endDate, startDate]
    const rangeStart = parseDateKey(ordered[0])
    const rangeEnd = parseDateKey(ordered[1])

    const rangeDates: string[] = []
    for (
      let cursor = rangeStart;
      cursor.getTime() <= rangeEnd.getTime();
      cursor = addDays(cursor, 1)
    ) {
      rangeDates.push(formatDateKey(cursor))
    }

    setSelectedDates((prev) => {
      let nextSelection: string[]
      if (mode === "add") {
        nextSelection = Array.from(new Set([...prev, ...rangeDates])).sort()
      } else {
        nextSelection = prev.filter((dateKey) => !rangeDates.includes(dateKey))
      }

      setActiveDate(nextSelection.length === 0 ? null : nextSelection.includes(endDate) ? endDate : nextSelection[nextSelection.length - 1])
      return nextSelection
    })
    setPublishError(null)
  }

  const resetSelectionToToday = () => {
    setSelectedDates([todayKey])
    setActiveDate(todayKey)
    setDisplayMonth(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  const handlePresetChange = (value: (typeof TIME_RANGE_PRESETS)[number]["value"]) => {
    setSelectedPreset(value)
    if (value === "custom") {
      return
    }

    const [start_time, end_time] = value.split("-")
    setDraft({ start_time, end_time })
  }

  const handlePublish = async () => {
    setPublishError(null)

    if (selectedDates.length === 0) {
      setPublishError("Selecione pelo menos um dia no calendário.")
      return
    }

    if (!isValidTimeRange(draft)) {
      setPublishError("O horário final deve ser maior que o inicial.")
      return
    }

    setPublishing(true)
    try {
      const createdGroups = await Promise.all(
        selectedDates.map((dateKey) =>
          api.instructors.createAvailability({
            start_date: dateKey,
            end_date: dateKey,
            weekdays: [parseDateKey(dateKey).getDay()],
            time_ranges: [draft]
          })
        )
      )
      setAvailability((prev) => [...prev, ...createdGroups.flat()])
      setPublishError(null)
      setDraft({ start_time: "08:00", end_time: "12:00" })
      setSelectedPreset("08:00-12:00")
      setSelectedDates([])
      setActiveDate(null)
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Falha ao publicar disponibilidade.")
    } finally {
      setPublishing(false)
    }
  }

  const handleDeleteAvailabilityGroup = async (ids: string[], clearSelection = false) => {
    setPublishError(null)
    try {
      await Promise.all(ids.map((id) => api.instructors.deleteAvailability(id)))
      const idSet = new Set(ids)
      setAvailability((prev) => prev.filter((slot) => !idSet.has(slot.id)))
      if (clearSelection) {
        setSelectedDates([])
        setActiveDate(null)
      }
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Falha ao remover disponibilidades.")
    }
  }

  const visibleRange = useMemo(() => {
    const start = startOfWeek(startOfMonth(displayMonth))
    const end = endOfWeek(endOfMonth(displayMonth))
    return { start, end }
  }, [displayMonth])

  const markersByDate = useMemo<Record<string, CalendarMarker[]>>(() => {
    const markerMap: Record<string, CalendarMarker[]> = {}

    const upsertMarker = (dateKey: string, marker: CalendarMarker) => {
      const current = markerMap[dateKey] || []
      const existing = current.find((item) => item.tone === marker.tone && item.label === marker.label)
      if (existing) {
        existing.count = (existing.count || 0) + (marker.count || 1)
      } else {
        current.push({ ...marker, count: marker.count || 1 })
      }
      markerMap[dateKey] = current
    }

    for (let cursor = new Date(visibleRange.start); cursor <= visibleRange.end; cursor = addDays(cursor, 1)) {
      const dateKey = formatDateKey(cursor)
      const availabilityCount = availability.filter((slot) => availabilityMatchesDate(slot, dateKey)).length

      if (availabilityCount > 0) {
        upsertMarker(dateKey, { tone: "availability", label: "Disponível", count: availabilityCount })
      }
    }

    lessons.forEach((lesson) => {
      const dateKey = getLessonDateKey(lesson)
      const tone =
        lesson.status === "pending_instructor"
          ? "pending"
          : lesson.status === "confirmed"
            ? "confirmed"
            : lesson.status === "cancelled"
              ? "cancelled"
              : "completed"

      const label =
        lesson.status === "pending_instructor"
          ? "Solicitação"
          : lesson.status === "confirmed"
            ? "Confirmada"
            : lesson.status === "cancelled"
              ? "Cancelada"
              : "Concluída"

      upsertMarker(dateKey, { tone, label, count: 1 })
    })

    return markerMap
  }, [availability, lessons, visibleRange.end, visibleRange.start])

  const selectedLessonsByDate = useMemo(() => {
    const selectedDateSet = new Set(selectedDates)
    const grouped = new Map<string, Lesson[]>()

    lessons
      .filter((lesson) => isActiveLesson(lesson))
      .filter((lesson) =>
        selectedDateSet.size > 0
          ? selectedDateSet.has(getLessonDateKey(lesson))
          : activeDate !== null && getLessonDateKey(lesson) === activeDate
      )
      .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
      .forEach((lesson) => {
        const dateKey = getLessonDateKey(lesson)
        const current = grouped.get(dateKey) || []
        current.push(lesson)
        grouped.set(dateKey, current)
      })

    const orderedDateKeys = Array.from(grouped.keys()).sort((left, right) => {
      if (activeDate && left === activeDate) {
        return -1
      }
      if (activeDate && right === activeDate) {
        return 1
      }
      return left.localeCompare(right)
    })

    return orderedDateKeys.map((dateKey) => ({
      dateKey,
      lessons: grouped.get(dateKey) || []
    }))
  }, [activeDate, lessons, selectedDates])

  const selectedAvailability = useMemo(
    () => {
      if (selectedDates.length === 0) {
        return []
      }

      return availability
        .filter((slot) => selectedDates.some((dateKey) => availabilityMatchesDate(slot, dateKey)))
        .sort((a, b) => {
          const leftDate = a.start_date || ""
          const rightDate = b.start_date || ""
          if (leftDate !== rightDate) {
            return leftDate.localeCompare(rightDate)
          }
          return a.start_time.localeCompare(b.start_time)
        })
    },
    [availability, selectedDates]
  )

  const groupedSelectedAvailability = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string
        start_time: string
        end_time: string
        dateKeys: string[]
        slotIds: string[]
      }
    >()

    selectedAvailability.forEach((slot) => {
      const matchedDates = selectedDates.filter((dateKey) => availabilityMatchesDate(slot, dateKey))
      if (matchedDates.length === 0) {
        return
      }

      const groupKey = `${slot.start_time}-${slot.end_time}`
      const existing = groups.get(groupKey)

      if (existing) {
        existing.dateKeys.push(...matchedDates)
        existing.slotIds.push(slot.id)
        return
      }

      groups.set(groupKey, {
        key: groupKey,
        start_time: slot.start_time,
        end_time: slot.end_time,
        dateKeys: [...matchedDates],
        slotIds: [slot.id]
      })
    })

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        dateKeys: Array.from(new Set(group.dateKeys)).sort(),
        slotIds: Array.from(new Set(group.slotIds))
      }))
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [selectedAvailability, selectedDates])

  const hasSelection = selectedDates.length > 0
  const activeLessons = useMemo(
    () => lessons.filter((lesson) => isActiveLesson(lesson)),
    [lessons]
  )
  const pendingSelectedLessons = useMemo(
    () =>
      selectedLessonsByDate.flatMap(({ lessons: groupedLessons }) =>
        groupedLessons.filter((lesson) => lesson.status === "pending_instructor")
      ),
    [selectedLessonsByDate]
  )
  const cancelableSelectedLessons = useMemo(
    () =>
      selectedLessonsByDate.flatMap(({ lessons: groupedLessons }) =>
        groupedLessons.filter((lesson) => ["pending_instructor", "confirmed"].includes(lesson.status))
      ),
    [selectedLessonsByDate]
  )

  const selectableDaysByFilter = useMemo(() => {
    const availabilityDates = new Set<string>()

    Object.entries(markersByDate).forEach(([dateKey, markers]) => {
      if (markers.some((marker) => marker.tone === "availability")) {
        availabilityDates.add(dateKey)
      }
    })

    const lessonDates = new Set(activeLessons.map((lesson) => getLessonDateKey(lesson)))

    const allDates = Array.from(new Set([...availabilityDates, ...lessonDates])).sort()

    return {
      all: allDates,
      availability: Array.from(availabilityDates).sort(),
      lessons: Array.from(lessonDates).sort()
    }
  }, [activeLessons, markersByDate])

  useEffect(() => {
    if (selectedDates.length > 0) {
      return
    }

    const nextSelection = selectableDaysByFilter[selectionFilter]
    if (nextSelection.length === 0) {
      return
    }

    const nextActiveDate = getPreferredActiveDate(nextSelection)
    setSelectedDates(nextSelection)
    setActiveDate(nextActiveDate)

    if (nextActiveDate) {
      const date = parseDateKey(nextActiveDate)
      setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    }
  }, [selectableDaysByFilter, selectedDates.length, selectionFilter])

  const handleSelectionFilterChange = (value: "all" | "availability" | "lessons") => {
    setSelectionFilter(value)
    const nextSelection = selectableDaysByFilter[value]
    setSelectedDates(nextSelection)
    setActiveDate(getPreferredActiveDate(nextSelection))

    const nextActiveDate = getPreferredActiveDate(nextSelection)
    if (nextActiveDate) {
      const date = parseDateKey(nextActiveDate)
      setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    }
  }

  const handleClearSelection = () => {
    setSelectedDates([])
    setActiveDate(null)
  }

  return (
    <div className="dashboard-card actions-card span-2" id="agenda">
      <div className="agenda-workspace">
        <div className="agenda-main">
          <ScheduleCalendar
            month={displayMonth}
            selectedDates={selectedDates}
            activeDate={activeDate ?? undefined}
            markersByDate={markersByDate}
            onMonthChange={setDisplayMonth}
            onSelectDate={selectDate}
            onRangeSelect={handleRangeSelect}
            title="📊 Central do Instrutor"
            subtitle="Selecione dias no calendário e publique horários em poucos cliques."
            contextualPanel={
              <div className="calendar-action-bar">
                <div className="calendar-action-copy">
                  <strong>1. Selecione os dias</strong>
                  <span>2. Escolha um período</span>
                  <span>3. Publique</span>
                </div>

                <div className="calendar-action-controls">
                  <select
                    value={selectedPreset}
                    onChange={(event) =>
                      handlePresetChange(
                        event.target.value as (typeof TIME_RANGE_PRESETS)[number]["value"]
                      )
                    }
                  >
                    {TIME_RANGE_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>

                  {selectedPreset === "custom" && (
                    <div className="calendar-custom-range">
                      <input
                        type="time"
                        value={draft.start_time}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, start_time: event.target.value }))
                        }
                      />
                      <input
                        type="time"
                        value={draft.end_time}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, end_time: event.target.value }))
                        }
                      />
                    </div>
                  )}

                  <div className="calendar-action-buttons">
                    <button
                      className="action-btn"
                      type="button"
                      onClick={handlePublish}
                      disabled={publishing || !hasSelection}
                    >
                      {publishing ? "Publicando..." : `Publicar em ${selectedDates.length || 0} dia(s)`}
                    </button>
                  </div>
                </div>
              </div>
            }
          />

          {(requestError || publishError) && (
            <div className="schedule-errors">
              {requestError && <p className="confirm-error">{requestError}</p>}
              {publishError && <p className="confirm-error">{publishError}</p>}
            </div>
          )}
        </div>

        <div className="schedule-detail-card schedule-editor-card agenda-side">
          <div className="calendar-secondary-actions side-actions">
            <button className="calendar-ghost-btn" type="button" onClick={resetSelectionToToday}>
              Hoje
            </button>
            <div className="section-filter schedule-selection-filter">
              <label htmlFor="agenda-selection-filter">Filtrar</label>
              <select
                id="agenda-selection-filter"
                value={selectionFilter}
                onChange={(event) =>
                  handleSelectionFilterChange(
                    event.target.value as "all" | "availability" | "lessons"
                  )
                }
              >
                <option value="all">Com eventos</option>
                <option value="availability">Disponibilidades</option>
                <option value="lessons">Solicitações e aulas</option>
              </select>
            </div>
            <button
              className="calendar-ghost-btn danger"
              type="button"
              onClick={handleClearSelection}
              disabled={!hasSelection}
            >
              Limpar seleção
            </button>
          </div>

          <div className="schedule-selection-bar">
            <div>
              <h4>{selectedDates.length} dia(s) selecionado(s)</h4>
              <p>
                {activeDate
                  ? `Dia ativo: ${formatLongDate(activeDate)}. A publicação abaixo vale para toda a seleção.`
                  : "Nenhum dia ativo. Selecione um ou mais dias para publicar horários."}
              </p>
            </div>
          </div>

          <div className="schedule-selection-chip-list">
            {selectedDates.map((dateKey) => (
              <button
                key={dateKey}
                type="button"
                className={`schedule-selection-chip${dateKey === activeDate ? " active" : ""}`}
                onClick={() => {
                  setActiveDate(dateKey)
                  const date = parseDateKey(dateKey)
                  setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1))
                }}
              >
                {parseDateKey(dateKey).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit"
                })}
              </button>
            ))}
          </div>

          <div className="schedule-section">
            <div className="schedule-section-head">
              <strong>Disponibilidades na seleção</strong>
              {groupedSelectedAvailability.length > 0 && (
                <button
                  className="cancel-btn"
                  type="button"
                  onClick={() =>
                    void handleDeleteAvailabilityGroup(
                      groupedSelectedAvailability.flatMap((group) => group.slotIds),
                      true
                    )
                  }
                >
                  Remover todas
                </button>
              )}
            </div>

            {!hasSelection ? (
              <p className="schedule-helper">
                Selecione um ou mais dias para ver as disponibilidades publicadas.
              </p>
            ) : groupedSelectedAvailability.length === 0 ? (
              <p className="schedule-helper">
                Nenhuma disponibilidade publicada para os dias selecionados.
              </p>
            ) : (
              <div className="schedule-entry-list">
                {groupedSelectedAvailability.map((group) => (
                  <div key={group.key} className="schedule-entry availability">
                    <div>
                      <strong>{group.start_time} - {group.end_time}</strong>
                      <span>{formatDateRanges(group.dateKeys)}</span>
                    </div>
                    <button
                      className="cancel-btn"
                      type="button"
                      onClick={() => void handleDeleteAvailabilityGroup(group.slotIds)}
                    >
                      Remover grupo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="schedule-section">
            <div className="schedule-section-head">
              <strong>Solicitações e aulas da seleção</strong>
              <div className="schedule-bulk-actions">
                {pendingSelectedLessons.length > 1 && (
                  <button
                    className="action-btn"
                    type="button"
                    onClick={() => void onConfirmAll(pendingSelectedLessons.map((lesson) => lesson.id))}
                    disabled={confirmingAll || cancelingAll}
                  >
                    {confirmingAll ? "Confirmando..." : `Confirmar todas (${pendingSelectedLessons.length})`}
                  </button>
                )}
                {cancelableSelectedLessons.length > 1 && (
                  <button
                    className="cancel-btn"
                    type="button"
                    onClick={() => void onCancelAll(cancelableSelectedLessons.map((lesson) => lesson.id))}
                    disabled={cancelingAll || confirmingAll}
                  >
                    {cancelingAll ? "Cancelando..." : `Cancelar todas (${cancelableSelectedLessons.length})`}
                  </button>
                )}
              </div>
            </div>

            {activeDate === null && selectedDates.length === 0 ? (
              <p className="schedule-helper">Selecione um dia para ver solicitações e aulas.</p>
            ) : selectedLessonsByDate.length === 0 ? (
              <p className="schedule-helper">Nenhuma solicitação ou aula ativa nas datas selecionadas.</p>
            ) : (
              <div className="schedule-entry-list">
                {selectedLessonsByDate.map(({ dateKey, lessons: groupedLessons }) => (
                  <div key={dateKey} className="schedule-day-group">
                    <div className="schedule-day-group-header">
                      <strong>
                        {formatLongDate(dateKey)}
                        {dateKey === activeDate ? " · Dia ativo" : ""}
                      </strong>
                      <span>{groupedLessons.length} item(ns)</span>
                    </div>

                    <div className="schedule-entry-list">
                      {groupedLessons.map((lesson) => (
                        <div key={lesson.id} className={`schedule-entry ${lesson.status}`}>
                          <div className="schedule-lesson-meta">
                            <strong>
                              {new Date(lesson.scheduled_start).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}{" "}
                              • {formatLessonDuration(lesson)}
                            </strong>
                            <span>{lessonStatusLabel[lesson.status] || lesson.status}</span>
                            <span>Aluno: {lesson.student_email || "Não informado"}</span>
                          </div>

                          {lesson.status === "pending_instructor" && (
                            <div className="booking-actions">
                              <button
                                className="action-btn"
                                type="button"
                                onClick={() => void onConfirm(lesson.id)}
                                disabled={confirmingId === lesson.id}
                              >
                                {confirmingId === lesson.id ? "Confirmando..." : "Confirmar"}
                              </button>
                              <button
                                className="cancel-btn"
                                type="button"
                                onClick={() => void onCancel(lesson.id)}
                                disabled={cancelingId === lesson.id}
                              >
                                {cancelingId === lesson.id ? "Cancelando..." : "Cancelar"}
                              </button>
                            </div>
                          )}

                          {lesson.status === "confirmed" && (
                            <>
                              <div className="schedule-confirm-row">
                                <input
                                  type="text"
                                  placeholder="Código do aluno"
                                  value={codeInputs[lesson.id] || ""}
                                  onChange={(event) =>
                                    setCodeInputs((prev) => ({
                                      ...prev,
                                      [lesson.id]: event.target.value
                                    }))
                                  }
                                />
                                <button
                                  className="action-btn"
                                  type="button"
                                  onClick={() =>
                                    void onValidateCode(lesson.id, codeInputs[lesson.id] || "")
                                  }
                                  disabled={validatingId === lesson.id}
                                >
                                  {validatingId === lesson.id ? "Validando..." : "Validar código"}
                                </button>
                                <button
                                  className="cancel-btn"
                                  type="button"
                                  onClick={() => void onCancel(lesson.id)}
                                  disabled={cancelingId === lesson.id}
                                >
                                  {cancelingId === lesson.id ? "Cancelando..." : "Cancelar"}
                                </button>
                              </div>
                              {validationErrors[lesson.id] && (
                                <p className="confirm-error inline-error">{validationErrors[lesson.id]}</p>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function InstructorPortal({ user }: DashboardProps) {
  const [stats, setStats] = useState<InstructorStats | null>(null)
  const [earnings, setEarnings] = useState<Earnings | null>(null)
  const [loading, setLoading] = useState(true)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmingAll, setConfirmingAll] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string | null>>({})
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [cancelingAll, setCancelingAll] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<"all" | "completed" | "cancelled">("completed")

  useEffect(() => {
    void fetchData({ showLoading: true })
  }, [])

  const fetchData = async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
    if (showLoading) {
      setLoading(true)
    }
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
      if (showLoading) {
        setLoading(false)
      }
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

  const handleConfirmAll = async (lessonIds: string[]) => {
    if (lessonIds.length === 0) {
      return
    }

    const confirmMessage =
      lessonIds.length === 1
        ? "Confirmar esta solicitação de aula?"
        : `Confirmar ${lessonIds.length} solicitações de aula?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    setConfirmingAll(true)
    setRequestError(null)
    try {
      const results = await Promise.allSettled(
        lessonIds.map(async (lessonId) => {
          await api.lessons.confirmBooking(lessonId)
        })
      )

      const failedCount = results.filter((result) => result.status === "rejected").length
      await fetchData()

      if (failedCount > 0) {
        setRequestError(
          failedCount === lessonIds.length
            ? "Não foi possível confirmar as solicitações selecionadas."
            : `${failedCount} solicitação(ões) não puderam ser confirmadas.`
        )
      }
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Falha ao confirmar solicitações")
    } finally {
      setConfirmingAll(false)
    }
  }

  const handleValidateCode = async (lessonId: string, code: string) => {
    setValidatingId(lessonId)
    setValidationErrors((prev) => ({ ...prev, [lessonId]: null }))
    try {
      await api.lessons.confirmCode(lessonId, code)
      setValidationErrors((prev) => ({ ...prev, [lessonId]: null }))
      await fetchData()
    } catch (err) {
      setValidationErrors((prev) => ({
        ...prev,
        [lessonId]: err instanceof Error ? err.message : "Falha ao validar código"
      }))
    } finally {
      setValidatingId(null)
    }
  }

  const handleCancel = async (lessonId: string) => {
    const lesson = lessons.find((item) => item.id === lessonId)
    const confirmMessage =
      lesson?.status === "confirmed"
        ? "Cancelar esta aula confirmada?"
        : "Cancelar esta solicitação de aula?"

    if (!window.confirm(confirmMessage)) {
      return
    }

    setCancelingId(lessonId)
    if (lesson?.status === "confirmed") {
      setValidationErrors((prev) => ({ ...prev, [lessonId]: null }))
    } else {
      setRequestError(null)
    }
    try {
      await api.lessons.cancelLesson(lessonId)
      await fetchData()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao cancelar aula"
      if (lesson?.status === "confirmed") {
        setValidationErrors((prev) => ({ ...prev, [lessonId]: message }))
      } else {
        setRequestError(message)
      }
    } finally {
      setCancelingId(null)
    }
  }

  const handleCancelAll = async (lessonIds: string[]) => {
    if (lessonIds.length === 0) {
      return
    }

    const confirmMessage =
      lessonIds.length === 1
        ? "Cancelar esta solicitação ou aula?"
        : `Cancelar ${lessonIds.length} solicitações/aulas?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    setCancelingAll(true)
    setRequestError(null)
    try {
      const results = await Promise.allSettled(
        lessonIds.map(async (lessonId) => {
          await api.lessons.cancelLesson(lessonId)
        })
      )

      const failedCount = results.filter((result) => result.status === "rejected").length
      await fetchData()

      if (failedCount > 0) {
        setRequestError(
          failedCount === lessonIds.length
            ? "Não foi possível cancelar as solicitações/aulas selecionadas."
            : `${failedCount} solicitação(ões)/aula(s) não puderam ser canceladas.`
        )
      }
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Falha ao cancelar solicitações/aulas")
    } finally {
      setCancelingAll(false)
    }
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
      <div className="dashboard-grid">
        <InstructorScheduleBoard
          lessons={lessons}
          onConfirm={handleConfirm}
          onConfirmAll={handleConfirmAll}
          onValidateCode={handleValidateCode}
          onCancel={handleCancel}
          onCancelAll={handleCancelAll}
          confirmingId={confirmingId}
          confirmingAll={confirmingAll}
          validatingId={validatingId}
          cancelingId={cancelingId}
          cancelingAll={cancelingAll}
          requestError={requestError}
          validationErrors={validationErrors}
        />

        <div className="dashboard-card welcome-card">
          <h2>Bem-vindo, {stats?.name}!</h2>
          <p className="location">📍 {stats?.city}, {stats?.state}</p>
          <p className="price">R$ {stats?.price_per_hour.toFixed(2)}/hora</p>
        </div>

        <div className="dashboard-card earnings-card compact-summary-card" id="ganhos">
          <div className="compact-summary-header">
            <h3>💰 Ganhos e indicadores</h3>
            <span className="compact-summary-badge">Resumo</span>
          </div>
          <div className="earnings-item">
            <span>Ganhos completos</span>
            <strong>R$ {earnings?.total_earnings.toFixed(2)}</strong>
          </div>
          <div className="earnings-item">
            <span>Ganhos pendentes</span>
            <strong>R$ {earnings?.pending_earnings.toFixed(2)}</strong>
          </div>
          <div className="compact-stat-grid">
            <div className="compact-stat-item">
              <span className="compact-stat-label">Aulas totais</span>
              <strong>{stats?.total_lessons}</strong>
            </div>
            <div className="compact-stat-item">
              <span className="compact-stat-label">Alunos ensinados</span>
              <strong>{stats?.students_taught}</strong>
            </div>
            <div className="compact-stat-item">
              <span className="compact-stat-label">Concluídas</span>
              <strong>{earnings?.completed_lessons}</strong>
            </div>
            <div className="compact-stat-item">
              <span className="compact-stat-label">Avaliação</span>
              <strong>⭐ {stats?.rating.toFixed(1)}</strong>
            </div>
          </div>
        </div>

        <div className="dashboard-card actions-card" id="concluidas">
          <div className="section-header-with-filter">
            <h3>🏁 Histórico</h3>
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
                    <strong>Data:</strong> {new Date(lesson.scheduled_start).toLocaleString("pt-BR")}
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
                      <strong>Nota:</strong> {lesson.review_rating ? lesson.review_rating : "Sem avaliação"}
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

        <div className="dashboard-card actions-card" id="avaliacoes">
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
