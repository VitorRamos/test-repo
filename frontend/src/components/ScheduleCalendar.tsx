import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  endOfMonth,
  endOfWeek,
  formatDateKey,
  formatMonthLabel,
  isSameMonth,
  parseDateKey,
  startOfMonth,
  startOfWeek,
  WEEKDAY_LABELS,
  type CalendarMarker
} from "../utils/calendar"
import "./ScheduleCalendar.css"

interface ScheduleCalendarProps {
  month: Date
  selectedDates: string[]
  activeDate?: string
  markersByDate: Record<string, CalendarMarker[]>
  onMonthChange: (nextMonth: Date) => void
  onSelectDate: (date: string) => void
  onRangeSelect?: (startDate: string, endDate: string, mode: "add" | "remove") => void
  title: string
  subtitle?: string
  toolbar?: ReactNode
  contextualPanel?: ReactNode
}

export function ScheduleCalendar({
  month,
  selectedDates,
  activeDate,
  markersByDate,
  onMonthChange,
  onSelectDate,
  onRangeSelect,
  title,
  subtitle,
  toolbar,
  contextualPanel
}: ScheduleCalendarProps) {
  const [dragState, setDragState] = useState<{
    anchor: string
    current: string
    mode: "add" | "remove"
    moved: boolean
  } | null>(null)
  const suppressClickRef = useRef(false)
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(monthEnd)
  const days: Date[] = []

  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor))
  }

  const previewSelectedDates = (() => {
    if (!dragState) {
      return selectedDates
    }

    const anchorDate = parseDateKey(dragState.anchor)
    const currentDate = parseDateKey(dragState.current)
    const [start, end] =
      anchorDate.getTime() <= currentDate.getTime()
        ? [anchorDate, currentDate]
        : [currentDate, anchorDate]

    const rangeDates: string[] = []
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      rangeDates.push(formatDateKey(cursor))
    }

    if (dragState.mode === "add") {
      return Array.from(new Set([...selectedDates, ...rangeDates]))
    }

    return selectedDates.filter((dateKey) => !rangeDates.includes(dateKey))
  })()

  useEffect(() => {
    if (!dragState) {
      return
    }

    const stopDragging = () => {
      if (dragState.moved) {
        suppressClickRef.current = true
        onRangeSelect?.(dragState.anchor, dragState.current, dragState.mode)
      }
      setDragState(null)
    }

    window.addEventListener("pointerup", stopDragging)
    return () => window.removeEventListener("pointerup", stopDragging)
  }, [dragState])

  return (
    <div className="schedule-calendar">
      <div className="schedule-calendar-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="schedule-calendar-toolbar">
          {toolbar}
          <div className="schedule-calendar-nav">
            <button type="button" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
              ‹
            </button>
            <strong>{formatMonthLabel(month)}</strong>
            <button type="button" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
              ›
            </button>
          </div>
        </div>
      </div>

      {contextualPanel && <div className="schedule-calendar-context">{contextualPanel}</div>}

      <div className="schedule-calendar-weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="schedule-calendar-grid">
        {days.map((day) => {
          const dateKey = formatDateKey(day)
          const markers = markersByDate[dateKey] || []
          const isSelected = previewSelectedDates.includes(dateKey)
          const isFocused = activeDate === dateKey && isSelected

          return (
            <button
              key={dateKey}
              type="button"
              className={`schedule-day${isSelected ? " selected" : ""}${isFocused ? " active" : ""}${isSameMonth(day, month) ? "" : " muted"}`}
              onPointerDown={() => {
                if (!onRangeSelect) {
                  return
                }
                setDragState({
                  anchor: dateKey,
                  current: dateKey,
                  mode: selectedDates.includes(dateKey) ? "remove" : "add",
                  moved: false
                })
              }}
              onPointerEnter={() => {
                if (!dragState || !onRangeSelect) {
                  return
                }
                setDragState((current) =>
                  current ? { ...current, current: dateKey, moved: current.anchor !== dateKey || current.moved } : current
                )
              }}
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false
                  return
                }
                onSelectDate(dateKey)
              }}
            >
              <span className="schedule-day-number">{day.getDate()}</span>
              <div className="schedule-day-markers">
                {markers.slice(0, 3).map((marker) => (
                  <span
                    key={`${dateKey}-${marker.tone}-${marker.label}`}
                    className={`schedule-marker ${marker.tone}`}
                    title={marker.label}
                  >
                    <span>{marker.label}</span>
                    {marker.count !== undefined && <strong>{marker.count}</strong>}
                  </span>
                ))}
                {markers.length > 3 && (
                  <span className="schedule-marker more">+{markers.length - 3}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
