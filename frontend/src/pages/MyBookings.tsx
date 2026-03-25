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
    try {
      const data = await api.lessons.myBookings()
      const lessons: Lesson[] = Array.isArray(data) ? (data as Lesson[]) : []
      setBookings(lessons)

      const instructorIds = Array.from(
        new Set(lessons.map((lesson) => lesson.instructor_id))
      )

      const entries = await Promise.all(
        instructorIds.map(async (id) => {
          const instructor = await api.instructors.getById(id)
          return [id, instructor.name] as const
        })
      )

      setInstructorNames(Object.fromEntries(entries))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar agendamentos")
    } finally {
      setLoading(false)
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
      ) : error ? (
        <p className="booking-error">{error}</p>
      ) : sortedBookings.length === 0 ? (
        <p>Você ainda não possui agendamentos.</p>
      ) : (
        <div className="bookings-list">
          {sortedBookings.map((lesson) => {
            const start = new Date(lesson.scheduled_start)
            const end = new Date(lesson.scheduled_end)
            const durationHours = Math.round((end.getTime() - start.getTime()) / 36e5 * 10) / 10

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
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
